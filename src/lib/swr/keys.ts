/**
 * SWR Cache Key Factories
 * 
 * Generates stable, deterministic cache keys for SWR hooks.
 * Keys are designed to be unique per data request and invalidate correctly.
 * 
 * Key Design Principles:
 * - Prefix with resource type for clarity and grouping
 * - Include all parameters that affect data
 * - Use consistent ordering and serialization
 * - Return arrays for complex keys (recommended by SWR)
 * 
 * Usage:
 *   const { data } = useSWR(chartDataKey(symbol, resolution), fetcher);
 */

import { getUserEmail } from '@/lib/auth/authUtils';

// ============================================================================
// Chart Data Keys
// ============================================================================

/**
 * Generate SWR cache key for chart data
 * 
 * @param symbol - Stock symbol (e.g., 'NSE:RELIANCE')
 * @param resolution - Time resolution (e.g., '1D', '1W', '1', '5')
 * @param barsCount - Number of bars (default: 300)
 * @param cvdEnabled - Whether CVD indicator is enabled (default: false)
 * @param cvdAnchorPeriod - CVD anchor period (e.g., '3M', '1M')
 * @param cvdTimeframe - CVD custom timeframe (e.g., '15S', '30S')
 * @returns SWR cache key array
 * 
 * @example
 * const key = chartDataKey('NSE:RELIANCE', '1D', 300, true, '3M');
 * // Returns: ['chart-data', 'NSE:RELIANCE', '1D', 300, true, '3M', null]
 */
export function chartDataKey(
	symbol: string,
	resolution = '1D',
	barsCount = 300,
	cvdEnabled = false,
	cvdAnchorPeriod?: string,
	cvdTimeframe?: string
): [string, string, string, number, boolean, string | null, string | null] {
	return [
		'chart-data',
		symbol,
		resolution,
		barsCount,
		cvdEnabled,
		cvdAnchorPeriod || null,
		cvdTimeframe || null,
	];
}

/**
 * Generate a simpler chart data key (without CVD parameters)
 * Useful for basic chart data without indicators
 * 
 * @example
 * const key = simpleChartDataKey('NSE:RELIANCE', '1D', 300);
 * // Returns: ['chart-data', 'NSE:RELIANCE', '1D', 300]
 */
export function simpleChartDataKey(
	symbol: string,
	resolution = '1D',
	barsCount = 300
): [string, string, string, number] {
	return ['chart-data', symbol, resolution, barsCount];
}

// ============================================================================
// Formula Keys
// ============================================================================

/**
 * Generate SWR cache key for formula list
 * User-scoped - automatically includes current user's email
 * 
 * @param userEmail - Optional user email (defaults to current user)
 * @returns SWR cache key array or null if not authenticated
 * 
 * @example
 * const key = formulaKey();
 * // Returns: ['formulas', 'user@example.com'] (if logged in)
 * // Returns: null (if not logged in - SWR will not fetch)
 */
export function formulaKey(userEmail?: string): [string, string] | null {
	const email = userEmail || getUserEmail();
	
	if (!email) {
		return null; // Return null to prevent fetch when not authenticated
	}

	return ['formulas', email];
}

/**
 * Generate SWR cache key for formula results (stock list)
 * 
 * @param formulaId - The formula ID to fetch results for
 * @param userEmail - Optional user email (defaults to current user)
 * @returns SWR cache key array or null if not authenticated
 * 
 * @example
 * const key = formulaResultsKey('formula_123');
 * // Returns: ['formula-results', 'formula_123', 'user@example.com']
 */
export function formulaResultsKey(
	formulaId: string,
	userEmail?: string
): [string, string, string] | null {
	const email = userEmail || getUserEmail();
	
	if (!email) {
		return null;
	}

	return ['formula-results', formulaId, email];
}

// ============================================================================
// Watchlist Keys
// ============================================================================

/**
 * Generate SWR cache key for unified watchlists
 * Fetches from both MIO and TradingView
 * 
 * @param userEmail - Optional user email (defaults to current user)
 * @returns SWR cache key array or null if not authenticated
 * 
 * @example
 * const key = watchlistKey();
 * // Returns: ['watchlists', 'unified', 'user@example.com']
 */
export function watchlistKey(userEmail?: string): [string, string, string] | null {
	const email = userEmail || getUserEmail();
	
	if (!email) {
		return null;
	}

	return ['watchlists', 'unified', email];
}

