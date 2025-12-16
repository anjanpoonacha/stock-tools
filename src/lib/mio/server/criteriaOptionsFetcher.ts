// src/lib/mio/server/criteriaOptionsFetcher.ts
/**
 * SERVER-SIDE ONLY
 * 
 * Fetches criterion options from MarketInOut API
 * Handles server-to-server HTTP requests (no CORS issues)
 * Parses HTML responses using cheerio
 */

import * as cheerio from 'cheerio';
import type { CriterionOption } from '@/types/mioCriteria';

const API_BASE = 'https://www.marketinout.com/stock-screener';

/**
 * Fetch options for a specific criterion from MarketInOut API
 * 
 * Implements retry logic with exponential backoff
 * Parses HTML response to extract structured option data
 * 
 * @param criterionId - The criterion ID to fetch options for (e.g., 'sector', 'industry')
 * @returns Array of criterion options
 * @throws Error if all retry attempts fail
 */
export async function fetchCriterionOptions(
  criterionId: string
): Promise<CriterionOption[]> {
  const url = `${API_BASE}/ajax_get_options.php?crit_id=${criterionId}`;
  
  console.log(`[CriteriaOptionsFetcher] Fetching options for ${criterionId}`);
  
  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept-Charset': 'utf-8',
          'User-Agent': 'MIO-TV-Scripts/1.0',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const options = parseOptionsHTML(html, criterionId);
      
      console.log(`[CriteriaOptionsFetcher] Successfully fetched ${options.length} options for ${criterionId}`);
      
      return options;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[CriteriaOptionsFetcher] Attempt ${attempt}/3 failed for ${criterionId}: ${errorMessage}`);
      
      // If this was the last attempt, throw the error
      if (attempt === 3) {
        throw new Error(`Failed to fetch options for ${criterionId} after 3 attempts: ${errorMessage}`);
      }
      
      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`[CriteriaOptionsFetcher] Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  // Should never reach here due to throw in loop, but TypeScript needs it
  throw new Error(`Failed to fetch options for ${criterionId}`);
}

/**
 * Parse HTML response from MarketInOut API
 * 
 * Handles multiple response patterns:
 * 1. Simple list: <a id="sector_13" name="Energy" local_id="13" on="0">Energy</a>
 * 2. With images: <a ...><img src="...">NYSE</a>
 * 3. In tables: <table><tr><td><a ...>Option</a></td></tr></table>
 * 4. Empty response: (returns empty array)
 * 
 * @param html - Raw HTML response from API
 * @param criterionId - The criterion ID (for logging)
 * @returns Array of parsed criterion options
 */
function parseOptionsHTML(html: string, criterionId: string): CriterionOption[] {
  const $ = cheerio.load(html);
  const options: CriterionOption[] = [];
  
  // Extract all <a> tags with local_id attribute
  $('a[local_id]').each((_, el) => {
    const $link = $(el);
    
    const option: CriterionOption = {
      optionId: $link.attr('id') || '',
      localId: $link.attr('local_id') || '',
      name: $link.attr('name') || '',
      title: $link.attr('title'),
      selected: $link.attr('on') === '1',
    };
    
    // Only add if we have at least an ID and name
    if (option.optionId && option.name) {
      options.push(option);
    }
  });
  
  // Handle empty responses (user-specific criteria like watchlists/portfolios)
  if (options.length === 0) {
    console.log(`[CriteriaOptionsFetcher] No options found for ${criterionId} (may be user-specific or empty)`);
  }
  
  return options;
}

/**
 * Sleep utility for retry delays
 * 
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate criterion ID to prevent injection attacks
 * 
 * @param criterionId - The criterion ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidCriterionId(criterionId: string): boolean {
  // Only allow alphanumeric characters and underscores
  return /^[a-zA-Z0-9_]+$/.test(criterionId);
}
