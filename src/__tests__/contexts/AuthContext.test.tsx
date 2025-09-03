import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth, useRequireAuth } from '@/contexts/AuthContext';
import { UserCredentials } from '@/types/auth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();

// Test component to access AuthContext
function TestComponent() {
  const auth = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{auth.isLoading.toString()}</div>
      <div data-testid="authenticated">{auth.isAuthenticated().toString()}</div>
      <div data-testid="email">{auth.getUserEmail() || 'null'}</div>
      <div data-testid="requires-auth">{auth.requiresAuth().toString()}</div>
      <div data-testid="error">{auth.error || 'null'}</div>
      <button 
        data-testid="login-btn" 
        onClick={() => auth.login({ userEmail: 'test@example.com', userPassword: 'password' })}
      >
        Login
      </button>
      <button data-testid="logout-btn" onClick={auth.logout}>Logout</button>
      <button data-testid="check-auth-btn" onClick={auth.checkAuthStatus}>Check Auth</button>
    </div>
  );
}

// Test component for useRequireAuth hook
function RequireAuthTestComponent() {
  const auth = useRequireAuth();
  
  return (
    <div>
      <div data-testid="needs-auth">{auth.needsAuth.toString()}</div>
      <div data-testid="authenticated">{auth.isAuthenticated().toString()}</div>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Reset mocks
    mockFetch.mockReset();
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(mockConsoleLog);
    vi.spyOn(console, 'error').mockImplementation(mockConsoleError);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AuthProvider', () => {
    it('should provide initial state correctly', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('email')).toHaveTextContent('null');
      expect(screen.getByTestId('requires-auth')).toHaveTextContent('true');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });

    it('should handle successful login', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          platforms: { tradingview: { status: 'online' } },
          message: 'Authentication successful',
          availableUsers: ['test@example.com'],
          currentUser: 'test@example.com'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initial loading
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // Trigger login
      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('email')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('requires-auth')).toHaveTextContent('false');
      });

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith('/api/session/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: 'test@example.com', userPassword: 'password' })
      });

      // Verify localStorage
      const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');
      const storedStatus = localStorage.getItem('mio-tv-auth-status');
      expect(storedCredentials).toBeTruthy();
      expect(storedStatus).toBeTruthy();
    });

    it('should handle login failure', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({ error: 'Invalid credentials' })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });
    });

    it('should handle network errors during login', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });
    });

    it('should handle logout correctly', async () => {
      // First login
      const mockResponse = {
        ok: true,
        json: async () => ({
          platforms: { tradingview: { status: 'online' } },
          message: 'Authentication successful'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });

      // Now logout
      await act(async () => {
        screen.getByTestId('logout-btn').click();
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('email')).toHaveTextContent('null');
      expect(screen.getByTestId('error')).toHaveTextContent('null');

      // Verify localStorage is cleared
      expect(localStorage.getItem('mio-tv-auth-credentials')).toBeNull();
      expect(localStorage.getItem('mio-tv-auth-status')).toBeNull();
    });

    it('should load stored credentials on mount', async () => {
      const credentials = { userEmail: 'stored@example.com', userPassword: 'password' };
      const authStatus = {
        isAuthenticated: true,
        userEmail: 'stored@example.com',
        sessionStats: {
          platforms: { tradingview: { status: 'online' } },
          message: 'Stored session'
        }
      };

      localStorage.setItem('mio-tv-auth-credentials', JSON.stringify(credentials));
      localStorage.setItem('mio-tv-auth-status', JSON.stringify(authStatus));

      // Mock the API call that validates stored credentials
      const mockResponse = {
        ok: true,
        json: async () => ({
          platforms: { tradingview: { sessionAvailable: true } },
          message: 'Stored session validated',
          availableUsers: ['stored@example.com'],
          currentUser: 'stored@example.com',
          hasSession: true
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('email')).toHaveTextContent('stored@example.com');
      });
    });

    it('should handle migration from old credentials', async () => {
      // Set old credentials
      localStorage.setItem('userEmail', 'old@example.com');
      localStorage.setItem('userPassword', 'oldpassword');

      const mockResponse = {
        ok: true,
        json: async () => ({
          platforms: { tradingview: { status: 'online' } },
          message: 'Migration successful',
          availableUsers: ['old@example.com'],
          currentUser: 'old@example.com'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('email')).toHaveTextContent('old@example.com');
      });

      // Verify old keys are removed
      expect(localStorage.getItem('userEmail')).toBeNull();
      expect(localStorage.getItem('userPassword')).toBeNull();

      // Verify new keys are set
      expect(localStorage.getItem('mio-tv-auth-credentials')).toBeTruthy();
      expect(localStorage.getItem('mio-tv-auth-status')).toBeTruthy();

      expect(mockConsoleLog).toHaveBeenCalledWith('[AuthContext] Migration successful, old keys removed');
    });

    it('should handle invalid stored credentials', async () => {
      // Set invalid credentials
      localStorage.setItem('mio-tv-auth-credentials', 'invalid-json');
      localStorage.setItem('mio-tv-auth-status', JSON.stringify({ isAuthenticated: true }));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });

      // Should clear invalid credentials
      expect(localStorage.getItem('mio-tv-auth-credentials')).toBeNull();
      expect(localStorage.getItem('mio-tv-auth-status')).toBeNull();
    });

    it('should handle checkAuthStatus with stored credentials', async () => {
      const credentials = { userEmail: 'check@example.com', userPassword: 'password' };
      localStorage.setItem('mio-tv-auth-credentials', JSON.stringify(credentials));

      const mockResponse = {
        ok: true,
        json: async () => ({
          platforms: { tradingview: { status: 'online' } },
          message: 'Auth check successful'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await act(async () => {
        screen.getByTestId('check-auth-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('email')).toHaveTextContent('check@example.com');
      });
    });

    it('should handle checkAuthStatus without stored credentials', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await act(async () => {
        screen.getByTestId('check-auth-btn').click();
      });

      // Should remain unauthenticated
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });

    it('should handle checkAuthStatus with invalid stored credentials', async () => {
      localStorage.setItem('mio-tv-auth-credentials', 'invalid-json');

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await act(async () => {
        screen.getByTestId('check-auth-btn').click();
      });

      // Should logout on error
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(localStorage.getItem('mio-tv-auth-credentials')).toBeNull();
    });

    it('should handle API response with sessionStats structure', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          sessionStats: {
            platforms: { marketinout: { status: 'online' } }
          },
          message: 'Success with sessionStats'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });
    });

    it('should handle API response without error message', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({})
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Authentication failed');
      });
    });

    it('should handle error during stored auth loading', async () => {
      // Set invalid JSON to trigger parsing error
      localStorage.setItem('mio-tv-auth-credentials', '{"invalid": json}'); // Invalid JSON
      localStorage.setItem('mio-tv-auth-status', '{"valid": "json"}');

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(mockConsoleError).toHaveBeenCalledWith('[AuthContext] Error loading stored auth:', expect.any(Error));
      
      // Should clear stored auth on error
      expect(localStorage.getItem('mio-tv-auth-credentials')).toBeNull();
      expect(localStorage.getItem('mio-tv-auth-status')).toBeNull();
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('useRequireAuth hook', () => {
    it('should return needsAuth true when not authenticated', async () => {
      render(
        <AuthProvider>
          <RequireAuthTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('needs-auth')).toHaveTextContent('true');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });
    });

    it('should return needsAuth false when authenticated', async () => {
      const credentials = { userEmail: 'auth@example.com', userPassword: 'password' };
      const authStatus = {
        isAuthenticated: true,
        userEmail: 'auth@example.com',
        sessionStats: { platforms: {}, message: 'Authenticated' }
      };

      localStorage.setItem('mio-tv-auth-credentials', JSON.stringify(credentials));
      localStorage.setItem('mio-tv-auth-status', JSON.stringify(authStatus));

      // Mock the API call that validates stored credentials
      const mockResponse = {
        ok: true,
        json: async () => ({
          platforms: { tradingview: { sessionAvailable: true } },
          message: 'Authenticated',
          availableUsers: ['auth@example.com'],
          currentUser: 'auth@example.com',
          hasSession: true
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <RequireAuthTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('needs-auth')).toHaveTextContent('false');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });
    });

    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<RequireAuthTestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle failed migration from old credentials', async () => {
      localStorage.setItem('userEmail', 'fail@example.com');
      localStorage.setItem('userPassword', 'failpassword');

      const mockResponse = {
        ok: false,
        json: async () => ({ error: 'Migration failed' })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });

      // Old credentials should still be present since migration failed
      expect(localStorage.getItem('userEmail')).toBe('fail@example.com');
      expect(localStorage.getItem('userPassword')).toBe('failpassword');
    });

    it('should handle invalid credentials schema during migration', async () => {
      localStorage.setItem('userEmail', 'invalid-email'); // Invalid email format
      localStorage.setItem('userPassword', ''); // Invalid password (empty)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });

      // The invalid credentials should not cause authentication
      // The component should remain in unauthenticated state
      expect(screen.getByTestId('requires-auth')).toHaveTextContent('true');
      expect(screen.getByTestId('email')).toHaveTextContent('null');
    });

    it('should handle invalid stored auth status', async () => {
      const credentials = { userEmail: 'valid@example.com', userPassword: 'password' };
      localStorage.setItem('mio-tv-auth-credentials', JSON.stringify(credentials));
      localStorage.setItem('mio-tv-auth-status', 'invalid-json');

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });

      // Should clear invalid stored data
      expect(localStorage.getItem('mio-tv-auth-credentials')).toBeNull();
      expect(localStorage.getItem('mio-tv-auth-status')).toBeNull();
    });

    it('should handle login with invalid credentials schema', async () => {
      // Create a test component that tries to login with invalid credentials
      function InvalidLoginTestComponent() {
        const auth = useAuth();
        
        React.useEffect(() => {
          const attemptInvalidLogin = async () => {
            try {
              await auth.login({ userEmail: '', userPassword: 'password' } as UserCredentials);
            } catch {
              // Expected to fail validation
            }
          };
          attemptInvalidLogin();
        }, [auth]);
        
        return (
          <div>
            <div data-testid="error">{auth.error || 'null'}</div>
            <div data-testid="loading">{auth.isLoading.toString()}</div>
          </div>
        );
      }

      render(
        <AuthProvider>
          <InvalidLoginTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).not.toHaveTextContent('null');
      });
    });
  });
});
