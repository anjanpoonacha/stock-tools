/**
 * Hook for fetching formula results (no chart data)
 * 
 * This hook:
 * - Fetches only the stock list from the formula
 * - Does not fetch chart data (loaded on-demand)
 * - Provides simple loading/error states
 * - Respects AuthGuard - doesn't fetch if not authenticated
 * 
 * TODO: Migrate to IndexedDB for caching
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Stock } from '@/types/stock';

/**
 * Hook return interface
 */
interface UseFormulaResultsReturn {
	stocks: Stock[];
	formulaName: string;
	loading: boolean;
	error: string | null;
	refetch: () => void;
}

/**
 * Hook for fetching formula results without chart data
 */
export function useFormulaResults(
	formulaId: string | null
): UseFormulaResultsReturn {
	// Get authentication state
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	
	const [stocks, setStocks] = useState<Stock[]>([]);
	const [formulaName, setFormulaName] = useState<string>('');
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	/**
	 * Fetch formula results
	 */
	const fetchResults = useCallback(async () => {
		// Don't fetch if not authenticated - let AuthGuard handle this
		if (!isAuthenticated()) {
			return;
		}

		if (!formulaId) {
			return;
		}

		setLoading(true);
		setError(null);

		try {
			// Get user credentials using centralized utility
			const { getStoredCredentials } = await import('@/lib/auth/authUtils');
			const credentials = getStoredCredentials();
			
			if (!credentials) {
				console.error('[useFormulaResults] No credentials found');
				setError(null); // Don't show error, let AuthGuard handle it
				return;
			}

			const response = await fetch('/api/formula-results', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userEmail: credentials.userEmail,
					userPassword: credentials.userPassword,
					formulaId,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
			}

		const data = await response.json();

		setStocks(data.stocks);
		setFormulaName(data.formulaName);
		setError(null);

	} catch (err) {
			console.error('[useFormulaResults] Error:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to load formula results';
			setError(errorMessage);
			setStocks([]);
			setFormulaName('');
		} finally {
			setLoading(false);
		}
	}, [formulaId, isAuthenticated]);

	/**
	 * Refetch results
	 */
	const refetch = useCallback(() => {
		if (formulaId) {
			fetchResults();
		}
	}, [formulaId, fetchResults]);

	// Fetch on mount or when formulaId changes (only if authenticated)
	useEffect(() => {
		// Wait for auth to complete before attempting fetch
		if (!authLoading && isAuthenticated()) {
			fetchResults();
		}
	}, [fetchResults, authLoading, isAuthenticated]);

	return {
		stocks,
		formulaName,
		loading: authLoading || loading, // Show loading during auth check
		error,
		refetch,
	};
}
