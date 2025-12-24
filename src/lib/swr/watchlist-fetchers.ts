/**
 * Watchlist-Specific SWR Fetchers
 * 
 * Specialized fetchers for watchlist operations across MIO and TradingView platforms.
 * Handles platform-specific authentication and error handling.
 * 
 * Usage:
 *   const { data } = useSWR(mioWatchlistsKey(), mioWatchlistFetcher);
 *   const { data } = useSWR(tvWatchlistsKey(), tvWatchlistFetcher);
 */

import { getStoredCredentials } from '@/lib/auth/authUtils';
import { FetcherError } from './fetchers';
import type { WatchlistItem } from '@/types/auth';

// ============================================================================
// Response Types
// ============================================================================

export interface MIOWatchlistsResponse {
	watchlists: WatchlistItem[];
	sessionUsed?: string;
}

export interface TVWatchlistsResponse {
	watchlists: WatchlistItem[];
	healthStatus?: string;
	monitoringActive?: boolean;
}

export interface WatchlistSymbolsResponse {
	symbols: string[];
	watchlistId: string | number;
	watchlistName: string;
}

// ============================================================================
// Auth Helper
// ============================================================================

/**
 * Get credentials object or throw FetcherError
 * @throws FetcherError if credentials are not available
 */
function getAuthCredentials() {
	const credentials = getStoredCredentials();
	
	if (!credentials) {
		throw new FetcherError(
			'Authentication required. Please log in to continue.',
			401
		);
	}

	return credentials;
}

/**
 * Handle fetch errors with proper status codes
 */
async function handleFetchError(response: Response): Promise<never> {
	const contentType = response.headers.get('content-type');
	let errorData: unknown;

	if (contentType?.includes('application/json')) {
		errorData = await response.json();
	} else {
		errorData = await response.text();
	}

	const errorMessage = 
		typeof errorData === 'object' && errorData !== null && 'error' in errorData
			? String((errorData as { error: unknown }).error)
			: `Request failed with status ${response.status}`;

	throw new FetcherError(errorMessage, response.status, errorData);
}

// ============================================================================
// MIO Watchlist Fetchers
// ============================================================================

/**
 * Fetcher for MIO watchlists via /api/mio-action
 * Retrieves all watchlists for the authenticated user
 * 
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * const { data } = useSWR(mioWatchlistsKey(), mioWatchlistFetcher);
 */
export async function mioWatchlistFetcher(): Promise<MIOWatchlistsResponse> {
	const credentials = getAuthCredentials();

	const response = await fetch('/api/mio-action', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			userEmail: credentials.userEmail,
			userPassword: credentials.userPassword,
		}),
	});

	if (!response.ok) {
		await handleFetchError(response);
	}

	const data = await response.json();
	
	return {
		watchlists: data.watchlists || [],
		sessionUsed: data.sessionUsed,
	};
}

// ============================================================================
// TradingView Watchlist Fetchers
// ============================================================================

/**
 * Fetcher for TradingView watchlists via /api/tradingview-watchlists
 * Retrieves all watchlists for the authenticated user
 * 
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * const { data } = useSWR(tvWatchlistsKey(), tvWatchlistFetcher);
 */
export async function tvWatchlistFetcher(): Promise<TVWatchlistsResponse> {
	const credentials = getAuthCredentials();

	// Note: TradingView API uses internalSessionId, which we need to resolve
	// For now, we'll use the same credential-based approach
	const response = await fetch('/api/tradingview-watchlists', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			userEmail: credentials.userEmail,
			userPassword: credentials.userPassword,
		}),
	});

	if (!response.ok) {
		await handleFetchError(response);
	}

	const data = await response.json();
	
	return {
		watchlists: data.watchlists || [],
		healthStatus: data.healthStatus,
		monitoringActive: data.monitoringActive,
	};
}

// ============================================================================
// Watchlist Symbols Fetchers
// ============================================================================

/**
 * Fetcher for symbols in a specific watchlist
 * Platform-agnostic - works with both MIO and TradingView
 * 
 * @param wlid - Watchlist ID
 * @param platform - Platform type ('mio' | 'tradingview')
 * @returns List of symbols in the watchlist
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * const { data } = useSWR(
 *   watchlistSymbolsKey('123', 'mio'), 
 *   () => watchlistSymbolsFetcher('123', 'mio')
 * );
 */
export async function watchlistSymbolsFetcher(
	wlid: string | number,
	platform: 'mio' | 'tradingview'
): Promise<WatchlistSymbolsResponse> {
	if (platform === 'tradingview') {
		// TradingView: Fetch all watchlists and extract the specific one
		// This is efficient because SWR will cache the full list
		// and TradingView API returns symbols in the watchlist list
		const watchlistsData = await tvWatchlistFetcher();

		const watchlist = watchlistsData.watchlists.find(
			wl => String(wl.id) === String(wlid)
		);

		if (!watchlist) {
			throw new FetcherError(
				`Watchlist ${wlid} not found on ${platform}`,
				404
			);
		}

		return {
			symbols: watchlist.symbols || [],
			watchlistId: watchlist.id,
			watchlistName: watchlist.name,
		};
	} else {
		// MIO: Need to fetch symbols separately
		// MIO watchlist list doesn't include symbols, so we need a separate fetch
		const credentials = getAuthCredentials();

		const response = await fetch('/api/mio-watchlist-symbols', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				wlid: String(wlid),
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
			}),
		});

		if (!response.ok) {
			await handleFetchError(response);
		}

		const data = await response.json();

		return {
			symbols: data.symbols || [],
			watchlistId: wlid,
			watchlistName: data.watchlistName || `Watchlist ${wlid}`,
		};
	}
}
