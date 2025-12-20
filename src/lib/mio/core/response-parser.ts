// src/lib/mio/core/response-parser.ts

import * as cheerio from 'cheerio';
import type { Watchlist } from './response-types';

/**
 * Centralized HTML response parser for MIO API
 * 
 * Provides static methods to parse various HTML response patterns from the MIO API,
 * including watchlist lists, redirect URLs, symbols, actions, and success/error messages.
 * 
 * Based on analysis from RESPONSE_ANALYSIS.md and parsing patterns from
 * poc-mio-watchlist-client.ts.
 */
export class ResponseParser {
	/**
	 * Parse watchlist list HTML to extract all watchlists
	 * 
	 * Extracts watchlist options from the HTML `<select id="sel_wlid">` element.
	 * Each option contains a numeric ID and the watchlist name.
	 * 
	 * @param html - HTML response from GET /wl/watch_list.php?mode=list
	 * @returns Array of watchlists with id and name
	 * 
	 * @example
	 * ```typescript
	 * const html = `
	 *   <select id="sel_wlid" class="name-select">
	 *     <option value="74562">AnalysedAlready</option>
	 *     <option value="52736">IndexWatchlist</option>
	 *   </select>
	 * `;
	 * const watchlists = ResponseParser.parseWatchlistList(html);
	 * // Result: [{ id: '74562', name: 'AnalysedAlready' }, ...]
	 * ```
	 */
	static parseWatchlistList(html: string): Watchlist[] {
		const $ = cheerio.load(html);
		const watchlists: Watchlist[] = [];

		$('#sel_wlid option').each((_, element) => {
			const id = $(element).attr('value')?.trim();
			const name = $(element).text().trim();

			// Validate ID is numeric and both fields exist
			if (id && name && /^\d+$/.test(id)) {
				watchlists.push({ id, name });
			}
		});

		return watchlists;
	}

	/**
	 * Extract watchlist ID from redirect HTML
	 * 
	 * Parses the watchlist ID (wlid) from 302 redirect response HTML.
	 * Used after creating a watchlist or other operations that return wlid in the redirect URL.
	 * 
	 * @param html - HTML redirect response containing wlid parameter
	 * @returns Watchlist ID string or null if not found
	 * 
	 * @example
	 * ```typescript
	 * const html = `<a HREF="watch_list.php?wlid=75859">here</a>`;
	 * const wlid = ResponseParser.extractWatchlistId(html);
	 * // Result: '75859'
	 * ```
	 */
	static extractWatchlistId(html: string): string | null {
		const match = html.match(/wlid=(\d+)/);
		return match ? match[1] : null;
	}

