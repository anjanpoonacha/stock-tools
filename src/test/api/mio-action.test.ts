import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST, PUT, DELETE } from '@/app/api/mio-action/route'
import { 
  createMockRequest, 
  createMockUserCredentials, 
  parseJsonResponse,
  expectSuccessResponse,
  expectErrorResponse,
  createMockKVStore,
  mockConsole
} from '../utils'

// Mock dependencies
vi.mock('@/lib/SessionResolver', () => ({
  SessionResolver: {
    getLatestMIOSessionForUser: vi.fn(),
  },
}))

vi.mock('@/lib/MIOService', () => ({
  MIOService: {
    getWatchlistsWithSession: vi.fn(),
    addWatchlist: vi.fn(),
    createWatchlist: vi.fn(),
    deleteWatchlists: vi.fn(),
  },
}))

vi.mock('@vercel/kv', () => ({
  kv: createMockKVStore(),
}))

describe('MIO Action API', () => {
  const console = mockConsole()
  
  beforeEach(() => {
    vi.clearAllMocks()
    console.mock()
  })

  afterEach(() => {
    console.restore()
  })

  describe('POST /api/mio-action', () => {
    it('should return error when user credentials are missing', async () => {
      const request = createMockRequest('POST', '/api/mio-action', {
        mioWlid: '123',
        symbols: ['AAPL', 'GOOGL']
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Authentication required')
      expect(result.data).toHaveProperty('needsSession', true)
    })

    it('should return error when no MIO session found for user', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(null)

      const credentials = createMockUserCredentials()
      const request = createMockRequest('POST', '/api/mio-action', {
        ...credentials,
        mioWlid: '123',
        symbols: ['AAPL', 'GOOGL']
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'No MarketInOut session found')
      expect(result.data).toHaveProperty('needsSession', true)
    })

    it('should get watchlists when no specific action requested', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const { MIOService } = await import('@/lib/MIOService')
      
      const mockSessionInfo = {
        internalId: 'test-session-123',
        key: 'ASPSESSIONIDCQTQTQTQ',
        value: 'TESTCOOKIE123456789'
      }
      
      const mockWatchlists = [
        { id: '1', name: 'Tech Stocks' },
        { id: '2', name: 'Blue Chips' }
      ]

      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(mockSessionInfo)
      vi.mocked(MIOService.getWatchlistsWithSession).mockResolvedValue(mockWatchlists)

      const credentials = createMockUserCredentials()
      const request = createMockRequest('POST', '/api/mio-action', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expectSuccessResponse(result)
      expect(result.data).toHaveProperty('watchlists', mockWatchlists)
      expect(result.data).toHaveProperty('sessionUsed', mockSessionInfo.internalId)
    })

    it('should add symbols to watchlist when mioWlid and symbols provided', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const { MIOService } = await import('@/lib/MIOService')
      
      const mockSessionInfo = {
        internalId: 'test-session-123',
        key: 'ASPSESSIONIDCQTQTQTQ',
        value: 'TESTCOOKIE123456789'
      }
      
      const mockResult = 'Successfully added 2 symbols to watchlist'

      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(mockSessionInfo)
      vi.mocked(MIOService.addWatchlist).mockResolvedValue(mockResult)

      const credentials = createMockUserCredentials()
      const request = createMockRequest('POST', '/api/mio-action', {
        ...credentials,
        mioWlid: '123',
        symbols: ['AAPL', 'GOOGL']
      })

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expectSuccessResponse(result)
      expect(result.data).toHaveProperty('result', mockResult)
      expect(result.data).toHaveProperty('sessionUsed', mockSessionInfo.internalId)
      
      // Verify MIOService was called with correct parameters
      expect(MIOService.addWatchlist).toHaveBeenCalledWith({
        sessionKey: mockSessionInfo.key,
        sessionValue: mockSessionInfo.value,
        mioWlid: '123',
        symbols: 'AAPL,GOOGL', // Should be converted to comma-separated string
      })
    })

    it('should handle MIOService errors gracefully', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const { MIOService } = await import('@/lib/MIOService')
      
      const mockSessionInfo = {
        internalId: 'test-session-123',
        key: 'ASPSESSIONIDCQTQTQTQ',
        value: 'TESTCOOKIE123456789'
      }

      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(mockSessionInfo)
      vi.mocked(MIOService.getWatchlistsWithSession).mockRejectedValue(new Error('Session expired'))

      const credentials = createMockUserCredentials()
      const request = createMockRequest('POST', '/api/mio-action', credentials)

      const response = await POST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 401, 'Session expired')
      expect(result.data).toHaveProperty('needsSession', true)
    })
  })

  describe('PUT /api/mio-action', () => {
    it('should return error when name is missing', async () => {
      const credentials = createMockUserCredentials()
      const request = createMockRequest('PUT', '/api/mio-action', credentials)

      const response = await PUT(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'required')
    })

    it('should create watchlist successfully', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const { MIOService } = await import('@/lib/MIOService')
      
      const mockSessionInfo = {
        internalId: 'test-session-123',
        key: 'ASPSESSIONIDCQTQTQTQ',
        value: 'TESTCOOKIE123456789'
      }
      
      const mockResult = 'Watchlist "New Watchlist" created successfully'

      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(mockSessionInfo)
      vi.mocked(MIOService.createWatchlist).mockResolvedValue(mockResult)

      const credentials = createMockUserCredentials()
      const request = createMockRequest('PUT', '/api/mio-action', {
        ...credentials,
        name: 'New Watchlist'
      })

      const response = await PUT(request)
      const result = await parseJsonResponse(response)

      expectSuccessResponse(result)
      expect(result.data).toHaveProperty('result', mockResult)
      expect(result.data).toHaveProperty('sessionUsed', mockSessionInfo.internalId)
      
      // Verify MIOService was called with correct parameters
      expect(MIOService.createWatchlist).toHaveBeenCalledWith(
        mockSessionInfo.key,
        mockSessionInfo.value,
        'New Watchlist'
      )
    })
  })

  describe('DELETE /api/mio-action', () => {
    it('should return error when deleteIds is not an array', async () => {
      const credentials = createMockUserCredentials()
      const request = createMockRequest('DELETE', '/api/mio-action', {
        ...credentials,
        deleteIds: 'not-an-array'
      })

      const response = await DELETE(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'required')
    })

    it('should delete watchlists successfully', async () => {
      const { SessionResolver } = await import('@/lib/SessionResolver')
      const { MIOService } = await import('@/lib/MIOService')
      
      const mockSessionInfo = {
        internalId: 'test-session-123',
        key: 'ASPSESSIONIDCQTQTQTQ',
        value: 'TESTCOOKIE123456789'
      }
      
      const mockResult = 'Successfully deleted 2 watchlists'

      vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(mockSessionInfo)
      vi.mocked(MIOService.deleteWatchlists).mockResolvedValue(mockResult)

      const credentials = createMockUserCredentials()
      const request = createMockRequest('DELETE', '/api/mio-action', {
        ...credentials,
        deleteIds: ['123', '456']
      })

      const response = await DELETE(request)
      const result = await parseJsonResponse(response)

      expectSuccessResponse(result)
      expect(result.data).toHaveProperty('result', mockResult)
      expect(result.data).toHaveProperty('sessionUsed', mockSessionInfo.internalId)
      
      // Verify MIOService was called with correct parameters
      expect(MIOService.deleteWatchlists).toHaveBeenCalledWith(
        mockSessionInfo.key,
        mockSessionInfo.value,
        ['123', '456']
      )
    })
  })
})
