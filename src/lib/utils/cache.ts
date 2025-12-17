/**
 * Reusable localStorage cache utilities
 */

export interface CachedData<T> {
	data: T;
	cachedAt: number;
}

export class LocalStorageCache {
	private static readonly DEFAULT_DURATION = 5 * 60 * 1000; // 5 minutes

	/**
	 * Get item from cache
	 */
	static get<T>(key: string, maxAge: number = this.DEFAULT_DURATION): T | null {
		try {
			const cached = localStorage.getItem(key);
			if (!cached) return null;

			const cachedData: CachedData<T> = JSON.parse(cached);
			const age = Date.now() - cachedData.cachedAt;

			if (age < maxAge) {
				console.log(`[Cache] Hit for ${key} (age: ${Math.round(age / 1000)}s)`);
				return cachedData.data;
			}

			// Expired, remove it
			console.log(`[Cache] Expired for ${key} (age: ${Math.round(age / 1000)}s)`);
			localStorage.removeItem(key);
			return null;
		} catch (e) {
			console.warn(`[Cache] Failed to get ${key}:`, e);
			return null;
		}
	}

	/**
	 * Set item in cache
	 */
	static set<T>(key: string, data: T): void {
		try {
			const cachedData: CachedData<T> = {
				data,
				cachedAt: Date.now(),
			};
			localStorage.setItem(key, JSON.stringify(cachedData));
			console.log(`[Cache] Saved ${key}`);
		} catch (e) {
			console.warn(`[Cache] Failed to set ${key}:`, e);
		}
	}

	/**
	 * Remove item from cache
	 */
	static remove(key: string): void {
		try {
			localStorage.removeItem(key);
			console.log(`[Cache] Removed ${key}`);
		} catch (e) {
			console.warn(`[Cache] Failed to remove ${key}:`, e);
		}
	}

	/**
	 * Clear all items with a specific prefix
	 */
	static clearByPrefix(prefix: string): void {
		try {
			const keys = Object.keys(localStorage);
			const matchingKeys = keys.filter(key => key.startsWith(prefix));
			matchingKeys.forEach(key => localStorage.removeItem(key));
			console.log(`[Cache] Cleared ${matchingKeys.length} items with prefix "${prefix}"`);
		} catch (e) {
			console.warn(`[Cache] Failed to clear by prefix ${prefix}:`, e);
		}
	}

	/**
	 * Get cache age in milliseconds
	 */
	static getAge(key: string): number | null {
		try {
			const cached = localStorage.getItem(key);
			if (!cached) return null;

			const cachedData: CachedData<unknown> = JSON.parse(cached);
			return Date.now() - cachedData.cachedAt;
		} catch {
			return null;
		}
	}
}
