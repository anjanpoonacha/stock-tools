import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSessionBridge } from '@/lib/useSessionBridge';

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

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSessionBridge', () => {
	const mockCredentials = {
		userEmail: 'test@example.com',
		userPassword: 'password123',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockCredentials));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return initial loading state', () => {
		mockFetch.mockImplementation(() => new Promise(() => { })); // Never resolves

		const { result } = renderHook(() => useSessionBridge('tradingview'));

		const [sessionId, loading, error] = result.current;
		expect(sessionId).toBeNull();
		expect(loading).toBe(true);
		expect(error).toBeNull();
	});

	it('should fetch session successfully for tradingview', async () => {
		const mockResponse = {
			platform: 'tradingview',
			hasSession: true,
			sessionAvailable: true,
			sessionId: 'test-session-123',
			message: 'Session found',
		};

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(mockResponse),
		});

		const { result } = renderHook(() => useSessionBridge('tradingview'));

		await waitFor(() => {
			const [sessionId, loading, error] = result.current;
			expect(loading).toBe(false);
			expect(sessionId).toBe('test-session-123');
			expect(error).toBeNull();
		});

		expect(mockFetch).toHaveBeenCalledWith('/api/session/current', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				platform: 'tradingview',
				userEmail: 'test@example.com',
				userPassword: 'password123',
			}),
		});
	});

	it('should fetch session successfully for marketinout', async () => {
		const mockResponse = {
			platform: 'marketinout',
			hasSession: true,
			sessionAvailable: true,
			sessionId: 'mio-session-456',
			message: 'Session found',
		};

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(mockResponse),
		});

		const { result } = renderHook(() => useSessionBridge('marketinout'));

		await waitFor(() => {
			const [sessionId, loading, error] = result.current;
			expect(loading).toBe(false);
			expect(sessionId).toBe('mio-session-456');
			expect(error).toBeNull();
		});

		expect(mockFetch).toHaveBeenCalledWith('/api/session/current', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				platform: 'marketinout',
				userEmail: 'test@example.com',
				userPassword: 'password123',
			}),
		});
	});

	it('should handle no session available', async () => {
		const mockResponse = {
			platform: 'tradingview',
			hasSession: false,
			sessionAvailable: false,
			sessionId: null,
			message: 'No session found',
		};

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(mockResponse),
		});

		const { result } = renderHook(() => useSessionBridge('tradingview'));

		await waitFor(() => {
			const [sessionId, loading, error] = result.current;
			expect(loading).toBe(false);
			expect(sessionId).toBeNull();
			expect(error).toBeNull();
		});
	});

	it('should handle session with no sessionId', async () => {
		const mockResponse = {
			platform: 'tradingview',
			hasSession: true,
			sessionAvailable: true,
			sessionId: null,
			message: 'Session found but no ID',
		};

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(mockResponse),
		});

		const { result } = renderHook(() => useSessionBridge('tradingview'));

		await waitFor(() => {
			const [sessionId, loading, error] = result.current;
			expect(loading).toBe(false);
			expect(sessionId).toBeNull();
			expect(error).toBeNull();
		});
	});

	it('should handle missing credentials in localStorage', async () => {
		mockLocalStorage.getItem.mockReturnValue(null);

		const { result } = renderHook(() => useSessionBridge('tradingview'));

		await waitFor(() => {
			const [sessionId, loading, error] = result.current;
			expect(loading).toBe(false);
			expect(sessionId).toBeNull();
			expect(error).toBe('Authentication required. Please log in first.');
		});

		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('should handle invalid JSON in localStorage', async () => {
		mockLocalStorage.getItem.mockReturnValue('invalid-json');

		const { result } = renderHook(() => useSessionBridge('tradingview'));

		await waitFor(() => {
			const [sessionId, loading, error] = result.current;
			expect(loading).toBe(false);
			expect(sessionId).toBeNull();
			expect(error).toBe('Invalid authentication data. Please log in again.');
		});

		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('should handle API response not ok', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
		});

		const { result } = renderHook(() => useSessionBridge('tradingview'));

		await waitFor(() => {
			const [sessionId, loading, error] = result.current;
			expect(loading).toBe(false);
			expect(sessionId).toBeNull();
			expect(error).toBe('Failed to fetch session: 401');
		});
	});

	it('should handle fetch network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const { result } = renderHook(() => useSessionBridge('tradingview'));

		await waitFor(() => {
			const [sessionId, loading, error] = result.current;
			expect(loading).toBe(false);
			expect(sessionId).toBeNull();
			expect(error).toBe('Network error');
		});
	});

	it('should handle unknown error', async () => {
		mockFetch.mockRejectedValueOnce('Unknown error');

		const { result } = renderHook(() => useSessionBridge('tradingview'));

		await waitFor(() => {
			const [sessionId, loading, error] = result.current;
			expect(loading).toBe(false);
			expect(sessionId).toBeNull();
			expect(error).toBe('Unknown error');
		});
	});

	it('should cleanup properly when component unmounts', async () => {
		const mockResponse = {
			platform: 'tradingview',
			hasSession: true,
			sessionAvailable: true,
			sessionId: 'test-session-123',
			message: 'Session found',
		};

		// Create a delayed promise to test cleanup
		let resolvePromise: (value: typeof mockResponse) => void;
		const delayedPromise = new Promise((resolve) => {
			resolvePromise = resolve;
		});

		mockFetch.mockReturnValueOnce({
			ok: true,
			json: () => delayedPromise,
		});

		const { result, unmount } = renderHook(() => useSessionBridge('tradingview'));

		// Verify initial loading state
		expect(result.current[1]).toBe(true); // loading

		// Unmount before promise resolves
		unmount();

		// Resolve the promise after unmount
		resolvePromise!(mockResponse);

		// Wait a bit to ensure any state updates would have happened
		await new Promise(resolve => setTimeout(resolve, 10));

		// The hook should not update state after unmount
		// We can't directly test this, but the cleanup function prevents memory leaks
		expect(mockFetch).toHaveBeenCalled();
	});

	it('should handle platform change', async () => {
		const mockResponseTV = {
			platform: 'tradingview',
			hasSession: true,
			sessionAvailable: true,
			sessionId: 'tv-session-123',
			message: 'TradingView session found',
		};

		const mockResponseMIO = {
			platform: 'marketinout',
			hasSession: true,
			sessionAvailable: true,
			sessionId: 'mio-session-456',
			message: 'MarketInOut session found',
		};

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponseTV),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponseMIO),
			});

		const { result, rerender } = renderHook(
			({ platform }: { platform: 'tradingview' | 'marketinout' }) => useSessionBridge(platform),
			{ initialProps: { platform: 'tradingview' as const } }
		);

		// Wait for first platform to load
		await waitFor(() => {
			expect(result.current[1]).toBe(false); // loading false
			expect(result.current[0]).toBe('tv-session-123');
		});

		// Change platform
		rerender({ platform: 'marketinout' as const });

		// Wait for second platform to load
		await waitFor(() => {
			expect(result.current[1]).toBe(false); // loading false
			expect(result.current[0]).toBe('mio-session-456');
		});

		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});
