/**
 * Centralized HTTP Client for MIO API
 * 
 * Provides a unified interface for making authenticated requests to the MIO API
 * with automatic:
 * - Cookie handling from SessionKeyValue
 * - Redirect detection and handling (302/301)
 * - Session expiry detection via ResponseValidator
 * - Response type detection (HTML/redirect/JSON)
 * - Error extraction via ResponseParser
 * - Typed response structure via MIOResponse<T>
 * 
 * Based on POC analysis from:
 * - scripts/poc-mio/RESPONSE_ANALYSIS.md
 * - scripts/poc-mio/poc-mio-watchlist-client.ts
 * 
 * @see RESPONSE_ANALYSIS.md for API response patterns
 */

import type { SessionKeyValue } from '../types';
import type { MIOResponse, ErrorCode } from './response-types';
import { ResponseValidator } from './response-validator';
import { ResponseParser } from './response-parser';

/**
 * Request options for MIO API calls
 */
export type MIORequestOptions = {
	/** HTTP method (GET or POST) */
	method: 'GET' | 'POST';
	/** Session credentials for authentication */
	sessionKeyValue: SessionKeyValue;
	/** Request body (URLSearchParams for POST) */
	body?: URLSearchParams;
	/** Additional headers to include */
	headers?: Record<string, string>;
};

/**
 * Centralized HTTP client for MIO API
 * 
 * Handles all HTTP communication with the MIO API including:
 * - Authentication via session cookies
 * - Response parsing and validation
 * - Error handling and session expiry detection
 * - Type-safe responses
 */
export class MIOHttpClient {
	/**
	 * Make an authenticated request to the MIO API
	 * 
	 * Flow:
	 * 1. Build request headers with session cookie
	 * 2. Execute fetch with redirect: 'manual' to capture 302s
	 * 3. Delegate response handling to handleResponse()
	 * 4. Return typed MIOResponse<T>
	 * 
	 * @param url - Full URL to request
	 * @param options - Request configuration (method, session, body, headers)
	 * @param parser - Optional function to parse response HTML into typed data
	 * @returns Promise<MIOResponse<T>> with success/error and metadata
	 * 
	 * @example
	 * ```ts
	 * // GET request with custom parser
	 * const response = await MIOHttpClient.request<Watchlist[]>(
	 *   'https://www.marketinout.com/wl/watch_list.php?mode=list',
	 *   { method: 'GET', sessionKeyValue: session },
	 *   (html) => ResponseParser.parseWatchlistList(html)
	 * );
	 * 
	 * if (response.success) {
	 *   console.log('Watchlists:', response.data);
	 * } else {
	 *   if (response.error?.needsRefresh) {
	 *     // Handle session expiry
	 *   }
	 * }
	 * ```
	 * 
	 * @example
	 * ```ts
	 * // POST request with form data
	 * const formData = new URLSearchParams({
	 *   mode: 'add',
	 *   wlid: '12345',
	 *   stock_list: 'TCS.NS,INFY.NS'
	 * });
	 * 
	 * const response = await MIOHttpClient.request(
	 *   'https://www.marketinout.com/wl/watch_list.php',
	 *   {
	 *     method: 'POST',
	 *     sessionKeyValue: session,
	 *     body: formData
	 *   }
	 * );
	 * ```
	 */
	static async request<T>(
		url: string,
		options: MIORequestOptions,
		parser?: (html: string) => T
	): Promise<MIOResponse<T>> {
		const { method, sessionKeyValue, body, headers = {} } = options;

		try {
			// Build request headers with session authentication
			const requestHeaders: Record<string, string> = {
				// Add session cookie for authentication
				Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				// Add user agent to mimic browser behavior
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				// Merge in any additional headers
				...headers,
			};

			// Add content-type header for POST requests
			if (method === 'POST' && body) {
				requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
			}

			// Execute the HTTP request
			const response = await fetch(url, {
				method,
				headers: requestHeaders,
				body: body?.toString(),
				// CRITICAL: Handle redirects manually to capture 302 responses
				// MIO API uses 302 redirects as success indicators for state-changing operations
				redirect: 'manual',
			});

			// Delegate response handling to private method
			return await this.handleResponse(response, url, parser);
		} catch (error) {
			// Network-level errors (timeout, no internet, DNS failure)
			return {
				success: false,
				error: {
					code: 'NETWORK_ERROR' as ErrorCode,
					message: error instanceof Error ? error.message : String(error),
				},
				meta: {
					statusCode: 0,
					responseType: 'text',
					url,
				},
			};
		}
	}

