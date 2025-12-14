// src/lib/mio/formulaClient.ts

import { SessionKeyValue, MIO_URLS } from './types';
import { ErrorHandler, Platform, ErrorLogger } from '../errors';

export const FORMULA_SCREENER_URL = 'https://www.marketinout.com/stock-screener/formula_screener.php';

interface CreateFormulaParams {
	sessionKeyValue: SessionKeyValue;
	name: string;
	formula: string;
	categoryId?: string;
	groupId?: string;
	eventId?: string;
}

interface EditFormulaParams extends CreateFormulaParams {
	screenId: string;
}

export interface FormulaCreateEditResult {
	screenId: string;
	redirectUrl: string;
}

/**
 * FormulaClient - Handles formula creation and editing operations with MIO API
 */
export class FormulaClient {
	/**
	 * Create new formula on MIO
	 * POST to formula_screener.php with action=run
	 * Returns screen_id extracted from 302 redirect Location header
	 */
	static async createFormula(params: CreateFormulaParams): Promise<FormulaCreateEditResult> {
		try {
			const formData = new URLSearchParams({
				action: 'run',
				session: '',
				screen_id: '',
				name: params.name,
				formula: params.formula, // Will be URL encoded automatically
				category_id: params.categoryId || 'price_action',
				group_id: params.groupId || 'stock',
				event_id: params.eventId || 'trend_up',
				via_email: '',
				via_sms: '',
				via_telegram: '',
				eod: '',
				send: '',
				vgroup: '',
			});

			console.log('[FormulaClient] Creating formula:', {
				name: params.name,
				formulaLength: params.formula.length,
				url: FORMULA_SCREENER_URL,
			});

			const res = await fetch(FORMULA_SCREENER_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'en-GB,en;q=0.5',
					'Cookie': `${params.sessionKeyValue.key}=${params.sessionKeyValue.value}`,
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				},
				body: formData.toString(),
				redirect: 'manual', // Don't follow redirects automatically
			});

			console.log('[FormulaClient] Response status:', res.status);

			// Expect 302 redirect
			if (res.status !== 302 && res.status !== 301) {
				// If we get 200, the formula might have been created but we need to check
				if (res.status === 200) {
					const text = await res.text();
					console.log('[FormulaClient] Got 200 response, checking for screen_id in response');

					// Try to find screen_id in response HTML
					const screenIdMatch = text.match(/screen_id[=:](\d+)/i);
					if (screenIdMatch && screenIdMatch[1]) {
						return {
							screenId: screenIdMatch[1],
							redirectUrl: `${FORMULA_SCREENER_URL}?screen_id=${screenIdMatch[1]}`,
						};
					}
				}

				throw new Error(`Unexpected response status: ${res.status}`);
			}

			// Extract Location header
			const location = res.headers.get('location');
			console.log('[FormulaClient] Redirect location:', location);

			if (!location) {
				throw new Error('No Location header in redirect response');
			}

			// Parse screen_id from URL
			// Possible formats:
			// - stocks.php?screen_id=496310&...
			// - formula_screener.php?screen_id=496310&...
			// - /stock-screener/stocks.php?screen_id=496310&...
			const screenIdMatch = location.match(/screen_id=(\d+)/i);
			if (!screenIdMatch || !screenIdMatch[1]) {
				throw new Error(`Could not extract screen_id from redirect URL: ${location}`);
			}

			const screenId = screenIdMatch[1];
			console.log('[FormulaClient] Extracted screen_id:', screenId);

			// Build full URL if location is relative
			const redirectUrl = location.startsWith('http')
				? location
				: `https://www.marketinout.com${location.startsWith('/') ? '' : '/stock-screener/'}${location}`;

			return {
				screenId,
				redirectUrl,
			};
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'createFormula',
				undefined,
				FORMULA_SCREENER_URL
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Edit existing formula on MIO
	 * Same endpoint as create, but with screen_id parameter
	 */
	static async editFormula(params: EditFormulaParams): Promise<FormulaCreateEditResult> {
		try {
			const formData = new URLSearchParams({
				action: 'run',
				session: '',
				screen_id: params.screenId,
				name: params.name,
				formula: params.formula,
				category_id: params.categoryId || 'price_action',
				group_id: params.groupId || 'stock',
				event_id: params.eventId || 'trend_up',
				via_email: '',
				via_sms: '',
				via_telegram: '',
				eod: '',
				send: '',
				vgroup: '',
			});

			console.log('[FormulaClient] Editing formula:', {
				screenId: params.screenId,
				name: params.name,
				formulaLength: params.formula.length,
			});

			const res = await fetch(FORMULA_SCREENER_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'en-GB,en;q=0.5',
					'Cookie': `${params.sessionKeyValue.key}=${params.sessionKeyValue.value}`,
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				},
				body: formData.toString(),
				redirect: 'manual',
			});

			console.log('[FormulaClient] Response status:', res.status);

			if (res.status !== 302 && res.status !== 301) {
				if (res.status === 200) {
					const text = await res.text();
					const screenIdMatch = text.match(/screen_id[=:](\d+)/i);
					if (screenIdMatch && screenIdMatch[1]) {
						return {
							screenId: screenIdMatch[1],
							redirectUrl: `${FORMULA_SCREENER_URL}?screen_id=${screenIdMatch[1]}`,
						};
					}
				}

				throw new Error(`Unexpected response status: ${res.status}`);
			}

			const location = res.headers.get('location');
			console.log('[FormulaClient] Redirect location:', location);

			if (!location) {
				throw new Error('No Location header in redirect response');
			}

			const screenIdMatch = location.match(/screen_id=(\d+)/i);
			if (!screenIdMatch || !screenIdMatch[1]) {
				throw new Error(`Could not extract screen_id from redirect URL: ${location}`);
			}

			const screenId = screenIdMatch[1];
			console.log('[FormulaClient] Confirmed screen_id:', screenId);

			const redirectUrl = location.startsWith('http')
				? location
				: `https://www.marketinout.com${location.startsWith('/') ? '' : '/stock-screener/'}${location}`;

			return {
				screenId,
				redirectUrl,
			};
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'editFormula',
				undefined,
				FORMULA_SCREENER_URL
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Delete formula(s) from MIO
	 * GET to my_stock_screens.php with todelete params and mode=delete
	 * Supports multiple deletes: ?todelete=X&todelete=Y&mode=delete
	 */
	static async deleteFormula(
		sessionKeyValue: SessionKeyValue,
		screenIds: string[]
	): Promise<void> {
		try {
			// Build query string with multiple todelete parameters
			const deleteParams = screenIds.map(id => `todelete=${id}`).join('&');
			const url = `${MIO_URLS.MY_STOCK_SCREENS}?${deleteParams}&mode=delete`;

			console.log('[FormulaClient] Deleting formulas:', { screenIds, url });

			const res = await fetch(url, {
				method: 'GET',
				headers: {
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'en-GB,en;q=0.5',
					'Cookie': `${sessionKeyValue.key}=${sessionKeyValue.value}`,
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
					'Referer': MIO_URLS.MY_STOCK_SCREENS,
				},
			});

			console.log('[FormulaClient] Delete response status:', res.status);

			if (!res.ok && res.status !== 302 && res.status !== 301) {
				throw new Error(`Failed to delete formula: ${res.status} ${res.statusText}`);
			}

			console.log('[FormulaClient] Formulas deleted successfully');
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'deleteFormula',
				undefined,
				MIO_URLS.MY_STOCK_SCREENS
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}
}
