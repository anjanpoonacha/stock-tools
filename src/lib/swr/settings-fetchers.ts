/**
 * SWR Settings Fetcher
 * 
 * Fetcher function for user-scoped KV settings.
 * Handles authentication and returns full AllSettings object.
 * 
 * Usage:
 *   const { data } = useSWR(settingsKey(), settingsFetcher);
 */

import { requireCredentials } from '@/lib/auth/authUtils';
import type { AllSettings } from '@/types/chartSettings';
import { FetcherError } from './fetchers';

// ============================================================================
// Settings Fetcher
// ============================================================================

/**
 * Fetcher for /api/kv/settings endpoint (GET)
 * Retrieves user-scoped settings (panel layout + chart settings)
 * 
 * Returns:
 * - AllSettings object if settings exist
 * - null if no settings exist (first-time user)
 * 
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * const { data, error, isLoading } = useSWR(settingsKey(), settingsFetcher);
 */
export async function settingsFetcher(): Promise<AllSettings | null> {
	// Get credentials (throws if not authenticated)
	const credentials = (() => {
		try {
			return requireCredentials();
		} catch (error) {
			throw new FetcherError(
				error instanceof Error ? error.message : 'Authentication required',
				401
			);
		}
	})();

	// Build query string with auth credentials
	const queryParams = new URLSearchParams({
		userEmail: credentials.userEmail,
		userPassword: credentials.userPassword,
	});

	const response = await fetch(`/api/kv/settings?${queryParams}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
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
				: `Failed to fetch settings (status ${response.status})`;

		throw new FetcherError(errorMessage, response.status, errorData);
	}

	// API returns null for first-time users
	return response.json();
}

/**
 * Verify that settings are loaded and authenticated
 * Useful for conditional rendering
 * 
 * @example
 * if (isSettingsAuthenticated(data, error)) {
 *   // User is authenticated and settings are loaded
 * }
 */
export function isSettingsAuthenticated(
	data: AllSettings | null | undefined,
	error: FetcherError | undefined
): boolean {
	// If error is 401, user is not authenticated
	if (error?.status === 401) {
		return false;
	}
	
	// If no error and data is present or null (both valid), user is authenticated
	return !error && (data !== undefined);
}
