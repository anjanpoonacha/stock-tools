import { getPlatformSession } from './sessionStore';
import { CookieParser } from './cookieParser';
import {
	SessionError,
	ErrorHandler,
	Platform,
	ErrorLogger
} from './sessionErrors';
import { SessionHealthMonitor } from './sessionHealthMonitor';
import { getHealthAwareSessionData } from './sessionValidation';
import type { FormulaListItem, MIOFormula, FormulaExtractionResult } from '@/types/formula';

// src/lib/MIOService.ts

type AddWatchlistWithSessionParams = {
	internalSessionId: string;
	mioWlid: string;
	symbols: string;
};

export class MIOService {
	/**
	 * Retrieve the ASP session ID for MIO from the session store.
	 */
	/**
	 * Retrieve the session key and value for MIO from the session store.
	 * Uses robust ASPSESSION detection from CookieParser and health-aware session data.
	 */
	static async getSessionKeyValue(internalSessionId: string): Promise<{ key: string; value: string } | undefined> {
		try {
			// Use health-aware session data retrieval
			const healthAwareResult = await getHealthAwareSessionData(internalSessionId);

			if (!healthAwareResult.sessionExists) {
				console.warn(`[MIOService] No valid session found for ID: ${internalSessionId}`, {
					overallStatus: healthAwareResult.overallStatus,
					recommendations: healthAwareResult.recommendations
				});
				return undefined;
			}

			// Get the actual session data from session store
			const session = await getPlatformSession(internalSessionId, 'marketinout');
			if (!session) {
				console.warn(`[MIOService] No MarketInOut session found for ID: ${internalSessionId}`);
				return undefined;
			}

			// Use CookieParser to extract ASPSESSION cookies
			const aspSessions = session.session ? CookieParser.extractASPSESSION(session.session) : {};
			const primaryASPSession = CookieParser.getPrimaryASPSESSION(aspSessions);

			if (primaryASPSession) {
				return primaryASPSession;
			}

			// Fallback to any key that is not 'sessionId'
			const key = Object.keys(session).find((k) => k !== 'sessionId');
			if (key && session[key]) {
				return { key, value: session[key] };
			}

			console.warn(`[MIOService] No valid session cookies found for ID: ${internalSessionId}`);
			return undefined;
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'getSessionKeyValue',
				undefined,
				undefined
			);
			ErrorLogger.logError(sessionError);
			return undefined;
		}
	}

	/**
	 * Extract session cookies from response Set-Cookie headers.
	 * Uses robust cookie parsing with comprehensive ASPSESSION detection.
	 */
	static extractSessionFromResponse(response: Response): { [key: string]: string } | null {
		try {
			const setCookieHeaders = response.headers.get('set-cookie');
			if (!setCookieHeaders) {
				console.debug('[MIOService] No set-cookie headers found in response');
				return null;
			}

			// Use CookieParser for robust parsing
			const parseResult = CookieParser.parseSetCookieHeader(setCookieHeaders);

			if (parseResult.errors.length > 0) {
				console.warn('[MIOService] Cookie parsing errors:', parseResult.errors);
			}

			// Extract all ASPSESSION cookies
			const aspSessionCookies = CookieParser.extractASPSESSION(parseResult.aspSessionCookies);

			if (Object.keys(aspSessionCookies).length > 0) {
				console.log(`[MIOService] Extracted ${Object.keys(aspSessionCookies).length} ASPSESSION cookies:`, Object.keys(aspSessionCookies));
				return aspSessionCookies;
			}

			// Also check for other session-related cookies in the full cookie list
			const allCookies: { [key: string]: string } = {};
			for (const cookie of parseResult.cookies) {
				// Include ASPSESSION and other potentially relevant cookies
				if (CookieParser.isASPSESSIONCookie(cookie.name) ||
					cookie.name.toLowerCase().includes('session') ||
					cookie.name.toLowerCase().includes('auth')) {
					allCookies[cookie.name] = cookie.value;
				}
			}

			const hasSessionData = Object.keys(allCookies).length > 0;
			if (!hasSessionData) {
				console.debug('[MIOService] No session cookies found in response');
			}

			return hasSessionData ? allCookies : null;
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'extractSessionFromResponse',
				undefined,
				response.url
			);
			ErrorLogger.logError(sessionError);
			console.error('[MIOService] Failed to extract session from response:', error);
			return null;
		}
	}

	/**
	 * Validate if a session is still healthy by making a lightweight test request.
	 * Uses the watchlist page as it's a simple authenticated endpoint.
	 */
	static async validateSessionHealth(internalSessionId: string): Promise<boolean> {
		try {
			const sessionKeyValue = await MIOService.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'validateSessionHealth',
					internalSessionId
				);
				ErrorLogger.logError(error);
				return false;
			}

			const res = await fetch('https://www.marketinout.com/wl/watch_list.php?mode=list', {
				method: 'HEAD', // Use HEAD for lightweight check
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			// Check if we get a successful response or redirect (both indicate valid session)
			const isHealthy = res.ok || res.status === 302;

			if (!isHealthy) {
				const error = ErrorHandler.parseError(
					`Session health check failed with status ${res.status}`,
					Platform.MARKETINOUT,
					'validateSessionHealth',
					res.status,
					res.url
				);
				ErrorLogger.logError(error);
			}

			return isHealthy;
		} catch (error) {
			const sessionError = ErrorHandler.createNetworkError(
				Platform.MARKETINOUT,
				'validateSessionHealth',
				error instanceof Error ? error : new Error(String(error)),
				'https://www.marketinout.com/wl/watch_list.php?mode=list'
			);
			ErrorLogger.logError(sessionError);
			console.error('[MIOService] Session health check failed:', error);
			return false;
		}
	}

	/**
	 * Refresh session by making a test request and updating session cookies if they change.
	 * Now uses health-integrated refresh with automatic health monitoring updates.
	 * Returns true if session was refreshed successfully, false if session is invalid.
	 */
	static async refreshSession(internalSessionId: string): Promise<boolean> {
		try {
			console.log(`[MIOService] Refreshing session for ${internalSessionId}`);

			const sessionKeyValue = await MIOService.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				console.warn(`[MIOService] No valid session to refresh for ID: ${internalSessionId}`);
				return false;
			}

			// Directly perform the refresh logic without circular dependency
			const res = await fetch('https://www.marketinout.com/wl/watch_list.php?mode=list', {
				method: 'HEAD',
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			const isRefreshed = res.ok || res.status === 302;
			if (isRefreshed) {
				console.log(`[MIOService] Session refreshed successfully for ID: ${internalSessionId}`);
			} else {
				console.warn(`[MIOService] Session refresh failed for ID: ${internalSessionId} with status: ${res.status}`);
			}

			return isRefreshed;
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'refreshSession',
				undefined,
				undefined
			);
			ErrorLogger.logError(sessionError);
			return false;
		}
	}

	/**
	 * Fetch MIO watchlists using internalSessionId (handles session lookup and HTML parsing).
	 * Removed retry mechanism - fails immediately on session expiration.
	 */
	static async getWatchlistsWithSession(internalSessionId: string): Promise<{ id: string; name: string }[]> {
		try {
			// Validate input parameters
			if (!internalSessionId) {
				const error = ErrorHandler.createGenericError(
					Platform.MARKETINOUT,
					'getWatchlistsWithSession',
					'Missing required parameter: internalSessionId'
				);
				ErrorLogger.logError(error);
				throw error;
			}

			const sessionKeyValue = await MIOService.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'getWatchlistsWithSession',
					internalSessionId
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Fetch the watchlist page from MIO
			const res = await fetch('https://www.marketinout.com/wl/watch_list.php?mode=list', {
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			if (!res.ok) {
				const error = ErrorHandler.parseError(
					`Failed to fetch watchlist page (status: ${res.status})`,
					Platform.MARKETINOUT,
					'getWatchlistsWithSession',
					res.status,
					res.url
				);
				ErrorLogger.logError(error);
				throw error;
			}

			const html = await res.text();

			// Check if we got a login page instead of watchlist page (indicates session expired)
			if (html.includes('login') || html.includes('signin') || html.includes('password')) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'getWatchlistsWithSession',
					internalSessionId
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Use dynamic import for cheerio to avoid SSR issues
			const cheerio = await import('cheerio');
			const $ = cheerio.load(html);

			// Optimized: Direct element selection and batch processing
			const optionElements = $('#sel_wlid option').get();
			const watchlists: { id: string; name: string }[] = [];

			// Pre-compile regex for better performance
			const numericIdRegex = /^\d+$/;

			// Process elements in a single pass without jQuery wrapper overhead
			for (let i = 0; i < optionElements.length; i++) {
				const element = optionElements[i];
				const id = (element.attribs?.value || '').trim();
				const name = ($(element).text() || '').trim();

				// Early exit conditions for better performance
				if (id && name && numericIdRegex.test(id)) {
					watchlists.push({ id, name });
				}
			}

			return watchlists;
		} catch (error) {
			// If it's already a SessionError, re-throw it
			if (error instanceof SessionError) {
				throw error;
			}

			// Otherwise, parse and wrap the error
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'getWatchlistsWithSession',
				undefined,
				'https://www.marketinout.com/wl/watch_list.php?mode=list'
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Add watchlist using internalSessionId (fetches aspSessionId from session store).
	 * Removed retry mechanism - fails immediately on session expiration.
	 */
	static async addWatchlistWithSession({
		internalSessionId,
		mioWlid,
		symbols,
	}: AddWatchlistWithSessionParams): Promise<string> {
		const sessionKeyValue = await MIOService.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) throw new Error('No MIO session found for this user.');

		try {
			const result = await MIOService.addWatchlist({
				sessionKey: sessionKeyValue.key,
				sessionValue: sessionKeyValue.value,
				mioWlid,
				symbols,
			});

			// Update health monitor with successful operation by performing a health check
			const monitor = SessionHealthMonitor.getInstance();
			try {
				await monitor.checkSessionHealth(internalSessionId, 'marketinout');
			} catch (error) {
				console.warn('[MIOService] Failed to update health status after successful operation:', error);
			}

			return result;
		} catch (error) {
			// Health status will be updated automatically during next scheduled check
			// or when validation is called again
			console.warn('[MIOService] Operation failed, health status will be updated on next check');
			throw error;
		}
	}
	static async addWatchlist({
		sessionKey,
		sessionValue,
		mioWlid,
		symbols,
	}: {
		sessionKey: string;
		sessionValue: string;
		mioWlid: string;
		symbols: string;
	}): Promise<string> {
		const regroupTVWatchlist = (symbols: string) => {
			// This should match the regroupTVWatchlist logic from utils if needed
			// For now, just return symbols as-is
			return symbols;
		};

		const formData = new URLSearchParams({
			mode: 'add',
			wlid: mioWlid,
			overwrite: '0',
			name: '',
			stock_list: regroupTVWatchlist(symbols),
		}).toString();

		const res = await fetch('https://www.marketinout.com/wl/watch_list.php', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: `${sessionKey}=${sessionValue}`,
			},
			body: formData,
		});

		const text = await res.text();
		if (!res.ok) {
			throw new Error(`Failed to sync. Status: ${res.status}. Please check your credentials.`);
		}

		// Check if response indicates session expired
		if (text.includes('login') || text.includes('signin') || text.includes('password')) {
			throw new Error('Session expired. Please re-authenticate with MIO.');
		}

		return text;
	}

	static async createWatchlist(sessionKey: string, sessionValue: string, name: string): Promise<string> {
		try {
			// Validate input parameters
			if (!sessionKey || !sessionValue || !name) {
				const error = ErrorHandler.createGenericError(
					Platform.MARKETINOUT,
					'createWatchlist',
					`Missing required parameters: sessionKey=${!!sessionKey}, sessionValue=${!!sessionValue}, name=${name}`
				);
				ErrorLogger.logError(error);
				throw error;
			}

			const url = `https://www.marketinout.com/wl/my_watch_lists.php?mode=new&name=${encodeURIComponent(name)}&wlid=`;
			const res = await fetch(url, {
				method: 'GET',
				headers: {
					Cookie: `${sessionKey}=${sessionValue}`,
				},
			});

			const text = await res.text();
			if (!res.ok) {
				const error = ErrorHandler.parseError(
					`Failed to create watchlist. Status: ${res.status}`,
					Platform.MARKETINOUT,
					'createWatchlist',
					res.status,
					res.url
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Check if response indicates session expired
			if (text.includes('login') || text.includes('signin') || text.includes('password')) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'createWatchlist',
					undefined
				);
				ErrorLogger.logError(error);
				throw error;
			}

			return text;
		} catch (error) {
			// If it's already a SessionError, re-throw it
			if (error instanceof SessionError) {
				throw error;
			}

			// Otherwise, parse and wrap the error
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'createWatchlist',
				undefined,
				`https://www.marketinout.com/wl/my_watch_lists.php?mode=new&name=${encodeURIComponent(name)}&wlid=`
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	static async deleteWatchlists(sessionKey: string, sessionValue: string, todeleteIds: string[]): Promise<string> {
		if (!Array.isArray(todeleteIds) || todeleteIds.length === 0) {
			throw new Error('No watchlist IDs provided for deletion.');
		}
		const params = todeleteIds.map((id) => `todelete=${encodeURIComponent(id)}`).join('&');
		const url = `https://www.marketinout.com/wl/my_watch_lists.php?${params}&mode=delete`;
		console.log('[MIOService][deleteWatchlists] url:', url, 'params:', params, 'ids:', todeleteIds);
		const res = await fetch(url, {
			method: 'GET',
			headers: {
				Cookie: `${sessionKey}=${sessionValue}`,
			},
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error('Failed to delete watchlists.');
		}
		return text;
	}

	/**
	 * Delete watchlists using internalSessionId (fetches aspSessionId from session store).
	 * Removed retry mechanism - fails immediately on session expiration.
	 */
	static async deleteWatchlistsWithSession(internalSessionId: string, deleteIds: string[]): Promise<string> {
		const sessionKeyValue = await MIOService.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) throw new Error('No MIO session found for this user.');

		try {
			return await MIOService.deleteWatchlists(sessionKeyValue.key, sessionKeyValue.value, deleteIds);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get list of formulas from MIO stock screener page
	 * Fetches: https://www.marketinout.com/stock-screener/my_stock_screens.php
	 * Parses table to extract formula name, page URL, and screen ID
	 */
	static async getFormulaListWithSession(internalSessionId: string): Promise<FormulaListItem[]> {
		try {
			// Validate input parameters
			if (!internalSessionId) {
				const error = ErrorHandler.createGenericError(
					Platform.MARKETINOUT,
					'getFormulaListWithSession',
					'Missing required parameter: internalSessionId'
				);
				ErrorLogger.logError(error);
				throw error;
			}

			const sessionKeyValue = await MIOService.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'getFormulaListWithSession',
					internalSessionId
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Fetch the formula list page from MIO
			const res = await fetch('https://www.marketinout.com/stock-screener/my_stock_screens.php', {
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			if (!res.ok) {
				const error = ErrorHandler.parseError(
					`Failed to fetch formula list page (status: ${res.status})`,
					Platform.MARKETINOUT,
					'getFormulaListWithSession',
					res.status,
					res.url
				);
				ErrorLogger.logError(error);
				throw error;
			}

			const html = await res.text();

			// Check if we got a login page instead (indicates session expired)
			if (html.includes('login') || html.includes('signin') || html.includes('password')) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'getFormulaListWithSession',
					internalSessionId
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Use dynamic import for cheerio to avoid SSR issues
			const cheerio = await import('cheerio');
			const $ = cheerio.load(html);

			// Parse the table containing formulas
			const formulas: FormulaListItem[] = [];
			const screenIdRegex = /screen(\d+)/; // Extract number from "screen496310"

			console.log(`[MIOService] Parsing formula list page...`);
			console.log(`[MIOService] Found ${$('tr[id^="screen"]').length} table rows`);

			// Select all table rows with id starting with "screen"
			$('tr[id^="screen"]').each((_, element) => {
				const $row = $(element);
				const rowId = $row.attr('id');

				if (!rowId) return;

				// Extract screen_id from row id (e.g., "screen496310" -> "496310")
				const match = rowId.match(screenIdRegex);
				if (!match || !match[1]) return;

				const screenId = match[1];

				// Get formula name from the third column's <a> tag
				const $nameLink = $row.find('td').eq(2).find('a').first();
				const name = $nameLink.text().trim();

				if (!name) return;

				// Construct full page URL
				const pageUrl = `https://www.marketinout.com/stock-screener/stocks.php?f=1&list=1&screen_id=${screenId}`;

				// Avoid duplicates (though shouldn't be any with this approach)
				if (!formulas.some(f => f.screenId === screenId)) {
					formulas.push({
						name,
						pageUrl,
						screenId,
					});
				}
			});

			console.log(`[MIOService] Successfully extracted ${formulas.length} formulas`);
			return formulas;
		} catch (error) {
			// If it's already a SessionError, re-throw it
			if (error instanceof SessionError) {
				throw error;
			}

			// Otherwise, parse and wrap the error
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'getFormulaListWithSession',
				undefined,
				'https://www.marketinout.com/stock-screener/my_stock_screens.php'
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Extract API URL from a formula page
	 * Navigates to the formula page and looks for "Web API" button/link
	 * Returns the API URL or null if not found
	 */
	static async extractApiUrlFromFormula(
		internalSessionId: string,
		formulaPageUrl: string
	): Promise<string | null> {
		try {
			const sessionKeyValue = await MIOService.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'extractApiUrlFromFormula',
					internalSessionId
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Fetch the formula page
			const res = await fetch(formulaPageUrl, {
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			if (!res.ok) {
				console.warn(`[MIOService] Failed to fetch formula page: ${formulaPageUrl} (status: ${res.status})`);
				return null;
			}

			const html = await res.text();

			// Check for session expiry
			if (html.includes('login') || html.includes('signin') || html.includes('password')) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'extractApiUrlFromFormula',
					internalSessionId
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Use cheerio to parse and find the API URL
			const cheerio = await import('cheerio');
			const $ = cheerio.load(html);

			let apiUrl: string | null = null;

			// Method 1: Find Web API image button and extract api_key from onclick
			// The Web API button is an <img> tag with onclick="api_info('api_key_here')"
			const webApiButton = $('img[alt="Web API"], img[title="Web API"]').filter('[onclick*="api_info"]');
			if (webApiButton.length > 0) {
				const onclickAttr = webApiButton.attr('onclick');
				if (onclickAttr) {
					// Extract api_key from: api_info('eed4a72303564710');
					const apiKeyMatch = onclickAttr.match(/api_info\(['"]([^'"]+)['"]\)/);
					if (apiKeyMatch && apiKeyMatch[1]) {
						const apiKey = apiKeyMatch[1];
						apiUrl = `https://api.marketinout.com/run/screen?key=${apiKey}`;
						console.log(`[MIOService] Found API URL via Web API button: ${apiUrl}`);
						return apiUrl;
					}
				}
			}

			// Method 2: Fallback - look for direct links (legacy/alternate format)
			$('a[href*="api.marketinout.com/run/screen"]').each((_, element) => {
				const href = $(element).attr('href');
				if (href && href.includes('key=')) {
					apiUrl = href;
					console.log(`[MIOService] Found API URL via direct link: ${apiUrl}`);
					return false; // Break loop
				}
			});

			// Method 3: Fallback - check onclick handlers with full URL (legacy)
			if (!apiUrl) {
				$('button, input[type="button"], img').each((_, element) => {
					const onclick = $(element).attr('onclick');
					if (onclick && onclick.includes('api.marketinout.com/run/screen')) {
						const urlMatch = onclick.match(/(https?:\/\/api\.marketinout\.com\/run\/screen\?key=[^'"&\s]+)/);
						if (urlMatch && urlMatch[1]) {
							apiUrl = urlMatch[1];
							console.log(`[MIOService] Found API URL via onclick handler: ${apiUrl}`);
							return false; // Break loop
						}
					}
				});
			}

			if (!apiUrl) {
				console.warn(`[MIOService] No API URL found for ${formulaPageUrl}`);
			}

			return apiUrl;
		} catch (error) {
			if (error instanceof SessionError) {
				throw error;
			}

			console.error(`[MIOService] Error extracting API URL from ${formulaPageUrl}:`, error);
			return null;
		}
	}

	/**
	 * Extract all formulas with their API URLs
	 * Orchestrates the full extraction workflow:
	 * 1. Get formula list
	 * 2. For each formula, extract API URL
	 * 3. Build complete MIOFormula objects
	 */
	static async extractAllFormulasWithSession(internalSessionId: string): Promise<FormulaExtractionResult> {
		try {
			// Step 1: Get the formula list
			const formulaList = await MIOService.getFormulaListWithSession(internalSessionId);

			if (formulaList.length === 0) {
				return {
					success: true,
					formulas: [],
					totalExtracted: 0,
					errors: [],
				};
			}

			// Step 2: Extract API URLs for each formula
			const extractionPromises = formulaList.map(async (formulaItem, index) => {
				// Add rate limiting delay (100ms between requests)
				if (index > 0) {
					await new Promise(resolve => setTimeout(resolve, 100));
				}

				try {
					const apiUrl = await MIOService.extractApiUrlFromFormula(
						internalSessionId,
						formulaItem.pageUrl
					);

					const now = new Date().toISOString();
					const formula: MIOFormula = {
						id: `formula_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						name: formulaItem.name,
						pageUrl: formulaItem.pageUrl,
						apiUrl,
						screenId: formulaItem.screenId,
						createdAt: now,
						updatedAt: now,
						extractionStatus: apiUrl ? 'success' : 'failed',
						extractionError: apiUrl ? undefined : 'API URL not found on formula page',
					};

					return { success: true, formula };
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					const now = new Date().toISOString();
					const formula: MIOFormula = {
						id: `formula_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						name: formulaItem.name,
						pageUrl: formulaItem.pageUrl,
						apiUrl: null,
						screenId: formulaItem.screenId,
						createdAt: now,
						updatedAt: now,
						extractionStatus: 'failed',
						extractionError: errorMessage,
					};

					return {
						success: false,
						formula,
						error: { formulaName: formulaItem.name, error: errorMessage },
					};
				}
			});

			// Wait for all extractions to complete
			const results = await Promise.allSettled(extractionPromises);

			// Process results
			const formulas: MIOFormula[] = [];
			const errors: Array<{ formulaName: string; error: string }> = [];
			let successCount = 0;

			results.forEach(result => {
				if (result.status === 'fulfilled') {
					formulas.push(result.value.formula);
					if (result.value.success) {
						successCount++;
					}
					if (result.value.error) {
						errors.push(result.value.error);
					}
				} else {
					// Promise rejected
					errors.push({
						formulaName: 'Unknown',
						error: result.reason?.message || 'Extraction failed',
					});
				}
			});

			return {
				success: errors.length === 0,
				formulas,
				totalExtracted: successCount,
				errors,
			};
		} catch (error) {
			// If it's a SessionError, re-throw it
			if (error instanceof SessionError) {
				throw error;
			}

			// Otherwise, return error result
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			ErrorLogger.logError(
				ErrorHandler.parseError(error, Platform.MARKETINOUT, 'extractAllFormulasWithSession')
			);

			return {
				success: false,
				formulas: [],
				totalExtracted: 0,
				errors: [{ formulaName: 'All formulas', error: errorMessage }],
			};
		}
	}
}
