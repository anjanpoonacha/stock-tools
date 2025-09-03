import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
	getInternalSessionId,
	getInternalSessionIdFromServer,
	useInternalSessionId
} from '../../lib/useInternalSessionId';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
};

// Mock window object
const mockWindow = {
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	dispatchEvent: vi.fn(),
	localStorage: mockLocalStorage,
};

// Mock console methods
const mockConsoleWarn = vi.fn();
const mockConsoleError = vi.fn();

// Mock console object
Object.defineProperty(console, 'warn', {
	value: mockConsoleWarn,
	writable: true,
});

Object.defineProperty(console, 'error', {
	value: mockConsoleError,
	writable: true,
});

describe('useInternalSessionId', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Setup window mock
		Object.defineProperty(global, 'window', {
			value: mockWindow,
			writable: true,
		});

		// Setup localStorage mock
		Object.defineProperty(global, 'localStorage', {
			value: mockLocalStorage,
			writable: true,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('getInternalSessionId', () => {
		it('should return empty string when window is undefined (SSR)', () => {
			// Temporarily remove window
			const originalWindow = global.window;
			// @ts-expect-error - Testing SSR scenario
			delete global.window;

			const result = getInternalSessionId();

			expect(result).toBe('');

			// Restore window
			global.window = originalWindow;
		});

		it('should return session ID from localStorage when available', () => {
			const testSessionId = 'test-session-123';
			mockLocalStorage.getItem.mockReturnValue(testSessionId);

			const result = getInternalSessionId();

			expect(result).toBe(testSessionId);
			expect(mockLocalStorage.getItem).toHaveBeenCalledWith('marketinout_internalSessionId');
		});

		it('should return empty string when localStorage returns null', () => {
			mockLocalStorage.getItem.mockReturnValue(null);

			const result = getInternalSessionId();

			expect(result).toBe('');
			expect(mockLocalStorage.getItem).toHaveBeenCalledWith('marketinout_internalSessionId');
		});

		it('should return empty string when localStorage returns empty string', () => {
			mockLocalStorage.getItem.mockReturnValue('');

			const result = getInternalSessionId();

			expect(result).toBe('');
			expect(mockLocalStorage.getItem).toHaveBeenCalledWith('marketinout_internalSessionId');
		});
	});

	describe('getInternalSessionIdFromServer', () => {
		it('should fetch session ID from server successfully', async () => {
			const testSessionId = 'server-session-456';
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					hasSession: true,
					sessionId: testSessionId,
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await getInternalSessionIdFromServer();

			expect(result).toBe(testSessionId);
			expect(mockFetch).toHaveBeenCalledWith('/api/session/current', {
				method: 'GET',
				credentials: 'include',
			});
			expect(mockLocalStorage.setItem).toHaveBeenCalledWith('marketinout_internalSessionId', testSessionId);
			expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(new Event('internalSessionIdChanged'));
		});

		it('should return empty string when server response is not ok', async () => {
			const mockResponse = {
				ok: false,
				status: 401,
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await getInternalSessionIdFromServer();

			expect(result).toBe('');
			expect(mockConsoleWarn).toHaveBeenCalledWith(
				'[SESSION] Failed to fetch session from server:',
				401
			);
			expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
			expect(mockWindow.dispatchEvent).not.toHaveBeenCalled();
		});

		it('should return empty string when server response has no session', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					hasSession: false,
					sessionId: null,
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await getInternalSessionIdFromServer();

			expect(result).toBe('');
			expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
			expect(mockWindow.dispatchEvent).not.toHaveBeenCalled();
		});

		it('should return empty string when server response has no sessionId', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					hasSession: true,
					sessionId: null,
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await getInternalSessionIdFromServer();

			expect(result).toBe('');
			expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
			expect(mockWindow.dispatchEvent).not.toHaveBeenCalled();
		});

		it('should return empty string when server response has empty sessionId', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					hasSession: true,
					sessionId: '',
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await getInternalSessionIdFromServer();

			expect(result).toBe('');
			expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
			expect(mockWindow.dispatchEvent).not.toHaveBeenCalled();
		});

		it('should handle JSON parsing errors', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await getInternalSessionIdFromServer();

			expect(result).toBe('');
			expect(mockConsoleError).toHaveBeenCalledWith(
				'[SESSION] Error fetching session from server:',
				expect.any(Error)
			);
		});

		it('should handle network errors', async () => {
			const networkError = new Error('Network error');
			mockFetch.mockRejectedValue(networkError);

			const result = await getInternalSessionIdFromServer();

			expect(result).toBe('');
			expect(mockConsoleError).toHaveBeenCalledWith(
				'[SESSION] Error fetching session from server:',
				networkError
			);
		});

		it('should handle server errors with different status codes', async () => {
			const mockResponse = {
				ok: false,
				status: 500,
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await getInternalSessionIdFromServer();

			expect(result).toBe('');
			expect(mockConsoleWarn).toHaveBeenCalledWith(
				'[SESSION] Failed to fetch session from server:',
				500
			);
		});
	});

	describe('useInternalSessionId hook', () => {
		it('should initialize with session ID from localStorage', async () => {
			const testSessionId = 'hook-session-789';
			mockLocalStorage.getItem.mockReturnValue(testSessionId);

			const { result } = renderHook(() => useInternalSessionId());

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(result.current.internalSessionId).toBe(testSessionId);
		});

		it('should fetch from server when localStorage is empty', async () => {
			const testSessionId = 'server-hook-session-101';
			mockLocalStorage.getItem.mockReturnValue(null);

			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					hasSession: true,
					sessionId: testSessionId,
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const { result } = renderHook(() => useInternalSessionId());

			// Wait for async server fetch with longer timeout
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(result.current.internalSessionId).toBe(testSessionId);
			expect(mockFetch).toHaveBeenCalledWith('/api/session/current', {
				method: 'GET',
				credentials: 'include',
			});
		});

		it('should remain empty when both localStorage and server return empty', async () => {
			mockLocalStorage.getItem.mockReturnValue(null);

			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					hasSession: false,
					sessionId: null,
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const { result } = renderHook(() => useInternalSessionId());

			// Wait for async server fetch
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(result.current.internalSessionId).toBe('');
		});

		it('should set up storage event listener', () => {
			renderHook(() => useInternalSessionId());

			expect(mockWindow.addEventListener).toHaveBeenCalledWith(
				'storage',
				expect.any(Function)
			);
		});

		it('should set up custom event listener', () => {
			renderHook(() => useInternalSessionId());

			expect(mockWindow.addEventListener).toHaveBeenCalledWith(
				'internalSessionIdChanged',
				expect.any(Function)
			);
		});

		it('should update state when storage event occurs', async () => {
			const initialSessionId = 'initial-session';
			const updatedSessionId = 'updated-session';

			mockLocalStorage.getItem
				.mockReturnValueOnce(initialSessionId)
				.mockReturnValueOnce(updatedSessionId);

			const { result } = renderHook(() => useInternalSessionId());

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(result.current.internalSessionId).toBe(initialSessionId);

			// Simulate storage event
			const storageEventHandler = mockWindow.addEventListener.mock.calls
				.find(call => call[0] === 'storage')?.[1];

			if (storageEventHandler) {
				const mockStorageEvent = {
					key: 'marketinout_internalSessionId',
					newValue: updatedSessionId,
				} as StorageEvent;

				act(() => {
					storageEventHandler(mockStorageEvent);
				});

				expect(result.current.internalSessionId).toBe(updatedSessionId);
			}
		});

		it('should handle storage event with null newValue', async () => {
			const initialSessionId = 'initial-session';

			mockLocalStorage.getItem.mockReturnValue(initialSessionId);

			const { result } = renderHook(() => useInternalSessionId());

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(result.current.internalSessionId).toBe(initialSessionId);

			// Simulate storage event with null newValue
			const storageEventHandler = mockWindow.addEventListener.mock.calls
				.find(call => call[0] === 'storage')?.[1];

			if (storageEventHandler) {
				const mockStorageEvent = {
					key: 'marketinout_internalSessionId',
					newValue: null,
				} as StorageEvent;

				act(() => {
					storageEventHandler(mockStorageEvent);
				});

				expect(result.current.internalSessionId).toBe('');
			}
		});

		it('should ignore storage events for other keys', async () => {
			const initialSessionId = 'initial-session';

			mockLocalStorage.getItem.mockReturnValue(initialSessionId);

			const { result } = renderHook(() => useInternalSessionId());

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(result.current.internalSessionId).toBe(initialSessionId);

			// Simulate storage event for different key
			const storageEventHandler = mockWindow.addEventListener.mock.calls
				.find(call => call[0] === 'storage')?.[1];

			if (storageEventHandler) {
				const mockStorageEvent = {
					key: 'other_key',
					newValue: 'other-value',
				} as StorageEvent;

				act(() => {
					storageEventHandler(mockStorageEvent);
				});

				// Should remain unchanged
				expect(result.current.internalSessionId).toBe(initialSessionId);
			}
		});

		it('should update state when custom event occurs', async () => {
			const initialSessionId = 'initial-session';
			const updatedSessionId = 'custom-updated-session';

			mockLocalStorage.getItem
				.mockReturnValueOnce(initialSessionId)
				.mockReturnValueOnce(updatedSessionId);

			const { result } = renderHook(() => useInternalSessionId());

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(result.current.internalSessionId).toBe(initialSessionId);

			// Simulate custom event
			const customEventHandler = mockWindow.addEventListener.mock.calls
				.find(call => call[0] === 'internalSessionIdChanged')?.[1];

			if (customEventHandler) {
				act(() => {
					customEventHandler();
				});

				expect(result.current.internalSessionId).toBe(updatedSessionId);
			}
		});

		it('should clean up event listeners on unmount', () => {
			const { unmount } = renderHook(() => useInternalSessionId());

			unmount();

			expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
				'storage',
				expect.any(Function)
			);
			expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
				'internalSessionIdChanged',
				expect.any(Function)
			);
		});

		it('should handle server fetch errors gracefully in hook', async () => {
			mockLocalStorage.getItem.mockReturnValue(null);
			mockFetch.mockRejectedValue(new Error('Server error'));

			const { result } = renderHook(() => useInternalSessionId());

			// Wait for async server fetch attempt
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(result.current.internalSessionId).toBe('');
			expect(mockConsoleError).toHaveBeenCalledWith(
				'[SESSION] Error fetching session from server:',
				expect.any(Error)
			);
		});
	});
});
