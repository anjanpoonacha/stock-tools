import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextRouter } from 'next/router';
import UserAuthTestPage from '@/app/user-authentication/page';

// Mock Next.js router
const mockRouter: Partial<NextRouter> = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  pathname: '/user-authentication',
  query: {},
  asPath: '/user-authentication',
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/user-authentication',
}));

// Mock AuthContext with different user scenarios
const mockAuthContext = {
  authStatus: null as AuthStatus | null,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  checkAuthStatus: vi.fn(),
  isAuthenticated: vi.fn(() => false),
  getUserEmail: vi.fn(() => null),
  requiresAuth: vi.fn(() => true),
};

interface AuthStatus {
  isAuthenticated: boolean;
  userEmail: string;
  sessionStats: {
    platforms: {
      marketinout?: { sessionAvailable: boolean };
      tradingview?: { sessionAvailable: boolean };
    };
    message: string;
    availableUsers: string[];
    currentUser: string;
  };
}

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}));

// Track fetch calls to ensure no insecure GET calls are made
const fetchSpy = vi.fn();

/**
 * Test suite to verify user authentication page security and user isolation
 */
describe('User Authentication Page Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchSpy;
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not make any insecure GET calls to session API', async () => {
    // Mock unauthenticated state
    mockAuthContext.authStatus = null;
    mockAuthContext.isAuthenticated = vi.fn(() => false);

    render(<UserAuthTestPage />);

    // Wait for component to fully render - use more specific text
    await waitFor(() => {
      expect(screen.getByText('Use the password same as that in the Chrome extension')).toBeInTheDocument();
    });

    // Verify no GET calls to /api/session/current were made
    const insecureGetCalls = fetchSpy.mock.calls.filter(call => 
      call[0].includes('/api/session/current') && 
      (!call[1] || call[1].method !== 'POST')
    );
    
    expect(insecureGetCalls.length).toBe(0);
  });

  it('should only show available users when authenticated', async () => {
    // Test unauthenticated state first
    mockAuthContext.authStatus = null;
    mockAuthContext.isAuthenticated = vi.fn(() => false);

    const { rerender } = render(<UserAuthTestPage />);

    // Should not show available users when not authenticated
    expect(screen.queryByText(/Available Users/)).not.toBeInTheDocument();

    // Now test authenticated state with user data
    mockAuthContext.authStatus = {
      isAuthenticated: true,
      userEmail: 'user1@test.com',
      sessionStats: {
        platforms: {
          marketinout: { sessionAvailable: true },
          tradingview: { sessionAvailable: false }
        },
        message: 'Sessions available for user user1@test.com',
        availableUsers: ['user1@test.com', 'user2@test.com'],
        currentUser: 'user1@test.com'
      }
    };
    mockAuthContext.isAuthenticated = vi.fn(() => true);

    rerender(<UserAuthTestPage />);

    // Should show available users when authenticated
    await waitFor(() => {
      expect(screen.getByText(/Available Users \(2\)/)).toBeInTheDocument();
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
      expect(screen.getByText('user2@test.com')).toBeInTheDocument();
    });
  });

  it('should display user-specific session data when authenticated', async () => {
    // Mock authenticated state with specific user data
    mockAuthContext.authStatus = {
      isAuthenticated: true,
      userEmail: 'testuser@example.com',
      sessionStats: {
        platforms: {
          marketinout: { sessionAvailable: true },
          tradingview: { sessionAvailable: false }
        },
        message: 'Sessions available for user testuser@example.com',
        availableUsers: ['testuser@example.com', 'otheruser@example.com'],
        currentUser: 'testuser@example.com'
      }
    };
    mockAuthContext.isAuthenticated = vi.fn(() => true);

    render(<UserAuthTestPage />);

    // Should show user-specific session data
    await waitFor(() => {
      expect(screen.getByText('Session Data for testuser@example.com')).toBeInTheDocument();
      expect(screen.getByText('Sessions filtered by user credentials')).toBeInTheDocument();
      expect(screen.getByText('Active Session')).toBeInTheDocument(); // MarketInOut active
      // There are multiple "No Session" elements (sidebar + main content), so just check that at least one exists
      expect(screen.getAllByText('No Session').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should show proper authentication prompt when not logged in', async () => {
    // Mock unauthenticated state
    mockAuthContext.authStatus = null;
    mockAuthContext.isAuthenticated = vi.fn(() => false);

    render(<UserAuthTestPage />);

    // Should show authentication prompt
    await waitFor(() => {
      expect(screen.getByText('Enter your credentials to view session data')).toBeInTheDocument();
    });

    // Should not show any session data
    expect(screen.queryByText(/Session Data for/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Active Session/)).not.toBeInTheDocument();
  });

  it('should handle loading state properly', async () => {
    // Mock loading state
    mockAuthContext.isLoading = true;
    mockAuthContext.authStatus = {
      isAuthenticated: true,
      userEmail: 'testuser@example.com',
      sessionStats: {
        platforms: {},
        message: 'Loading...',
        availableUsers: [],
        currentUser: 'testuser@example.com'
      }
    };

    render(<UserAuthTestPage />);

    // Should show loading spinner
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  it('should not expose sensitive data without authentication', async () => {
    // Mock unauthenticated state
    mockAuthContext.authStatus = null;
    mockAuthContext.isAuthenticated = vi.fn(() => false);

    render(<UserAuthTestPage />);

    await waitFor(() => {
      // Use getAllByText to handle multiple "User Authentication" elements (sidebar + main content)
      expect(screen.getAllByText('User Authentication').length).toBeGreaterThanOrEqual(1);
    });

    // Verify no sensitive data is displayed
    expect(screen.queryByText(/Session Data for/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Available Users/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Active Session/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Session Statistics/)).not.toBeInTheDocument();

    // Verify no API calls were made to fetch sensitive data
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should properly isolate user data between different users', async () => {
    // Test with first user
    mockAuthContext.authStatus = {
      isAuthenticated: true,
      userEmail: 'user1@test.com',
      sessionStats: {
        platforms: {
          marketinout: { sessionAvailable: true },
          tradingview: { sessionAvailable: true }
        },
        message: 'Sessions available for user user1@test.com',
        availableUsers: ['user1@test.com', 'user2@test.com'],
        currentUser: 'user1@test.com'
      }
    };

    const { rerender } = render(<UserAuthTestPage />);

    await waitFor(() => {
      expect(screen.getByText('Session Data for user1@test.com')).toBeInTheDocument();
      // Just verify the session data is displayed, don't check for specific statistics section
      expect(screen.getByText('Sessions filtered by user credentials')).toBeInTheDocument();
    });

    // Switch to second user
    mockAuthContext.authStatus = {
      isAuthenticated: true,
      userEmail: 'user2@test.com',
      sessionStats: {
        platforms: {
          marketinout: { sessionAvailable: false },
          tradingview: { sessionAvailable: true }
        },
        message: 'Sessions available for user user2@test.com',
        availableUsers: ['user1@test.com', 'user2@test.com'],
        currentUser: 'user2@test.com'
      }
    };

    rerender(<UserAuthTestPage />);

    await waitFor(() => {
      expect(screen.getByText('Session Data for user2@test.com')).toBeInTheDocument();
      // Just verify the session data is displayed, don't check for specific statistics section
      expect(screen.getByText('Sessions filtered by user credentials')).toBeInTheDocument();
    });

    // Verify user1 data is not shown
    expect(screen.queryByText('Session Data for user1@test.com')).not.toBeInTheDocument();
  });
});
