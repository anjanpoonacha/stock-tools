// src/lib/mio/core/response-validator.ts

import type { ValidationResult } from './response-types';

/**
 * Login page indicators
 * 
 * Keywords that indicate the response is a login page (session expired)
 */
const LOGIN_INDICATORS = ['login', 'signin', 'password', 'Sign In'] as const;

/**
 * Centralized response validator for MIO API
 * 
 * Provides static methods to validate HTML responses from the MIO API,
 * including session expiry detection, redirect validation, and response structure checks.
 * 
 * Based on validation strategies from RESPONSE_ANALYSIS.md.
 */
export class ResponseValidator {
	/**
	 * Check if HTML response indicates a login page (session expired)
	 * 
	 * Scans the HTML for common login page indicators such as "login", "signin", "password".
	 * This is critical for detecting session expiry across all MIO API endpoints.
	 * 
	 * @param html - HTML response body to check
	 * @returns True if response appears to be a login page
	 * 
	 * @example
	 * ```typescript
	 * const html = '<form action="login.php">Username: <input name="username">...</form>';
	 * const expired = ResponseValidator.isSessionExpired(html);
	 * // Result: true
	 * ```
	 */
	static isSessionExpired(html: string): boolean {
		const lowerHtml = html.toLowerCase();
		return LOGIN_INDICATORS.some((indicator) =>
			lowerHtml.includes(indicator.toLowerCase())
		);
	}

	/**
	 * Check if a URL is a login page URL
	 * 
	 * Checks if a redirect URL points to a login page, which indicates session expiry.
	 * Common login URL patterns include 'login', 'signin', 'auth'.
	 * 
	 * @param url - URL to check
	 * @returns True if URL appears to be a login page
	 * 
	 * @example
	 * ```typescript
	 * const url = 'https://www.marketinout.com/login.php';
	 * const isLogin = ResponseValidator.isLoginUrl(url);
	 * // Result: true
	 * ```
	 */
	static isLoginUrl(url: string): boolean {
		const lowerUrl = url.toLowerCase();
		return (
			lowerUrl.includes('login') ||
			lowerUrl.includes('signin') ||
			lowerUrl.includes('auth')
		);
	}

	/**
	 * Check if response is a successful redirect
	 * 
	 * MIO API uses 302 redirects to indicate successful operations.
	 * This method validates both the status code and the presence of the standard
	 * redirect HTML structure.
	 * 
	 * @param statusCode - HTTP status code from response
	 * @param html - HTML response body
	 * @returns True if response is a valid success redirect
	 * 
	 * @example
	 * ```typescript
	 * const html = '<body><h1>Object Moved</h1><a HREF="watch_list.php?wlid=123">here</a></body>';
	 * const isSuccess = ResponseValidator.isSuccessRedirect(302, html);
	 * // Result: true
	 * ```
	 */
	static isSuccessRedirect(statusCode: number, html: string): boolean {
		// Check for 301 or 302 status
		const isRedirectStatus = statusCode === 302 || statusCode === 301;

		// Check for "Object moved" or redirect link pattern
		const hasRedirectMarkers =
			html.includes('Object moved') || html.includes('Object Moved') || /<a\s+HREF="[^"]+">(?:here|click here)/i.test(html);

