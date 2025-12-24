/**
 * Chart Data Cache
 * 
 * In-memory cache for chart data responses to reduce TradingView API load
 * and improve response times for repeated requests.
 * 
 * Features:
 * - Configurable TTL (Time To Live) via CHART_DATA_CACHE_TTL env var
 * - Automatic stale entry cleanup
 * - Cache statistics for monitoring
 * - CVD-aware: Only caches successful CVD fetches (validated in route.ts)
 */

import type { ChartDataResponse } from '@/lib/tradingview/types';
import { getChartDataCacheTTL } from '@/lib/cache/cacheConfig';

interface CacheEntry {
	data: ChartDataResponse;
	timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Get cache TTL from config (supports dynamic TTL via env var)
 */
function getCacheTTL(): number {
	return getChartDataCacheTTL();
}

/**
 * Retrieves cached chart data if available and not expired
 * 
 * @param key - Cache key (format: symbol:resolution:barsCount:cvdEnabled)
 * @returns Cached chart data or null if not found/expired
 */
export function getCachedChartData(key: string): ChartDataResponse | null {
	const cached = cache.get(key);
	if (!cached) return null;
	
	const ttl = getCacheTTL();
	if (Date.now() - cached.timestamp > ttl) {
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
