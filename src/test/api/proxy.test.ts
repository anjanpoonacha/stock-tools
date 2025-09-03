import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as proxyPOST } from '@/app/api/proxy/route'
import { 
  parseJsonResponse,
  expectErrorResponse,
  mockConsole,
  createMockFetch
} from '../utils'

describe('Proxy API', () => {
  const console = mockConsole()
  
  beforeEach(() => {
    vi.clearAllMocks()
    console.mock()
    // Mock global fetch
    global.fetch = createMockFetch()
  })

  afterEach(() => {
    console.restore()
    vi.restoreAllMocks()
  })

  describe('POST /api/proxy', () => {
    it('should return 400 when url is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: 'GET',
          headers: {}
        })
      })

      const response = await proxyPOST(request)
      const result = await parseJsonResponse(response)

      expectErrorResponse(result, 400, 'Missing url')
    })

    it('should successfully proxy a GET request', async () => {
      // Mock fetch to return a successful JSON response
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({ message: 'Success', data: [1, 2, 3] })
      })

      const request = new NextRequest('http://localhost:3000/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: {
            'Authorization': 'Bearer token123'
          }
        })
      })

      const response = await proxyPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data.status).toBe(200)
      expect(result.data.data).toEqual({ message: 'Success', data: [1, 2, 3] })
      
      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/data', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token123'
        }
      })
    })

    it('should successfully proxy a POST request with JSON body', async () => {
      // Mock fetch to return a successful JSON response
      global.fetch = vi.fn().mockResolvedValue({
        status: 201,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({ id: 123, created: true })
      })

      const request = new NextRequest('http://localhost:3000/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://api.example.com/create',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token123'
          },
          body: { name: 'Test Item', value: 42 }
        })
      })

      const response = await proxyPOST(request)
      const result = await parseJsonResponse(response)

      expect(result.status).toBe(200)
      expect(result.data.status).toBe(201)
      expect(result.data.data).toEqual({ id: 123, created: true })
      
      // Verify fetch was called with correct parameters including JSON body
      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/create', {
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({ name: 'Test Item', value: 42 })
      })
    })
  })
})
