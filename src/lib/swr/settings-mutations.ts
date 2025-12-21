/**
 * SWR Settings Mutations
 * 
 * Mutation functions for updating user-scoped KV settings.
 * Includes debouncing, optimistic updates, and error rollback.
 * 
 * Usage:
 *   const { trigger } = useSWRMutation(settingsKey(), updateSettingsMutation);
 *   await trigger(newSettings);
 */

import { requireCredentials } from '@/lib/auth/authUtils';
import type { AllSettings } from '@/types/chartSettings';
import { FetcherError } from './fetchers';

// ============================================================================
// Debounce Utilities
// ============================================================================

/**
 * Debounce timer map for settings updates
 * Key: user email (to support multiple users)
 * Value: timeout ID
 */
const debounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Debounce delay for settings updates (1 second)
 * Prevents excessive writes to KV store
 */
const SETTINGS_DEBOUNCE_MS = 1000;

/**
 * Clear debounce timer for a user
 */
function clearDebounceTimer(userEmail: string): void {
	const timer = debounceTimers.get(userEmail);
	if (timer) {
		clearTimeout(timer);
		debounceTimers.delete(userEmail);
	}
}

// ============================================================================
// Settings Mutation
// ============================================================================

/**
 * Mutation function for /api/kv/settings endpoint (POST)
 * Updates user-scoped settings with debouncing and error handling.
 * 
 * Features:
 * - 1-second debounce to reduce KV writes
 * - Optimistic updates (update UI immediately)
 * - Error rollback (revert on failure)
 * - Per-user debouncing (multi-user safe)
 * 
 * @param _key - SWR cache key (unused, provided by SWR)
 * @param options - SWR mutation options
 * @param settings - New settings to save
 * @returns Promise that resolves when settings are saved
 * 
 * @throws FetcherError on authentication or API errors
 * 
 * @example
 * // Basic usage
 * const { trigger } = useSWRMutation(settingsKey(), updateSettingsMutation);
 * await trigger(newSettings);
 * 
 * @example
 * // With optimistic updates
 * const { trigger } = useSWRMutation(
 *   settingsKey(),
 *   updateSettingsMutation,
 *   {
 *     optimisticData: (current) => newSettings,
 *     rollbackOnError: true,
 *     populateCache: true,
 *     revalidate: false,
 *   }
 * );
 */
export async function updateSettingsMutation(
	_key: unknown,
	{ arg: settings }: { arg: AllSettings }
): Promise<{ success: boolean }> {
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

	// Return a promise that resolves after debounce
	return new Promise<{ success: boolean }>((resolve, reject) => {
		// Clear any existing timer for this user
		clearDebounceTimer(credentials.userEmail);

		// Set new debounce timer
		const timer = setTimeout(async () => {
			try {
				// Remove timer from map
				debounceTimers.delete(credentials.userEmail);

				// Perform the actual API call
				const response = await fetch('/api/kv/settings', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						userEmail: credentials.userEmail,
						userPassword: credentials.userPassword,
						settings,
					}),
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
							: `Failed to update settings (status ${response.status})`;

					throw new FetcherError(errorMessage, response.status, errorData);
				}

				const result = await response.json();
				resolve(result);
			} catch (error) {
				reject(error);
			}
		}, SETTINGS_DEBOUNCE_MS);

		// Store timer in map
		debounceTimers.set(credentials.userEmail, timer);
	});
}

/**
 * Immediately save settings without debouncing
 * Use for critical updates that must be saved immediately
 * 
 * @example
 * const { trigger } = useSWRMutation(settingsKey(), updateSettingsImmediately);
 * await trigger(newSettings);
 */
export async function updateSettingsImmediately(
	_key: unknown,
	{ arg: settings }: { arg: AllSettings }
): Promise<{ success: boolean }> {
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

	// Clear any pending debounced update for this user
	clearDebounceTimer(credentials.userEmail);

	// Perform the API call immediately
	const response = await fetch('/api/kv/settings', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			userEmail: credentials.userEmail,
			userPassword: credentials.userPassword,
			settings,
		}),
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
				: `Failed to update settings (status ${response.status})`;

		throw new FetcherError(errorMessage, response.status, errorData);
	}

	return response.json();
}
