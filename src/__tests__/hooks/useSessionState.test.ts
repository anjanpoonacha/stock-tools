import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionState, useSessionStateReader } from '@/hooks/useSessionState';
import { useAuth } from '@/contexts/AuthContext';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext');

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

describe('useSessionState', () => {
	const mockAuthContext = {
		authStatus: null as unknown,
		isLoading: false,
		error: null as string | null,
		login: vi.fn(),
		logout: vi.fn(),
		checkAuthStatus: vi.fn(),
		isAuthenticated: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset mock context to defaults
		mockAuthContext.authStatus = null;
		mockAuthContext.isLoading = false;
		mockAuthContext.error = null;
		mockAuthContext.isAuthenticated.mockReturnValue(false);
		(useAuth as ReturnType<typeof vi.fn>).mockReturnValue(mockAuthContext);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('useSessionState', () => {
		it('should return initial state when no auth status', () => {
			const { result } = renderHook(() => useSessionState());

			expect(result.current.sessionStats).toBeNull();
			expect(result.current.isLoading).toBe(false);
			expect(result.current.error).toBeNull();
			expect(result.current.credentials).toBeNull();
			expect(result.current.isLoggedIn).toBe(false);
			expect(typeof result.current.lastUpdated).toBe('number');
		});

		it('should map auth status to session stats correctly', () => {
			const mockAuthStatus = {
				userEmail: 'test@example.com',
				sessionStats: {
					platforms: {
						marketinout: { sessionAvailable: true },
						tradingview: { sessionAvailable: false },
					},
					availableUsers: ['user1', 'user2'],
					currentUser: 'user1',
					message: 'Session active',
				},
			};

			mockAuthContext.authStatus = mockAuthStatus;
			mockAuthContext.isAuthenticated.mockReturnValue(true);

			const { result } = renderHook(() => useSessionState());

			expect(result.current.sessionStats).toEqual({
				hasSession: true,
				sessionAvailable: true,
				availableUsers: ['user1', 'user2'],
				currentUser: 'user1',
				platforms: {
					marketinout: {
						hasSession: true,
						sessionAvailable: true,
					},
					tradingview: {
						hasSession: false,
						sessionAvailable: false,
					},
				},
				message: 'Session active',
			});

			expect(result.current.credentials).toEqual({
				userEmail: 'test@example.com',
				userPassword: '',
			});

			expect(result.current.isLoggedIn).toBe(true);
		});

		it('should handle auth status without platforms', () => {
			const mockAuthStatus = {
				userEmail: 'test@example.com',
				sessionStats: {
					availableUsers: [],
					currentUser: null,
					message: 'No platforms',
				},
			};

			mockAuthContext.authStatus = mockAuthStatus;

			const { result } = renderHook(() => useSessionState());

			expect(result.current.sessionStats).toEqual({
				hasSession: false,
				sessionAvailable: false,
				availableUsers: [],
				currentUser: null,
				platforms: undefined,
				message: 'No platforms',
			});
		});

		it('should delegate login to AuthContext', async () => {
			const credentials = { userEmail: 'test@example.com', userPassword: 'password' };
			mockAuthContext.login.mockResolvedValue(true);

			const { result } = renderHook(() => useSessionState());

			await result.current.login(credentials);

			expect(mockAuthContext.login).toHaveBeenCalledWith(credentials);
		});

		it('should delegate logout to AuthContext and clean localStorage', () => {
			const { result } = renderHook(() => useSessionState());

			result.current.logout();

			expect(mockAuthContext.logout).toHaveBeenCalled();
			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('userEmail');
			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('userPassword');
		});

		it('should delegate refresh session to AuthContext', async () => {
			const { result } = renderHook(() => useSessionState());

			await result.current.refreshSession();

			expect(mockAuthContext.checkAuthStatus).toHaveBeenCalled();
		});

		it('should handle autoLogin (no-op)', async () => {
			const { result } = renderHook(() => useSessionState());

			await result.current.autoLogin();

			// Should not throw and should be a no-op
			expect(true).toBe(true);
		});

		it('should handle clearError (no-op)', () => {
			const { result } = renderHook(() => useSessionState());

			result.current.clearError();

			// Should not throw and should be a no-op
			expect(true).toBe(true);
		});

		it('should handle loading state from AuthContext', () => {
			mockAuthContext.isLoading = true;

			const { result } = renderHook(() => useSessionState());

			expect(result.current.isLoading).toBe(true);
		});

		it('should handle error state from AuthContext', () => {
			mockAuthContext.error = 'Authentication failed';

			const { result } = renderHook(() => useSessionState());

			expect(result.current.error).toBe('Authentication failed');
		});
	});

	describe('useSessionStateReader', () => {
		it('should return read-only session state', () => {
			const mockAuthStatus = {
				userEmail: 'test@example.com',
				sessionStats: {
					platforms: {
						marketinout: { sessionAvailable: true },
					},
					availableUsers: ['user1'],
					currentUser: 'user1',
					message: 'Active session',
				},
			};

			mockAuthContext.authStatus = mockAuthStatus;
			mockAuthContext.isAuthenticated.mockReturnValue(true);

			const { result } = renderHook(() => useSessionStateReader());

			expect(result.current.sessionStats).toEqual({
				hasSession: true,
				sessionAvailable: true,
				availableUsers: ['user1'],
				currentUser: 'user1',
				platforms: {
					marketinout: {
						hasSession: true,
						sessionAvailable: true,
					},
					tradingview: undefined,
				},
				message: 'Active session',
			});

			expect(result.current.credentials).toEqual({
				userEmail: 'test@example.com',
				userPassword: '',
			});

			expect(result.current.isLoggedIn).toBe(true);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.error).toBeNull();
			expect(typeof result.current.lastUpdated).toBe('number');
		});

		it('should return null session stats when no auth status', () => {
			mockAuthContext.authStatus = null;

			const { result } = renderHook(() => useSessionStateReader());

			expect(result.current.sessionStats).toBeNull();
			expect(result.current.credentials).toBeNull();
			expect(result.current.isLoggedIn).toBe(false);
		});

		it('should handle auth status without session stats', () => {
			const mockAuthStatus = {
				userEmail: 'test@example.com',
			};

			mockAuthContext.authStatus = mockAuthStatus;

			const { result } = renderHook(() => useSessionStateReader());

			expect(result.current.sessionStats).toBeNull();
			expect(result.current.credentials).toEqual({
				userEmail: 'test@example.com',
				userPassword: '',
			});
		});
	});
});
