import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextRouter } from 'next/router';
import MioSyncPage from '@/app/mio-sync/page';
import MioWatchlistPage from '@/app/mio-watchlist/page';
import TvSyncPage from '@/app/tv-sync/page';

// Mock Next.js router
const mockRouter: Partial<NextRouter> = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  pathname: '/mio-sync',
  query: {},
  asPath: '/mio-sync',
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/mio-sync',
}));

// Mock AuthContext to simulate logged-in user
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    authStatus: {
      isAuthenticated: true,
      userEmail: 'anjan@example.com',
      sessionStats: {
        platforms: {},
        message: 'User authenticated',
        availableUsers: ['anjan@example.com'],
        currentUser: 'anjan@example.com',
      },
    },
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuthStatus: vi.fn(),
    isAuthenticated: () => true,
    getUserEmail: () => 'anjan@example.com',
    requiresAuth: () => false,
  }),
}));

// Mock toast hook
const mockShowToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockShowToast,
}));

// Mock useSessionAvailability hook to return no sessions available
vi.mock('@/hooks/useSessionAvailability', () => ({
  useSessionAvailability: () => ({
    mioSessionAvailable: false,
    tvSessionAvailable: false,
    loading: false,
    error: null,
  }),
}));

// Track fetch calls
const fetchSpy = vi.fn();

/**
 * Comprehensive test to verify that all pages with MIO API calls
 * have been fixed to not make unnecessary requests when no sessions exist
 */
describe('All Pages API Calls Fix', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Mock localStorage with valid credentials
    const mockCredentials = {
      userEmail: 'anjan@example.com',
      userPassword: 'password123'
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => {
          if (key === 'mio-tv-auth-credentials') {
            return JSON.stringify(mockCredentials);
          }
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    // Mock global fetch and track calls
    global.fetch = fetchSpy;
    
    // Mock session API to return no sessions
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes('/api/session/current')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            platform: 'tradingview',
            hasSession: false,
            sessionAvailable: false,
            sessionId: null,
            message: 'No session found'
          })
        });
      }
      
      // If any call to /api/mio-action is made, we'll track it
      // This should NOT happen when no sessions exist
      if (url.includes('/api/mio-action')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({
            error: 'No MarketInOut session found. Please use the browser extension to capture sessions from marketinout.com',
            needsSession: true
          })
        });
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' })
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('MIO Sync page should not make API calls when no sessions exist', async () => {
    render(<MioSyncPage />);

    // Wait for component to fully load
    await waitFor(() => {
      expect(screen.getByText('MIO Sync')).toBeInTheDocument();
    });

    // Wait for all async operations to complete
    await waitFor(() => {
      const warningMessages = screen.queryAllByText(/No MarketInOut session found|Visit TradingView and log in/);
      expect(warningMessages.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Verify no API calls to /api/mio-action were made
    const mioActionCalls = fetchSpy.mock.calls.filter(call => 
      call[0].includes('/api/mio-action')
    );
    expect(mioActionCalls.length).toBe(0);
  });

  it('MIO Watchlist page should not make API calls when no sessions exist', async () => {
    render(<MioWatchlistPage />);

    // Wait for component to fully load
    await waitFor(() => {
      expect(screen.getByText('MIO Watchlist Management')).toBeInTheDocument();
    });

    // Wait for all async operations to complete
    await waitFor(() => {
      const warningMessages = screen.queryAllByText(/No MarketInOut session found|Please use the browser extension/);
      expect(warningMessages.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Verify no API calls to /api/mio-action were made
    const mioActionCalls = fetchSpy.mock.calls.filter(call => 
      call[0].includes('/api/mio-action')
    );
    expect(mioActionCalls.length).toBe(0);
  });

  it('TV Sync page should not make API calls when no sessions exist', async () => {
    render(<TvSyncPage />);

    // Wait for component to fully load
    await waitFor(() => {
      expect(screen.getByText('TradingView Screener Sync')).toBeInTheDocument();
    });

    // Wait for all async operations to complete
    await waitFor(() => {
      const warningMessages = screen.queryAllByText(/Visit TradingView and log in|No TradingView session/);
      expect(warningMessages.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Verify no API calls to /api/proxy for TradingView watchlists were made
    const proxyWatchlistCalls = fetchSpy.mock.calls.filter(call => 
      call[0].includes('/api/proxy') && 
      call[1]?.body?.includes('symbols_list/all')
    );
    expect(proxyWatchlistCalls.length).toBe(0);
  });

  it('should show appropriate console messages for skipped API calls', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    
    // Test MIO Sync page
    render(<MioSyncPage />);
    await waitFor(() => {
      expect(screen.getByText('MIO Sync')).toBeInTheDocument();
    });

    // Test MIO Watchlist page
    render(<MioWatchlistPage />);
    await waitFor(() => {
      expect(screen.getByText('MIO Watchlist Management')).toBeInTheDocument();
    });

    // Test TV Sync page
    render(<TvSyncPage />);
    await waitFor(() => {
      expect(screen.getByText('TradingView Screener Sync')).toBeInTheDocument();
    });

    // Wait for console messages
    await waitFor(() => {
      const consoleMessages = consoleSpy.mock.calls.map(call => call.join(' '));
      const syncSkipMessage = consoleMessages.some(msg => 
        msg.includes('[SYNC] Skipping MIO watchlists fetch - no session available')
      );
      const watchlistSkipMessage = consoleMessages.some(msg => 
        msg.includes('[MIO-WATCHLIST] Skipping watchlists fetch - no session available')
      );
      const tvSyncSkipMessage = consoleMessages.some(msg => 
        msg.includes('[TV-SYNC] Skipping TradingView watchlists fetch - no session available')
      );
      
      expect(syncSkipMessage || watchlistSkipMessage || tvSyncSkipMessage).toBe(true);
    }, { timeout: 3000 });

    consoleSpy.mockRestore();
  });
});
