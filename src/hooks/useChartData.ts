/**
 * Reusable Chart Data Hook
 * 
 * Centralized hook for fetching chart data.
 * Used by both TradingViewLiveChart and ReusableChart components.
 */

import { useState, useEffect, useMemo } from 'react';
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

	// Get credentials using centralized utility
	const { requireCredentials } = await import('@/lib/auth/authUtils');
	const credentials = requireCredentials();

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

	if (!result.success) {
		throw new Error(result.error || 'Failed to fetch chart data');
	}

	if (!result.bars || result.bars.length === 0) {
		throw new Error('No chart data received');
	}

	return result;
}

/**
 * Reusable hook for fetching chart data
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
	const [rawData, setRawData] = useState<ChartDataResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [refetchKey, setRefetchKey] = useState(0);

	const { enabled = true } = params;

	// Stabilize params object to prevent unnecessary re-fetches
	// This ensures that if parent components re-render and create a new params object,
	// we only trigger a fetch if the actual values have changed
	const stableParams = useMemo(() => ({
		symbol: params.symbol,
		resolution: params.resolution,
		barsCount: params.barsCount,
		apiEndpoint: params.apiEndpoint,
		cvdEnabled: params.cvdEnabled,
		cvdAnchorPeriod: params.cvdAnchorPeriod,
		cvdTimeframe: params.cvdTimeframe,
	}), [
		params.symbol,
		params.resolution,
		params.barsCount,
		params.apiEndpoint,
		params.cvdEnabled,
		params.cvdAnchorPeriod,
		params.cvdTimeframe,
	]);

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

				// Fetch from API using stable params
				const result = await fetchChartData(stableParams);

				if (!mounted) return;

				setRawData(result);
				setLoading(false);
			} catch (err) {
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
	}, [stableParams, enabled, refetchKey]);

	const refetch = () => {
		setRefetchKey(prev => prev + 1);
	};

	return {
		data: processedData,
		loading,
		error,
		refetch
	};
}
