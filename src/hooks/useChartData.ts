/**
 * Reusable Chart Data Hook with Caching
 * 
 * Centralized hook for fetching chart data with automatic caching.
 * Used by both TradingViewLiveChart and ReusableChart components.
 * 
 * Features:
 * - Automatic cache check before API calls
 * - Saves successful responses to cache
 * - 5-minute TTL by default
 * - Prevents duplicate fetches
 */

import { useState, useEffect } from 'react';
import { LocalStorageCache } from '@/lib/utils/cache';
import type { OHLCVBar } from '@/lib/tradingview/types';

export interface ChartDataResponse {
	success: boolean;
	symbol: string;
	resolution: string;
	bars: OHLCVBar[];
	metadata: {
		name?: string;
		exchange?: string;
		currency_code?: string;
		pricescale?: number;
	};
	indicators?: {
		[key: string]: {
			studyId: string;
			studyName: string;
			config: unknown;
			values: Array<{
				time: number;
				values: number[];
			}>;
		};
	};
	error?: string;
}

interface UseChartDataParams {
	symbol: string;
	resolution: string;
	barsCount: number;
	apiEndpoint?: string;
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

const CACHE_KEY_PREFIX = 'chart-data:';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key from parameters
 */
function getCacheKey(params: UseChartDataParams): string {
	const { symbol, resolution, barsCount, cvdEnabled } = params;
	// Normalize cvdEnabled to boolean for consistent cache keys
	const cvdFlag = cvdEnabled === true;
	const key = `${CACHE_KEY_PREFIX}${symbol}_${resolution}_${barsCount}_${cvdFlag}`;
	console.log(`[getCacheKey] Generated key: ${key}`, { symbol, resolution, barsCount, cvdEnabled, cvdFlag });
	return key;
}

/**
 * Fetch chart data from API
 */
async function fetchChartData(params: UseChartDataParams): Promise<ChartDataResponse> {
	const { 
		symbol, 
		resolution, 
		barsCount, 
		apiEndpoint = '/api/chart-data',
		cvdEnabled,
		cvdAnchorPeriod,
		cvdTimeframe
	} = params;

	// Get credentials
	const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');
	if (!storedCredentials) {
		throw new Error('Authentication credentials not found. Please log in again.');
	}

	const credentials = JSON.parse(storedCredentials);

	// Build API URL
	const url = new URL(apiEndpoint, window.location.origin);
	url.searchParams.set('symbol', symbol);
	url.searchParams.set('resolution', resolution);
	url.searchParams.set('barsCount', barsCount.toString());
	
	// Add CVD parameters if enabled
	if (cvdEnabled) {
		url.searchParams.set('cvdEnabled', 'true');
		if (cvdAnchorPeriod) {
			url.searchParams.set('cvdAnchorPeriod', cvdAnchorPeriod);
		}
		if (cvdTimeframe) {
			url.searchParams.set('cvdTimeframe', cvdTimeframe);
		}
		console.log('[fetchChartData] CVD ENABLED - params:', { cvdAnchorPeriod, cvdTimeframe });
	} else {
		console.log('[fetchChartData] CVD DISABLED');
	}

	// Fetch data
	const response = await fetch(url.toString(), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			userEmail: credentials.userEmail,
			userPassword: credentials.userPassword
		})
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const result: ChartDataResponse = await response.json();
	
	console.log('[fetchChartData] API Response:', {
		success: result.success,
		barsCount: result.bars?.length,
		hasIndicators: !!result.indicators,
		indicatorKeys: result.indicators ? Object.keys(result.indicators) : []
	});

	if (!result.success) {
		throw new Error(result.error || 'Failed to fetch chart data');
	}

	if (!result.bars || result.bars.length === 0) {
		throw new Error('No chart data received');
	}

	return result;
}

/**
 * Reusable hook for fetching chart data with caching
 * 
 * @param params - Chart data fetch parameters
 * @returns Chart data, loading state, error state, and refetch function
 * 
 * @example
 * ```typescript
 * const { data, loading, error } = useChartData({
 *   symbol: 'NSE:RELIANCE',
 *   resolution: '1D',
 *   barsCount: 300,
 *   cvdEnabled: true
 * });
 * ```
 */
export function useChartData(params: UseChartDataParams): UseChartDataReturn {
	const [data, setData] = useState<ChartDataResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [refetchKey, setRefetchKey] = useState(0);

	const { enabled = true } = params;

	useEffect(() => {
		// Don't fetch if disabled
		if (!enabled) {
			return;
		}

		let mounted = true;

		async function loadData() {
			try {
				setLoading(true);
				setError(null);

				const cacheKey = getCacheKey(params);

				// Check cache first
				const cached = LocalStorageCache.get<ChartDataResponse>(cacheKey, CACHE_TTL);
				if (cached) {
					console.log(`[useChartData] ✅ Cache HIT: ${params.symbol} ${params.resolution} - Key: ${cacheKey}`);
					if (mounted) {
						setData(cached);
						setLoading(false);
					}
					return;
				}

				console.log(`[useChartData] ❌ Cache MISS, fetching: ${params.symbol} ${params.resolution} - Key: ${cacheKey}`);

				// Fetch from API
				const result = await fetchChartData(params);

				if (!mounted) return;

				// Save to cache (only if not exceeding quota)
				try {
					LocalStorageCache.set(cacheKey, result);
				} catch (err) {
					console.warn('[useChartData] Failed to cache (quota exceeded):', err instanceof Error ? err.message : 'Unknown error');
					// Continue without caching - not critical
				}

				setData(result);
				setLoading(false);
			} catch (err) {
				console.error('[useChartData] Error loading data:', err);
				if (!mounted) return;
				const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
				setError(errorMessage);
				setLoading(false);
			}
		}

		loadData();

		return () => {
			mounted = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		params.symbol,
		params.resolution,
		params.barsCount,
		params.apiEndpoint,
		params.cvdEnabled,
		params.cvdAnchorPeriod,
		params.cvdTimeframe,
		enabled,
		refetchKey
	]);

	const refetch = () => {
		setRefetchKey(prev => prev + 1);
	};

	return {
		data,
		loading,
		error,
		refetch
	};
}

/**
 * Prefetch chart data in the background
 * Returns promise that resolves when complete
 * 
 * @param params - Chart data fetch parameters
 * @returns Promise<void>
 */
export async function prefetchChartData(params: UseChartDataParams): Promise<void> {
	const cacheKey = getCacheKey(params);

	// Skip if already cached
	const existing = LocalStorageCache.get<ChartDataResponse>(cacheKey, CACHE_TTL);
	if (existing) {
		console.log(`[prefetchChartData] ⏭️  Already cached: ${params.symbol} ${params.resolution} - Key: ${cacheKey}`);
		return;
	}

	try {
		console.log(`[prefetchChartData] 🔄 Fetching: ${params.symbol} ${params.resolution} - Key: ${cacheKey}`);
		const result = await fetchChartData(params);
		LocalStorageCache.set(cacheKey, result);
		console.log(`[prefetchChartData] ✅ Cached: ${params.symbol} ${params.resolution} - Key: ${cacheKey}`);
	} catch (err) {
		console.error(`[prefetchChartData] ❌ Error fetching ${params.symbol} ${params.resolution}:`, err);
		// Don't throw - prefetch failures should be silent
	}
}
