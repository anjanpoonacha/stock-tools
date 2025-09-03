import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as testSessionGET, POST as testSessionPOST } from '@/app/api/test-session/route'
import { 
  parseJsonResponse,
  expectErrorResponse,
  mockConsole
} from '../utils'

// Mock SessionFlowTester
vi.mock('@/lib/sessionFlowTester', () => ({
  SessionFlowTester: vi.fn().mockImplementation(() => ({
    runAllTests: vi.fn(),
    generateTestReport: vi.fn(),
    quickHealthCheck: vi.fn(),
    testSessionCreationAndValidation: vi.fn(),
    testHealthMonitoringIntegration: vi.fn(),
    testErrorHandlingScenarios: vi.fn(),
    testCookieParsingRobustness: vi.fn(),
    testSessionRefreshMechanisms: vi.fn(),
    testCrossPlatformOperations: vi.fn(),
    testCompleteSessionFlow: vi.fn(),
  }))
}))

// Mock other dependencies
vi.mock('@/lib/sessionValidation', () => ({
  getHealthAwareSessionData: vi.fn()
}))

vi.mock('@/lib/MIOService', () => ({
  MIOService: {
    getSessionKeyValue: vi.fn(),
    refreshSession: vi.fn()
  }
}))

vi.mock('@/lib/sessionHealthMonitor', () => ({
  SessionHealthMonitor: {
    getInstance: vi.fn().mockReturnValue({
      checkSessionHealth: vi.fn(),
      getSessionHealth: vi.fn(),
      getMonitoringStats: vi.fn()
    })
  }
}))

describe('Test Session API', () => {
  const console = mockConsole()
  
  beforeEach(() => {
    vi.clearAllMocks()
    console.mock()
  })

  afterEach(() => {
    console.restore()
  })

  describe('GET /api/test-session', () => {
    it('should return available tests when action is getAvailableTests', async () => {
      const request = new NextRequest('http://localhost:3000/api/test-session?action=getAvailableTests')

      const response = await testSessionGET(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data.success).toBe(true)
      expect(result.data.availableTests).toBeDefined()
      expect((result.data.availableTests as unknown as { testSuites: unknown[] }).testSuites).toBeInstanceOf(Array)
      expect((result.data.availableTests as unknown as { individualActions: unknown[] }).individualActions).toBeInstanceOf(Array)
      expect((result.data.availableTests as unknown as { testSuites: unknown[] }).testSuites.length).toBe(7)
      expect((result.data.availableTests as unknown as { individualActions: unknown[] }).individualActions.length).toBe(4)
    })
  })

  describe('POST /api/test-session', () => {
    it('should return error for unknown action', async () => {
      const request = new NextRequest('http://localhost:3000/api/test-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'unknownAction'
        })
      })

      const response = await testSessionPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Unknown action: unknownAction')
    })
  })
})
