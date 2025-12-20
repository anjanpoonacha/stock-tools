/**
 * Chart Data Cache
 * 
 * In-memory cache for chart data responses to reduce TradingView API load
 * and improve response times for repeated requests.
 * 
 * Features:
 * - 5-minute TTL (Time To Live)
 * - Automatic stale entry cleanup
 * - Cache statistics for monitoring
 */

import type { ChartDataResponse } from '@/lib/tradingview/types';

interface CacheEntry {
	data: ChartDataResponse;
	timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieves cached chart data if available and not expired
 * 
 * @param key - Cache key (format: symbol:resolution:barsCount:cvdEnabled)
 * @returns Cached chart data or null if not found/expired
 */
export function getCachedChartData(key: string): ChartDataResponse | null {
	const cached = cache.get(key);
	if (!cached) return null;
	
	if (Date.now() - cached.timestamp > CACHE_TTL) {
		cache.delete(key);
		return null;
	}
	
	return cached.data;
}

/**
 * Stores chart data in cache with current timestamp
 * 
 * @param key - Cache key (format: symbol:resolution:barsCount:cvdEnabled)
 * @param data - Chart data response to cache
 */
export function setCachedChartData(key: string, data: ChartDataResponse): void {
	cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clears all cached chart data
 */
export function clearChartDataCache(): void {
	cache.clear();
}

/**
 * Returns cache statistics for monitoring
 * 
 * @returns Object with cache size and keys
 */
export function getCacheStats() {
	return {
		size: cache.size,
		keys: Array.from(cache.keys())
	};
}
