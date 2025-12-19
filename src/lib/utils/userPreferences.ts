/**
 * User Preferences Utility
 * Manages personalized settings that persist across sessions
 */

const PREFERENCES_KEY = 'mio-user-preferences';

export interface UserPreferences {
	// Formula Results Table Preferences
	formulaResults?: {
		sortBy?: 'symbol' | 'name' | 'price' | 'sector' | 'industry';
		sortOrder?: 'asc' | 'desc';
		groupBy?: 'none' | 'sector' | 'industry';
	};
}

/**
 * Get all user preferences from localStorage
 */
export function getUserPreferences(): UserPreferences {
	try {
		const stored = localStorage.getItem(PREFERENCES_KEY);
		if (!stored) return {};
		return JSON.parse(stored);
	} catch (error) {
		return {};
	}
}

/**
 * Update user preferences in localStorage
 */
export function updateUserPreferences(updates: Partial<UserPreferences>): void {
	try {
		const current = getUserPreferences();
		const updated = {
			...current,
			...updates,
			// Deep merge nested objects
			formulaResults: {
				...current.formulaResults,
				...updates.formulaResults,
			},
		};
		localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
	} catch (error) {
	}
}

/**
 * Clear all user preferences
 */
export function clearUserPreferences(): void {
	try {
		localStorage.removeItem(PREFERENCES_KEY);
	} catch (error) {
	}
}

/**
 * Get formula results table preferences
 */
export function getFormulaResultsPreferences() {
	const prefs = getUserPreferences();
	return prefs.formulaResults || {};
}

/**
 * Update formula results table preferences
 */
export function updateFormulaResultsPreferences(
	updates: Partial<NonNullable<UserPreferences['formulaResults']>>
): void {
	updateUserPreferences({
		formulaResults: updates,
	});
}
