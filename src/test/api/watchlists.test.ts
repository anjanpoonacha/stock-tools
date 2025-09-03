import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET, POST } from '@/app/api/watchlists/route'
import { 
  createMockRequest, 
  parseJsonResponse,
  expectErrorResponse,
  mockConsole,
  createMockUserCredentials
} from '../utils'

// Mock dependencies
vi.mock('@/lib/SessionResolver', () => ({
  SessionResolver: {
    hasSessionsForPlatformAndUser: vi.fn(),
    getLatestMIOSessionForUser: vi.fn(),
    getLatestSessionForUser: vi.fn(),
  },
}))

describe('Watchlists API', () => {
  const console = mockConsole()
  
  beforeEach(() => {
    vi.clearAllMocks()
    console.mock()
  })

  afterEach(() => {
    console.restore()
  })

  describe('POST /api/watchlists', () => {
    it('should fetch watchlists from both platforms successfully', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock both platforms available
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockResolvedValueOnce(true) // MIO
        .mockResolvedValueOnce(true) // TradingView

      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue({
        key: 'ASPSESSIONIDCQTQTQTQ',
        value: 'mio-session-123',
        internalId: 'internal-mio-123'
      })

      vi.mocked(SessionResolver.getLatestSessionForUser).mockResolvedValue({
        sessionData: { sessionId: 'tv-session-456' },
        internalId: 'internal-tv-456'
      })

      const request = createMockRequest('POST', '/api/watchlists', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('userEmail', credentials.userEmail)
      expect(result.data).toHaveProperty('totalWatchlists', 4) // 2 MIO + 2 TV
      expect(result.data.platforms.mio).toHaveProperty('available', true)
      expect(result.data.platforms.tradingview).toHaveProperty('available', true)
      expect(result.data.platforms.mio.watchlists).toHaveLength(2)
      expect(result.data.platforms.tradingview.watchlists).toHaveLength(2)
      expect(result.data.message).toContain('Successfully fetched watchlists from both platforms')
    })

    it('should fetch watchlists from MIO only when TradingView unavailable', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock only MIO available
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockResolvedValueOnce(true) // MIO
        .mockResolvedValueOnce(false) // TradingView

      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue({
        key: 'ASPSESSIONIDCQTQTQTQ',
        value: 'mio-session-123',
        internalId: 'internal-mio-123'
      })

      const request = createMockRequest('POST', '/api/watchlists', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('totalWatchlists', 2) // 2 MIO only
      expect(result.data.platforms.mio).toHaveProperty('available', true)
      expect(result.data.platforms.tradingview).toHaveProperty('available', false)
      expect(result.data.platforms.mio.watchlists).toHaveLength(2)
      expect(result.data.platforms.tradingview.watchlists).toBeUndefined()
      expect(result.data.message).toContain('Fetched 2 watchlists from MIO')
      expect(result.data.message).toContain('TradingView unavailable')
    })

    it('should fetch watchlists from TradingView only when MIO unavailable', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock only TradingView available
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockResolvedValueOnce(false) // MIO
        .mockResolvedValueOnce(true) // TradingView

      vi.mocked(SessionResolver.getLatestSessionForUser).mockResolvedValue({
        sessionData: { sessionId: 'tv-session-456' },
        internalId: 'internal-tv-456'
      })

      const request = createMockRequest('POST', '/api/watchlists', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('totalWatchlists', 2) // 2 TV only
      expect(result.data.platforms.mio).toHaveProperty('available', false)
      expect(result.data.platforms.tradingview).toHaveProperty('available', true)
      expect(result.data.platforms.mio.watchlists).toBeUndefined()
      expect(result.data.platforms.tradingview.watchlists).toHaveLength(2)
      expect(result.data.message).toContain('Fetched 2 watchlists from TradingView')
      expect(result.data.message).toContain('MIO unavailable')
    })

    it('should return failure when no platforms are available', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock both platforms unavailable
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockResolvedValueOnce(false) // MIO
        .mockResolvedValueOnce(false) // TradingView

      const request = createMockRequest('POST', '/api/watchlists', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', false)
      expect(result.data).toHaveProperty('totalWatchlists', 0)
      expect(result.data.platforms.mio).toHaveProperty('available', false)
      expect(result.data.platforms.tradingview).toHaveProperty('available', false)
      expect(result.data.message).toContain('No watchlists available from either platform')
    })

    it('should handle MIO session error gracefully', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock MIO error, TradingView success
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockRejectedValueOnce(new Error('MIO connection failed'))
        .mockResolvedValueOnce(true) // TradingView

      vi.mocked(SessionResolver.getLatestSessionForUser).mockResolvedValue({
        sessionData: { sessionId: 'tv-session-456' },
        internalId: 'internal-tv-456'
      })

      const request = createMockRequest('POST', '/api/watchlists', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data.platforms.mio).toHaveProperty('available', false)
      expect(result.data.platforms.mio).toHaveProperty('error', 'MIO connection failed')
      expect(result.data.platforms.tradingview).toHaveProperty('available', true)
      expect(result.data.platforms.tradingview.watchlists).toHaveLength(2)
    })

    it('should handle TradingView session error gracefully', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock MIO success, TradingView error
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockResolvedValueOnce(true) // MIO
        .mockRejectedValueOnce(new Error('TradingView timeout'))

      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue({
        key: 'ASPSESSIONIDCQTQTQTQ',
        value: 'mio-session-123',
        internalId: 'internal-mio-123'
      })

      const request = createMockRequest('POST', '/api/watchlists', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data.platforms.mio).toHaveProperty('available', true)
      expect(result.data.platforms.mio.watchlists).toHaveLength(2)
      expect(result.data.platforms.tradingview).toHaveProperty('available', false)
      expect(result.data.platforms.tradingview).toHaveProperty('error', 'TradingView timeout')
    })

    it('should validate watchlist data structure', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockResolvedValueOnce(true) // MIO
        .mockResolvedValueOnce(false) // TradingView

      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue({
        key: 'ASPSESSIONIDCQTQTQTQ',
        value: 'mio-session-123',
        internalId: 'internal-mio-123'
      })

      const request = createMockRequest('POST', '/api/watchlists', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data.platforms.mio.watchlists).toBeDefined()
      
      const mioWatchlists = result.data.platforms.mio.watchlists
      expect(mioWatchlists).toHaveLength(2)
      
      // Validate first watchlist structure
      const firstWatchlist = mioWatchlists[0]
      expect(firstWatchlist).toHaveProperty('id')
      expect(firstWatchlist).toHaveProperty('name')
      expect(firstWatchlist).toHaveProperty('symbols')
      expect(firstWatchlist).toHaveProperty('createdAt')
      expect(firstWatchlist).toHaveProperty('updatedAt')
      expect(firstWatchlist).toHaveProperty('owner', credentials.userEmail)
      expect(Array.isArray(firstWatchlist.symbols)).toBe(true)
      expect(firstWatchlist.symbols.length).toBeGreaterThan(0)
    })

    it('should return 400 for invalid credentials', async () => {
      const invalidCredentials = {
        userEmail: '', // Invalid empty email
        userPassword: 'password123'
      }

      const request = createMockRequest('POST', '/api/watchlists', invalidCredentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Invalid request data')
      expect(result.data).toHaveProperty('details')
    })

    it('should return 400 for missing password', async () => {
      const invalidCredentials = {
        userEmail: 'test@example.com',
        userPassword: '' // Invalid empty password
      }

      const request = createMockRequest('POST', '/api/watchlists', invalidCredentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Invalid request data')
      expect(result.data).toHaveProperty('details')
    })

    it('should handle platform errors gracefully and return success false', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock both platforms throwing errors
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockRejectedValueOnce(new Error('MIO database connection failed'))
        .mockRejectedValueOnce(new Error('TradingView service unavailable'))

      const request = createMockRequest('POST', '/api/watchlists', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', false)
      expect(result.data).toHaveProperty('totalWatchlists', 0)
      expect(result.data.platforms.mio).toHaveProperty('available', false)
      expect(result.data.platforms.mio).toHaveProperty('error', 'MIO database connection failed')
      expect(result.data.platforms.tradingview).toHaveProperty('available', false)
      expect(result.data.platforms.tradingview).toHaveProperty('error', 'TradingView service unavailable')
      expect(result.data.message).toContain('No watchlists available from either platform')
    })
  })

  describe('GET /api/watchlists', () => {
    it('should return platform availability for valid credentials', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock both platforms available
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockResolvedValueOnce(true) // MIO
        .mockResolvedValueOnce(true) // TradingView

      const request = createMockRequest('GET', '/api/watchlists', undefined, {
        userEmail: credentials.userEmail,
        userPassword: credentials.userPassword
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('userEmail', credentials.userEmail)
      expect(result.data.platforms.mio).toHaveProperty('available', true)
      expect(result.data.platforms.mio).toHaveProperty('sessionCount', 1)
      expect(result.data.platforms.tradingview).toHaveProperty('available', true)
      expect(result.data.platforms.tradingview).toHaveProperty('sessionCount', 1)
      expect(result.data.message).toContain('MIO available')
      expect(result.data.message).toContain('TradingView available')
    })

    it('should return mixed platform availability', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock only MIO available
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockResolvedValueOnce(true) // MIO
        .mockResolvedValueOnce(false) // TradingView

      const request = createMockRequest('GET', '/api/watchlists', undefined, {
        userEmail: credentials.userEmail,
        userPassword: credentials.userPassword
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data.platforms.mio).toHaveProperty('available', true)
      expect(result.data.platforms.mio).toHaveProperty('sessionCount', 1)
      expect(result.data.platforms.tradingview).toHaveProperty('available', false)
      expect(result.data.platforms.tradingview).toHaveProperty('sessionCount', 0)
      expect(result.data.message).toContain('MIO available')
      expect(result.data.message).toContain('TradingView unavailable')
    })

    it('should return no platform availability', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock both platforms unavailable
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockResolvedValueOnce(false) // MIO
        .mockResolvedValueOnce(false) // TradingView

      const request = createMockRequest('GET', '/api/watchlists', undefined, {
        userEmail: credentials.userEmail,
        userPassword: credentials.userPassword
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data.platforms.mio).toHaveProperty('available', false)
      expect(result.data.platforms.mio).toHaveProperty('sessionCount', 0)
      expect(result.data.platforms.tradingview).toHaveProperty('available', false)
      expect(result.data.platforms.tradingview).toHaveProperty('sessionCount', 0)
      expect(result.data.message).toContain('MIO unavailable')
      expect(result.data.message).toContain('TradingView unavailable')
    })

    it('should return 400 when userEmail is missing', async () => {
      const request = createMockRequest('GET', '/api/watchlists', undefined, {
        userPassword: 'password123'
        // Missing userEmail
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Missing credentials')
      expect(result.data.message).toContain('Both userEmail and userPassword are required')
    })

    it('should return 400 when userPassword is missing', async () => {
      const request = createMockRequest('GET', '/api/watchlists', undefined, {
        userEmail: 'test@example.com'
        // Missing userPassword
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Missing credentials')
      expect(result.data.message).toContain('Both userEmail and userPassword are required')
    })

    it('should return 500 for server errors during availability check', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const credentials = createMockUserCredentials()

      // Mock server error
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser)
        .mockRejectedValue(new Error('Service unavailable'))

      const request = createMockRequest('GET', '/api/watchlists', undefined, {
        userEmail: credentials.userEmail,
        userPassword: credentials.userPassword
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 500, 'Failed to check platform availability')
      expect(result.data).toHaveProperty('details', 'Service unavailable')
    })
  })
})
