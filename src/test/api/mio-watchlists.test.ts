import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as mioWatchlistsGET, POST as mioWatchlistsPOST } from '@/app/api/mio-watchlists/route'
import { 
  parseJsonResponse,
  expectErrorResponse,
  mockConsole,
  createTestSessionId
} from '../utils'

// Mock SessionResolver
vi.mock('@/lib/SessionResolver', () => ({
  SessionResolver: {
    hasSessionsForPlatformAndUser: vi.fn(),
    getLatestMIOSessionForUser: vi.fn(),
  }
}))

describe('MIO Watchlists API', () => {
  const console = mockConsole()
  
  beforeEach(() => {
    vi.clearAllMocks()
    console.mock()
  })

  afterEach(() => {
    console.restore()
  })

  describe('GET /api/mio-watchlists', () => {
    it('should return 401 when userEmail is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/mio-watchlists?userPassword=password123')

      const response = await mioWatchlistsGET(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Authentication required')
      expect(result.data.message).toBe('Both userEmail and userPassword are required to access watchlists')
      expect(result.data.success).toBe(false)
    })

    it('should return 401 when userPassword is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/mio-watchlists?userEmail=test@example.com')

      const response = await mioWatchlistsGET(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Authentication required')
      expect(result.data.message).toBe('Both userEmail and userPassword are required to access watchlists')
      expect(result.data.success).toBe(false)
    })

    it('should return 403 when no MIO session found', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      
      // Mock no session found
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser).mockResolvedValue(false)
      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/mio-watchlists?userEmail=test@example.com&userPassword=password123')

      const response = await mioWatchlistsGET(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 403, 'No valid session found')
      expect(result.data.message).toContain('No MarketInOut session found for user test@example.com')
      expect(result.data.success).toBe(false)
      expect(result.data.userEmail).toBe('test@example.com')
      expect(result.data.hasSession).toBe(false)
    })

    it('should return watchlists successfully with valid credentials', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      
      // Mock successful session
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser).mockResolvedValue(true)
      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue({
        key: 'test-session-key',
        value: 'test-session-value',
        internalId: createTestSessionId('mio-watchlists')
      })

      const request = new NextRequest('http://localhost:3000/api/mio-watchlists?userEmail=test@example.com&userPassword=password123')

      const response = await mioWatchlistsGET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data.success).toBe(true)
      expect(result.data.userEmail).toBe('test@example.com')
      expect(Array.isArray(result.data.watchlists)).toBe(true)
      expect((result.data.watchlists as unknown[]).length).toBe(2)
      expect((result.data.watchlists as unknown[])[0]).toHaveProperty('name', "test@example.com's Portfolio")
      expect((result.data.watchlists as unknown[])[0]).toHaveProperty('symbols')
      expect(result.data.totalWatchlists).toBe(2)
    })
  })

  describe('POST /api/mio-watchlists', () => {
    it('should return 401 when userEmail is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/mio-watchlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userPassword: 'password123',
          watchlistName: 'Test Watchlist',
          symbols: ['RELIANCE', 'TCS']
        })
      })

      const response = await mioWatchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Authentication required')
      expect(result.data.message).toBe('Both userEmail and userPassword are required')
      expect(result.data.success).toBe(false)
    })

    it('should return 401 when userPassword is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/mio-watchlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userEmail: 'test@example.com',
          watchlistName: 'Test Watchlist',
          symbols: ['RELIANCE', 'TCS']
        })
      })

      const response = await mioWatchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Authentication required')
      expect(result.data.message).toBe('Both userEmail and userPassword are required')
      expect(result.data.success).toBe(false)
    })

    it('should return 403 when no MIO session found', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      
      // Mock no session found
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser).mockResolvedValue(false)
      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/mio-watchlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userEmail: 'test@example.com',
          userPassword: 'password123',
          watchlistName: 'Test Watchlist',
          symbols: ['RELIANCE', 'TCS']
        })
      })

      const response = await mioWatchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 403, 'No valid session found')
      expect(result.data.message).toContain('No MarketInOut session found for user test@example.com')
      expect(result.data.success).toBe(false)
      expect(result.data.userEmail).toBe('test@example.com')
      expect(result.data.hasSession).toBe(false)
    })

    it('should create watchlist successfully with valid credentials', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      
      // Mock successful session
      vi.mocked(SessionResolver.hasSessionsForPlatformAndUser).mockResolvedValue(true)
      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue({
        key: 'test-session-key',
        value: 'test-session-value',
        internalId: createTestSessionId('mio-watchlists')
      })

      const request = new NextRequest('http://localhost:3000/api/mio-watchlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userEmail: 'test@example.com',
          userPassword: 'password123',
          watchlistName: 'My New Watchlist',
          symbols: ['RELIANCE', 'TCS', 'INFY']
        })
      })

      const response = await mioWatchlistsPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data.success).toBe(true)
      expect(result.data.message).toBe("Watchlist 'My New Watchlist' created successfully for user test@example.com")
      expect(result.data.userEmail).toBe('test@example.com')
      expect(typeof (result.data as unknown as { sessionId: string }).sessionId).toBe('string')
      expect((result.data as unknown as { sessionId: string }).sessionId.length).toBeGreaterThan(0)
      expect((result.data as unknown as { watchlist: unknown }).watchlist).toBeDefined()
      expect((result.data as unknown as { watchlist: { name: string } }).watchlist.name).toBe('My New Watchlist')
      expect(Array.isArray((result.data as unknown as { watchlist: { symbols: unknown[] } }).watchlist.symbols)).toBe(true)
      expect((result.data as unknown as { watchlist: { symbols: string[] } }).watchlist.symbols).toEqual(['RELIANCE', 'TCS', 'INFY'])
      expect((result.data as unknown as { watchlist: { owner: string } }).watchlist.owner).toBe('test@example.com')
      expect(typeof (result.data as unknown as { watchlist: { id: number } }).watchlist.id).toBe('number')
      expect(typeof (result.data as unknown as { watchlist: { createdAt: string } }).watchlist.createdAt).toBe('string')
      expect(typeof (result.data as unknown as { watchlist: { updatedAt: string } }).watchlist.updatedAt).toBe('string')
    })
  })
})
