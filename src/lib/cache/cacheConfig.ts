/**
 * Centralized Cache Configuration
 * 
 * Single source of truth for all caching behavior across the application.
 * Checks environment variables once and exports reusable helpers.
 * 
 * Usage:
 * - Server-side: Use granular cache functions for specific layers
 * - Client-side: Use isClientCacheEnabled() for SWR/frontend caches
 * - SWR hooks: Use getSwrDedupingInterval() for consistent deduplication
 * 
 * Cache Layers:
 * - Session/JWT Cache: Caches TradingView session lookups and JWT tokens (5min TTL)
 * - CVD Config Cache: Caches CVD Pine script configuration (24h TTL)
 * - Chart Data Cache: Caches entire chart data responses (configurable TTL)
 */

/**
 * Check if server-side caching is enabled (Legacy)
 * 
 * @deprecated Use granular cache functions instead:
 * - isSessionJWTCacheEnabled() for session/JWT caching
 * - isCVDConfigCacheEnabled() for CVD config caching
 * - isChartDataCacheEnabled() for chart data caching
 * 
 * Checks ENABLE_SERVER_CACHE environment variable.
 * Caching is DISABLED by default (must explicitly enable).
 * 
 * @returns true if ENABLE_SERVER_CACHE=true, false otherwise
 */
export function isServerCacheEnabled(): boolean {
	return process.env.ENABLE_SERVER_CACHE === 'true';
}

/**
 * Check if Session and JWT caching is enabled
 * 
 * Caches:
 * - TradingView session lookups from KV (saves 280-1000ms per request)
 * - JWT token fetches from TradingView API (saves 250-1100ms per request)
 * 
 * TTL: 5 minutes
 * Risk: Low (credentials rarely change within 5 minutes)
 * Impact: HIGH - Saves 400-1500ms per request
 * 
 * @returns true if ENABLE_SESSION_JWT_CACHE=true, false otherwise
 */
export function isSessionJWTCacheEnabled(): boolean {
	return process.env.ENABLE_SESSION_JWT_CACHE === 'true';
}

/**
 * Check if CVD config caching is enabled
 * 
 * Caches CVD Pine script configuration fetched from TradingView HTML.
 * The Pine script is encrypted (~17KB) and rarely changes.
 * 
 * TTL: 24 hours (in Vercel KV)
 * Risk: Very Low (Pine script is static, updates are rare)
 * Impact: HIGH - Saves 550-780ms per CVD request
 * 
 * Default: ENABLED (only disabled if explicitly set to 'false')
 * Reasoning: Pine script is static data, 24h TTL is very safe
 * 
 * @returns true if ENABLE_CVD_CONFIG_CACHE is not 'false', false otherwise
 */
export function isCVDConfigCacheEnabled(): boolean {
	// Default to enabled unless explicitly disabled
	return process.env.ENABLE_CVD_CONFIG_CACHE !== 'false';
}

/**
 * Check if chart data caching is enabled
 * 
 * Caches entire chart data API responses including:
 * - OHLCV bars
 * - Symbol metadata
 * - CVD indicator data (if successfully fetched)
 * 
 * TTL: Configurable via CHART_DATA_CACHE_TTL (default 5 minutes)
 * Risk: Medium (price data may be stale)
 * Impact: VERY HIGH - Saves 2-3 seconds for repeated requests
 * 
 * Default: DISABLED (must explicitly enable)
 * Reasoning: Price data staleness might not be acceptable for all use cases
 * 
 * Note: CVD failures are NOT cached (only successful CVD fetches)
 * 
 * @returns true if ENABLE_CHART_DATA_CACHE=true, false otherwise
 */
export function isChartDataCacheEnabled(): boolean {
	return process.env.ENABLE_CHART_DATA_CACHE === 'true';
}

/**
 * Get chart data cache TTL in milliseconds
 * 
 * Reads CHART_DATA_CACHE_TTL environment variable.
 * Used by chartDataCache to determine how long to cache responses.
 * 
 * @returns Cache TTL in milliseconds (default: 300000ms = 5 minutes)
 */
export function getChartDataCacheTTL(): number {
	const ttlSeconds = parseInt(process.env.CHART_DATA_CACHE_TTL || '300', 10);
	const validTTL = ttlSeconds > 0 ? ttlSeconds : 300; // Default 5 minutes
	return validTTL * 1000; // Convert to milliseconds
}

/**
 * Check if client-side caching is enabled
 * 
 * Checks NEXT_PUBLIC_ENABLE_CLIENT_CACHE environment variable.
 * Caching is DISABLED by default (must explicitly enable).
 * 
 * @returns true if NEXT_PUBLIC_ENABLE_CLIENT_CACHE=true, false otherwise
 */
export function isClientCacheEnabled(): boolean {
	return process.env.NEXT_PUBLIC_ENABLE_CLIENT_CACHE === 'true';
}

/**
 * Get SWR deduplication interval based on cache settings
 * 
 * Returns 0 (no deduplication) when client-side caching is disabled,
 * or the provided interval when caching is enabled.
 * 
 * @param defaultInterval - The interval (in ms) to use when caching is enabled
 * @returns 0 if caching disabled, defaultInterval if enabled
 * 
 * @example
 * ```typescript
 * useSWR(key, fetcher, {
 *   dedupingInterval: getSwrDedupingInterval(5000) // 5s when enabled, 0 when disabled
 * })
 * ```
 */
export function getSwrDedupingInterval(defaultInterval: number): number {
	return isClientCacheEnabled() ? defaultInterval : 0;
}
