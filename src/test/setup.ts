import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: () => new Map(),
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

// Mock environment variables
process.env.KV_URL = 'test://localhost'
process.env.KV_REST_API_URL = 'test://localhost'
process.env.KV_REST_API_TOKEN = 'test-token'
process.env.KV_REST_API_READ_ONLY_TOKEN = 'test-read-token'

// Global test utilities
global.fetch = vi.fn()

// Suppress console warnings in tests unless explicitly needed
const originalConsoleWarn = console.warn
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
    return
  }
  originalConsoleWarn(...args)
}
