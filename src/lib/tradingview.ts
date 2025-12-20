/**
 * TradingView API abstraction layer.
 * Encapsulates all TradingView API interactions for maintainability and reuse.
 *
 * ## Usage Example
 * ```ts
 * import { fetchWatchlistsWithAuth } from "@/lib/tradingview";
 * const watchlists = await fetchWatchlistsWithAuth(url, cookie);
 * ```
 */

/**
 * Fetch shortlist data from TradingView.
 * @param params - Parameters for fetching shortlist.
 * @returns Promise with shortlist data.
 */
export async function fetchShortlist(): Promise<never> {
	// TODO: Implement TradingView shortlist fetch logic.
	throw new Error('fetchShortlist not implemented');
}

/**
 * Post an alert to TradingView.
 * @param payload - Alert payload.
 * @returns Promise with TradingView response.
 */
export async function postAlert(): Promise<never> {
	// TODO: Implement TradingView alert posting logic.
	throw new Error('postAlert not implemented');
}

/**
 * Parse TradingView alert payload.
 * @param data - Raw payload data.
 * @returns Parsed payload.
 */
export function parseAlertPayload<T>(data: T): T {
	// TODO: Implement payload parsing logic.
	return data;
}

/**
 * Fetch TradingView watchlists with authentication.
 * @param url - TradingView API endpoint.
 * @param cookie - Authentication cookie.
 * @returns Promise with filtered watchlist data.
 */
// Watchlist type for TradingView
export type TradingViewWatchlist = {
	id: string;
	name: string;
	symbols: string[];
};

export async function fetchWatchlistsWithAuth(url: string, cookie: string): Promise<TradingViewWatchlist[]> {
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
				Cookie: cookie,
			},
		});
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
		}
		const data = await res.json();
		if (!Array.isArray(data)) {
			throw new Error('Unexpected response format from TradingView API');
		}
		// Only return id, name, and symbols for each watchlist
		return data
			.filter((list: unknown): list is TradingViewWatchlist => {
				return (
					typeof list === 'object' &&
					list !== null &&
					'id' in list &&
					'name' in list &&
					'symbols' in list &&
					Array.isArray((list as { symbols: unknown }).symbols)
				);
			})
			.map((list) => ({
				id: list.id,
				name: list.name,
				symbols: list.symbols,
			}));
	} catch (err) {
		throw err;
	}
}

/**
 * Append a symbol to a TradingView watchlist.
 * @param watchlistId - The ID of the watchlist.
 * @param symbol - The symbol to append (e.g. "NSE:TCS").
 * @param cookie - The TradingView session cookie (e.g. "sessionid=...")
 */
export async function appendSymbolToWatchlist(watchlistId: string, symbol: string, cookie: string): Promise<void> {
	const url = `https://www.tradingview.com/api/v1/symbols_list/custom/${watchlistId}/append/`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Cookie: cookie,
			Origin: 'https://www.tradingview.com',
			'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
		},
		body: JSON.stringify([symbol]),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`[TradingView API] Failed to append symbol: ${res.status} ${res.statusText} - ${text}`);
	}
}

/**
 * Create a new watchlist on TradingView.
 * @param name - The name of the watchlist to create.
 * @param cookie - The TradingView session cookie (e.g. "sessionid=...")
 * @returns Promise with the created watchlist ID
 */
export async function createWatchlist(name: string, cookie: string): Promise<{ id: string; name: string }> {
	const url = 'https://www.tradingview.com/api/v1/symbols_list/custom/';
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Cookie: cookie,
			Origin: 'https://www.tradingview.com',
			'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
		},
		body: JSON.stringify({
			name,
			symbols: [],
		}),
	});
	
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`[TradingView API] Failed to create watchlist: ${res.status} ${res.statusText} - ${text}`);
	}

	const data = await res.json();
	
	// Validate response structure
	if (!data || (typeof data.id !== 'string' && typeof data.id !== 'number')) {
		throw new Error(`[TradingView API] Invalid response structure from create watchlist. Got: ${JSON.stringify(data)}`);
	}

	return {
		id: String(data.id), // Convert to string for consistency
		name: data.name || name,
	};
}

/**
 * Validate TradingView session by checking the custom watchlists endpoint.
 * If not logged in, it returns an array with 1 watchlist where id is null.
 * If logged in, it returns the user's actual watchlists with valid IDs.
 * @param cookie - TradingView session cookie
 * @returns Promise with validation result
 */
export async function validateTradingViewSession(cookie: string): Promise<{
	isValid: boolean;
	watchlistCount: number;
	hasValidIds: boolean;
	error?: string;
}> {
	const validationUrl = 'https://www.tradingview.com/api/v1/symbols_list/custom/';

	try {
		const res = await fetch(validationUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
				Cookie: cookie,
			},
		});

		if (!res.ok) {
			return {
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: `HTTP ${res.status}: ${res.statusText}`
			};
		}

		const data = await res.json();

		if (!Array.isArray(data)) {
			return {
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: 'Unexpected response format'
			};
		}

		// Check if this is a logged-out response (1 watchlist with null id)
		const hasValidIds = data.length > 1 || (data.length === 1 && data[0].id !== null);

		return {
			isValid: hasValidIds,
			watchlistCount: data.length,
			hasValidIds,
			error: hasValidIds ? undefined : 'Session appears to be logged out (null watchlist ID detected)'
		};

	} catch (err) {
		return {
			isValid: false,
			watchlistCount: 0,
			hasValidIds: false,
			error: err instanceof Error ? err.message : 'Unknown validation error'
		};
	}
}

// Add more TradingView-related abstractions as needed.