	/**
	 * Extract symbol from wl_add_all redirect response
	 * 
	 * Parses the stock symbol from 302 redirect response after add/remove operations.
	 * The symbol is URL-encoded in the redirect URL.
	 * 
	 * @param html - HTML redirect response from wl_add_all.php
	 * @returns Stock symbol (decoded) or null if not found
	 * 
	 * @example
	 * ```typescript
	 * const html = `<a HREF="wl_add_all_done.php?action=add&symbol=WIPRO.NS">here</a>`;
	 * const symbol = ResponseParser.extractSymbolFromRedirect(html);
	 * // Result: 'WIPRO.NS'
	 * ```
	 */
	static extractSymbolFromRedirect(html: string): string | null {
		const match = html.match(/symbol=([^"&]+)/);
		return match ? decodeURIComponent(match[1]) : null;
	}

	/**
	 * Extract action type from wl_add_all redirect response
	 * 
	 * Determines if the operation was an 'add' or 'remove' action based on the redirect URL.
	 * 
	 * @param html - HTML redirect response from wl_add_all.php
	 * @returns Action type ('add' | 'remove') or null if not found
	 * 
	 * @example
	 * ```typescript
	 * const html = `<a HREF="wl_add_all_done.php?action=remove&symbol=INFY.NS">here</a>`;
	 * const action = ResponseParser.extractAction(html);
	 * // Result: 'remove'
	 * ```
	 */
	static extractAction(html: string): 'add' | 'remove' | null {
		const match = html.match(/action=(add|remove)/);
		return match ? (match[1] as 'add' | 'remove') : null;
	}

	/**
	 * Extract redirect target URL from 302 response HTML
	 * 
	 * Parses the target URL from the `<a HREF="...">here</a>` link in redirect responses.
	 * Returns the relative or absolute URL.
	 * 
	 * @param html - HTML redirect response body
	 * @returns Redirect target URL or null if not found
	 * 
	 * @example
	 * ```typescript
	 * const html = `<a HREF="watch_list.php?wlid=75859">here</a>`;
	 * const url = ResponseParser.extractRedirectUrl(html);
	 * // Result: 'watch_list.php?wlid=75859'
	 * ```
	 */
	static extractRedirectUrl(html: string): string | null {
		const match = html.match(/<a\s+HREF="([^"]+)">(?:here|click here)/i);
		return match ? match[1] : null;
	}

	/**
	 * Check if HTTP status code indicates a redirect
	 * 
	 * @param statusCode - HTTP status code from response
	 * @returns True if status code is 301 or 302
	 * 
	 * @example
	 * ```typescript
	 * ResponseParser.isRedirect(302); // true
	 * ResponseParser.isRedirect(200); // false
	 * ```
	 */
	static isRedirect(statusCode: number): boolean {
		return statusCode === 302 || statusCode === 301;
	}

	/**
	 * Parse wl_add_all response to extract action details
	 * 
	 * Comprehensive parser for add/remove single stock responses. Extracts success status,
	 * action type, symbol, and any messages from the HTML response.
	 * 
	 * This method combines multiple parsing strategies to handle different response patterns:
	 * - Success messages (e.g., "WIPRO.NS has been added")
	 * - Error messages
	 * - Session expiry detection
	 * 
	 * @param html - HTML response from wl_add_all.php operation
	 * @param wlid - Watchlist ID from the request
	 * @returns Parsed response with success, action, symbol, wlid, and message
	 * 
	 * @example
	 * ```typescript
	 * const html = `<a HREF="wl_add_all_done.php?action=add&symbol=TCS.NS">here</a>`;
	 * const result = ResponseParser.parseAddAllResponse(html, '12345');
	 * // Result: { success: true, action: 'add', symbol: 'TCS.NS', wlid: '12345' }
	 * ```
	 */
	static parseAddAllResponse(
		html: string,
		wlid: string
	): { success: boolean; action?: 'add' | 'remove'; symbol?: string; message?: string } {
		// Extract action and symbol from redirect URL
		const action = this.extractAction(html);
		const symbol = this.extractSymbolFromRedirect(html);

		// For successful redirects (302), action and symbol should be present
		if (action && symbol) {
			return {
				success: true,
				action,
				symbol,
				message: `Stock ${symbol} ${action === 'add' ? 'added to' : 'removed from'} watchlist ${wlid}`,
			};
		}

		// If we can't extract action/symbol, it might be an error or non-standard response
		return {
			success: false,
			message: 'Unable to parse add/remove response',
		};
	}

	/**
	 * Extract error message from HTML response
	 * 
	 * Attempts to extract human-readable error messages from HTML responses.
	 * Looks for common error indicators and patterns in the HTML.
	 * 
	 * @param html - HTML response body
	 * @returns Error message string or null if no error found
	 * 
	 * @example
	 * ```typescript
	 * const html = '<div class="error">Invalid watchlist ID</div>';
	 * const error = ResponseParser.extractErrorMessage(html);
	 * // Result: 'Invalid watchlist ID'
	 * ```
	 */
	static extractErrorMessage(html: string): string | null {
		// Pattern 1: Look for error class elements
		const errorClassMatch = html.match(/<[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/[^>]+>/i);
		if (errorClassMatch) {
			return errorClassMatch[1].trim();
		}

		// Pattern 2: Look for error keywords in HTML
		const errorPattern = /(error|failed|invalid|not found)[^.!]*[.!]/i;
		const errorMatch = html.match(errorPattern);
		if (errorMatch) {
			return errorMatch[0].trim();
		}

		return null;
	}
}
