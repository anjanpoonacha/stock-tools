/**
 * CVD Configuration Service
 * 
 * Dynamically fetches CVD (Cumulative Volume Delta) indicator configuration
 * from TradingView to avoid hardcoded encrypted text that becomes stale.
 * 
 * Features:
 * - Two-tier cache: In-memory (1-5ms) + Vercel KV (300-1600ms)
 * - Fetches CVD config from TradingView chart page HTML
 * - In-memory cache checked first (fast, per-instance)
 * - KV cache checked on memory miss (persistent, shared across instances)
 * - Falls back to fetching from TradingView if both caches miss
 * - No hardcoded constants dependency
 * - Type-safe configuration interface
 * 
 * Architecture:
 * 1. Check in-memory cache first (1-5ms) - Tier 1
 * 2. If memory miss, check KV cache (300-1600ms) - Tier 2
 * 3. If KV miss, fetch from TradingView (<2 seconds)
 * 4. Store in both tiers for next time
 * 5. If fetch fails, retry once more
 * 6. If KV unavailable, skip KV caching but still use memory cache
 * 
 * @module cvdConfigService
 */

import { kv } from '@vercel/kv';
import { CVD_PINE_FEATURES } from './cvd-constants';
import { isCVDConfigCacheEnabled } from '@/lib/cache/cacheConfig';
import { debugCvd } from '@/lib/utils/chartDebugLogger';

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
	source: 'memory-cache' | 'kv-cache' | 'fresh-fetch'; // Where the config came from
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
 * In-memory cache entry interface
 */
interface MemoryCacheEntry {
	config: CVDConfig;
	expiresAt: number;
}

/**
 * CVD Config Service
 * Singleton service for managing CVD configuration with two-tier caching
 */
class CVDConfigService {
	private fetchInProgress: Promise<CVDConfig> | null = null;
	
	/**
	 * In-memory cache (Tier 1: Fast, 1-5ms)
	 * Per-instance, clears on server restart
	 */
	private memoryCache: Map<string, MemoryCacheEntry> = new Map();

	/**
	 * Get CVD configuration (with two-tier caching)
	 * 
	 * Flow:
	 * 1. Check in-memory cache (Tier 1: 1-5ms)
	 * 2. If memory miss, check KV cache (Tier 2: 300-1600ms)
	 * 3. If KV miss, fetch from TradingView
	 * 4. Store in both tiers for next time
	 * 5. If KV fails, still use memory cache
	 * 
	 * @param sessionId TradingView session ID
	 * @param sessionIdSign Optional session signature
	 * @returns CVD configuration
	 */
	async getConfig(sessionId: string, sessionIdSign?: string): Promise<CVDConfig> {
		const startTime = Date.now();
		const cacheKey = CVD_CONFIG_KV_KEY;
		
		// If fetch already in progress, wait for it
		if (this.fetchInProgress) {
			return this.fetchInProgress;
		}

		// Tier 1: Check in-memory cache FIRST (1-5ms)
		const memCached = this.memoryCache.get(cacheKey);
		if (memCached && Date.now() < memCached.expiresAt) {
			const duration = Date.now() - startTime;
			debugCvd.configFetched(duration, 'memory-cache');
			debugCvd.configDetails(memCached.config);
			return memCached.config;
		}

		// Tier 2: Check KV cache on memory miss (only if enabled via env var)
		const cacheEnabled = isCVDConfigCacheEnabled();
		
		if (cacheEnabled) {
			try {
				const kvCached = await this.getFromCache();
				if (kvCached) {
					// Store in memory for next time
					this.memoryCache.set(cacheKey, {
						config: kvCached,
						expiresAt: Date.now() + (CACHE_TTL_SECONDS * 1000)
					});
					
					const duration = Date.now() - startTime;
					debugCvd.configFetched(duration, 'kv-cache');
					debugCvd.configDetails(kvCached);
					return kvCached;
				}
			} catch (error) {
				// KV error, continue to fetch
			}
		} else {
			console.log('[CVD Config] Cache DISABLED (default) - fetching fresh config');
		}

		// Both caches miss - fetch fresh config
		this.fetchInProgress = this.fetchAndCacheConfig(sessionId, sessionIdSign, cacheKey);

		try {
			const config = await this.fetchInProgress;
			const duration = Date.now() - startTime;
			debugCvd.configFetched(duration, 'tradingview-api');
			debugCvd.configDetails(config);
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
	 * Fetch config from TradingView and cache it in both tiers
	 */
	private async fetchAndCacheConfig(sessionId: string, sessionIdSign: string | undefined, cacheKey: string): Promise<CVDConfig> {
		const config = await this.fetchConfigFromTradingView(sessionId, sessionIdSign);
		
		// Store in memory cache (Tier 1) - always enabled
		this.memoryCache.set(cacheKey, {
			config,
			expiresAt: Date.now() + (CACHE_TTL_SECONDS * 1000)
		});
		
		// Store in KV cache (Tier 2) - only if enabled
		if (isCVDConfigCacheEnabled()) {
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
	 * Manually invalidate both cache tiers
	 * Useful for forcing a fresh fetch or when TradingView updates are detected
	 */
	async invalidateCache(): Promise<void> {
		// Clear memory cache (Tier 1)
		this.memoryCache.clear();
		
		// Clear KV cache (Tier 2)
		try {
			await kv.del(CVD_CONFIG_KV_KEY);
		} catch (error) {
			// KV error, ignore
		}
	}

	/**
	 * Clean up expired entries from memory cache
	 * Optional maintenance method to prevent memory buildup
	 */
	private cleanupExpiredConfigs(): void {
		const now = Date.now();
		for (const [key, value] of this.memoryCache.entries()) {
			if (now >= value.expiresAt) {
				this.memoryCache.delete(key);
			}
		}
	}

	/**
	 * Get cache status (for debugging)
	 */
	async getCacheStatus(): Promise<{ 
		memory: {
			cached: boolean;
			expiresAt?: number;
		};
		kv: {
			cached: boolean;
			ttl?: number;
		};
		config?: CVDConfig;
	}> {
		// Check memory cache
		const memCached = this.memoryCache.get(CVD_CONFIG_KV_KEY);
		const memoryStatus = {
			cached: !!memCached && Date.now() < memCached.expiresAt,
			expiresAt: memCached?.expiresAt
		};

		// Check KV cache
		let kvStatus = { cached: false, ttl: undefined as number | undefined };
		let config: CVDConfig | undefined;
		
		try {
			const cached = await kv.get<CVDConfig>(CVD_CONFIG_KV_KEY);
			const ttl = await kv.ttl(CVD_CONFIG_KV_KEY);
			
			kvStatus = {
				cached: !!cached,
				ttl: ttl > 0 ? ttl : undefined
			};
			
			config = cached || undefined;
		} catch (error) {
			// KV error, ignore
		}

		return {
			memory: memoryStatus,
			kv: kvStatus,
			config
		};
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
	debugCvd.configStart('N/A', undefined); // Called from context where anchorPeriod/timeframe not available
	return cvdConfigService.getConfig(sessionId, sessionIdSign);
}