		return isRedirectStatus && hasRedirectMarkers;
	}

	/**
	 * Validate watchlist list response structure
	 * 
	 * Checks if the HTML response from the watchlist list endpoint contains
	 * the expected structure (watchlist selector element). Also detects session expiry.
	 * 
	 * This is used to validate GET /wl/watch_list.php?mode=list responses.
	 * 
	 * @param html - HTML response from watchlist list endpoint
	 * @returns Validation result with error details if invalid
	 * 
	 * @example
	 * ```typescript
	 * const html = '<select id="sel_wlid"><option value="123">MyWatchlist</option></select>';
	 * const result = ResponseValidator.validateWatchlistResponse(html);
	 * // Result: { valid: true }
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * const loginHtml = '<form action="login.php">...</form>';
	 * const result = ResponseValidator.validateWatchlistResponse(loginHtml);
	 * // Result: { valid: false, error: 'Session expired', needsRefresh: true }
	 * ```
	 */
	static validateWatchlistResponse(html: string): ValidationResult {
		// Check for session expiry first (highest priority)
		if (this.isSessionExpired(html)) {
			return {
				valid: false,
				error: 'Session expired - please refresh your session',
				needsRefresh: true,
			};
		}

		// Check for expected watchlist selector element
		if (!html.includes('sel_wlid')) {
			return {
				valid: false,
				error: 'Missing watchlist selector element (sel_wlid)',
			};
		}

		// Validation passed
		return { valid: true };
	}

	/**
	 * Validate create watchlist response
	 * 
	 * Checks if the response from creating a watchlist is valid by verifying
	 * it's a redirect and contains a watchlist ID.
	 * 
	 * @param statusCode - HTTP status code from response
	 * @param html - HTML response body
	 * @returns Validation result with error details if invalid
	 * 
	 * @example
	 * ```typescript
	 * const html = '<a HREF="watch_list.php?wlid=75859">here</a>';
	 * const result = ResponseValidator.validateCreateWatchlistResponse(302, html);
	 * // Result: { valid: true }
	 * ```
	 */
	static validateCreateWatchlistResponse(
		statusCode: number,
		html: string
	): ValidationResult {
		// Check for session expiry
		if (this.isSessionExpired(html)) {
			return {
				valid: false,
				error: 'Session expired - please refresh your session',
				needsRefresh: true,
			};
		}

		// Check for successful redirect
		if (!this.isSuccessRedirect(statusCode, html)) {
			return {
				valid: false,
				error: 'Expected redirect response (302) with watchlist ID',
			};
		}

		// Check for wlid in response
		if (!/wlid=\d+/.test(html)) {
			return {
				valid: false,
				error: 'Watchlist ID not found in redirect URL',
			};
		}

		return { valid: true };
	}

	/**
	 * Validate add/remove stock response
	 * 
	 * Checks if the response from add/remove operations is valid by verifying
	 * the redirect contains the expected action and symbol parameters.
	 * 
	 * @param statusCode - HTTP status code from response
	 * @param html - HTML response body
	 * @returns Validation result with error details if invalid
	 * 
	 * @example
	 * ```typescript
	 * const html = '<a HREF="wl_add_all_done.php?action=add&symbol=TCS.NS">here</a>';
	 * const result = ResponseValidator.validateAddRemoveResponse(302, html);
	 * // Result: { valid: true }
	 * ```
	 */
	static validateAddRemoveResponse(
		statusCode: number,
		html: string
	): ValidationResult {
		// Check for session expiry
		if (this.isSessionExpired(html)) {
			return {
				valid: false,
				error: 'Session expired - please refresh your session',
				needsRefresh: true,
			};
		}

		// Check for successful redirect
		if (!this.isSuccessRedirect(statusCode, html)) {
			return {
				valid: false,
				error: 'Expected redirect response (302)',
			};
		}

		// Check for required parameters in redirect URL
		const hasAction = /action=(add|remove)/.test(html);
		const hasSymbol = /symbol=([^"&]+)/.test(html);

		if (!hasAction || !hasSymbol) {
			return {
				valid: false,
				error: 'Missing action or symbol in redirect URL',
			};
		}

		return { valid: true };
	}

	/**
	 * Validate delete watchlist response
	 * 
	 * Checks if the response from deleting a watchlist is valid by verifying
	 * it's a redirect to the watchlist management page.
	 * 
	 * @param statusCode - HTTP status code from response
	 * @param html - HTML response body
	 * @returns Validation result with error details if invalid
	 * 
	 * @example
	 * ```typescript
	 * const html = '<a HREF="my_watch_lists.php">here</a>';
	 * const result = ResponseValidator.validateDeleteResponse(302, html);
	 * // Result: { valid: true }
	 * ```
	 */
	static validateDeleteResponse(
		statusCode: number,
		html: string
	): ValidationResult {
		// Check for session expiry
		if (this.isSessionExpired(html)) {
			return {
				valid: false,
				error: 'Session expired - please refresh your session',
				needsRefresh: true,
			};
		}

		// Check for successful redirect
		if (!this.isSuccessRedirect(statusCode, html)) {
			return {
				valid: false,
				error: 'Expected redirect response (302)',
			};
		}

		// Check for redirect to watchlist management page
		if (!html.includes('my_watch_lists.php')) {
			return {
				valid: false,
				error: 'Expected redirect to my_watch_lists.php',
			};
		}

		return { valid: true };
	}
}
