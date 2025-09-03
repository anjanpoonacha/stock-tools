import { describe, it, expect } from 'vitest'
import { createMockRequest, createMockUserCredentials } from './utils'

describe('Test Setup Verification', () => {
  it('should have vitest globals available', () => {
    expect(expect).toBeDefined()
    expect(describe).toBeDefined()
    expect(it).toBeDefined()
  })

  it('should create mock requests correctly', () => {
    const request = createMockRequest('GET', '/api/test')
    expect(request).toBeDefined()
    expect(request.method).toBe('GET')
    expect(request.url).toContain('/api/test')
  })

  it('should create mock user credentials', () => {
    const credentials = createMockUserCredentials()
    expect(credentials).toHaveProperty('userEmail')
    expect(credentials).toHaveProperty('userPassword')
    expect(credentials.userEmail).toBe('test@example.com')
  })

  it('should have environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test')
    expect(process.env.KV_URL).toBe('test://localhost')
  })
})
