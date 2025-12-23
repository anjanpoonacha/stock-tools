/**
 * CVD Configuration Service
 * 
 * Dynamically fetches CVD (Cumulative Volume Delta) indicator configuration
 * from TradingView to avoid hardcoded encrypted text that becomes stale.
 * 
 * Features:
 * - Fetches CVD config from TradingView chart page HTML
 * - Caches config in Vercel KV for 24 hours (shared across instances)
 * - Falls back to fetching again if KV unavailable
 * - No hardcoded constants dependency
 * - Type-safe configuration interface
 * 
 * Architecture:
 * 1. Check KV cache first (instant)
 * 2. If cache miss/expired, fetch from TradingView (<2 seconds)
 * 3. If fetch fails, retry once more
 * 4. If KV unavailable, skip caching but still fetch fresh config
 * 
 * @module cvdConfigService
 */

import { kv } from '@vercel/kv';
import { CVD_PINE_FEATURES } from './cvd-constants';
import { isServerCacheEnabled } from '@/lib/cache/cacheConfig';

// Re-export CVD_PINE_FEATURES for use in building StudyConfig
export { CVD_PINE_FEATURES };

/**
 * CVD Configuration
 * Complete configuration needed to create CVD indicator via WebSocket
 */
export interface CVDConfig {
	text: string;           // Encrypted Pine script
	pineId: string;         // Study ID (e.g., "STD;Cumulative%1Volume%1Delta")
	pineVersion: string;    // Pine version (e.g., "7.0")
	source: 'kv-cache' | 'fresh-fetch'; // Where the config came from
	fetchedAt?: Date;       // When config was fetched (for debugging)
}

/**
 * KV Cache key for CVD config
 */
const CVD_CONFIG_KV_KEY = 'tradingview:cvd:config';

/**
 * Cache TTL in seconds (24 hours)
 */
const CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * CVD Config Service
 * Singleton service for managing CVD configuration
 */
class CVDConfigService {
	private fetchInProgress: Promise<CVDConfig> | null = null;

	/**
	 * Get CVD configuration (with KV caching)
	 * 
	 * Flow:
	 * 1. Try to get from KV cache
	 * 2. If cache miss, fetch from TradingView
	 * 3. Store in KV for next time
	 * 4. If KV fails, still fetch fresh config
	 * 
	 * @param sessionId TradingView session ID
	 * @param sessionIdSign Optional session signature
	 * @returns CVD configuration
	 */
	async getConfig(sessionId: string, sessionIdSign?: string): Promise<CVDConfig> {
		
		// If fetch already in progress, wait for it
		if (this.fetchInProgress) {
			return this.fetchInProgress;
		}

		// Try to get from KV cache first (only if enabled via env var)
		const cacheEnabled = isServerCacheEnabled();
		
		if (cacheEnabled) {
			try {
				const cached = await this.getFromCache();
				if (cached) {
					return cached;
				} else {
				}
			} catch (error) {
			}
		} else {
			console.log('[CVD Config] Cache DISABLED (default) - fetching fresh config');
		}

		// Cache miss - fetch fresh config
		this.fetchInProgress = this.fetchAndCacheConfig(sessionId, sessionIdSign);

		try {
			const config = await this.fetchInProgress;
			return config;
		} finally {
			this.fetchInProgress = null;
		}
	}

