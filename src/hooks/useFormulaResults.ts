/**
 * Hook for fetching formula results (no chart data)
 * 
 * This hook:
 * - Fetches only the stock list from the formula
 * - Does not fetch chart data (loaded on-demand)
 * - Provides simple loading/error states
 * - Caches results in localStorage
 * - Respects AuthGuard - doesn't fetch if not authenticated
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Stock } from '@/types/stock';
import { LocalStorageCache } from '@/lib/utils/cache';

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

const CACHE_KEY_PREFIX = 'formula-results:';

/**
 * Hook for fetching formula results without chart data
 */
export function useFormulaResults(
	formulaId: string | null
): UseFormulaResultsReturn {
	console.log('[useFormulaResults] Hook called with formulaId:', formulaId);
	
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
			console.log('[useFormulaResults] Not authenticated, skipping fetch');
			return;
		}

		if (!formulaId) {
			console.log('[useFormulaResults] No formulaId provided, skipping fetch');
			return;
		}

		const cacheKey = `${CACHE_KEY_PREFIX}${formulaId}`;
		console.log('[useFormulaResults] Fetching results for:', formulaId);

		// Check cache first
		const cached = LocalStorageCache.get<{ stocks: Stock[]; formulaName: string }>(cacheKey);
		if (cached) {
			console.log('[useFormulaResults] ✅ Cache HIT:', cacheKey);
			setStocks(cached.stocks);
			setFormulaName(cached.formulaName);
			setError(null);
			return;
		}

		console.log('[useFormulaResults] ❌ Cache MISS, fetching from API');
		setLoading(true);
		setError(null);

		try {
			// Get user credentials from localStorage (same as AuthContext)
			const credentialsStr = localStorage.getItem('mio-tv-auth-credentials');
			if (!credentialsStr) {
				console.error('[useFormulaResults] No credentials found');
				setError(null); // Don't show error, let AuthGuard handle it
				return;
			}

			let credentials;
			try {
				credentials = JSON.parse(credentialsStr);
			} catch (err) {
				console.error('[useFormulaResults] Failed to parse credentials');
				setError(null); // Don't show error, let AuthGuard handle it
				return;
			}

			if (!credentials.userEmail || !credentials.userPassword) {
				console.error('[useFormulaResults] Missing email or password');
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

			console.log('[useFormulaResults] ✅ Success:', {
				formulaName: data.formulaName,
				stockCount: data.stocks.length
			});

			setStocks(data.stocks);
			setFormulaName(data.formulaName);
			setError(null);

			// Cache the results
			try {
				LocalStorageCache.set(cacheKey, {
					stocks: data.stocks,
					formulaName: data.formulaName
				});
				console.log('[useFormulaResults] ✅ Cached results');
			} catch (err) {
				console.warn('[useFormulaResults] Failed to cache (quota exceeded):', err instanceof Error ? err.message : 'Unknown error');
			}

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
	 * Refetch results (clears cache first)
	 */
	const refetch = useCallback(() => {
		if (formulaId) {
			const cacheKey = `${CACHE_KEY_PREFIX}${formulaId}`;
			LocalStorageCache.remove(cacheKey);
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
