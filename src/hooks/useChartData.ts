/**
 * Reusable Chart Data Hook
 * 
 * Centralized hook for fetching chart data using SWR.
 * Provides automatic deduplication, caching, and revalidation.
 * Used by both TradingViewLiveChart and ReusableChart components.
 */

import { useMemo } from 'react';
import useSWR from 'swr';
import { chartDataFetcher, type ChartDataFetcherParams } from '@/lib/swr/fetchers';
import { chartDataKey } from '@/lib/swr/keys';
import { getStoredCredentials } from '@/lib/auth/authUtils';
import type { ChartDataResponse } from '@/lib/tradingview/types';
import { isClientCacheEnabled } from '@/lib/cache/cacheConfig';

// Re-export for backward compatibility
export type { ChartDataResponse };

interface UseChartDataParams {
	symbol: string;
	resolution: string;
	barsCount: number;
	apiEndpoint?: string; // Deprecated: Uses /api/chart-data by default (ignored in SWR version)
	cvdEnabled?: boolean;
	cvdAnchorPeriod?: string;
	cvdTimeframe?: string;
	enabled?: boolean; // Allow disabling the fetch
}

interface UseChartDataReturn {
	data: ChartDataResponse | null;
	loading: boolean;
	error: string | null;
	refetch: () => void;
}

/**
 * SWR fetcher wrapper for chart data
 * Wraps chartDataFetcher to match hook's parameter format
 */
async function fetchChartDataForSWR(params: ChartDataFetcherParams): Promise<ChartDataResponse> {
	const result = await chartDataFetcher(params);
	
	// Validate response
	if (!result.success) {
		// Check if it's a CVD validation error
		if (result.error?.includes('CVD validation failed')) {
			throw new Error(
				`${result.error}\n\n💡 Tip: Ensure CVD delta timeframe is less than chart resolution.\nExample: For daily charts, use 1min or 60min deltas (not daily or weekly).`
			);
		}
		
		// Generic error
		throw new Error(result.error || 'Failed to fetch chart data');
	}

	if (!result.bars || result.bars.length === 0) {
		throw new Error(
			'No chart data received. This may be due to:\n' +
			'• Invalid symbol or delisted stock\n' +
			'• Network connectivity issues\n' +
			'• TradingView API limitations\n\n' +
			'Please verify the symbol and try again.'
		);
	}

	return result;
}

/**
 * Reusable hook for fetching chart data with SWR
 * 
 * Features:
 * - Automatic request deduplication across components
 * - Shared cache when same symbol/resolution is used
 * - Conditional fetching based on enabled param and auth status
 * - Efficient bar deduplication at data layer
 * 
 * @param params - Chart data fetch parameters
 * @returns Chart data, loading state, error state, and refetch function
 * 
 * @example
 * ```typescript
 * const { data, loading, error, refetch } = useChartData({
 *   symbol: 'NSE:RELIANCE',
 *   resolution: '1D',
 *   barsCount: 300,
 *   cvdEnabled: true
 * });
 * ```
 */
export function useChartData(params: UseChartDataParams): UseChartDataReturn {
	const { 
		symbol, 
		resolution, 
		barsCount, 
		cvdEnabled, 
		cvdAnchorPeriod, 
		cvdTimeframe,
		enabled = true 
	} = params;

	// Check if user is authenticated
	const credentials = getStoredCredentials();
	const isAuthenticated = !!credentials;

	// Generate stable SWR cache key
	// Returns null if disabled or not authenticated (prevents fetch)
	const swrKey = useMemo(() => {
		if (!enabled || !isAuthenticated) {
			return null;
		}
		
		return chartDataKey(
			symbol,
			resolution,
			barsCount,
			cvdEnabled,
			cvdAnchorPeriod,
			cvdTimeframe
		);
	}, [symbol, resolution, barsCount, cvdEnabled, cvdAnchorPeriod, cvdTimeframe, enabled, isAuthenticated]);

	// Create fetcher params object
	const fetcherParams = useMemo<ChartDataFetcherParams>(() => ({
		symbol,
		resolution,
		barsCount,
		cvdEnabled,
		cvdAnchorPeriod,
		cvdTimeframe,
	}), [symbol, resolution, barsCount, cvdEnabled, cvdAnchorPeriod, cvdTimeframe]);

	// Fetch data with SWR
	const { data: rawData, error: swrError, isLoading, mutate } = useSWR(
		swrKey,
		() => fetchChartDataForSWR(fetcherParams),
		{
			revalidateOnFocus: false,
			dedupingInterval: 0, // No deduping - allow truly parallel dual layout requests
			keepPreviousData: isClientCacheEnabled(), // Only smooth transitions when cache is enabled
		}
	);

	// Process data: deduplicate bars efficiently
	// This moves deduplication from component render to data layer (runs once per fetch)
	const processedData = useMemo(() => {
		if (!rawData?.bars) return rawData;
		
		// Deduplicate using Set for O(n) performance
		const seen = new Set<number>();
		const uniqueBars = rawData.bars.filter(bar => {
			if (seen.has(bar.time)) return false;
			seen.add(bar.time);
			return true;
		});
		
		return { ...rawData, bars: uniqueBars };
	}, [rawData]);

	// Convert SWR error to string format for backward compatibility
	const errorMessage = useMemo(() => {
		if (!swrError) return null;
		return swrError instanceof Error ? swrError.message : 'Unknown error occurred';
	}, [swrError]);

	// Refetch function using SWR's mutate
	const refetch = () => {
		mutate();
	};

	return {
		data: processedData || null,
		loading: isLoading,
		error: errorMessage,
		refetch
	};
}
