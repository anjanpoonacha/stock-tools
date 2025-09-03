import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/contexts/AuthContext';
import UserAuthTestPage from '@/app/user-authentication/page';

// Mock the session API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

/**
 * Test suite for stale session state issue
 * Scenario: User is logged in with active sessions, KV data gets removed,
 * page refresh should detect stale state and show correct session status
 */
describe('Stale Session State Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('should detect stale session state after KV data is removed and page refresh', async () => {
    // SETUP: Simulate user was previously logged in with active sessions
    const storedCredentials = {
      userEmail: 'test@example.com',
      userPassword: 'password123'
    };

    const staleAuthStatus = {
      isAuthenticated: true,
      userEmail: 'test@example.com',
      sessionStats: {
        platforms: {
          marketinout: { sessionAvailable: true },
          tradingview: { sessionAvailable: true }
        },
        message: 'Sessions available - all operations should work automatically',
        availableUsers: ['test@example.com'],
        currentUser: 'test@example.com'
      }
    };

    // Mock localStorage to return stored credentials and stale auth status
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'mio-tv-auth-credentials') {
        return JSON.stringify(storedCredentials);
      }
      if (key === 'mio-tv-auth-status') {
        return JSON.stringify(staleAuthStatus);
      }
      return null;
    });

    // SIMULATE: KV data has been removed - API now returns no sessions
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hasSession: false,
        sessionAvailable: false,
        platforms: {
          marketinout: { hasSession: false, sessionAvailable: false },
          tradingview: { hasSession: false, sessionAvailable: false }
        },
        message: 'No sessions found for user test@example.com - please use browser extension to capture sessions',
        availableUsers: ['test@example.com'],
        currentUser: 'test@example.com'
      })
    });

    // ACT: Render component (simulates page refresh)
    render(
      <TestWrapper>
        <UserAuthTestPage />
      </TestWrapper>
    );

    // ASSERT: After validation, should show correct "No Session" status
    await waitFor(() => {
      // Should show "No Session" for both platforms (may appear multiple times in UI)
      const noSessionElements = screen.getAllByText('No Session');
      expect(noSessionElements.length).toBeGreaterThanOrEqual(2); // At least one for MIO, one for TV
    }, { timeout: 3000 });

    // ASSERT: Should show appropriate message about no sessions (use getAllByText since message may appear multiple times)
    await waitFor(() => {
      const noSessionMessages = screen.getAllByText(/No sessions found for user test@example.com/);
      expect(noSessionMessages.length).toBeGreaterThanOrEqual(1);
    });

    // ASSERT: Should have called API to validate session state
    expect(mockFetch).toHaveBeenCalledWith('/api/session/current', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(storedCredentials),
    });

    // ASSERT: Should update stored auth status with fresh data
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'mio-tv-auth-status',
      expect.stringContaining('"sessionAvailable":false')
    );
  });

  it('should handle session validation failure and clear stale credentials', async () => {
    // SETUP: Simulate stored credentials that are no longer valid
    const invalidCredentials = {
      userEmail: 'invalid@example.com',
      userPassword: 'wrongpassword'
    };

    const staleAuthStatus = {
      isAuthenticated: true,
      userEmail: 'invalid@example.com',
      sessionStats: {
        platforms: {
          marketinout: { sessionAvailable: true }
        }
      }
    };

    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'mio-tv-auth-credentials') {
        return JSON.stringify(invalidCredentials);
      }
      if (key === 'mio-tv-auth-status') {
        return JSON.stringify(staleAuthStatus);
      }
      return null;
    });

    // SIMULATE: API returns 400/401 for invalid credentials
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Missing user credentials',
        success: false
      })
    });

    // ACT: Render component
    render(
      <TestWrapper>
        <UserAuthTestPage />
      </TestWrapper>
    );

    // ASSERT: Should clear invalid stored credentials
    await waitFor(() => {
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('mio-tv-auth-credentials');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('mio-tv-auth-status');
    });

    // ASSERT: Should show authentication prompt
    await waitFor(() => {
      expect(screen.getByText('Enter your credentials to view session data')).toBeInTheDocument();
    });
  });

  it('should show active sessions when KV data is available after refresh', async () => {
    // SETUP: User has valid stored credentials
    const validCredentials = {
      userEmail: 'valid@example.com',
      userPassword: 'validpassword'
    };

    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'mio-tv-auth-credentials') {
        return JSON.stringify(validCredentials);
      }
      if (key === 'mio-tv-auth-status') {
        return JSON.stringify({
          isAuthenticated: true,
          userEmail: 'valid@example.com'
        });
      }
      return null;
    });

    // SIMULATE: KV data is available - API returns active sessions
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hasSession: true,
        sessionAvailable: true,
        platforms: {
          marketinout: { hasSession: true, sessionAvailable: true },
          tradingview: { hasSession: true, sessionAvailable: true }
        },
        message: 'Sessions available for user valid@example.com - all operations should work automatically',
        availableUsers: ['valid@example.com'],
        currentUser: 'valid@example.com'
      })
    });

    // ACT: Render component
    render(
      <TestWrapper>
        <UserAuthTestPage />
      </TestWrapper>
    );

    // ASSERT: Should show active sessions
    await waitFor(() => {
      const activeSessionElements = screen.getAllByText('Active Session');
      expect(activeSessionElements).toHaveLength(2); // One for MIO, one for TV
    });

    // ASSERT: Should show success message (use getAllByText since message may appear multiple times)
    await waitFor(() => {
      const successMessages = screen.getAllByText(/Sessions available for user valid@example.com/);
      expect(successMessages.length).toBeGreaterThanOrEqual(1);
    });
  });
});
