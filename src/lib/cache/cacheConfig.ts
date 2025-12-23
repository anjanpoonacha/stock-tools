/**
 * Centralized Cache Configuration
 * 
 * Single source of truth for all caching behavior across the application.
 * Checks environment variables once and exports reusable helpers.
 * 
 * Usage:
 * - Server-side: Use isServerCacheEnabled() for backend caches
 * - Client-side: Use isClientCacheEnabled() for SWR/frontend caches
 * - SWR hooks: Use getSwrDedupingInterval() for consistent deduplication
 */

/**
 * Check if server-side caching is enabled
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
