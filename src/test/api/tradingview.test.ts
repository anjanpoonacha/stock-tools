import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST as telegramPOST } from '@/app/api/tradingview-telegram/route'
import { POST as watchlistsPOST } from '@/app/api/tradingview-watchlists/route'
import { POST as shortlistPOST } from '@/app/api/tv-shortlist/route'
import { SessionErrorType, ErrorSeverity, Platform } from '@/lib/sessionErrors'
import { 
  createMockRequest, 
  parseJsonResponse,
  expectErrorResponse,
  mockConsole,
  createTestSessionId
} from '../utils'

// Mock dependencies
vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: vi.fn(),
}))

vi.mock('@/lib/tradingview', () => ({
  fetchWatchlistsWithAuth: vi.fn(),
  appendSymbolToWatchlist: vi.fn(),
}))

vi.mock('@/lib/sessionValidation', () => ({
  validateAndStartMonitoring: vi.fn(),
  getHealthAwareSessionData: vi.fn(),
}))

vi.mock('@/lib/sessionStore', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({
  validateUserCredentials: vi.fn(),
  createErrorResponse: vi.fn(),
  createSuccessResponse: vi.fn(),
  getErrorMessage: vi.fn(),
  getErrorStatusCode: vi.fn(),
}))

vi.mock('@/lib/constants', () => ({
  LOG_PREFIXES: {
    API: '[API]'
  }
}))

