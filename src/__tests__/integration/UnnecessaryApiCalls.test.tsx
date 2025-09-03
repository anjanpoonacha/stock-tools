import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/contexts/AuthContext';
import MioSyncPage from '@/app/mio-sync/page';

// Mock the hooks and components
vi.mock('@/lib/useSessionBridge', () => ({
  useSessionBridge: () => [null, false, null], // No TradingView session
}));

vi.mock('@/hooks/useSessionAvailability', () => ({
  useSessionAvailability: () => ({
    mioSessionAvailable: false, // No MIO session available
    tvSessionAvailable: false,
    loading: false,
    error: null,
  }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('@/components/dashboard/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/auth/AuthGuard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Unnecessary API Calls Issue', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock localStorage with valid credentials
    const mockCredentials = {
      userEmail: 'anjan@example.com',
      userPassword: 'password123',
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

    // Spy on fetch to track API calls
    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: string | URL | Request) => {
      if (url === '/api/mio-action') {
        // This should NOT be called when no session is available
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            statusText: 'Unauthorized',
          })
        );
      }
      
      // Mock other API calls as needed
      return Promise.resolve(
        new Response(JSON.stringify({}), { status: 200 })
      );
    });

    // Spy on console.log to verify the skip message
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should NOT make API calls to /api/mio-action when no MIO session is available', async () => {
    render(
      <AuthProvider>
        <MioSyncPage />
      </AuthProvider>
    );

    // Wait for component to fully render and effects to run
    await waitFor(() => {
      expect(screen.getByText('MIO Sync')).toBeInTheDocument();
    });

    // Should show the warning message for no MIO session
    await waitFor(() => {
      expect(screen.getByText(/No MarketInOut session found/)).toBeInTheDocument();
    });

    // Wait a bit more to ensure all effects have completed
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[SYNC] Skipping MIO watchlists fetch - no session available'
      );
    }, { timeout: 2000 });

    // CRITICAL: Verify that /api/mio-action was NOT called
    const mioActionCalls = fetchSpy.mock.calls.filter((call: unknown[]) => 
      call[0] === '/api/mio-action'
    );
    
    expect(mioActionCalls).toHaveLength(0);
    
    // Verify the skip message was logged
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[SYNC] Skipping MIO watchlists fetch - no session available'
    );
  });

  it('should show appropriate warning messages without making unauthorized API calls', async () => {
    render(
      <AuthProvider>
        <MioSyncPage />
      </AuthProvider>
    );

    // Should show warning for MarketInOut
    await waitFor(() => {
      expect(screen.getByText(/No MarketInOut session found/)).toBeInTheDocument();
    });

    // Should show message about using browser extension
    await waitFor(() => {
      expect(screen.getByText(/Please use the browser extension to capture sessions from marketinout.com/)).toBeInTheDocument();
    });

    // Verify no unauthorized API calls were made
    const unauthorizedCalls = fetchSpy.mock.calls.filter((call: unknown[]) => {
      const url = call[0];
      return url === '/api/mio-action';
    });

    expect(unauthorizedCalls).toHaveLength(0);
  });

  it('should handle the race condition where session check completes after component mount', async () => {
    // Re-mock the hook for this specific test with loading state
    vi.mocked(vi.doMock('@/hooks/useSessionAvailability', () => ({
      useSessionAvailability: () => ({
        mioSessionAvailable: false,
        tvSessionAvailable: false,
        loading: true, // Still loading initially
        error: null,
      }),
    })));

    render(
      <AuthProvider>
        <MioSyncPage />
      </AuthProvider>
    );

    // Even during any loading state, should not make API calls to /api/mio-action
    await waitFor(() => {
      expect(screen.getByText('MIO Sync')).toBeInTheDocument();
    });

    // The key test: verify no API calls were made regardless of loading state
    const mioActionCalls = fetchSpy.mock.calls.filter((call: unknown[]) => 
      call[0] === '/api/mio-action'
    );
    
    expect(mioActionCalls).toHaveLength(0);
  });
});
