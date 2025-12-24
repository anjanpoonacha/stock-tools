/**
 * Hook for fetching stocks from unified watchlists
 * 
 * This hook:
 * - Fetches symbols from MIO and/or TradingView watchlists
 * - Merges and deduplicates symbols
 * - Returns normalized stock data compatible with ResultsTable/ChartView
 * - Uses SWR for caching
 */

import { useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { watchlistSymbolsFetcher } from '@/lib/swr/watchlist-fetchers';
import type { Stock } from '@/types/stock';
import { getSwrDedupingInterval, isClientCacheEnabled } from '@/lib/cache/cacheConfig';
import { mioToTv } from '@/lib/utils/exchangeMapper';
import { enrichStockMetadata } from '@/lib/utils';

/**
 * Hook return interface
 */
interface UseWatchlistStocksReturn {
	stocks: Stock[];
	isLoading: boolean;
	error: string | null;
	refetch: () => void;
}

/**
 * SWR key generator - returns null if no watchlist IDs provided
 */
const watchlistStocksKey = (
	mioWlid?: string | null,
	tvWlid?: string | null
): readonly [string, string?, string?] | null => {
	if (!mioWlid && !tvWlid) return null;
	return ['watchlist-stocks', mioWlid, tvWlid].filter(Boolean) as [string, string?, string?];
};

/**
 * Fetcher for watchlist stocks - fetches from both platforms and merges
 */
const fetchWatchlistStocks = async (
	_key: string,
	mioWlid?: string | null,
	tvWlid?: string | null
): Promise<Stock[]> => {
	// Fetch symbols from both platforms in parallel
	const promises: Promise<{ symbols: string[]; platform: 'mio' | 'tradingview' }>[] = [];

	if (mioWlid) {
		promises.push(
			watchlistSymbolsFetcher(mioWlid, 'mio')
				.then(result => ({ symbols: result.symbols, platform: 'mio' as const }))
				.catch(err => {
					console.error('Failed to fetch MIO watchlist:', err);
					return { symbols: [], platform: 'mio' as const };
				})
		);
	}

	if (tvWlid) {
		promises.push(
			watchlistSymbolsFetcher(tvWlid, 'tradingview')
				.then(result => ({ symbols: result.symbols, platform: 'tradingview' as const }))
				.catch(err => {
					console.error('Failed to fetch TradingView watchlist:', err);
					return { symbols: [], platform: 'tradingview' as const };
				})
		);
	}

	const results = await Promise.all(promises);

	// Flatten symbols and normalize to TradingView format
	const normalizedSymbols: string[] = [];
	
	for (const { symbols, platform } of results) {
		for (const symbol of symbols) {
			// MIO symbols need conversion (WIPRO.NS -> NSE:WIPRO)
			// TradingView symbols are already in correct format (NSE:WIPRO)
			const tvSymbol = platform === 'mio' ? mioToTv(symbol) : symbol;
			normalizedSymbols.push(tvSymbol);
		}
	}

	// Deduplicate symbols
	const uniqueSymbols = Array.from(new Set(normalizedSymbols));

	// Convert to Stock format with sector/industry enrichment
	return uniqueSymbols.map(symbol => {
		const metadata = enrichStockMetadata(symbol);
		return {
			symbol,
			name: symbol, // Can be enhanced later to fetch full names
			sector: metadata.sector,
			industry: metadata.industry,
		};
	});
};

/**
 * Hook for fetching stocks from a watchlist
 * Supports MIO-only, TV-only, or unified watchlists
 */
export function useWatchlistStocks(
	mioWlid?: string | null,
	tvWlid?: string | null
): UseWatchlistStocksReturn {
	// Get authentication state
	const { isAuthenticated } = useAuth();

	// Generate SWR key
	const swrKey = useMemo(() => {
		// Only generate key if authenticated
		if (!isAuthenticated()) {
			return null;
		}
		return watchlistStocksKey(mioWlid || undefined, tvWlid || undefined);
	}, [isAuthenticated, mioWlid, tvWlid]);

	// Fetch data using SWR
	const { data, error, isLoading, mutate } = useSWR(
		swrKey,
		([_key, mio, tv]) => fetchWatchlistStocks(_key, mio, tv),
		{
			revalidateOnFocus: false,
			keepPreviousData: isClientCacheEnabled(),
			dedupingInterval: getSwrDedupingInterval(5000),
		}
	);

	// Extract error message
	const errorMessage = useMemo(() => {
		if (!error) return null;
		return error instanceof Error ? error.message : 'Failed to load watchlist stocks';
	}, [error]);

	return {
		stocks: data || [],
		isLoading,
		error: errorMessage,
		refetch: () => mutate(),
	};
}
