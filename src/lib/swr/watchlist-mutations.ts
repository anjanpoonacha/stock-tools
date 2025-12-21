/**
 * Watchlist SWR Mutations
 * 
 * Mutation functions for watchlist operations using useSWRMutation pattern.
 * All mutations automatically revalidate related SWR cache keys.
 * 
 * Usage:
 *   const { trigger } = useSWRMutation('/api/mio-action', addStockToWatchlistMutation);
 *   await trigger({ symbol: 'NSE:RELIANCE', wlid: '123', platform: 'mio' });
 */

import { getStoredCredentials } from '@/lib/auth/authUtils';
import { FetcherError } from './fetchers';

// ============================================================================
// Mutation Argument Types
// ============================================================================

export interface AddStockToWatchlistArgs {
	symbol: string;
	wlid: string | number;
	platform: 'mio' | 'tradingview';
}

export interface SyncWatchlistToMioArgs {
	tvWlid: string | number;
	mioWlid: string | number;
	symbols: string[];
}

export interface AppendToTvWatchlistArgs {
	wlid: string | number;
	symbols: string[];
}

export interface RemoveStockFromWatchlistArgs {
	symbol: string;
	wlid: string | number;
	platform: 'mio' | 'tradingview';
}

export interface CreateWatchlistArgs {
	name: string;
	platform: 'mio';
}

export interface DeleteWatchlistArgs {
	deleteIds: string[] | number[];
	platform: 'mio';
}

// ============================================================================
// Response Types
// ============================================================================

export interface MutationResponse {
	success: boolean;
	message?: string;
	data?: unknown;
	sessionUsed?: string;
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
// MIO Mutations
// ============================================================================

/**
 * Add a single stock to MIO watchlist
 * 
 * @param args - Stock symbol and watchlist ID
 * @returns Mutation response with success status
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * const { trigger } = useSWRMutation(
 *   mioWatchlistsKey(), 
 *   (_key, { arg }) => addStockToWatchlist(arg)
 * );
 * await trigger({ symbol: 'NSE:RELIANCE', wlid: '123', platform: 'mio' });
 */
export async function addStockToWatchlist(
	args: AddStockToWatchlistArgs
): Promise<MutationResponse> {
	const { symbol, wlid, platform } = args;
	const credentials = getAuthCredentials();

	if (platform === 'mio') {
		const response = await fetch('/api/mio-action', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
				action: 'addSingle',
				mioWlid: String(wlid),
				symbol,
			}),
		});

		if (!response.ok) {
			await handleFetchError(response);
		}

		const data = await response.json();
		
		return {
			success: data.result?.success ?? true,
			message: data.result?.message,
			data: data.result,
			sessionUsed: data.sessionUsed,
		};
	}

	// TradingView mutations would go here
	throw new FetcherError(
		`Platform ${platform} not yet supported for adding stocks`,
		501
	);
}

/**
 * Remove a single stock from watchlist
 * 
 * @param args - Stock symbol and watchlist ID
 * @returns Mutation response with success status
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * const { trigger } = useSWRMutation(
 *   mioWatchlistsKey(), 
 *   (_key, { arg }) => removeStockFromWatchlist(arg)
 * );
 * await trigger({ symbol: 'NSE:RELIANCE', wlid: '123', platform: 'mio' });
 */
export async function removeStockFromWatchlist(
	args: RemoveStockFromWatchlistArgs
): Promise<MutationResponse> {
	const { symbol, wlid, platform } = args;
	const credentials = getAuthCredentials();

	if (platform === 'mio') {
		const response = await fetch('/api/mio-action', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
				action: 'removeSingle',
				mioWlid: String(wlid),
				symbol,
			}),
		});

		if (!response.ok) {
			await handleFetchError(response);
		}

		const data = await response.json();
		
		return {
			success: data.result?.success ?? true,
			message: data.result?.message,
			data: data.result,
			sessionUsed: data.sessionUsed,
		};
	}

	throw new FetcherError(
		`Platform ${platform} not yet supported for removing stocks`,
		501
	);
}

/**
 * Create a new watchlist
 * 
 * @param args - Watchlist name and platform
 * @returns Created watchlist data
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * const { trigger } = useSWRMutation(
 *   mioWatchlistsKey(),
 *   (_key, { arg }) => createWatchlist(arg)
 * );
 * await trigger({ name: 'My New Watchlist', platform: 'mio' });
 */
export async function createWatchlist(
	args: CreateWatchlistArgs
): Promise<MutationResponse> {
	const { name, platform } = args;
	const credentials = getAuthCredentials();

	if (platform === 'mio') {
		const response = await fetch('/api/mio-action', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
				name,
			}),
		});

		if (!response.ok) {
			await handleFetchError(response);
		}

		const data = await response.json();
		
		return {
			success: data.result?.success ?? true,
			message: data.result?.message,
			data: data.result,
			sessionUsed: data.sessionUsed,
		};
	}

	throw new FetcherError(
		`Platform ${platform} not yet supported for creating watchlists`,
		501
	);
}