	/**
	 * Get config from KV cache
	 */
	private async getFromCache(): Promise<CVDConfig | null> {
		try {
			const cached = await kv.get<CVDConfig>(CVD_CONFIG_KV_KEY);
			if (cached) {
				// Mark as coming from cache
				return {
					...cached,
					source: 'kv-cache'
				};
			}
			return null;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Store config in KV cache
	 */
	private async storeInCache(config: CVDConfig): Promise<void> {
		try {
			await kv.set(CVD_CONFIG_KV_KEY, config, { ex: CACHE_TTL_SECONDS });
		} catch (error) {
		}
	}

	/**
	 * Fetch config from TradingView and cache it
	 */
	private async fetchAndCacheConfig(sessionId: string, sessionIdSign?: string): Promise<CVDConfig> {
		const config = await this.fetchConfigFromTradingView(sessionId, sessionIdSign);
		
		// Try to cache it (but only if caching is enabled)
		if (isServerCacheEnabled()) {
			await this.storeInCache(config);
		}
		
		return config;
	}

	/**
	 * Fetch CVD configuration from TradingView
	 * 
	 * Parses the chart page HTML to extract:
	 * - Encrypted Pine script text
	 * - Pine ID
	 * - Pine version
	 * 
	 * @param sessionId TradingView session ID
	 * @param sessionIdSign Optional session signature
	 * @returns CVD configuration
	 * @throws Error if fetch or parse fails
	 */
	private async fetchConfigFromTradingView(sessionId: string, sessionIdSign?: string): Promise<CVDConfig> {
		const chartUrl = 'https://www.tradingview.com/chart/';
		const cookies = sessionIdSign 
			? `sessionid=${sessionId}; sessionid_sign=${sessionIdSign}`
			: `sessionid=${sessionId}`;

		
		let lastError: Error | null = null;
		
		// Try up to 2 times
		for (let attempt = 1; attempt <= 2; attempt++) {
			try {
				const response = await fetch(chartUrl, {
					headers: {
						'Cookie': cookies,
						'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
						'Accept': 'text/html,application/xhtml+xml',
					},
				});


				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const html = await response.text();
				
				const config = this.parseConfigFromHTML(html);

				if (config) {
					return config;
				} else {
					throw new Error('Failed to parse CVD config from HTML');
				}

			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				
				if (attempt < 2) {
					await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
				}
			}
		}

		throw new Error(`Failed to fetch CVD config after 2 attempts: ${lastError?.message || 'Unknown error'}`);
	}

	/**
	 * Parse CVD configuration from TradingView HTML
	 * 
	 * Extracts:
	 * 1. Encrypted text (bmI9Ks46_...)
	 * 2. Pine version from study key
	 * 3. Pine ID (always "STD;Cumulative%1Volume%1Delta")
	 * 
	 * @param html TradingView chart page HTML
	 * @returns CVD configuration or null if not found
	 */
	private parseConfigFromHTML(html: string): CVDConfig | null {
		
		// Find all encrypted texts
		const encryptedPattern = /bmI9Ks46_[A-Za-z0-9+/=_]{1000,}/g;
		const encryptedMatches = html.match(encryptedPattern);


		if (!encryptedMatches || encryptedMatches.length === 0) {
			return null;
		}

		// Sort by length (CVD is the longest at ~17KB)
		const sortedByLength = [...encryptedMatches].sort((a, b) => b.length - a.length);

		// Search for CVD indicator
		for (const encryptedText of sortedByLength) {
			const matchIndex = html.indexOf(encryptedText);

			// Get context window (10KB before and after)
			const contextWindow = html.substring(
				Math.max(0, matchIndex - 10000),
				Math.min(html.length, matchIndex + encryptedText.length + 10000)
			);

			// Check if this is CVD
			const isCVD = contextWindow.includes('Cumulative%1Volume%1Delta') ||
			              contextWindow.includes('Cumulative Volume Delta');


			if (isCVD) {
				
				// Extract Pine version from study key
				// Format: "Script$STD;Cumulative%1Volume%1Delta@tv-scripting-101[v.X.X]"
				const studyKeyMatch = contextWindow.match(
					/"Script\$STD;Cumulative%1Volume%1Delta@tv-scripting-101\[v\.(\d+\.\d+)\]"/
				);


				if (studyKeyMatch) {
					const pineVersion = studyKeyMatch[1];
					const pineId = 'STD;Cumulative%1Volume%1Delta';


					return {
						text: encryptedText,
						pineId,
						pineVersion,
						source: 'fresh-fetch',
						fetchedAt: new Date()
					};
				}
			}
		}

		return null;
	}

	/**
	 * Manually invalidate KV cache
	 * Useful for forcing a fresh fetch or when TradingView updates are detected
	 */
	async invalidateCache(): Promise<void> {
		try {
			await kv.del(CVD_CONFIG_KV_KEY);
		} catch (error) {
		}
	}

	/**
	 * Get cache status (for debugging)
	 */
	async getCacheStatus(): Promise<{ 
		cached: boolean; 
		config?: CVDConfig;
		ttl?: number;
	}> {
		try {
			const cached = await kv.get<CVDConfig>(CVD_CONFIG_KV_KEY);
			const ttl = await kv.ttl(CVD_CONFIG_KV_KEY);
			
			return {
				cached: !!cached,
				config: cached || undefined,
				ttl: ttl > 0 ? ttl : undefined
			};
		} catch (error) {
			return { cached: false };
		}
	}
}

// Export singleton instance
export const cvdConfigService = new CVDConfigService();

/**
 * Convenience function to get CVD config
 * 
 * @param sessionId TradingView session ID
 * @param sessionIdSign Optional session signature
 * @returns CVD configuration
 * 
 * @example
 * ```ts
 * const config = await getCVDConfig('your-session-id');
 * ```
 */
export async function getCVDConfig(sessionId: string, sessionIdSign?: string): Promise<CVDConfig> {
	return cvdConfigService.getConfig(sessionId, sessionIdSign);
}
