import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as sessionCurrentGET } from '@/app/api/session/current/route'
import { 
  parseJsonResponse,
  mockConsole,
  createTestSessionId
} from '../utils'

// Mock SessionResolver
vi.mock('@/lib/SessionResolver', () => ({
  SessionResolver: {
    getSessionStats: vi.fn(),
    hasSessionsForPlatform: vi.fn(),
    getLatestSession: vi.fn(),
    getLatestMIOSession: vi.fn(),
    hasSessionsForPlatformAndUser: vi.fn(),
    getLatestSessionForUser: vi.fn(),
    getLatestMIOSessionForUser: vi.fn(),
    getAvailableUsers: vi.fn(),
  }
}))

describe('Session Current API', () => {
  const console = mockConsole()
  
  beforeEach(() => {
    vi.clearAllMocks()
    console.mock()
  })

  afterEach(() => {
    console.restore()
  })

  describe('GET /api/session/current', () => {
    it('should return session info for all platforms when no platform specified', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      
      // Mock session resolver responses
      vi.mocked(SessionResolver.getSessionStats).mockResolvedValue({
        totalSessions: 2,
        platformCounts: { marketinout: 1, tradingview: 1 }
      })
      vi.mocked(SessionResolver.hasSessionsForPlatform).mockImplementation((platform) => {
        return Promise.resolve(platform === 'marketinout' || platform === 'tradingview')
      })
      vi.mocked(SessionResolver.getLatestMIOSession).mockResolvedValue({
        key: 'test-mio-key',
        value: 'test-mio-value',
        internalId: createTestSessionId('mio')
      })
      vi.mocked(SessionResolver.getLatestSession).mockResolvedValue({
        sessionData: { sessionId: 'tv-session-123' },
        internalId: createTestSessionId('tv')
      })

      const request = new NextRequest('http://localhost:3000/api/session/current')

      const response = await sessionCurrentGET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data.hasSession).toBe(true)
      expect(result.data.sessionAvailable).toBe(true)
      expect(result.data.sessionStats).toBeDefined()
      expect(result.data.platforms).toBeDefined()
      expect((result.data.platforms as unknown as { marketinout: { hasSession: boolean } }).marketinout.hasSession).toBe(true)
      expect((result.data.platforms as unknown as { tradingview: { hasSession: boolean } }).tradingview.hasSession).toBe(true)
      expect(result.data.message).toContain('Sessions available')
    })
  })
})