describe('TradingView API', () => {
  const console = mockConsole()
  
  beforeEach(() => {
    vi.clearAllMocks()
    console.mock()
    // Set up environment variables for tests
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test_bot_token')
    vi.stubEnv('TELEGRAM_CHAT_ID', 'test_chat_id') 
    vi.stubEnv('TELEGRAM_TOPIC_ID', 'test_topic_id')
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    console.restore()
    vi.unstubAllEnvs()
  })

  describe('POST /api/tradingview-telegram', () => {
    it('should return 400 for missing sessionId in query params', async () => {
      const request = new NextRequest('http://localhost:3000/api/tradingview-telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Test alert'
        })
      })

      const response = await telegramPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Missing TradingView sessionId in query params')
    })

    it('should process JSON alert payload successfully', async () => {
      const { sendTelegramMessage } = await import('@/lib/telegram')
      const { fetchWatchlistsWithAuth, appendSymbolToWatchlist } = await import('@/lib/tradingview')
      
      const sessionId = 'test_session_123'
      const alertPayload = {
        message: 'RELIANCE buy signal triggered',
        text: 'Stock alert for RELIANCE',
        symbol: 'RELIANCE'
      }

      // Mock TradingView API responses
      vi.mocked(fetchWatchlistsWithAuth).mockResolvedValue([
        { id: 'wl_123', name: '0.TriggeredToday', symbols: [] }
      ])
      vi.mocked(appendSymbolToWatchlist).mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost:3000/api/tradingview-telegram?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertPayload)
      })

      const response = await telegramPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)

      // Verify Telegram message was not sent in test environment
      expect(sendTelegramMessage).not.toHaveBeenCalled()

      // Verify TradingView watchlist operations
      expect(fetchWatchlistsWithAuth).toHaveBeenCalledWith(
        'https://www.tradingview.com/api/v1/symbols_list/all/',
        `sessionid=${sessionId}`
      )
      expect(appendSymbolToWatchlist).toHaveBeenCalledWith(
        'wl_123',
        'NSE:RELIANCE',
        `sessionid=${sessionId}`
      )
    })

    it('should process text alert payload successfully', async () => {
      const { fetchWatchlistsWithAuth, appendSymbolToWatchlist } = await import('@/lib/tradingview')
      
      const sessionId = 'test_session_456'
      const alertText = 'INFY stock alert triggered - buy signal'

      // Mock TradingView API responses
      vi.mocked(fetchWatchlistsWithAuth).mockResolvedValue([
        { id: 'wl_456', name: '0.TriggeredToday', symbols: [] }
      ])
      vi.mocked(appendSymbolToWatchlist).mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost:3000/api/tradingview-telegram?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: alertText
      })

      const response = await telegramPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)

      // Verify TradingView watchlist operations with extracted symbol
      expect(fetchWatchlistsWithAuth).toHaveBeenCalledWith(
        'https://www.tradingview.com/api/v1/symbols_list/all/',
        `sessionid=${sessionId}`
      )
      expect(appendSymbolToWatchlist).toHaveBeenCalledWith(
        'wl_456',
        'NSE:INFY',
        `sessionid=${sessionId}`
      )
    })

    it('should handle missing watchlist gracefully', async () => {
      const { fetchWatchlistsWithAuth, appendSymbolToWatchlist } = await import('@/lib/tradingview')
      
      const sessionId = 'test_session_789'
      const alertPayload = {
        message: 'TCS buy signal triggered'
      }

      // Mock TradingView API responses - no matching watchlist
      vi.mocked(fetchWatchlistsWithAuth).mockResolvedValue([
        { id: 'wl_other', name: 'Other Watchlist', symbols: [] }
      ])

      const request = new NextRequest(`http://localhost:3000/api/tradingview-telegram?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertPayload)
      })

      const response = await telegramPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)

      // Verify watchlist fetch was attempted but append was not called
      expect(fetchWatchlistsWithAuth).toHaveBeenCalled()
      expect(appendSymbolToWatchlist).not.toHaveBeenCalled()
    })

    it('should handle TradingView API errors gracefully', async () => {
      const { fetchWatchlistsWithAuth } = await import('@/lib/tradingview')
      
      const sessionId = 'test_session_error'
      const alertPayload = {
        message: 'WIPRO buy signal triggered'
      }

      // Mock TradingView API error
      vi.mocked(fetchWatchlistsWithAuth).mockRejectedValue(new Error('TradingView API error'))

      const request = new NextRequest(`http://localhost:3000/api/tradingview-telegram?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertPayload)
      })

      const response = await telegramPOST(request)
      const result = await parseJsonResponse(response)

      // Should still succeed even if TradingView operations fail
      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)
    })

    it('should handle alerts without extractable symbols', async () => {
      const sessionId = 'test_session_no_symbol'
      const alertPayload = {
        message: 'Market alert - general notification without specific symbol'
      }

      const request = new NextRequest(`http://localhost:3000/api/tradingview-telegram?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertPayload)
      })

      const response = await telegramPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)

      // Verify no TradingView operations were attempted
      const { fetchWatchlistsWithAuth } = await import('@/lib/tradingview')
      expect(fetchWatchlistsWithAuth).not.toHaveBeenCalled()
    })

    it('should send Telegram message in production environment', async () => {
      const { sendTelegramMessage } = await import('@/lib/telegram')
      
      // Mock process.env directly since the API reads env vars at module load time
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        TELEGRAM_BOT_TOKEN: 'test_bot_token',
        TELEGRAM_CHAT_ID: 'test_chat_id',
        TELEGRAM_TOPIC_ID: 'test_topic_id'
      }
      
      // Re-import the module to pick up new environment variables
      vi.resetModules()
      const { POST: telegramPOSTWithEnv } = await import('@/app/api/tradingview-telegram/route')
      
      const sessionId = 'test_session_prod'
      const alertPayload = {
        message: 'Production alert test'
      }

      const request = new NextRequest(`http://localhost:3000/api/tradingview-telegram?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertPayload)
      })

      const response = await telegramPOSTWithEnv(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('ok', true)

      // Verify Telegram message was sent in production
      expect(sendTelegramMessage).toHaveBeenCalledWith(
        'test_bot_token',
        'test_chat_id',
        'Production alert test',
        'test_topic_id'
      )
      
      // Restore original environment
      process.env = originalEnv
    })

    it('should handle general errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/tradingview-telegram?sessionId=test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      })

      const response = await telegramPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(500)
      expect(result.data).toHaveProperty('error')
    })
  })

  describe('POST /api/tradingview-watchlists', () => {
    it('should return 400 for missing sessionid and internalSessionId', async () => {
      const request = createMockRequest('POST', '/api/tradingview-watchlists', {
        // Missing both sessionid and internalSessionId
      })

      const response = await watchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Missing sessionid or internalSessionId')
    })

    it('should fetch watchlists with direct sessionid', async () => {
      const { fetchWatchlistsWithAuth } = await import('@/lib/tradingview')
      
      const sessionId = 'direct_session_123'
      const mockWatchlists = [
        { id: 'wl_1', name: 'My Watchlist 1', symbols: [] },
        { id: 'wl_2', name: 'My Watchlist 2', symbols: [] }
      ]

      vi.mocked(fetchWatchlistsWithAuth).mockResolvedValue(mockWatchlists)

      const request = createMockRequest('POST', '/api/tradingview-watchlists', {
        sessionid: sessionId
      })

      const response = await watchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('watchlists', mockWatchlists)

      expect(fetchWatchlistsWithAuth).toHaveBeenCalledWith(
        'https://www.tradingview.com/api/v1/symbols_list/all/',
        `sessionid=${sessionId}`
      )
    })

    it('should fetch watchlists with internalSessionId and health monitoring', async () => {
      const { fetchWatchlistsWithAuth } = await import('@/lib/tradingview')
      const { validateAndStartMonitoring, getHealthAwareSessionData } = await import('@/lib/sessionValidation')
      const { getSession } = await import('@/lib/sessionStore')
      
      const internalSessionId = createTestSessionId('tv-internal')
      const actualSessionId = 'tv_session_456'
      const mockWatchlists = [
        { id: 'wl_3', name: 'TradingView Watchlist', symbols: [] }
      ]

      // Mock health-aware session data
      vi.mocked(getHealthAwareSessionData).mockResolvedValue({
        sessionExists: true,
        overallStatus: 'healthy',
        platforms: ['tradingview'],
        recommendations: [],
        healthReport: {},
        canAutoRecover: true,
        timestamp: new Date().toISOString()
      })

      // Mock validation and monitoring
      vi.mocked(validateAndStartMonitoring).mockResolvedValue({
        isValid: true,
        monitoringStarted: true,
        healthStatus: 'healthy',
        watchlists: []
      })

      // Mock session data retrieval
      vi.mocked(getSession).mockResolvedValue({
        tradingview: {
          sessionId: actualSessionId
        }
      })

      vi.mocked(fetchWatchlistsWithAuth).mockResolvedValue(mockWatchlists)

      const request = createMockRequest('POST', '/api/tradingview-watchlists', {
        internalSessionId
      })

      const response = await watchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('watchlists', mockWatchlists)
      expect(result.data).toHaveProperty('healthStatus', 'healthy')
      expect(result.data).toHaveProperty('monitoringActive', true)

      expect(getHealthAwareSessionData).toHaveBeenCalledWith(internalSessionId)
      expect(validateAndStartMonitoring).toHaveBeenCalledWith(internalSessionId, 'tradingview')
      expect(getSession).toHaveBeenCalledWith(internalSessionId)
      expect(fetchWatchlistsWithAuth).toHaveBeenCalledWith(
        'https://www.tradingview.com/api/v1/symbols_list/all/',
        `sessionid=${actualSessionId}`
      )
    })

    it('should return 401 when no TradingView session found', async () => {
      const { getHealthAwareSessionData } = await import('@/lib/sessionValidation')
      
      const internalSessionId = createTestSessionId('no-tv-session')

      // Mock health data without TradingView platform
      vi.mocked(getHealthAwareSessionData).mockResolvedValue({
        sessionExists: true,
        overallStatus: 'warning',
        platforms: ['marketinout'], // No TradingView
        recommendations: ['Add TradingView session'],
        healthReport: {},
        canAutoRecover: false,
        timestamp: new Date().toISOString()
      })

      const request = createMockRequest('POST', '/api/tradingview-watchlists', {
        internalSessionId
      })

      const response = await watchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'No TradingView session found.')
      expect(result.data).toHaveProperty('healthStatus', 'warning')
      expect(result.data).toHaveProperty('recommendations')
    })

    it('should return 401 when session validation fails', async () => {
      const { validateAndStartMonitoring, getHealthAwareSessionData } = await import('@/lib/sessionValidation')
      
      const internalSessionId = createTestSessionId('invalid-session')

      // Mock health data with TradingView platform
      vi.mocked(getHealthAwareSessionData).mockResolvedValue({
        sessionExists: true,
        overallStatus: 'healthy',
        platforms: ['tradingview'],
        recommendations: [],
        healthReport: {},
        canAutoRecover: true,
        timestamp: new Date().toISOString()
      })

      // Mock validation failure
      const mockError = {
        type: SessionErrorType.SESSION_EXPIRED,
        message: 'TradingView session expired',
        name: 'SessionError',
        severity: ErrorSeverity.ERROR,
        platform: Platform.TRADINGVIEW,
        context: {
          platform: Platform.TRADINGVIEW,
          operation: 'validation',
          timestamp: new Date()
        },
        recoverySteps: [],
        userMessage: 'TradingView session expired',
        technicalMessage: 'TradingView session expired',
        errorCode: 'TRADINGVIEW_SESSION_EXPIRED',
        timestamp: new Date(),
        code: 'TRADINGVIEW_SESSION_EXPIRED',
        canAutoRecover: () => false,
        getRecoveryInstructions: () => ['Please re-authenticate with TradingView'],
        shouldRetry: () => false,
        getRetryDelay: () => 0,
        toJSON: () => ({ message: 'TradingView session expired' }),
        getDisplayMessage: () => 'TradingView session expired',
        getTechnicalDetails: () => ({}),
        getAutomatedRecoveryActions: () => []
      }
      vi.mocked(validateAndStartMonitoring).mockResolvedValue({
        isValid: false,
        monitoringStarted: false,
        healthStatus: 'unhealthy',
        error: mockError,
        watchlists: []
      })

      const request = createMockRequest('POST', '/api/tradingview-watchlists', {
        internalSessionId
      })

      const response = await watchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'TradingView session expired')
      expect(result.data).toHaveProperty('canAutoRecover', false)
      expect(result.data).toHaveProperty('recoveryInstructions')
    })

    it('should return 401 when sessionid not found in session data', async () => {
      const { validateAndStartMonitoring, getHealthAwareSessionData } = await import('@/lib/sessionValidation')
      const { getSession } = await import('@/lib/sessionStore')
      
      const internalSessionId = createTestSessionId('no-sessionid')

      // Mock successful health and validation
      vi.mocked(getHealthAwareSessionData).mockResolvedValue({
        sessionExists: true,
        overallStatus: 'healthy',
        platforms: ['tradingview'],
        recommendations: [],
        healthReport: {},
        canAutoRecover: true,
        timestamp: new Date().toISOString()
      })

      vi.mocked(validateAndStartMonitoring).mockResolvedValue({
        isValid: true,
        monitoringStarted: true,
        healthStatus: 'healthy',
        watchlists: []
      })

      // Mock session data without TradingView sessionId
      vi.mocked(getSession).mockResolvedValue({
        tradingview: {
          sessionId: ''
        }
      })

      const request = createMockRequest('POST', '/api/tradingview-watchlists', {
        internalSessionId
      })

      const response = await watchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'TradingView sessionid not found in session data')
    })

    it('should handle TradingView API errors', async () => {
      const { fetchWatchlistsWithAuth } = await import('@/lib/tradingview')
      
      const sessionId = 'error_session'

      vi.mocked(fetchWatchlistsWithAuth).mockRejectedValue(new Error('TradingView API unavailable'))

      const request = createMockRequest('POST', '/api/tradingview-watchlists', {
        sessionid: sessionId
      })

      const response = await watchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 500, 'TradingView API unavailable')
    })
  })

  describe('POST /api/tv-shortlist', () => {
    it('should return 400 for missing url or sessionid', async () => {
      const { createErrorResponse } = await import('@/lib/apiAuth')
      
      vi.mocked(createErrorResponse).mockReturnValue(
        NextResponse.json({ error: 'Missing url or sessionid' }, { status: 400 })
      )

      const request = createMockRequest('POST', '/api/tv-shortlist', {
        userEmail: 'test@example.com',
        userPassword: 'password123'
        // Missing url and sessionid
      })

      await shortlistPOST(request)

      expect(createErrorResponse).toHaveBeenCalledWith('Missing url or sessionid', 400)
    })

    it('should fetch shortlist successfully with valid credentials', async () => {
      const { validateUserCredentials, createSuccessResponse } = await import('@/lib/apiAuth')
      const { fetchWatchlistsWithAuth } = await import('@/lib/tradingview')
      
      const mockSessionInfo = {
        internalId: createTestSessionId('shortlist'),
        isValid: true,
        key: 'test-key',
        value: 'test-value'
      }
      const mockWatchlists = [
        { id: 'sl_1', name: 'Shortlist 1', symbols: [] },
        { id: 'sl_2', name: 'Shortlist 2', symbols: [] }
      ]

      vi.mocked(validateUserCredentials).mockResolvedValue(mockSessionInfo)
      vi.mocked(fetchWatchlistsWithAuth).mockResolvedValue(mockWatchlists)
      vi.mocked(createSuccessResponse).mockReturnValue(
        NextResponse.json({ 
          watchlists: mockWatchlists,
          internalSessionId: mockSessionInfo.internalId 
        })
      )

      const request = createMockRequest('POST', '/api/tv-shortlist', {
        url: 'https://www.tradingview.com/api/v1/symbols_list/all/',
        sessionid: 'shortlist_session_123',
        userEmail: 'test@example.com',
        userPassword: 'password123'
      })

      await shortlistPOST(request)

      expect(validateUserCredentials).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(fetchWatchlistsWithAuth).toHaveBeenCalledWith(
        'https://www.tradingview.com/api/v1/symbols_list/all/',
        'sessionid=shortlist_session_123'
      )
      expect(createSuccessResponse).toHaveBeenCalledWith(
        { watchlists: mockWatchlists },
        mockSessionInfo.internalId
      )
    })

    it('should handle authentication errors', async () => {
      const { validateUserCredentials, getErrorMessage, getErrorStatusCode, createErrorResponse } = await import('@/lib/apiAuth')
      
      const authError = new Error('Invalid credentials')
      vi.mocked(validateUserCredentials).mockRejectedValue(authError)
      vi.mocked(getErrorMessage).mockReturnValue('Invalid credentials')
      vi.mocked(getErrorStatusCode).mockReturnValue(401)
      vi.mocked(createErrorResponse).mockReturnValue(
        NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      )

      const request = createMockRequest('POST', '/api/tv-shortlist', {
        url: 'https://www.tradingview.com/api/v1/symbols_list/all/',
        sessionid: 'invalid_session',
        userEmail: 'invalid@example.com',
        userPassword: 'wrongpassword'
      })

      await shortlistPOST(request)

      expect(validateUserCredentials).toHaveBeenCalledWith('invalid@example.com', 'wrongpassword')
      expect(getErrorMessage).toHaveBeenCalledWith(authError)
      expect(getErrorStatusCode).toHaveBeenCalledWith(authError)
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid credentials', 401, true)
    })

    it('should handle TradingView API errors', async () => {
      const { validateUserCredentials, getErrorMessage, getErrorStatusCode, createErrorResponse } = await import('@/lib/apiAuth')
      const { fetchWatchlistsWithAuth } = await import('@/lib/tradingview')
      
      const mockSessionInfo = {
        internalId: createTestSessionId('api-error'),
        isValid: true,
        key: 'test-key',
        value: 'test-value'
      }

      vi.mocked(validateUserCredentials).mockResolvedValue(mockSessionInfo)
      
      const apiError = new Error('TradingView service unavailable')
      vi.mocked(fetchWatchlistsWithAuth).mockRejectedValue(apiError)
      vi.mocked(getErrorMessage).mockReturnValue('TradingView service unavailable')
      vi.mocked(getErrorStatusCode).mockReturnValue(500)
      vi.mocked(createErrorResponse).mockReturnValue(
        NextResponse.json({ error: 'TradingView service unavailable' }, { status: 500 })
      )

      const request = createMockRequest('POST', '/api/tv-shortlist', {
        url: 'https://www.tradingview.com/api/v1/symbols_list/all/',
        sessionid: 'valid_session',
        userEmail: 'test@example.com',
        userPassword: 'password123'
      })

      await shortlistPOST(request)

      expect(validateUserCredentials).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(fetchWatchlistsWithAuth).toHaveBeenCalled()
      expect(getErrorMessage).toHaveBeenCalledWith(apiError)
      expect(getErrorStatusCode).toHaveBeenCalledWith(apiError)
      expect(createErrorResponse).toHaveBeenCalledWith('TradingView service unavailable', 500, false)
    })
  })
})