	/**
	 * Handle HTTP response and convert to typed MIOResponse<T>
	 * 
	 * Response handling flow:
	 * 1. Check for redirects (302/301) → Success indicator for MIO API
	 * 2. Check for HTTP errors (4xx/5xx) → Extract error message
	 * 3. Check for session expiry → Detect login page indicators
	 * 4. Parse response with optional parser → Convert HTML to typed data
	 * 5. Return typed MIOResponse<T> with metadata
	 * 
	 * @param response - Fetch Response object
	 * @param url - Original request URL (for metadata)
	 * @param parser - Optional function to parse HTML response
	 * @returns Promise<MIOResponse<T>> with parsed data or error
	 * 
	 * @private
	 */
	private static async handleResponse<T>(
		response: Response,
		url: string,
		parser?: (html: string) => T
	): Promise<MIOResponse<T>> {
		const statusCode = response.status;
		const html = await response.text();

		// ========================================================================
		// CASE 1: Handle redirects (302/301)
		// ========================================================================
		// MIO API uses 302 redirects as success indicators for:
		// - Create watchlist (redirects to watch_list.php?wlid=XXX)
		// - Add stocks (redirects to watch_list.php?wlid=XXX)
		// - Delete watchlist (redirects to my_watch_lists.php)
		// - Add/remove single stock (redirects to wl_add_all_done.php)
		//
		// We accept 302 as success WITHOUT following the redirect for performance
		// The redirect URL is available in Location header or HTML body
		if (statusCode === 302 || statusCode === 301) {
			const location = response.headers.get('location');
			const redirectUrl = location || ResponseParser.extractRedirectUrl(html);

			// Check if redirect target is login page (session expired)
			if (redirectUrl && ResponseValidator.isLoginUrl(redirectUrl)) {
				return {
					success: false,
					error: {
						code: 'SESSION_EXPIRED' as ErrorCode,
						message: 'Session expired - redirected to login page',
						needsRefresh: true,
					},
					meta: {
						statusCode,
						responseType: 'redirect',
						url,
						redirectUrl,
					},
				};
			}

			// Parse the redirect HTML if parser provided
			const data = parser ? parser(html) : (html as unknown as T);

			return {
				success: true,
				data,
				meta: {
					statusCode,
					responseType: 'redirect',
					url,
					redirectUrl: redirectUrl || undefined,
				},
			};
		}

		// ========================================================================
		// CASE 2: Handle HTTP errors (4xx/5xx)
		// ========================================================================
		if (!response.ok) {
			const errorMsg =
				ResponseParser.extractErrorMessage(html) ||
				`HTTP ${statusCode}: ${response.statusText}`;

			return {
				success: false,
				error: {
					code: `HTTP_${statusCode}` as ErrorCode,
					message: errorMsg,
					needsRefresh: statusCode === 401 || statusCode === 403,
				},
				meta: {
					statusCode,
					responseType: 'html',
					url,
				},
			};
		}

		// ========================================================================
		// CASE 3: Check for session expiry in HTML content
		// ========================================================================
		// Even with HTTP 200, the response might be a login page
		// Check for login indicators: 'login', 'signin', 'password'
		if (ResponseValidator.isSessionExpired(html)) {
			return {
				success: false,
				error: {
					code: 'SESSION_EXPIRED' as ErrorCode,
					message: 'Session expired - please refresh your session',
					needsRefresh: true,
				},
				meta: {
					statusCode,
					responseType: 'html',
					url,
				},
			};
		}

		// ========================================================================
		// CASE 4: Successful response - parse HTML if parser provided
		// ========================================================================
		if (parser) {
			try {
				const data = parser(html);
				return {
					success: true,
					data,
					meta: {
						statusCode,
						responseType: 'html',
						url,
					},
				};
			} catch (parseError) {
				// Parser threw an error - invalid HTML structure or parsing logic error
				return {
					success: false,
					error: {
						code: 'PARSE_ERROR' as ErrorCode,
						message:
							parseError instanceof Error
								? parseError.message
								: 'Failed to parse response',
					},
					meta: {
						statusCode,
						responseType: 'html',
						url,
					},
				};
			}
		}

		// ========================================================================
		// CASE 5: No parser provided - return raw HTML
		// ========================================================================
		return {
			success: true,
			data: html as unknown as T,
			meta: {
				statusCode,
				responseType: 'html',
				url,
			},
		};
	}
}
