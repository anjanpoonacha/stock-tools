// src/lib/mio/criteriaOptionsClient.ts
/**
 * CLIENT-SIDE API client for fetching MarketInOut enum options
 * 
 * This is a simplified client that calls our Next.js API route,
 * which handles server-side caching (KV) and external API calls.
 * 
 * Caching Strategy:
 * - Memory cache (client-side, session-scoped, instant)
 * - KV cache (server-side, 24h TTL, handled by API route)
 * - External API (server-side, handled by API route)
 */

import type { CriterionOption } from '@/types/mioCriteria';

/**
 * API response structure from our endpoint
 */
interface CriteriaOptionsAPIResponse {
  success: boolean;
  criterionId?: string;
  options?: CriterionOption[];
  cached?: boolean;
  timestamp?: string;
  error?: string;
}

/**
 * Client for fetching criterion options via our API route
 * 
 * Simple implementation:
 * - Memory cache for instant lookups within the same session
 * - Calls /api/mio-criteria/options for data (which handles KV + external API)
 * - No CORS issues (same-origin requests)
 * - No KV dependencies (handled server-side)
 */
export class CriteriaOptionsClient {
  private memoryCache = new Map<string, CriterionOption[]>();

  /**
   * Get options for a criterion
   * 
   * Checks memory cache first, then calls our API route
   * The API route handles KV caching and external API calls
   * 
   * @param criterionId - The criterion ID (e.g., "sector", "industry")
   * @returns Array of options, empty array if criterion has no options
   * @throws Error if API call fails
   */
  async getOptions(criterionId: string): Promise<CriterionOption[]> {
    // Check memory cache first
    const memoryCached = this.memoryCache.get(criterionId);
    if (memoryCached) {
      console.log(`[CriteriaOptionsClient] Memory cache hit for ${criterionId}`);
      return memoryCached;
    }

    console.log(`[CriteriaOptionsClient] Memory cache miss for ${criterionId}, calling API...`);
    
    // Fetch from our API route
    const url = `/api/mio-criteria/options?criterionId=${encodeURIComponent(criterionId)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data: CriteriaOptionsAPIResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch options');
    }
    
    const options = data.options || [];
    
    // Update memory cache
    this.memoryCache.set(criterionId, options);
    
    console.log(
      `[CriteriaOptionsClient] Fetched ${options.length} options for ${criterionId} ` +
      `(cached: ${data.cached})`
    );
    
    return options;
  }

  /**
   * Force refresh options, bypassing memory cache
   * (Server-side KV cache is still checked by the API route)
   * 
   * @param criterionId - The criterion ID to refresh
   * @returns Array of options from API
   */
  async refreshOptions(criterionId: string): Promise<CriterionOption[]> {
    // Clear memory cache for this criterion
    this.memoryCache.delete(criterionId);
    
    console.log(`[CriteriaOptionsClient] Refreshing ${criterionId} (bypassing memory cache)`);
    
    // Fetch fresh data (API route will check its caches)
    return await this.getOptions(criterionId);
  }

  /**
   * Clear memory cache only
   * (Does not affect server-side KV cache)
   */
  clearCache(): void {
    this.memoryCache.clear();
    console.log('[CriteriaOptionsClient] Cleared memory cache');
  }

  /**
   * Get memory cache statistics
   */
  getCacheStats(): {
    memoryCacheSize: number;
    memoryCachedCriteria: string[];
  } {
    return {
      memoryCacheSize: this.memoryCache.size,
      memoryCachedCriteria: Array.from(this.memoryCache.keys()),
    };
  }

  /**
   * Batch fetch multiple criteria options
   * 
   * @param criterionIds - Array of criterion IDs to fetch
   * @returns Map of criterion ID to options
   */
  async batchGetOptions(criterionIds: string[]): Promise<Map<string, CriterionOption[]>> {
    const results = new Map<string, CriterionOption[]>();
    
    console.log(`[CriteriaOptionsClient] Batch fetching ${criterionIds.length} criteria`);
    
    // Fetch all in parallel (API route handles rate limiting)
    const promises = criterionIds.map(async (criterionId) => {
      try {
        const options = await this.getOptions(criterionId);
        results.set(criterionId, options);
      } catch (error) {
        console.error(`[CriteriaOptionsClient] Error fetching ${criterionId} in batch:`, error);
        // Store empty array for failed fetches
        results.set(criterionId, []);
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }
}
