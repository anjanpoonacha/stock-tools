/**
 * SWR Fetcher Utilities
 * 
 * Reusable fetcher functions for SWR hooks with consistent error handling and authentication.
 * All fetchers use credentials from localStorage via getStoredCredentials().
 * 
 * Usage:
 *   const { data, error } = useSWR(chartDataKey(...), chartDataFetcher);
 */

import { getStoredCredentials, requireCredentials } from '@/lib/auth/authUtils';
import type { ChartDataResponse } from '@/lib/tradingview/types';
import type { MIOFormula } from '@/types/formula';
import type { Stock } from '@/types/stock';
import type { UnifiedWatchlistResponse } from '@/types/auth';

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class with HTTP status code for SWR error handling
 */
export class FetcherError extends Error {
	constructor(
		message: string,
		public status: number,
		public response?: unknown
	) {
		super(message);
		this.name = 'FetcherError';
	}
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
// Auth Helper
// ============================================================================

/**
 * Get authentication headers for API requests
 * @throws FetcherError if credentials are not available
 */
function getAuthHeaders(): HeadersInit {
	const credentials = getStoredCredentials();
	
	if (!credentials) {
		throw new FetcherError('Authentication required. Please log in to continue.', 401);
	}

	return {
		'Content-Type': 'application/json',
	};
}

/**
 * Get credentials object or throw error
 * @throws FetcherError if credentials are not available
 */
function getAuthCredentials() {
	try {
		return requireCredentials();
	} catch (error) {
		throw new FetcherError(
			error instanceof Error ? error.message : 'Authentication required',
			401
		);
	}
}

// ============================================================================
// Chart Data Fetchers
// ============================================================================

export interface ChartDataFetcherParams {
	symbol: string;
	resolution?: string;
	barsCount?: number;
	cvdEnabled?: boolean;
	cvdAnchorPeriod?: string;
	cvdTimeframe?: string;
}

/**
 * Fetcher for /api/chart-data endpoint
 * Handles POST request with authentication
 * 
 * @throws FetcherError on authentication or API errors
 */
export async function chartDataFetcher(
	params: ChartDataFetcherParams
): Promise<ChartDataResponse> {
	const credentials = getAuthCredentials();
	
	// Build query string
	const queryParams = new URLSearchParams({
		symbol: params.symbol,
		...(params.resolution && { resolution: params.resolution }),
		...(params.barsCount && { barsCount: params.barsCount.toString() }),
		...(params.cvdEnabled !== undefined && { cvdEnabled: params.cvdEnabled.toString() }),
		...(params.cvdAnchorPeriod && { cvdAnchorPeriod: params.cvdAnchorPeriod }),
		...(params.cvdTimeframe && { cvdTimeframe: params.cvdTimeframe }),
	});

	const response = await fetch(`/api/chart-data?${queryParams}`, {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			userEmail: credentials.userEmail,
			userPassword: credentials.userPassword,
		}),
	});

	if (!response.ok) {
		await handleFetchError(response);
	}

	return response.json();
}

// ============================================================================
// Formula Fetchers
// ============================================================================

export interface FormulaListResponse {
	formulas: MIOFormula[];
	totalCount: number;
	lastUpdated: string | null;
}

/**
 * Fetcher for /api/mio-formulas endpoint (GET)
 * Retrieves user's stored formulas
 * 
 * @throws FetcherError on authentication or API errors
 */
export async function formulaFetcher(): Promise<FormulaListResponse> {
	const credentials = getAuthCredentials();
	
	const queryParams = new URLSearchParams({
		userEmail: credentials.userEmail,
		userPassword: credentials.userPassword,
	});

	const response = await fetch(`/api/mio-formulas?${queryParams}`, {
		method: 'GET',
		headers: getAuthHeaders(),
	});

	if (!response.ok) {
		await handleFetchError(response);
	}

	return response.json();
}

/**
 * Extract formulas from MIO (POST)
 * This is a mutation, not a fetcher - but included for completeness
 * Use with SWR's mutation hooks (useSWRMutation)
 * 
 * @param forceRefresh - Force re-extraction even if formulas exist
 * @throws FetcherError on authentication or API errors
 */
export async function extractFormulas(forceRefresh = false): Promise<{
	success: boolean;
	extracted: number;
	failed: number;
	formulas: MIOFormula[];
	errors: Array<{ formulaName: string; error: string }>;
}> {
	const credentials = getAuthCredentials();

	const response = await fetch('/api/mio-formulas', {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			userEmail: credentials.userEmail,
			userPassword: credentials.userPassword,
			forceRefresh,
		}),
	});

	if (!response.ok) {
		await handleFetchError(response);
	}

	return response.json();
}

// ============================================================================
// Formula Results Fetchers
// ============================================================================

export interface FormulaResultsResponse {
	success: boolean;
	formulaName: string;
	stocks: Stock[];
	stockCount: number;
	error?: string;
}

/**
 * Fetcher for /api/formula-results endpoint
 * Gets stock list for a specific formula
 * 
 * @param formulaId - The formula ID to fetch results for
 * @throws FetcherError on authentication or API errors
 */
export async function formulaResultsFetcher(
	formulaId: string
): Promise<FormulaResultsResponse> {
	const credentials = getAuthCredentials();

	const response = await fetch('/api/formula-results', {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			userEmail: credentials.userEmail,
			userPassword: credentials.userPassword,
			formulaId,
		}),
	});

	if (!response.ok) {
		await handleFetchError(response);
	}

	return response.json();
}

// ============================================================================
// Watchlist Fetchers
// ============================================================================

/**
 * Fetcher for /api/watchlists endpoint
 * Gets unified watchlists from both MIO and TradingView
 * 
 * @throws FetcherError on authentication or API errors
 */
export async function watchlistFetcher(): Promise<UnifiedWatchlistResponse> {
	const credentials = getAuthCredentials();

	const response = await fetch('/api/watchlists', {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			userEmail: credentials.userEmail,
			userPassword: credentials.userPassword,
		}),
	});

	if (!response.ok) {
		await handleFetchError(response);
	}

	return response.json();
}

/**
 * Fetcher for /api/watchlists endpoint (GET)
 * Quick status check without full watchlist data
 * 
 * @throws FetcherError on authentication or API errors
 */
export async function watchlistStatusFetcher(): Promise<{
	userEmail: string;
	platforms: {
		mio: { available: boolean; sessionCount: number };
		tradingview: { available: boolean; sessionCount: number };
	};
	message: string;
}> {
	const credentials = getAuthCredentials();
	
	const queryParams = new URLSearchParams({
		userEmail: credentials.userEmail,
		userPassword: credentials.userPassword,
	});

	const response = await fetch(`/api/watchlists?${queryParams}`, {
		method: 'GET',
		headers: getAuthHeaders(),
	});

	if (!response.ok) {
		await handleFetchError(response);
	}

	return response.json();
}
