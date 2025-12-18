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
			const jsonString = JSON.stringify(cachedData);
			
			// Check size (rough estimate: 1 char = ~2 bytes in UTF-16)
			const sizeKB = (jsonString.length * 2) / 1024;
			
			if (sizeKB > 1024) { // Warn if > 1MB
				console.warn(`[Cache] Large cache item (${sizeKB.toFixed(0)}KB): ${key}`);
			}
			
			localStorage.setItem(key, jsonString);
			console.log(`[Cache] Saved ${key} (${sizeKB.toFixed(1)}KB)`);
		} catch (e) {
			if (e instanceof DOMException && e.name === 'QuotaExceededError') {
				console.warn(`[Cache] Quota exceeded. Clearing old cache items...`);
				// Try to free up space by clearing old items
				this.clearOldest(5); // Clear 5 oldest items
				
				// Try again
				try {
					const cachedData: CachedData<T> = { data, cachedAt: Date.now() };
					localStorage.setItem(key, JSON.stringify(cachedData));
					console.log(`[Cache] Saved ${key} after cleanup`);
				} catch (retryError) {
					console.error(`[Cache] Failed to set ${key} even after cleanup:`, retryError);
					throw retryError; // Re-throw so caller knows it failed
				}
			} else {
				console.warn(`[Cache] Failed to set ${key}:`, e);
				throw e;
			}
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

	/**
	 * Clear oldest cache items
	 * @param count Number of items to clear
	 */
	static clearOldest(count: number): void {
		try {
			const keys = Object.keys(localStorage);
			const cacheItems: Array<{ key: string; age: number }> = [];

			// Get age for each cache item
			for (const key of keys) {
				const age = this.getAge(key);
				if (age !== null) {
					cacheItems.push({ key, age });
				}
			}

			// Sort by age (oldest first)
			cacheItems.sort((a, b) => b.age - a.age);

			// Remove oldest items
			const toRemove = cacheItems.slice(0, count);
			toRemove.forEach(item => {
				localStorage.removeItem(item.key);
				console.log(`[Cache] Removed old item: ${item.key} (age: ${Math.round(item.age / 1000)}s)`);
			});

			console.log(`[Cache] Cleared ${toRemove.length} oldest items`);
		} catch (e) {
			console.warn('[Cache] Failed to clear oldest items:', e);
		}
	}
}