/**
 * Delete watchlists
 * 
 * @param args - Array of watchlist IDs to delete and platform
 * @returns Mutation response with success status
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * const { trigger } = useSWRMutation(
 *   mioWatchlistsKey(),
 *   (_key, { arg }) => deleteWatchlists(arg)
 * );
 * await trigger({ deleteIds: ['123', '456'], platform: 'mio' });
 */
export async function deleteWatchlists(
	args: DeleteWatchlistArgs
): Promise<MutationResponse> {
	const { deleteIds, platform } = args;
	const credentials = getAuthCredentials();

	if (platform === 'mio') {
		const response = await fetch('/api/mio-action', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
				deleteIds: deleteIds.map(String),
			}),
		});

		if (!response.ok) {
			await handleFetchError(response);
		}

		const data = await response.json();
		
		return {
			success: data.result?.success ?? true,
			message: data.result?.message,
			data: data.result,
			sessionUsed: data.sessionUsed,
		};
	}

	throw new FetcherError(
		`Platform ${platform} not yet supported for deleting watchlists`,
		501
	);
}

// ============================================================================
// Cross-Platform Sync Mutations
// ============================================================================

/**
 * Sync watchlist from TradingView to MIO
 * Bulk operation that adds all symbols from TV watchlist to MIO watchlist
 * 
 * @param args - Source TV watchlist ID, target MIO watchlist ID, and symbols
 * @returns Mutation response with success status
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * const { trigger } = useSWRMutation(
 *   mioWatchlistsKey(),
 *   (_key, { arg }) => syncWatchlistToMio(arg)
 * );
 * await trigger({ 
 *   tvWlid: 'tv123', 
 *   mioWlid: 'mio456', 
 *   symbols: ['NSE:RELIANCE', 'NSE:TCS'] 
 * });
 */
export async function syncWatchlistToMio(
	args: SyncWatchlistToMioArgs
): Promise<MutationResponse> {
	const { mioWlid, symbols } = args;
	const credentials = getAuthCredentials();

	// Use the bulk add endpoint
	const response = await fetch('/api/mio-action', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			userEmail: credentials.userEmail,
			userPassword: credentials.userPassword,
			mioWlid: String(mioWlid),
			symbols,
		}),
	});

	if (!response.ok) {
		await handleFetchError(response);
	}

	const data = await response.json();
	
	return {
		success: data.result?.success ?? true,
		message: data.result?.message || `Synced ${symbols.length} symbols to MIO`,
		data: data.result,
		sessionUsed: data.sessionUsed,
	};
}

/**
 * Append symbols to TradingView watchlist
 * Note: This is a placeholder - actual implementation depends on TV API availability
 * 
 * @param args - Watchlist ID and symbols to append
 * @returns Mutation response with success status
 * @throws FetcherError - Currently not implemented
 * 
 * @example
 * const { trigger } = useSWRMutation(
 *   tvWatchlistsKey(),
 *   (_key, { arg }) => appendToTvWatchlist(arg)
 * );
 * await trigger({ wlid: 'tv123', symbols: ['NSE:RELIANCE'] });
 */
export async function appendToTvWatchlist(
	_args: AppendToTvWatchlistArgs
): Promise<MutationResponse> {
	// TODO: Implement TradingView watchlist mutation when API is available
	throw new FetcherError(
		'TradingView watchlist mutations not yet implemented',
		501
	);
}

// ============================================================================
// Mutation Hook Factories (useSWRMutation compatible)
// ============================================================================

/**
 * Create mutation function for useSWRMutation hook
 * Automatically handles the _key parameter that SWR passes
 * 
 * @example
 * const { trigger } = useSWRMutation(
 *   mioWatchlistsKey(),
 *   addStockToWatchlistMutation
 * );
 * await trigger({ symbol: 'NSE:RELIANCE', wlid: '123', platform: 'mio' });
 */
export const addStockToWatchlistMutation = (
	_key: unknown,
	{ arg }: { arg: AddStockToWatchlistArgs }
) => addStockToWatchlist(arg);

export const removeStockFromWatchlistMutation = (
	_key: unknown,
	{ arg }: { arg: RemoveStockFromWatchlistArgs }
) => removeStockFromWatchlist(arg);

export const createWatchlistMutation = (
	_key: unknown,
	{ arg }: { arg: CreateWatchlistArgs }
) => createWatchlist(arg);

export const deleteWatchlistsMutation = (
	_key: unknown,
	{ arg }: { arg: DeleteWatchlistArgs }
) => deleteWatchlists(arg);

export const syncWatchlistToMioMutation = (
	_key: unknown,
	{ arg }: { arg: SyncWatchlistToMioArgs }
) => syncWatchlistToMio(arg);

export const appendToTvWatchlistMutation = (
	_key: unknown,
	{ arg }: { arg: AppendToTvWatchlistArgs }
) => appendToTvWatchlist(arg);
