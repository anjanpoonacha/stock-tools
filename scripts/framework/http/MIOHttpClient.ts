/**
 * MarketInOut HTTP Client
 * 
 * Handles MarketInOut-specific HTTP requests with:
 * - Session cookie authentication
 * - HTML response parsing
 * - Login page detection
 * - Success/error message extraction
 */

import { BaseHttpClient } from './BaseHttpClient.js';
import type { RequestOptions } from './types.js';

// Pattern matching constants
const LOGIN_INDICATORS = ['login', 'signin', 'password'] as const;

const PATTERNS = {
  SUCCESS_MESSAGE: /(has been added|has been removed|successfully|created)/i,
  ERROR_MESSAGE: /(error|failed|invalid)/i,
  REDIRECT_URL: /<a\s+HREF="([^"]+)">(?:here|click here)/i,
  WATCHLIST_ID_EXTRACT: /wlid=(\d+)/,
} as const;

export class MIOHttpClient extends BaseHttpClient {
  constructor(
    private sessionKey: string,
    private sessionValue: string
  ) {
    super();
  }

  /**
   * Build headers with MIO session cookie
   */
  protected buildHeaders(options: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Cookie: `${this.sessionKey}=${this.sessionValue}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ...options.headers,
    };

    // Add content-type for POST with URLSearchParams
    if (options.method === 'POST' && options.body instanceof URLSearchParams) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    return headers;
  }

  /**
   * Check if HTML response indicates a login page (session expired)
   */
  isLoginPage(html: string): boolean {
    const lowerHtml = html.toLowerCase();
    return LOGIN_INDICATORS.some((indicator) => lowerHtml.includes(indicator.toLowerCase()));
  }

  /**
   * Extract success message from HTML response
   */
  extractSuccessMessage(html: string): string | null {
    // Pattern 1: "X has been added to the watch list!"
    const match1 = html.match(/([A-Z0-9.]+)\s+has been (added|removed)/i);
    if (match1) {
      return match1[0];
    }

    // Pattern 2: Look for success indicators
    if (PATTERNS.SUCCESS_MESSAGE.test(html)) {
      // Extract the sentence containing success
      const sentences = html.split(/[.!]/);
      const successSentence = sentences.find((s) => PATTERNS.SUCCESS_MESSAGE.test(s));
      return successSentence?.trim() || null;
    }

    return null;
  }

  /**
   * Extract error message from HTML response
   */
  extractErrorMessage(html: string): string | null {
    // Look for error indicators
    if (PATTERNS.ERROR_MESSAGE.test(html)) {
      const sentences = html.split(/[.!]/);
      const errorSentence = sentences.find((s) => PATTERNS.ERROR_MESSAGE.test(s));
      return errorSentence?.trim() || null;
    }
    return null;
  }

  /**
   * Extract redirect URL from HTML (302 responses)
   */
  extractRedirectUrl(html: string): string | null {
    // Pattern: <a HREF="watch_list.php?wlid=74577">here</a>
    const match = html.match(PATTERNS.REDIRECT_URL);
    if (match && match[1]) {
      return match[1].startsWith('http')
        ? match[1]
        : `https://www.marketinout.com${match[1]}`;
    }
    return null;
  }

  /**
   * Extract watchlist ID from HTML/URL text
   */
  extractWatchlistId(text: string): string | null {
    const match = text.match(PATTERNS.WATCHLIST_ID_EXTRACT);
    return match ? match[1] : null;
  }
}