/**
 * Generate SWR cache key for platform-specific watchlists
 * 
 * @param platform - 'mio' or 'tradingview'
 * @param userEmail - Optional user email (defaults to current user)
 * @returns SWR cache key array or null if not authenticated
 * 
 * @example
 * const key = platformWatchlistKey('mio');
 * // Returns: ['watchlists', 'mio', 'user@example.com']
 */
export function platformWatchlistKey(
	platform: 'mio' | 'tradingview',
	userEmail?: string
): [string, 'mio' | 'tradingview', string] | null {
	const email = userEmail || getUserEmail();
	
	if (!email) {
		return null;
	}

	return ['watchlists', platform, email];
}

/**
 * Generate SWR cache key for watchlist status check
 * Lightweight check without full data
 * 
 * @param userEmail - Optional user email (defaults to current user)
 * @returns SWR cache key array or null if not authenticated
 * 
 * @example
 * const key = watchlistStatusKey();
 * // Returns: ['watchlists', 'status', 'user@example.com']
 */
export function watchlistStatusKey(userEmail?: string): [string, string, string] | null {
	const email = userEmail || getUserEmail();
	
	if (!email) {
		return null;
	}

	return ['watchlists', 'status', email];
}

/**
 * Generate SWR cache key for MIO watchlists
 * Fetches only MIO platform watchlists
 * 
 * @param userEmail - Optional user email (defaults to current user)
 * @returns SWR cache key array or null if not authenticated
 * 
 * @example
 * const key = mioWatchlistsKey();
 * // Returns: ['watchlists', 'mio', 'user@example.com']
 */
export function mioWatchlistsKey(userEmail?: string): [string, 'mio' | 'tradingview', string] | null {
	return platformWatchlistKey('mio', userEmail);
}

/**
 * Generate SWR cache key for TradingView watchlists
 * Fetches only TradingView platform watchlists
 * 
 * @param userEmail - Optional user email (defaults to current user)
 * @returns SWR cache key array or null if not authenticated
 * 
 * @example
 * const key = tvWatchlistsKey();
 * // Returns: ['watchlists', 'tradingview', 'user@example.com']
 */
export function tvWatchlistsKey(userEmail?: string): [string, 'mio' | 'tradingview', string] | null {
	return platformWatchlistKey('tradingview', userEmail);
}

/**
 * Generate SWR cache key for symbols in a specific watchlist
 * Platform-agnostic - works with both MIO and TradingView
 * 
 * @param wlid - Watchlist ID
 * @param platform - Platform type ('mio' | 'tradingview')
 * @param userEmail - Optional user email (defaults to current user)
 * @returns SWR cache key array or null if not authenticated
 * 
 * @example
 * const key = watchlistSymbolsKey('123', 'mio');
 * // Returns: ['watchlist-symbols', '123', 'mio', 'user@example.com']
 */
export function watchlistSymbolsKey(
	wlid: string | number,
	platform: 'mio' | 'tradingview',
	userEmail?: string
): [string, string, 'mio' | 'tradingview', string] | null {
	const email = userEmail || getUserEmail();
	
	if (!email) {
		return null;
	}

	return ['watchlist-symbols', String(wlid), platform, email];
}

// ============================================================================
// Settings Keys
// ============================================================================

/**
 * Generate SWR cache key for user settings
 * User-scoped - automatically includes current user's email
 * 
 * @param userEmail - Optional user email (defaults to current user)
 * @returns SWR cache key array or null if not authenticated
 * 
 * @example
 * const key = settingsKey();
 * // Returns: ['settings', 'user@example.com'] (if logged in)
 * // Returns: null (if not logged in - SWR will not fetch)
 */
export function settingsKey(userEmail?: string): [string, string] | null {
	const email = userEmail || getUserEmail();
	
	if (!email) {
		return null; // Return null to prevent fetch when not authenticated
	}

	return ['settings', email];
}

// ============================================================================
// Key Utilities
// ============================================================================

/**
 * Check if a cache key is valid (not null)
 * Useful for conditional rendering based on authentication
 * 
 * @example
 * const key = formulaKey();
 * if (isValidKey(key)) {
 *   // User is authenticated, proceed with rendering
 * }
 */
export function isValidKey<T>(key: T | null): key is T {
	return key !== null;
}

/**
 * Generate a key matcher function for cache invalidation
 * Used with mutate(matcher) to invalidate multiple related keys
 * 
 * @example
 * // Invalidate all chart data for a specific symbol
 * mutate((key) => keyMatches(key, 'chart-data', 'NSE:RELIANCE'));
 */
export function keyMatches(
	key: unknown,
	...prefixes: string[]
): boolean {
	if (!Array.isArray(key)) {
		return false;
	}

	return prefixes.every((prefix, index) => key[index] === prefix);
}
