import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as logoutPOST } from '@/app/api/auth/logout/route'
import { POST as sessionBridgePOST } from '@/app/api/auth/session-bridge/route'
import { 
  createMockRequest, 
  parseJsonResponse,
  expectErrorResponse,
  mockConsole,
  createTestSessionId
} from '../utils'

// Mock dependencies
vi.mock('@/lib/sessionStore', () => ({
  deleteSession: vi.fn(),
  savePlatformSession: vi.fn(),
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

describe('Authentication API', () => {
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

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid session cookie', async () => {
      const { deleteSession } = await import('@/lib/sessionStore')
      const sessionId = createTestSessionId('logout')

      // Create request with session cookie
      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `myAppToken=${sessionId}`
        }
      })

      const response = await logoutPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)
      expect(deleteSession).toHaveBeenCalledWith(sessionId)

      // Check that cookie is cleared
      const setCookieHeader = response.headers.get('set-cookie')
      expect(setCookieHeader).toContain('myAppToken=')
      expect(setCookieHeader).toContain('Max-Age=0')
    })

    it('should logout successfully without session cookie', async () => {
      const { deleteSession } = await import('@/lib/sessionStore')

      // Create request without session cookie
      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await logoutPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)
      expect(deleteSession).not.toHaveBeenCalled()

      // Check that cookie is still cleared
      const setCookieHeader = response.headers.get('set-cookie')
      expect(setCookieHeader).toContain('myAppToken=')
      expect(setCookieHeader).toContain('Max-Age=0')
    })
  })

  describe('POST /api/auth/session-bridge', () => {
    it('should bridge valid MIO session successfully', async () => {
      const { savePlatformSession, generateSessionId } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      const { validateAndStartMonitoring } = await import('@/lib/sessionValidation')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'ABCDEFGHIJKLMNOP'
      const internalSessionId = createTestSessionId('bridge')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)
      vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ [sessionKey]: sessionValue })
      vi.mocked(CookieParser.isASPSESSIONCookie).mockReturnValue(true)
      vi.mocked(generateSessionId).mockReturnValue(internalSessionId)
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

      const request = createMockRequest('POST', '/api/auth/session-bridge', {
        sessionKey,
        sessionValue
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)
      expect(result.data).toHaveProperty('internalSessionId', internalSessionId)
      expect(result.data).toHaveProperty('healthMonitoringActive', true)

      expect(savePlatformSession).toHaveBeenCalledWith(
        internalSessionId,
        'marketinout',
        {
          sessionId: sessionValue,
          [sessionKey]: sessionValue
        }
      )

      expect(validateAndStartMonitoring).toHaveBeenCalledWith(internalSessionId, 'marketinout')

      // Check that session cookie is set
      const setCookieHeader = response.headers.get('set-cookie')
      expect(setCookieHeader).toContain(`myAppToken=${internalSessionId}`)
      expect(setCookieHeader).toContain('HttpOnly')
    })

    it('should reuse existing internal session ID from cookie', async () => {
      const { savePlatformSession } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      const { validateAndStartMonitoring } = await import('@/lib/sessionValidation')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'ABCDEFGHIJKLMNOP'
      const existingSessionId = createTestSessionId('existing')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)
      vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ [sessionKey]: sessionValue })
      vi.mocked(CookieParser.isASPSESSIONCookie).mockReturnValue(true)
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

      // Create request with existing session cookie
      const request = new NextRequest('http://localhost:3000/api/auth/session-bridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `myAppToken=${existingSessionId}`
        },
        body: JSON.stringify({
          sessionKey,
          sessionValue
        })
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('internalSessionId', existingSessionId)

      expect(savePlatformSession).toHaveBeenCalledWith(
        existingSessionId,
        'marketinout',
        {
          sessionId: sessionValue,
          [sessionKey]: sessionValue
        }
      )
    })

    it('should return 400 for invalid JSON request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/session-bridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Invalid JSON in request body')
    })

    it('should return 400 for missing sessionKey', async () => {
      const request = createMockRequest('POST', '/api/auth/session-bridge', {
        sessionValue: 'ABCDEFGHIJKLMNOP'
        // Missing sessionKey
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Missing sessionKey or sessionValue')
    })

    it('should return 400 for missing sessionValue', async () => {
      const request = createMockRequest('POST', '/api/auth/session-bridge', {
        sessionKey: 'ASPSESSIONIDCQTQTQTQ'
        // Missing sessionValue
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Missing sessionKey or sessionValue')
    })

    it('should return 400 for invalid cookie format', async () => {
      const { CookieParser } = await import('@/lib/cookieParser')
      
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(false)

      const request = createMockRequest('POST', '/api/auth/session-bridge', {
        sessionKey: 'invalid-cookie-name!',
        sessionValue: 'ABCDEFGHIJKLMNOP'
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Invalid cookie format')
      expect(result.data).toHaveProperty('details', 'Cookie name or value contains invalid characters or exceeds length limits')
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

      const request = createMockRequest('POST', '/api/auth/session-bridge', {
        sessionKey,
        sessionValue
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Invalid session credentials')
      expect(result.data).toHaveProperty('details', 'Session expired or invalid - redirected to login page')
    })

    it('should return 401 for invalid MIO session (login page content)', async () => {
      const { CookieParser } = await import('@/lib/cookieParser')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'INVALID_SESSION'

      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)

      // Mock login page response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html><form>login form with username and password fields</form></html>'),
        headers: new Headers()
      } as Response)

      const request = createMockRequest('POST', '/api/auth/session-bridge', {
        sessionKey,
        sessionValue
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Invalid session credentials')
      expect(result.data).toHaveProperty('details', 'Session invalid - login required')
    })

    it('should return 401 for network error during validation', async () => {
      const { CookieParser } = await import('@/lib/cookieParser')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'ABCDEFGHIJKLMNOP'

      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)

      // Mock network error
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network connection failed'))

      const request = createMockRequest('POST', '/api/auth/session-bridge', {
        sessionKey,
        sessionValue
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Invalid session credentials')
      expect(result.data).toHaveProperty('details', 'Network error during validation: Network connection failed')
    })

    it('should handle cookie sanitization', async () => {
      const { savePlatformSession, generateSessionId } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      const { validateAndStartMonitoring } = await import('@/lib/sessionValidation')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'UNSAFE<script>alert("xss")</script>VALUE'
      const sanitizedValue = 'UNSAFESCRIPTALERTXSSSCRIPTVALUE'
      const internalSessionId = createTestSessionId('sanitize')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sanitizedValue)
      vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ [sessionKey]: sanitizedValue })
      vi.mocked(CookieParser.isASPSESSIONCookie).mockReturnValue(true)
      vi.mocked(generateSessionId).mockReturnValue(internalSessionId)
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

      const request = createMockRequest('POST', '/api/auth/session-bridge', {
        sessionKey,
        sessionValue
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(CookieParser.sanitizeCookieValue).toHaveBeenCalledWith(sessionValue)
      
      // Verify sanitized value is used in session data
      expect(savePlatformSession).toHaveBeenCalledWith(
        internalSessionId,
        'marketinout',
        {
          sessionId: sanitizedValue,
          [sessionKey]: sanitizedValue
        }
      )
    })

    it('should handle health monitoring failure gracefully', async () => {
      const { savePlatformSession, generateSessionId } = await import('@/lib/sessionStore')
      const { CookieParser } = await import('@/lib/cookieParser')
      const { validateAndStartMonitoring } = await import('@/lib/sessionValidation')
      
      const sessionKey = 'ASPSESSIONIDCQTQTQTQ'
      const sessionValue = 'ABCDEFGHIJKLMNOP'
      const internalSessionId = createTestSessionId('health-fail')

      // Mock dependencies
      vi.mocked(CookieParser.validateCookieFormat).mockReturnValue(true)
      vi.mocked(CookieParser.sanitizeCookieValue).mockReturnValue(sessionValue)
      vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ [sessionKey]: sessionValue })
      vi.mocked(CookieParser.isASPSESSIONCookie).mockReturnValue(true)
      vi.mocked(generateSessionId).mockReturnValue(internalSessionId)
      
      // Mock health monitoring failure
      vi.mocked(validateAndStartMonitoring).mockRejectedValue(new Error('Health monitoring service unavailable'))

      // Mock successful MIO validation
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>watchlist page with sel_wlid</html>'),
        headers: new Headers()
      } as Response)

      const request = createMockRequest('POST', '/api/auth/session-bridge', {
        sessionKey,
        sessionValue
      })

      const response = await sessionBridgePOST(request)
      const result = await parseJsonResponse(response)

      // Should still succeed even if health monitoring fails
      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)
      expect(result.data).toHaveProperty('internalSessionId', internalSessionId)
      expect(result.data).toHaveProperty('healthMonitoringActive', true)

      expect(savePlatformSession).toHaveBeenCalled()
    })
  })
})
