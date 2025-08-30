/**
 * useAsyncOperation Hook
 * 
 * Provides consistent async operation handling with loading states,
 * error management, and abort controller support.
 */

import { useState, useRef, useCallback } from 'react';

interface AsyncOperationState<T> {
	data: T | null;
	isLoading: boolean;
	error: string | null;
}

interface AsyncOperationOptions<T> {
	onSuccess?: (data: T) => void;
	onError?: (error: string) => void;
	abortPrevious?: boolean;
}

export function useAsyncOperation<T = unknown>(
	options: AsyncOperationOptions<T> = {}
) {
	const { onSuccess, onError, abortPrevious = true } = options;

	const [state, setState] = useState<AsyncOperationState<T>>({
		data: null,
		isLoading: false,
		error: null,
	});

	const abortControllerRef = useRef<AbortController | null>(null);

	const execute = useCallback(async (
		asyncFn: (signal?: AbortSignal) => Promise<T>
	): Promise<T | null> => {
		// Abort previous request if enabled
		if (abortPrevious && abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		// Create new abort controller
		abortControllerRef.current = new AbortController();

		setState(prev => ({
			...prev,
			isLoading: true,
			error: null,
		}));

		try {
			const result = await asyncFn(abortControllerRef.current.signal);

			setState({
				data: result,
				isLoading: false,
				error: null,
			});

			onSuccess?.(result);
			return result;
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					console.log('Request was aborted');
					return null;
				}

				const errorMessage = error.message || 'An unexpected error occurred';
				setState({
					data: null,
					isLoading: false,
					error: errorMessage,
				});

				onError?.(errorMessage);
				return null;
			}

			const genericError = 'An unknown error occurred';
			setState({
				data: null,
				isLoading: false,
				error: genericError,
			});

			onError?.(genericError);
			return null;
		} finally {
			abortControllerRef.current = null;
		}
	}, [onSuccess, onError, abortPrevious]);

	const reset = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		setState({
			data: null,
			isLoading: false,
			error: null,
		});
	}, []);

	const setError = useCallback((error: string) => {
		setState(prev => ({
			...prev,
			error,
			isLoading: false,
		}));
	}, []);

	const clearError = useCallback(() => {
		setState(prev => ({
			...prev,
			error: null,
		}));
	}, []);

	return {
		...state,
		execute,
		reset,
		setError,
		clearError,
		isIdle: !state.isLoading && !state.error && !state.data,
	};
}
