/**
 * Hook for fetching formula results using SWR
 * 
 * This hook:
 * - Fetches only the stock list from the formula
 * - Does not fetch chart data (loaded on-demand)
 * - Provides simple loading/error states
 * - Respects AuthGuard - doesn't fetch if not authenticated
 * - Uses SWR for caching and automatic revalidation (replaces IndexedDB TODO)
 */

import { useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredCredentials } from '@/lib/auth/authUtils';
import { formulaResultsFetcher, formulaResultsKey } from '@/lib/swr';
import type { Stock } from '@/types/stock';
import { getSwrDedupingInterval, isClientCacheEnabled } from '@/lib/cache/cacheConfig';

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
 * Uses SWR for automatic caching and revalidation
 */
export function useFormulaResults(
	formulaId: string | null
): UseFormulaResultsReturn {
	// Get authentication state
	const { isAuthenticated, isLoading: authLoading } = useAuth();

	// Get credentials for SWR key
	const credentials = useMemo(() => {
		// Only get credentials if authenticated
		if (!isAuthenticated()) {
			return null;
		}
		return getStoredCredentials();
	}, [isAuthenticated]);

	// Generate SWR key (returns null if any param is missing -> no fetch)
	const swrKey = useMemo(() => {
		return formulaResultsKey({
			formulaId: formulaId || undefined,
			userEmail: credentials?.userEmail,
			userPassword: credentials?.userPassword,
		});
	}, [formulaId, credentials]);

	// Fetch data using SWR
	const { data, error, isLoading, mutate } = useSWR(
		swrKey,
		([_key, params]) => formulaResultsFetcher(_key, params),
		{
			// Don't revalidate on focus to avoid unnecessary API calls
			revalidateOnFocus: false,
			// Keep previous data while revalidating (only when caching enabled)
			keepPreviousData: isClientCacheEnabled(),
			// Dedupe requests within 5 seconds (only when caching enabled)
			dedupingInterval: getSwrDedupingInterval(5000),
		}
	);

	// Extract error message
	const errorMessage = useMemo(() => {
		if (!error) return null;
		return error instanceof Error ? error.message : 'Failed to load formula results';
	}, [error]);

	return {
		stocks: data?.stocks || [],
		formulaName: data?.formulaName || '',
		loading: authLoading || isLoading,
		error: errorMessage,
		refetch: () => mutate(),
	};
}
