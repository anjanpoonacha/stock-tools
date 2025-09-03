import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock SessionResolver to simulate multi-user session data
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
  },
}));

import { GET, POST } from '@/app/api/session/current/route';
import { SessionResolver } from '@/lib/SessionResolver';

// Get the mocked SessionResolver
const mockSessionResolver = SessionResolver as {
  getSessionStats: ReturnType<typeof vi.fn>;
  hasSessionsForPlatform: ReturnType<typeof vi.fn>;
  getLatestSession: ReturnType<typeof vi.fn>;
  getLatestMIOSession: ReturnType<typeof vi.fn>;
  hasSessionsForPlatformAndUser: ReturnType<typeof vi.fn>;
  getLatestSessionForUser: ReturnType<typeof vi.fn>;
  getLatestMIOSessionForUser: ReturnType<typeof vi.fn>;
  getAvailableUsers: ReturnType<typeof vi.fn>;
};

/**
 * Test suite to verify session API properly filters by user credentials
 * and prevents unauthorized access to other users' session data
 */
describe('Session API User Filtering Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock session stats with multiple users
    mockSessionResolver.getSessionStats.mockResolvedValue({
      totalSessions: 4,
      platforms: {
        marketinout: { count: 2 },
        tradingview: { count: 2 }
      }
    });

    // Mock available users
    mockSessionResolver.getAvailableUsers.mockResolvedValue([
      'user1@test.com',
      'user2@test.com',
      'admin@test.com'
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET endpoint security', () => {
    it('should return all sessions without user filtering (current behavior)', async () => {
      // Mock platform sessions for all users
      mockSessionResolver.hasSessionsForPlatform.mockImplementation((platform: string) => {
        return Promise.resolve(platform === 'marketinout' || platform === 'tradingview');
      });

      mockSessionResolver.getLatestMIOSession.mockResolvedValue({
        internalId: 'mio-session-1',
        sessionData: { userId: 'user1@test.com' }
      });

      mockSessionResolver.getLatestSession.mockResolvedValue({
        internalId: 'tv-session-1',
        sessionData: { sessionId: 'tv123', userId: 'user2@test.com' }
      });

      const request = new NextRequest('http://localhost:3000/api/session/current');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasSession).toBe(true);
      expect(data.sessionAvailable).toBe(true);
      expect(data.platforms.marketinout.hasSession).toBe(true);
      expect(data.platforms.tradingview.hasSession).toBe(true);

      // Verify it returns sessions from all users (security concern)
      expect(mockSessionResolver.hasSessionsForPlatform).toHaveBeenCalledWith('marketinout');
      expect(mockSessionResolver.hasSessionsForPlatform).toHaveBeenCalledWith('tradingview');
    });

    it('should expose session statistics without authentication', async () => {
      mockSessionResolver.hasSessionsForPlatform.mockResolvedValue(false);
      mockSessionResolver.getLatestMIOSession.mockResolvedValue(null);
      mockSessionResolver.getLatestSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/session/current');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionStats).toBeDefined();
      expect(mockSessionResolver.getSessionStats).toHaveBeenCalled();
    });
  });

  describe('POST endpoint user filtering', () => {
    it('should return only sessions for authenticated user', async () => {
      const userCredentials = {
        userEmail: 'user1@test.com',
        userPassword: 'password123'
      };

      // Mock user-specific session data
      mockSessionResolver.hasSessionsForPlatformAndUser.mockImplementation(
        (platform: string, credentials: { userEmail: string; userPassword: string }) => {
          if (credentials.userEmail === 'user1@test.com') {
            return Promise.resolve(platform === 'marketinout');
          }
          return Promise.resolve(false);
        }
      );

      mockSessionResolver.getLatestMIOSessionForUser.mockImplementation((credentials: { userEmail: string; userPassword: string }) => {
        if (credentials.userEmail === 'user1@test.com') {
          return Promise.resolve({
            internalId: 'mio-user1-session',
            sessionData: { userId: 'user1@test.com' }
          });
        }
        return Promise.resolve(null);
      });

      mockSessionResolver.getLatestSessionForUser.mockImplementation(
        (platform: string, credentials: { userEmail: string; userPassword: string }) => {
          if (credentials.userEmail === 'user1@test.com' && platform === 'tradingview') {
            return Promise.resolve(null); // No TV session for user1
          }
          return Promise.resolve(null);
        }
      );

      const request = new NextRequest('http://localhost:3000/api/session/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userCredentials),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.currentUser).toBe('user1@test.com');
      expect(data.platforms.marketinout.hasSession).toBe(true);
      expect(data.platforms.tradingview.hasSession).toBe(false);
      expect(data.availableUsers).toEqual(['user1@test.com', 'user2@test.com', 'admin@test.com']);

      // Verify user-specific methods were called
      expect(mockSessionResolver.hasSessionsForPlatformAndUser).toHaveBeenCalledWith('marketinout', userCredentials);
      expect(mockSessionResolver.hasSessionsForPlatformAndUser).toHaveBeenCalledWith('tradingview', userCredentials);
      expect(mockSessionResolver.getLatestMIOSessionForUser).toHaveBeenCalledWith(userCredentials);
    });

    it('should isolate sessions between different users', async () => {
      // Test user1 credentials
      const user1Credentials = {
        userEmail: 'user1@test.com',
        userPassword: 'password123'
      };

      // Test user2 credentials  
      const user2Credentials = {
        userEmail: 'user2@test.com',
        userPassword: 'password456'
      };

      // Mock different session data for each user
      mockSessionResolver.hasSessionsForPlatformAndUser.mockImplementation(
        (platform: string, credentials: { userEmail: string; userPassword: string }) => {
          if (credentials.userEmail === 'user1@test.com') {
            return Promise.resolve(platform === 'marketinout'); // User1 has MIO only
          }
          if (credentials.userEmail === 'user2@test.com') {
            return Promise.resolve(platform === 'tradingview'); // User2 has TV only
          }
          return Promise.resolve(false);
        }
      );

      mockSessionResolver.getLatestMIOSessionForUser.mockImplementation((credentials: { userEmail: string; userPassword: string }) => {
        if (credentials.userEmail === 'user1@test.com') {
          return Promise.resolve({
            internalId: 'mio-user1-session',
            sessionData: { userId: 'user1@test.com' }
          });
        }
        return Promise.resolve(null);
      });

      mockSessionResolver.getLatestSessionForUser.mockImplementation(
        (platform: string, credentials: { userEmail: string; userPassword: string }) => {
          if (credentials.userEmail === 'user2@test.com' && platform === 'tradingview') {
            return Promise.resolve({
              internalId: 'tv-user2-session',
              sessionData: { sessionId: 'tv456', userId: 'user2@test.com' }
            });
          }
          return Promise.resolve(null);
        }
      );

      // Test user1 request
      const user1Request = new NextRequest('http://localhost:3000/api/session/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user1Credentials),
      });

      const user1Response = await POST(user1Request);
      const user1Data = await user1Response.json();

      expect(user1Data.currentUser).toBe('user1@test.com');
      expect(user1Data.platforms.marketinout.hasSession).toBe(true);
      expect(user1Data.platforms.tradingview.hasSession).toBe(false);

      // Reset mocks for user2 test
      vi.clearAllMocks();
      mockSessionResolver.getSessionStats.mockResolvedValue({});
      mockSessionResolver.getAvailableUsers.mockResolvedValue(['user1@test.com', 'user2@test.com']);

      // Re-setup mocks for user2
      mockSessionResolver.hasSessionsForPlatformAndUser.mockImplementation(
        (platform: string, credentials: { userEmail: string; userPassword: string }) => {
          if (credentials.userEmail === 'user2@test.com') {
            return Promise.resolve(platform === 'tradingview');
          }
          return Promise.resolve(false);
        }
      );

      mockSessionResolver.getLatestMIOSessionForUser.mockResolvedValue(null);
      mockSessionResolver.getLatestSessionForUser.mockImplementation(
        (platform: string, credentials: { userEmail: string; userPassword: string }) => {
          if (credentials.userEmail === 'user2@test.com' && platform === 'tradingview') {
            return Promise.resolve({
              internalId: 'tv-user2-session',
              sessionData: { sessionId: 'tv456', userId: 'user2@test.com' }
            });
          }
          return Promise.resolve(null);
        }
      );

      // Test user2 request
      const user2Request = new NextRequest('http://localhost:3000/api/session/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user2Credentials),
      });

      const user2Response = await POST(user2Request);
      const user2Data = await user2Response.json();

      expect(user2Data.currentUser).toBe('user2@test.com');
      expect(user2Data.platforms.marketinout.hasSession).toBe(false);
      expect(user2Data.platforms.tradingview.hasSession).toBe(true);

      // Verify users can't see each other's sessions
      expect(user1Data.currentUser).not.toBe(user2Data.currentUser);
      expect(user1Data.platforms.marketinout.hasSession).not.toBe(user2Data.platforms.marketinout.hasSession);
    });

    it('should require valid credentials', async () => {
      const invalidCredentials = {
        userEmail: '',
        userPassword: ''
      };

      const request = new NextRequest('http://localhost:3000/api/session/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidCredentials),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing user credentials');
      expect(data.success).toBe(false);
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/session/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
      expect(data.success).toBe(false);
    });

    it('should handle invalid content type', async () => {
      const request = new NextRequest('http://localhost:3000/api/session/current', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'some text',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid content type');
      expect(data.success).toBe(false);
    });

    it('should return platform-specific sessions for authenticated user', async () => {
      const userCredentials = {
        userEmail: 'testuser@example.com',
        userPassword: 'testpass'
      };

      // Mock platform-specific request - ensure all required mocks are set up
      mockSessionResolver.hasSessionsForPlatformAndUser.mockResolvedValue(true);
      mockSessionResolver.getLatestSessionForUser.mockResolvedValue({
        internalId: 'tv-session-123',
        sessionData: { sessionId: 'tv789', userId: 'testuser@example.com' }
      });

      // Ensure getSessionStats and getAvailableUsers are mocked for this test
      mockSessionResolver.getSessionStats.mockResolvedValue({
        totalSessions: 1,
        platforms: { tradingview: { count: 1 } }
      });
      mockSessionResolver.getAvailableUsers.mockResolvedValue([
        'user1@test.com', 'user2@test.com', 'admin@test.com'
      ]);

      const request = new NextRequest('http://localhost:3000/api/session/current?platform=tradingview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userCredentials, platform: 'tradingview' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.platform).toBe('tradingview');
      expect(data.currentUser).toBe('testuser@example.com');
      expect(data.hasSession).toBe(true);
      expect(data.sessionId).toBe('tv789');
      expect(data.availableUsers).toEqual(['user1@test.com', 'user2@test.com', 'admin@test.com']);

      // Verify platform-specific methods were called
      expect(mockSessionResolver.hasSessionsForPlatformAndUser).toHaveBeenCalledWith('tradingview', userCredentials);
      expect(mockSessionResolver.getLatestSessionForUser).toHaveBeenCalledWith('tradingview', userCredentials);
    });
  });

  describe('Error handling', () => {
    it('should handle SessionResolver errors gracefully', async () => {
      mockSessionResolver.getSessionStats.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/session/current');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to retrieve session information');
      expect(data.hasSession).toBe(false);
      expect(data.sessionAvailable).toBe(false);
    });

    it('should handle POST endpoint errors gracefully', async () => {
      const userCredentials = {
        userEmail: 'user@test.com',
        userPassword: 'password'
      };

      mockSessionResolver.getSessionStats.mockRejectedValue(new Error('Session store unavailable'));

      const request = new NextRequest('http://localhost:3000/api/session/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userCredentials),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to retrieve user session information');
      expect(data.hasSession).toBe(false);
      expect(data.sessionAvailable).toBe(false);
    });
  });
});
