import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';

describe('useAsyncOperation', () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('should initialize with correct default state', () => {
		const { result } = renderHook(() => useAsyncOperation());

		expect(result.current.data).toBeNull();
		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBeNull();
		expect(result.current.isIdle).toBe(true);
	});

	it('should handle successful async operation', async () => {
		const mockData = { id: 1, name: 'test' };
		const asyncFn = vi.fn().mockResolvedValue(mockData);
		const onSuccess = vi.fn();

		const { result } = renderHook(() => useAsyncOperation({ onSuccess }));

		let executeResult: unknown;
		await act(async () => {
			executeResult = await result.current.execute(asyncFn);
		});

		expect(executeResult).toEqual(mockData);
		expect(result.current.data).toEqual(mockData);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBeNull();
		expect(result.current.isIdle).toBe(false);
		expect(onSuccess).toHaveBeenCalledWith(mockData);
	});

	it('should handle async operation error', async () => {
		const errorMessage = 'Test error';
		const asyncFn = vi.fn().mockRejectedValue(new Error(errorMessage));
		const onError = vi.fn();

		const { result } = renderHook(() => useAsyncOperation({ onError }));

		let executeResult: unknown;
		await act(async () => {
			executeResult = await result.current.execute(asyncFn);
		});

		expect(executeResult).toBeNull();
		expect(result.current.data).toBeNull();
		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBe(errorMessage);
		expect(result.current.isIdle).toBe(false);
		expect(onError).toHaveBeenCalledWith(errorMessage);
	});

	it('should handle abort error', async () => {
		const abortError = new Error('Aborted');
		abortError.name = 'AbortError';
		const asyncFn = vi.fn().mockRejectedValue(abortError);

		const { result } = renderHook(() => useAsyncOperation());

		let executeResult: unknown;
		await act(async () => {
			executeResult = await result.current.execute(asyncFn);
		});

		expect(executeResult).toBeNull();
		expect(result.current.data).toBeNull();
		expect(result.current.error).toBeNull();
		expect(consoleLogSpy).toHaveBeenCalledWith('Request was aborted');
	});

	it('should handle non-Error exceptions', async () => {
		const asyncFn = vi.fn().mockRejectedValue('String error');
		const onError = vi.fn();

		const { result } = renderHook(() => useAsyncOperation({ onError }));

		let executeResult: unknown;
		await act(async () => {
			executeResult = await result.current.execute(asyncFn);
		});

		expect(executeResult).toBeNull();
		expect(result.current.error).toBe('An unknown error occurred');
		expect(onError).toHaveBeenCalledWith('An unknown error occurred');
	});

	it('should abort previous request when abortPrevious is true', async () => {
		const firstAsyncFn = vi.fn().mockImplementation(
			(signal?: AbortSignal) => new Promise((resolve, reject) => {
				const abortError = new Error('Aborted');
				abortError.name = 'AbortError';
				signal?.addEventListener('abort', () => reject(abortError));
				setTimeout(() => resolve('first'), 100);
			})
		);
		const secondAsyncFn = vi.fn().mockResolvedValue('second');

		const { result } = renderHook(() => useAsyncOperation({ abortPrevious: true }));

		// Start first request
		act(() => {
			result.current.execute(firstAsyncFn);
		});

		// Start second request immediately
		let secondResult: unknown;
		await act(async () => {
			secondResult = await result.current.execute(secondAsyncFn);
		});

		expect(secondResult).toBe('second');
		expect(result.current.data).toBe('second');
		expect(consoleLogSpy).toHaveBeenCalledWith('Request was aborted');
	});

	it('should not abort previous request when abortPrevious is false', async () => {
		const firstAsyncFn = vi.fn().mockResolvedValue('first');
		const secondAsyncFn = vi.fn().mockResolvedValue('second');

		const { result } = renderHook(() => useAsyncOperation({ abortPrevious: false }));

		// Start first request
		await act(async () => {
			await result.current.execute(firstAsyncFn);
		});

		// Start second request
		await act(async () => {
			await result.current.execute(secondAsyncFn);
		});

		expect(result.current.data).toBe('second');
		expect(firstAsyncFn).toHaveBeenCalled();
		expect(secondAsyncFn).toHaveBeenCalled();
	});

	it('should reset state correctly', async () => {
		const asyncFn = vi.fn().mockResolvedValue('test data');

		const { result } = renderHook(() => useAsyncOperation());

		// Execute operation first
		await act(async () => {
			await result.current.execute(asyncFn);
		});

		expect(result.current.data).toBe('test data');

		// Reset
		act(() => {
			result.current.reset();
		});

		expect(result.current.data).toBeNull();
		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBeNull();
		expect(result.current.isIdle).toBe(true);
	});

	it('should set error manually', () => {
		const { result } = renderHook(() => useAsyncOperation());

		act(() => {
			result.current.setError('Manual error');
		});

		expect(result.current.error).toBe('Manual error');
		expect(result.current.isLoading).toBe(false);
	});

	it('should clear error', async () => {
		const asyncFn = vi.fn().mockRejectedValue(new Error('Test error'));

		const { result } = renderHook(() => useAsyncOperation());

		// Create error first
		await act(async () => {
			await result.current.execute(asyncFn);
		});

		expect(result.current.error).toBe('Test error');

		// Clear error
		act(() => {
			result.current.clearError();
		});

		expect(result.current.error).toBeNull();
	});

	it('should handle Error without message', async () => {
		const errorWithoutMessage = new Error();
		errorWithoutMessage.message = '';
		const asyncFn = vi.fn().mockRejectedValue(errorWithoutMessage);

		const { result } = renderHook(() => useAsyncOperation());

		await act(async () => {
			await result.current.execute(asyncFn);
		});

		expect(result.current.error).toBe('An unexpected error occurred');
	});

	it('should pass abort signal to async function', async () => {
		const asyncFn = vi.fn().mockImplementation((signal?: AbortSignal) => {
			expect(signal).toBeInstanceOf(AbortSignal);
			return Promise.resolve('success');
		});

		const { result } = renderHook(() => useAsyncOperation());

		await act(async () => {
			await result.current.execute(asyncFn);
		});

		expect(asyncFn).toHaveBeenCalledWith(expect.any(AbortSignal));
	});
});
