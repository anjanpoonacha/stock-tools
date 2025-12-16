// src/lib/mio/apiClient.ts

import {
	SessionError,
	ErrorHandler,
	Platform,
	ErrorLogger
} from '../errors';
import type { SessionKeyValue, Watchlist, AddWatchlistParams } from './types';
import { MIO_URLS as URLS, PATTERNS, LOGIN_INDICATORS } from './types';
import type { FormulaListItem } from '@/types/formula';

/**
 * API Client - Handles HTTP requests, watchlist and formula operations
 */
export class APIClient {
	/**
	 * Regroup TV watchlist symbols (utility function)
	 */
	private static regroupTVWatchlist(symbols: string): string {
		// This should match the regroupTVWatchlist logic from utils if needed
		// For now, just return symbols as-is
		return symbols;
	}

	/**
	 * Fetch MIO watchlists using session credentials and parse HTML.
	 */
	static async getWatchlists(sessionKeyValue: SessionKeyValue): Promise<Watchlist[]> {
		try {
			// Fetch the watchlist page from MIO
			const res = await fetch(URLS.WATCHLIST_PAGE, {
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			if (!res.ok) {
				const error = ErrorHandler.parseError(
					`Failed to fetch watchlist page (status: ${res.status})`,
					Platform.MARKETINOUT,
					'getWatchlists',
					res.status,
					res.url
				);
				ErrorLogger.logError(error);
				throw error;
			}

			const html = await res.text();

			// Check if we got a login page instead of watchlist page (indicates session expired)
			if (LOGIN_INDICATORS.some(indicator => html.includes(indicator))) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'getWatchlists',
					undefined
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Use dynamic import for cheerio to avoid SSR issues
			const cheerio = await import('cheerio');
			const $ = cheerio.load(html);

			// Optimized: Direct element selection and batch processing
			const optionElements = $('#sel_wlid option').get();
			const watchlists: Watchlist[] = [];

			// Process elements in a single pass without jQuery wrapper overhead
			for (let i = 0; i < optionElements.length; i++) {
				const element = optionElements[i];
				const id = (element.attribs?.value || '').trim();
				const name = ($(element).text() || '').trim();

				// Early exit conditions for better performance
				if (id && name && PATTERNS.NUMERIC_ID.test(id)) {
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
				'getWatchlists',
				undefined,
				URLS.WATCHLIST_PAGE
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Add symbols to a watchlist
	 */
	static async addWatchlist({
		sessionKey,
		sessionValue,
		mioWlid,
		symbols,
	}: AddWatchlistParams): Promise<string> {
		const formData = new URLSearchParams({
			mode: 'add',
			wlid: mioWlid,
			overwrite: '0',
			name: '',
			stock_list: APIClient.regroupTVWatchlist(symbols),
		}).toString();

		const res = await fetch(URLS.WATCHLIST_API, {
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
		if (LOGIN_INDICATORS.some(indicator => text.includes(indicator))) {
			throw new Error('Session expired. Please re-authenticate with MIO.');
		}

		return text;
	}

	/**
	 * Create a new watchlist
	 */
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

			const url = `${URLS.MY_WATCHLISTS}?mode=new&name=${encodeURIComponent(name)}&wlid=`;
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
			if (LOGIN_INDICATORS.some(indicator => text.includes(indicator))) {
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
				`${URLS.MY_WATCHLISTS}?mode=new&name=${encodeURIComponent(name)}&wlid=`
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Delete watchlists by IDs
	 */
	static async deleteWatchlists(sessionKey: string, sessionValue: string, todeleteIds: string[]): Promise<string> {
		if (!Array.isArray(todeleteIds) || todeleteIds.length === 0) {
			throw new Error('No watchlist IDs provided for deletion.');
		}
		const params = todeleteIds.map((id) => `todelete=${encodeURIComponent(id)}`).join('&');
		const url = `${URLS.MY_WATCHLISTS}?${params}&mode=delete`;
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
	 * Get list of formulas from MIO stock screener page
	 * Fetches: https://www.marketinout.com/stock-screener/my_stock_screens.php
	 * Parses table to extract formula name, page URL, and screen ID
	 */
	static async getFormulaList(sessionKeyValue: SessionKeyValue): Promise<FormulaListItem[]> {
		try {
			// Fetch the formula list page from MIO
			const res = await fetch(URLS.FORMULA_LIST, {
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			if (!res.ok) {
				const error = ErrorHandler.parseError(
					`Failed to fetch formula list page (status: ${res.status})`,
					Platform.MARKETINOUT,
					'getFormulaList',
					res.status,
					res.url
				);
				ErrorLogger.logError(error);
				throw error;
			}

			const html = await res.text();

			// Check if we got a login page instead (indicates session expired)
			if (LOGIN_INDICATORS.some(indicator => html.includes(indicator))) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'getFormulaList',
					undefined
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Use dynamic import for cheerio to avoid SSR issues
			const cheerio = await import('cheerio');
			const $ = cheerio.load(html);

			// Parse the table containing formulas
			const formulas: FormulaListItem[] = [];


			// Select all table rows with id starting with "screen"
			$('tr[id^="screen"]').each((_, element) => {
				const $row = $(element);
				const rowId = $row.attr('id');

				if (!rowId) return;

				// Extract screen_id from row id (e.g., "screen496310" -> "496310")
				const match = rowId.match(PATTERNS.SCREEN_ID);
				if (!match || !match[1]) return;

				const screenId = match[1];

				// Get formula name from the third column's <a> tag
				const $nameLink = $row.find('td').eq(2).find('a').first();
				const name = $nameLink.text().trim();

				if (!name) return;

				// Construct full page URL (without list=1 - it's for results page, not editor)
				const pageUrl = `${URLS.FORMULA_PAGE_BASE}?f=1&screen_id=${screenId}`;

				// Avoid duplicates (though shouldn't be any with this approach)
				if (!formulas.some(f => f.screenId === screenId)) {
					formulas.push({
						name,
						pageUrl,
						screenId,
					});
				}
			});

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
				'getFormulaList',
				undefined,
				URLS.FORMULA_LIST
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Extract API URL and formula text from a formula page
	 * Navigates to the formula page and looks for "Web API" button/link
	 * Also extracts the formula text for editing
	 * Returns object with apiUrl and formulaText (both can be null if not found)
	 */
	static async extractApiUrlFromFormula(
		sessionKeyValue: SessionKeyValue,
		formulaPageUrl: string
	): Promise<{ apiUrl: string | null; formulaText: string | null }> {
		try {
			// Fetch the formula page
			const res = await fetch(formulaPageUrl, {
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			if (!res.ok) {
				return { apiUrl: null, formulaText: null };
			}

			const html = await res.text();

			// Check for session expiry
			if (LOGIN_INDICATORS.some(indicator => html.includes(indicator))) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'extractApiUrlFromFormula',
					undefined
				);
				ErrorLogger.logError(error);
				throw error;
			}

			// Use cheerio to parse and find the API URL and formula text
			const cheerio = await import('cheerio');
			const $ = cheerio.load(html);


			let apiUrl: string | null = null;
			let formulaText: string | null = null;

			// Extract formula text - try multiple strategies
			// Strategy 1: Look for textarea with name="formula"
			formulaText = $('textarea[name="formula"]').val() as string;

			// Strategy 2: Look for input with name="formula"
			if (!formulaText) {
				formulaText = $('input[name="formula"]').val() as string;
			}

			// Strategy 3: Look for readonly textarea or pre/code blocks
			if (!formulaText) {
				formulaText = $('textarea[readonly]').val() as string;
			}

			// Strategy 4: Look for text following "Formula:" label
			if (!formulaText) {
				$('td, div, span').each((_, el) => {
					const text = $(el).text();
					if (text.includes('Formula:')) {
						// Get next sibling or child content
						const nextText = $(el).next().text().trim();
						if (nextText && nextText.length > 3) {
							formulaText = nextText;
							return false; // Break
						}
					}
				});
			}

			// Strategy 5: Look for formula in section header (on results page)
			// The formula appears after: <font class="section">Screen Name:</font><br>(formula text)
			if (!formulaText) {
				const $sectionFont = $('font.section').filter((_, el) => {
					const text = $(el).text();
					return text.includes(':');
				});

				if ($sectionFont.length > 0) {
					const $parentTd = $sectionFont.parent();
					const htmlContent = $parentTd.html() || '';

					// Extract text after </font><br> and before next tag or end
					// Pattern: </font><br>(formula text here)<optional whitespace/newlines>
					const match = htmlContent.match(/<\/font><br>([^<]+)/);
					if (match && match[1]) {
						formulaText = match[1]
							.replace(/&gt;/g, '>')
							.replace(/&lt;/g, '<')
							.replace(/&amp;/g, '&')
							.replace(/&quot;/g, '"')
							.replace(/&apos;/g, "'")
							.trim();
					}
				}
			}

			// Method 1: Find Web API image button and extract api_key from onclick
			// The Web API button is an <img> tag with onclick="api_info('api_key_here')"
			const webApiButton = $('img[alt="Web API"], img[title="Web API"]').filter('[onclick*="api_info"]');
			if (webApiButton.length > 0) {
				const onclickAttr = webApiButton.attr('onclick');
				if (onclickAttr) {
					// Extract api_key from: api_info('eed4a72303564710');
					const apiKeyMatch = onclickAttr.match(PATTERNS.API_KEY_ONCLICK);
					if (apiKeyMatch && apiKeyMatch[1]) {
						const apiKey = apiKeyMatch[1];
						apiUrl = `${URLS.API_BASE}?key=${apiKey}`;
					}
				}
			}

			// Method 2: Fallback - look for direct links (legacy/alternate format)
			if (!apiUrl) {
				$('a[href*="api.marketinout.com/run/screen"]').each((_, element) => {
					const href = $(element).attr('href');
					if (href && href.includes('key=')) {
						apiUrl = href;
						return false; // Break loop
					}
				});
			}

			// Method 3: Fallback - check onclick handlers with full URL (legacy)
			if (!apiUrl) {
				$('button, input[type="button"], img').each((_, element) => {
					const onclick = $(element).attr('onclick');
					if (onclick && onclick.includes('api.marketinout.com/run/screen')) {
						const urlMatch = onclick.match(PATTERNS.API_URL_ONCLICK);
						if (urlMatch && urlMatch[1]) {
							apiUrl = urlMatch[1];
							return false; // Break loop
						}
					}
				});
			}

			return { apiUrl, formulaText };
		} catch (error) {
			if (error instanceof SessionError) {
				throw error;
			}

			return { apiUrl: null, formulaText: null };
		}
	}
}
