import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as pingGET, OPTIONS as pingOPTIONS } from '@/app/api/extension/ping/route'
import { GET as sessionGET, POST as sessionPOST, OPTIONS as sessionOPTIONS } from '@/app/api/extension/session/route'
import { 
  createMockRequest, 
  parseJsonResponse,
  expectErrorResponse,
  mockConsole,
  createTestSessionId
} from '../utils'

// Mock dependencies
vi.mock('@/lib/sessionStore', () => ({
  savePlatformSessionWithCleanup: vi.fn(),
  generateSessionId: vi.fn(),
}))

vi.mock('@/lib/cookieParser', () => ({
  CookieParser: {
    validateCookieFormat: vi.fn(),
    sanitizeCookieValue: vi.fn(),
    extractASPSESSION: vi.fn(),
    isASPSESSIONCookie: vi.fn(),
  },
}))

vi.mock('@/lib/sessionValidation', () => ({
  validateAndStartMonitoring: vi.fn(),
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('Extension API', () => {
  const console = mockConsole()
  
  beforeEach(() => {
    vi.clearAllMocks()
    console.mock()
    // Reset fetch mock
    vi.mocked(global.fetch).mockReset()
  })

  afterEach(() => {
    console.restore()
  })

  describe('GET /api/extension/ping', () => {
    it('should return ping response with correct structure', async () => {
      const response = await pingGET()
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('status', 'ok')
      expect(result.data).toHaveProperty('service', 'mio-trading-app')
      expect(result.data).toHaveProperty('timestamp')
      expect(result.data).toHaveProperty('message', 'Extension API is reachable')

      // Verify timestamp is valid ISO string
      expect(typeof result.data.timestamp).toBe('string')
      expect(() => new Date(result.data.timestamp as string)).not.toThrow()

      // Check CORS headers
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
    })

    it('should handle OPTIONS request for CORS preflight', async () => {
      const response = await pingOPTIONS()

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400')
    })
  })

  describe('GET /api/extension/session', () => {
    it('should return session service status', async () => {
      const response = await sessionGET()
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('status', 'ok')
      expect(result.data).toHaveProperty('service', 'multi-platform-session-extractor-api')
      expect(result.data).toHaveProperty('supportedPlatforms')
      expect(result.data).toHaveProperty('timestamp')

      // Verify supported platforms
      expect(Array.isArray(result.data.supportedPlatforms)).toBe(true)
      expect(result.data.supportedPlatforms).toContain('marketinout')
      expect(result.data.supportedPlatforms).toContain('tradingview')
      expect(result.data.supportedPlatforms).not.toContain('unknown')

      // Check CORS headers
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })

    it('should handle OPTIONS request for CORS preflight', async () => {
      const response = await sessionOPTIONS()

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400')
    })
  })

  describe('POST /api/extension/session', () => {
    it('should return 401 for missing user credentials', async () => {
      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey: 'ASPSESSIONIDCQTQTQTQ',
        sessionValue: 'ABCDEFGHIJKLMNOP'
        // Missing userEmail and userPassword
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Authentication required')
      expect(result.data).toHaveProperty('details', 'User email and password required to submit session data')
      expect(result.data).toHaveProperty('success', false)
    })

    it('should return 400 for missing sessionKey', async () => {
      const request = createMockRequest('POST', '/api/extension/session', {
        sessionValue: 'ABCDEFGHIJKLMNOP',
        userEmail: 'test@example.com',
        userPassword: 'password123'
        // Missing sessionKey
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Missing sessionKey or sessionValue')
      expect(result.data).toHaveProperty('success', false)
    })

    it('should return 400 for missing sessionValue', async () => {
      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey: 'ASPSESSIONIDCQTQTQTQ',
        userEmail: 'test@example.com',
        userPassword: 'password123'
        // Missing sessionValue
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Missing sessionKey or sessionValue')
      expect(result.data).toHaveProperty('success', false)
    })

    it('should return 400 for invalid cookie format', async () => {
      const { CookieParser } = await import('@/lib/cookieParser')
      
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(false)

      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey: 'invalid-cookie-name!',
        sessionValue: 'ABCDEFGHIJKLMNOP',
        userEmail: 'test@example.com',
        userPassword: 'password123'
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Invalid cookie format')
      expect(result.data).toHaveProperty('details', 'Cookie name or value contains invalid characters or exceeds length limits')
      expect(result.data).toHaveProperty('success', false)
    })

    it('should successfully bridge MIO session with valid credentials', async () => {
      const { savePlatformSessionWithCleanup, generateSessionId } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      const { validateAndStartMonitoring } = await import('@/lib/sessionValidation')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'ABCDEFGHIJKLMNOP'
      const internalSessionId = createTestSessionId('extension')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)
      vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ [sessionKey]: sessionValue })
      vi.mocked(CookieParser.isASPSESSIONCookie).mockReturnValue(true)
      vi.mocked(generateSessionId).mockReturnValue(internalSessionId)
      vi.mocked(savePlatformSessionWithCleanup).mockResolvedValue(internalSessionId)
      vi.mocked(validateAndStartMonitoring).mockResolvedValue({
        isValid: true,
        monitoringStarted: true,
        healthStatus: 'healthy',
        watchlists: []
      })

      // Mock successful MIO validation
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>watchlist page with sel_wlid</html>'),
        headers: new Headers()
      } as Response)

      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey,
        sessionValue,
        userEmail: 'test@example.com',
        userPassword: 'password123',
        url: 'https://www.marketinout.com/wl/watch_list.php',
        platform: 'marketinout'
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('internalSessionId', internalSessionId)
      expect(result.data).toHaveProperty('sessionKey', sessionKey)
      expect(result.data).toHaveProperty('platform', 'marketinout')
      expect(result.data).toHaveProperty('healthMonitoringActive', true)
      expect(result.data).toHaveProperty('message')

      expect(savePlatformSessionWithCleanup).toHaveBeenCalledWith(
        internalSessionId,
        'marketinout',
        expect.objectContaining({
          sessionId: sessionValue,
          [sessionKey]: sessionValue,
          userEmail: 'test@example.com',
          userPassword: 'password123',
          platform: 'marketinout',
          source: 'extension'
        })
      )

      expect(validateAndStartMonitoring).toHaveBeenCalledWith(internalSessionId, 'marketinout')

      // Check that session cookie is set
      const setCookieHeader = response.headers.get('set-cookie')
      expect(setCookieHeader).toContain(`myAppToken=${internalSessionId}`)
      expect(setCookieHeader).toContain('HttpOnly')
    })

    it('should successfully bridge TradingView session', async () => {
      const { savePlatformSessionWithCleanup, generateSessionId } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      
      const sessionKey = 'sessionid'
      const sessionValue = 'tv_session_value_123'
      const internalSessionId = createTestSessionId('tv-extension')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)
      vi.mocked(generateSessionId).mockReturnValue(internalSessionId)
      vi.mocked(savePlatformSessionWithCleanup).mockResolvedValue(internalSessionId)

      // Mock successful TradingView validation
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'user123', username: 'testuser' }),
        headers: new Headers()
      } as Response)

      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey,
        sessionValue,
        userEmail: 'test@tradingview.com',
        userPassword: 'tvpassword',
        url: 'https://www.tradingview.com/chart/',
        platform: 'tradingview'
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('internalSessionId', internalSessionId)
      expect(result.data).toHaveProperty('platform', 'tradingview')
      expect(result.data).toHaveProperty('healthMonitoringActive', false) // TradingView doesn't have health monitoring

      expect(savePlatformSessionWithCleanup).toHaveBeenCalledWith(
        internalSessionId,
        'tradingview',
        expect.objectContaining({
          sessionId: sessionValue,
          [sessionKey]: sessionValue,
          platform: 'tradingview',
          source: 'extension'
        })
      )
    })

    it('should return 401 for invalid MIO session (redirect to login)', async () => {
      const { CookieParser } = await import('@/lib/cookieParser')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'INVALID_SESSION'

      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)

      // Mock redirect to login page
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 302,
        headers: new Headers({
          'location': 'https://www.marketinout.com/login.php'
        })
      } as Response)

      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey,
        sessionValue,
        userEmail: 'test@example.com',
        userPassword: 'password123',
        platform: 'marketinout'
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Invalid session credentials')
      expect(result.data).toHaveProperty('details', 'Session expired or invalid - redirected to login page')
      expect(result.data).toHaveProperty('platform', 'marketinout')
      expect(result.data).toHaveProperty('success', false)
    })

    it('should return 401 for invalid TradingView session', async () => {
      const { CookieParser } = await import('@/lib/cookieParser')
      
      const sessionKey = 'sessionid'
      const sessionValue = 'invalid_tv_session'

      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)

      // Mock authentication failure
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers()
      } as Response)

      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey,
        sessionValue,
        userEmail: 'test@tradingview.com',
        userPassword: 'password123',
        platform: 'tradingview'
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Invalid session credentials')
      expect(result.data).toHaveProperty('details', 'Session invalid - authentication required')
      expect(result.data).toHaveProperty('platform', 'tradingview')
      expect(result.data).toHaveProperty('success', false)
    })

    it('should handle network error during validation', async () => {
      const { CookieParser } = await import('@/lib/cookieParser')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'ABCDEFGHIJKLMNOP'

      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)

      // Mock network error
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network connection failed'))

      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey,
        sessionValue,
        userEmail: 'test@example.com',
        userPassword: 'password123',
        platform: 'marketinout'
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Invalid session credentials')
      expect(result.data).toHaveProperty('details', 'Network error during validation: Network connection failed')
      expect(result.data).toHaveProperty('success', false)
    })

    it('should detect platform from URL when not provided', async () => {
      const { savePlatformSessionWithCleanup, generateSessionId } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'ABCDEFGHIJKLMNOP'
      const internalSessionId = createTestSessionId('auto-detect')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)
      vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ [sessionKey]: sessionValue })
      vi.mocked(generateSessionId).mockReturnValue(internalSessionId)
      vi.mocked(savePlatformSessionWithCleanup).mockResolvedValue(internalSessionId)

      // Mock successful MIO validation
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>watchlist page with sel_wlid</html>'),
        headers: new Headers()
      } as Response)

      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey,
        sessionValue,
        userEmail: 'test@example.com',
        userPassword: 'password123',
        url: 'https://www.marketinout.com/wl/watch_list.php'
        // No platform provided - should be auto-detected from URL
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('platform', 'marketinout') // Auto-detected from URL

      expect(savePlatformSessionWithCleanup).toHaveBeenCalledWith(
        internalSessionId,
        'marketinout', // Auto-detected platform
        expect.objectContaining({
          platform: 'marketinout'
        })
      )
    })

    it('should handle cookie sanitization', async () => {
      const { savePlatformSessionWithCleanup, generateSessionId } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'UNSAFE<script>alert("xss")</script>VALUE'
      const sanitizedValue = 'UNSAFESCRIPTALERTXSSSCRIPTVALUE'
      const internalSessionId = createTestSessionId('sanitize')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sanitizedValue)
      vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ [sessionKey]: sanitizedValue })
      vi.mocked(generateSessionId).mockReturnValue(internalSessionId)
      vi.mocked(savePlatformSessionWithCleanup).mockResolvedValue(internalSessionId)

      // Mock successful MIO validation
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>watchlist page with sel_wlid</html>'),
        headers: new Headers()
      } as Response)

      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey,
        sessionValue,
        userEmail: 'test@example.com',
        userPassword: 'password123',
        platform: 'marketinout'
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(CookieParser.sanitizeCookieValue).toHaveBeenCalledWith(sessionValue)
      
      // Verify sanitized value is used in session data
      expect(savePlatformSessionWithCleanup).toHaveBeenCalledWith(
        internalSessionId,
        'marketinout',
        expect.objectContaining({
          sessionId: sanitizedValue,
          [sessionKey]: sanitizedValue
        })
      )
    })

    it('should handle health monitoring failure gracefully', async () => {
      const { savePlatformSessionWithCleanup, generateSessionId } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      const { validateAndStartMonitoring } = await import('@/lib/sessionValidation')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'ABCDEFGHIJKLMNOP'
      const internalSessionId = createTestSessionId('health-fail')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)
      vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ [sessionKey]: sessionValue })
      vi.mocked(generateSessionId).mockReturnValue(internalSessionId)
      vi.mocked(savePlatformSessionWithCleanup).mockResolvedValue(internalSessionId)
      
      // Mock health monitoring failure
      vi.mocked(validateAndStartMonitoring).mockRejectedValue(new Error('Health monitoring service unavailable'))

      // Mock successful MIO validation
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>watchlist page with sel_wlid</html>'),
        headers: new Headers()
      } as Response)

      const request = createMockRequest('POST', '/api/extension/session', {
        sessionKey,
        sessionValue,
        userEmail: 'test@example.com',
        userPassword: 'password123',
        platform: 'marketinout'
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      // Should still succeed even if health monitoring fails
      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('internalSessionId', internalSessionId)
      expect(result.data).toHaveProperty('healthMonitoringActive', false) // Failed to start

      expect(savePlatformSessionWithCleanup).toHaveBeenCalled()
    })

    it('should reuse existing internal session ID from cookie', async () => {
      const { savePlatformSessionWithCleanup } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'ABCDEFGHIJKLMNOP'
      const existingSessionId = createTestSessionId('existing')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)
      vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ [sessionKey]: sessionValue })
      vi.mocked(savePlatformSessionWithCleanup).mockResolvedValue(existingSessionId)

      // Mock successful MIO validation
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>watchlist page with sel_wlid</html>'),
        headers: new Headers()
      } as Response)

      // Create request with existing session cookie
      const request = new NextRequest('http://localhost:3000/api/extension/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `myAppToken=${existingSessionId}`
        },
        body: JSON.stringify({
          sessionKey,
          sessionValue,
          userEmail: 'test@example.com',
          userPassword: 'password123',
          platform: 'marketinout'
        })
      })

      const response = await sessionPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('internalSessionId', existingSessionId)

      expect(savePlatformSessionWithCleanup).toHaveBeenCalledWith(
        existingSessionId,
        'marketinout',
        expect.objectContaining({
          sessionId: sessionValue,
          [sessionKey]: sessionValue
        })
      )
    })
  })
})
