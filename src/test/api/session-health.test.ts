import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET, POST, DELETE } from '@/app/api/session-health/route'
import { 
  createMockRequest, 
  parseJsonResponse,
  expectErrorResponse,
  createMockKVStore,
  mockConsole,
  createTestSessionId
} from '../utils'

// Mock dependencies
vi.mock('@/lib/sessionHealthMonitor', () => ({
  sessionHealthMonitor: {
    getSessionHealthReport: vi.fn(),
    getAllHealthReports: vi.fn(),
    getMonitoringStats: vi.fn(),
    getSessionHealth: vi.fn(),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    checkSessionHealth: vi.fn(),
  },
}))

vi.mock('@/lib/sessionStore', () => ({
  getSession: vi.fn(),
}))

vi.mock('@vercel/kv', () => ({
  kv: createMockKVStore(),
}))

describe('Session Health API', () => {
  const console = mockConsole()
  
  beforeEach(() => {
    vi.clearAllMocks()
    console.mock()
  })

  afterEach(() => {
    console.restore()
  })

  describe('GET /api/session-health', () => {
    it('should return health status for specific session', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const sessionId = createTestSessionId('health')
      
      const mockReport = {
        sessionId,
        platforms: {
          marketinout: {
            internalSessionId: sessionId,
            platform: 'marketinout',
            status: 'healthy' as const,
            lastSuccessfulCheck: new Date(),
            lastFailedCheck: null,
            consecutiveFailures: 0,
            totalChecks: 5,
            totalFailures: 0,
            lastRefreshAttempt: null,
            lastSuccessfulRefresh: null,
            nextCheckTime: new Date(),
            checkInterval: 300000,
            isMonitoring: true,
            errorHistory: [],
            recoveryAttempts: 0,
            lastRecoveryAttempt: null,
          }
        },
        overallStatus: 'healthy' as const,
        lastUpdated: new Date(),
        criticalErrors: [],
        recommendedActions: [],
        autoRecoveryAvailable: false
      }

      vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(mockReport)

      const request = createMockRequest('GET', '/api/session-health', undefined, {
        action: 'status',
        sessionId
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('report')
      expect(result.data.report).toHaveProperty('sessionId', sessionId)
      expect(result.data.report).toHaveProperty('overallStatus', 'healthy')
      expect(sessionHealthMonitor.getSessionHealthReport).toHaveBeenCalledWith(sessionId)
    })

    it('should return 404 when session not found for status check', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const sessionId = createTestSessionId('not-found')

      vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(null)

      const request = createMockRequest('GET', '/api/session-health', undefined, {
        action: 'status',
        sessionId
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 404, 'Session not found')
    })

    it('should return all health reports when no sessionId provided', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      
      const mockReports = [
        {
          sessionId: 'session-1',
          platforms: {},
          overallStatus: 'healthy' as const,
          lastUpdated: new Date(),
          criticalErrors: [],
          recommendedActions: [],
          autoRecoveryAvailable: false
        },
        {
          sessionId: 'session-2',
          platforms: {},
          overallStatus: 'critical' as const,
          lastUpdated: new Date(),
          criticalErrors: [],
          recommendedActions: [],
          autoRecoveryAvailable: false
        }
      ]

      vi.mocked(sessionHealthMonitor.getAllHealthReports).mockReturnValue(mockReports)

      const request = createMockRequest('GET', '/api/session-health', undefined, {
        action: 'status'
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('reports')
      expect(Array.isArray(result.data.reports)).toBe(true)
      expect(result.data.reports).toHaveLength(2)
      expect(sessionHealthMonitor.getAllHealthReports).toHaveBeenCalled()
    })

    it('should return monitoring statistics', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      
      const mockStats = {
        totalSessions: 5,
        activeSessions: 4,
        healthySessions: 3,
        warningSessions: 1,
        criticalSessions: 1,
        expiredSessions: 0,
        isGlobalMonitoringActive: true,
        totalErrors: 2,
        totalRecoveryAttempts: 1,
        successfulRecoveries: 1,
        recentErrors: []
      }

      vi.mocked(sessionHealthMonitor.getMonitoringStats).mockReturnValue(mockStats)

      const request = createMockRequest('GET', '/api/session-health', undefined, {
        action: 'stats'
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('stats', mockStats)
      expect(sessionHealthMonitor.getMonitoringStats).toHaveBeenCalled()
    })

    it('should return platform-specific health status', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const sessionId = createTestSessionId('platform')
      const platform = 'marketinout'
      
      const mockHealth = {
        internalSessionId: sessionId,
        platform: 'marketinout',
        status: 'healthy' as const,
        lastSuccessfulCheck: new Date(),
        lastFailedCheck: null,
        consecutiveFailures: 0,
        totalChecks: 5,
        totalFailures: 0,
        lastRefreshAttempt: null,
        lastSuccessfulRefresh: null,
        nextCheckTime: new Date(),
        checkInterval: 300000,
        isMonitoring: true,
        errorHistory: [],
        recoveryAttempts: 0,
        lastRecoveryAttempt: null,
      }

      vi.mocked(sessionHealthMonitor.getSessionHealth).mockReturnValue(mockHealth)

      const request = createMockRequest('GET', '/api/session-health', undefined, {
        action: 'platform-status',
        sessionId,
        platform
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('health')
      expect(result.data.health).toHaveProperty('internalSessionId', sessionId)
      expect(result.data.health).toHaveProperty('platform', 'marketinout')
      expect(result.data.health).toHaveProperty('status', 'healthy')
      expect(result.data.health).toHaveProperty('totalChecks', 5)
      expect(result.data.health).toHaveProperty('totalFailures', 0)
      expect(result.data.health).toHaveProperty('isMonitoring', true)
      expect(sessionHealthMonitor.getSessionHealth).toHaveBeenCalledWith(sessionId, platform)
    })

    it('should return 400 for platform-status without required parameters', async () => {
      const request = createMockRequest('GET', '/api/session-health', undefined, {
        action: 'platform-status'
        // Missing sessionId and platform
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'sessionId and platform parameters are required')
    })

    it('should return 400 for invalid action', async () => {
      const request = createMockRequest('GET', '/api/session-health', undefined, {
        action: 'invalid-action'
      })

      const response = await GET(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Invalid action')
    })
  })

  describe('POST /api/session-health', () => {
    it('should start monitoring for a session and platform', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const { getSession } = await import('@/lib/sessionStore')
      const sessionId = createTestSessionId('monitoring')
      const platform = 'marketinout'

      const mockSession = {
        [platform]: { sessionId, cookies: 'test-cookies' }
      }

      vi.mocked(getSession).mockResolvedValue(mockSession)
      vi.mocked(sessionHealthMonitor.startMonitoring).mockReturnValue(undefined)

      const request = createMockRequest('POST', '/api/session-health', {
        action: 'start-monitoring',
        sessionId,
        platform
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('message')
      expect(sessionHealthMonitor.startMonitoring).toHaveBeenCalledWith(sessionId, platform)
    })

    it('should allow monitoring test sessions without validation', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const sessionId = 'test-session-123'
      const platform = 'marketinout'

      vi.mocked(sessionHealthMonitor.startMonitoring).mockReturnValue(undefined)

      const request = createMockRequest('POST', '/api/session-health', {
        action: 'start-monitoring',
        sessionId,
        platform
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('isTestSession', true)
      expect(sessionHealthMonitor.startMonitoring).toHaveBeenCalledWith(sessionId, platform)
    })

    it('should stop monitoring for a session and platform', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const sessionId = createTestSessionId('stop')
      const platform = 'marketinout'

      vi.mocked(sessionHealthMonitor.stopMonitoring).mockReturnValue(undefined)

      const request = createMockRequest('POST', '/api/session-health', {
        action: 'stop-monitoring',
        sessionId,
        platform
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, platform)
    })

    it('should perform manual health check', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const sessionId = createTestSessionId('check')
      const platform = 'marketinout'

      const mockStatus = 'healthy'
      vi.mocked(sessionHealthMonitor.checkSessionHealth).mockResolvedValue(mockStatus)

      const request = createMockRequest('POST', '/api/session-health', {
        action: 'check-health',
        sessionId,
        platform
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('sessionId', sessionId)
      expect(result.data).toHaveProperty('platform', platform)
      expect(result.data).toHaveProperty('status', mockStatus)
      expect(result.data).toHaveProperty('timestamp')
      expect(sessionHealthMonitor.checkSessionHealth).toHaveBeenCalledWith(sessionId, platform)
    })

    it('should start monitoring all platforms for a session', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const { getSession } = await import('@/lib/sessionStore')
      const sessionId = createTestSessionId('all-platforms')

      const mockSession = {
        marketinout: { sessionId, cookies: 'mio-cookies' },
        tradingview: { sessionId, cookies: 'tv-cookies' }
      }

      vi.mocked(getSession).mockResolvedValue(mockSession)
      vi.mocked(sessionHealthMonitor.startMonitoring).mockReturnValue(undefined)

      const request = createMockRequest('POST', '/api/session-health', {
        action: 'start-all-monitoring',
        sessionId
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('platforms')
      expect(result.data.platforms).toEqual(['marketinout', 'tradingview'])
      expect(sessionHealthMonitor.startMonitoring).toHaveBeenCalledWith(sessionId, 'marketinout')
      expect(sessionHealthMonitor.startMonitoring).toHaveBeenCalledWith(sessionId, 'tradingview')
    })

    it('should return 400 when sessionId is missing', async () => {
      const request = createMockRequest('POST', '/api/session-health', {
        action: 'start-monitoring',
        platform: 'marketinout'
        // Missing sessionId
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'sessionId is required')
    })

    it('should return 400 for invalid action', async () => {
      const sessionId = createTestSessionId('invalid')

      const request = createMockRequest('POST', '/api/session-health', {
        action: 'invalid-action',
        sessionId
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Invalid action')
    })
  })

  describe('DELETE /api/session-health', () => {
    it('should stop monitoring specific platform', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const sessionId = createTestSessionId('delete-platform')
      const platform = 'marketinout'

      vi.mocked(sessionHealthMonitor.stopMonitoring).mockReturnValue(undefined)

      const request = createMockRequest('DELETE', '/api/session-health', undefined, {
        sessionId,
        platform
      })

      const response = await DELETE(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, platform)
    })

    it('should stop monitoring all platforms for a session', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const sessionId = createTestSessionId('delete-all')

      const mockReport = {
        sessionId,
        platforms: {
          marketinout: {
            internalSessionId: sessionId,
            platform: 'marketinout',
            status: 'healthy' as const,
            lastSuccessfulCheck: new Date(),
            lastFailedCheck: null,
            consecutiveFailures: 0,
            totalChecks: 5,
            totalFailures: 0,
            lastRefreshAttempt: null,
            lastSuccessfulRefresh: null,
            nextCheckTime: new Date(),
            checkInterval: 300000,
            isMonitoring: true,
            errorHistory: [],
            recoveryAttempts: 0,
            lastRecoveryAttempt: null,
          },
          tradingview: {
            internalSessionId: sessionId,
            platform: 'tradingview',
            status: 'healthy' as const,
            lastSuccessfulCheck: new Date(),
            lastFailedCheck: null,
            consecutiveFailures: 0,
            totalChecks: 3,
            totalFailures: 0,
            lastRefreshAttempt: null,
            lastSuccessfulRefresh: null,
            nextCheckTime: new Date(),
            checkInterval: 300000,
            isMonitoring: true,
            errorHistory: [],
            recoveryAttempts: 0,
            lastRecoveryAttempt: null,
          }
        },
        overallStatus: 'healthy' as const,
        lastUpdated: new Date(),
        criticalErrors: [],
        recommendedActions: [],
        autoRecoveryAvailable: false
      }

      vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(mockReport)
      vi.mocked(sessionHealthMonitor.stopMonitoring).mockReturnValue(undefined)

      const request = createMockRequest('DELETE', '/api/session-health', undefined, {
        sessionId
        // No platform specified - should stop all
      })

      const response = await DELETE(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('platforms', ['marketinout', 'tradingview'])
      expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, 'marketinout')
      expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, 'tradingview')
    })

    it('should return 400 when sessionId is missing', async () => {
      const request = createMockRequest('DELETE', '/api/session-health')

      const response = await DELETE(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'sessionId is required')
    })

    it('should handle case when no monitoring found for session', async () => {
      const { sessionHealthMonitor } = await import('@/lib/sessionHealthMonitor')
      const sessionId = createTestSessionId('no-monitoring')

      vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(null)

      const request = createMockRequest('DELETE', '/api/session-health', undefined, {
        sessionId
      })

      const response = await DELETE(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data.message).toContain('No monitoring found')
    })
  })
})
