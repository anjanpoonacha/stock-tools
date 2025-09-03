import { vi, expect } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Mock data generators
export const createMockSessionData = (sessionId: string, aspSessionId: string) => ({
  sessionId,
  cookies: `ASPSESSIONIDCQTQTQTQ=${aspSessionId}; path=/; domain=.marketinout.com`,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  timestamp: Date.now(),
  platform: 'marketinout' as const,
})

export const createMockUserCredentials = (email = 'test@example.com', password = 'testpass123') => ({
  userEmail: email,
  userPassword: password,
})

export const createMockWatchlist = (id: string, name: string) => ({
  id,
  name,
  symbols: ['AAPL', 'GOOGL', 'MSFT'],
})

// API Request helpers
export const createMockRequest = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: Record<string, unknown>,
  searchParams?: Record<string, string>
): NextRequest => {
  const fullUrl = new URL(url, 'http://localhost:3000')
  
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      fullUrl.searchParams.set(key, value)
    })
  }

  const request = new NextRequest(fullUrl, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  return request
}

// Response helpers
export const parseJsonResponse = async (response: NextResponse): Promise<{
  status: number
  data: Record<string, unknown>
}> => {
  const data = await response.json()
  return {
    status: response.status,
    data,
  }
}

// Mock implementations
export const createMockKVStore = () => {
  const store = new Map<string, string>()
  
  return {
    get: vi.fn().mockImplementation((key: string) => {
      const value = store.get(key)
      return Promise.resolve(value ? JSON.parse(value) : null)
    }),
    set: vi.fn().mockImplementation((key: string, value: unknown) => {
      store.set(key, JSON.stringify(value))
      return Promise.resolve('OK')
    }),
    del: vi.fn().mockImplementation((key: string) => {
      const existed = store.has(key)
      store.delete(key)
      return Promise.resolve(existed ? 1 : 0)
    }),
    exists: vi.fn().mockImplementation((key: string) => {
      return Promise.resolve(store.has(key) ? 1 : 0)
    }),
    keys: vi.fn().mockImplementation((pattern: string) => {
      const keys = Array.from(store.keys())
      if (pattern === '*') return Promise.resolve(keys)
      
      // Simple pattern matching for tests
      const regex = new RegExp(pattern.replace('*', '.*'))
      return Promise.resolve(keys.filter(key => regex.test(key)))
    }),
    clear: () => {
      store.clear()
    },
  }
}

export const createMockFetch = () => {
  return vi.fn().mockImplementation((url: string) => {
    // Default mock responses based on URL patterns
    if (url.includes('marketinout.com/watchlist')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`
          <div class="watchlist-item" data-id="1">Tech Stocks</div>
          <div class="watchlist-item" data-id="2">Blue Chips</div>
        `),
        json: () => Promise.resolve({ watchlists: [] }),
      })
    }

    if (url.includes('tradingview.com')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ok' }),
      })
    }

    // Default response
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    })
  })
}

// Test session helpers
export const createTestSessionId = (prefix: string): string => {
  return `test-${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const cleanupTestSessions = async (sessionIds: string[], kvStore: ReturnType<typeof createMockKVStore>) => {
  for (const sessionId of sessionIds) {
    await kvStore.del(`session:${sessionId}`)
    await kvStore.del(`session:${sessionId}:marketinout`)
    await kvStore.del(`session:${sessionId}:tradingview`)
  }
}

// Assertion helpers
export const expectSuccessResponse = (response: { status: number; data: Record<string, unknown> }) => {
  expect(response.status).toBe(200)
  expect(response.data).not.toHaveProperty('error')
  // MIO Action API doesn't return a 'success' property, it spreads the data directly
}

export const expectErrorResponse = (
  response: { status: number; data: Record<string, unknown> },
  expectedStatus: number,
  expectedErrorMessage?: string
) => {
  expect(response.status).toBe(expectedStatus)
  expect(response.data).toHaveProperty('error')
  if (expectedErrorMessage) {
    expect(response.data.error).toContain(expectedErrorMessage)
  }
}

// Time helpers for testing
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Mock console for testing
export const mockConsole = () => {
  const originalConsole = { ...console }
  
  return {
    mock: () => {
      console.log = vi.fn()
      console.error = vi.fn()
      console.warn = vi.fn()
      console.info = vi.fn()
    },
    restore: () => {
      Object.assign(console, originalConsole)
    },
    getLogs: () => ({
      log: (console.log as ReturnType<typeof vi.fn>).mock.calls,
      error: (console.error as ReturnType<typeof vi.fn>).mock.calls,
      warn: (console.warn as ReturnType<typeof vi.fn>).mock.calls,
      info: (console.info as ReturnType<typeof vi.fn>).mock.calls,
    }),
  }
}
