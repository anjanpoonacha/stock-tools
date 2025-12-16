// src/lib/mio/formulaCache.ts

import type { CachedFormulaData, FormulaAutocompleteData } from '@/types/formulaEditor';

/**
 * FormulaCacheManager - Client-side caching for formula autocomplete data
 * Uses localStorage with TTL (Time To Live) expiration
 */
export class FormulaCacheManager {
	private static readonly CACHE_KEY = 'mio-formula-data-v1';
	private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
	private static readonly CACHE_VERSION = '1.0.0';

	/**
	 * Get cached formula data if available and not expired
	 */
	static get(): CachedFormulaData | null {
		if (typeof window === 'undefined') {
			return null; // SSR guard
		}

		try {
			const cached = localStorage.getItem(this.CACHE_KEY);
			if (!cached) {
				return null;
			}

			const data: CachedFormulaData = JSON.parse(cached);

			// Check if version matches
			if (data.version !== this.CACHE_VERSION) {
				console.log('[FormulaCacheManager] Cache version mismatch, clearing');
				this.clear();
				return null;
			}

			// Check if expired
			if (this.isExpiredData(data)) {
				console.log('[FormulaCacheManager] Cache expired, clearing');
				this.clear();
				return null;
			}

			console.log('[FormulaCacheManager] Returning cached data');
			return data;
		} catch (error) {
			console.error('[FormulaCacheManager] Error reading cache:', error);
			this.clear();
			return null;
		}
	}

	/**
	 * Set cached formula data
	 */
	static set(data: FormulaAutocompleteData): void {
		if (typeof window === 'undefined') {
			return; // SSR guard
		}

		try {
			const cachedData: CachedFormulaData = {
				...data,
				timestamp: new Date().toISOString(),
				version: this.CACHE_VERSION,
			};

			localStorage.setItem(this.CACHE_KEY, JSON.stringify(cachedData));
			console.log('[FormulaCacheManager] Data cached successfully');
		} catch (error) {
			console.error('[FormulaCacheManager] Error setting cache:', error);
			// If quota exceeded, clear and try again
			if (error instanceof DOMException && error.name === 'QuotaExceededError') {
				this.clear();
			}
		}
	}

	/**
	 * Check if cached data is expired
	 */
	static isExpired(): boolean {
		const data = this.get();
		if (!data) {
			return true;
		}
		return this.isExpiredData(data);
	}

	/**
	 * Check if given cached data is expired
	 */
	private static isExpiredData(data: CachedFormulaData): boolean {
		const timestamp = new Date(data.timestamp).getTime();
		const now = Date.now();
		const age = now - timestamp;

		return age > this.CACHE_TTL_MS;
	}

	/**
	 * Clear cached data
	 */
	static clear(): void {
		if (typeof window === 'undefined') {
			return; // SSR guard
		}

		try {
			localStorage.removeItem(this.CACHE_KEY);
			console.log('[FormulaCacheManager] Cache cleared');
		} catch (error) {
			console.error('[FormulaCacheManager] Error clearing cache:', error);
		}
	}

	/**
	 * Get cache age in milliseconds
	 */
	static getCacheAge(): number | null {
		const data = this.get();
		if (!data) {
			return null;
		}

		const timestamp = new Date(data.timestamp).getTime();
		return Date.now() - timestamp;
	}

	/**
	 * Get cache age in human-readable format
	 */
	static getCacheAgeFormatted(): string | null {
		const age = this.getCacheAge();
		if (age === null) {
			return null;
		}

		const hours = Math.floor(age / (60 * 60 * 1000));
		const minutes = Math.floor((age % (60 * 60 * 1000)) / (60 * 1000));

		if (hours > 0) {
			return `${hours}h ${minutes}m ago`;
		}
		return `${minutes}m ago`;
	}
}
