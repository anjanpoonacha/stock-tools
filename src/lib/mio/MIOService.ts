// src/lib/mio/MIOService.ts

import { SessionManager } from './sessionManager';
import { APIClient } from './apiClient';
import { FormulaClient, type FormulaCreateEditResult } from './formulaClient';
import {
	SessionError,
	ErrorHandler,
	Platform,
	ErrorLogger
} from '../errors';
import type {
	AddWatchlistWithSessionParams,
	AddWatchlistParams,
	Watchlist,
	SessionKeyValue,
	SessionData
} from './types';
import { RATE_LIMIT } from './types';
import type { FormulaListItem, MIOFormula, FormulaExtractionResult } from '@/types/formula';

/**
 * MIOService - Main facade that coordinates session management and API operations
 */
export class MIOService {
	/**
	 * Retrieve the session key and value for MIO from the session store.
	 * Uses robust ASPSESSION detection from CookieParser and health-aware session data.
	 */
	static async getSessionKeyValue(internalSessionId: string): Promise<SessionKeyValue | undefined> {
		return SessionManager.getSessionKeyValue(internalSessionId);
	}

	/**
	 * Extract session cookies from response Set-Cookie headers.
	 * Uses robust cookie parsing with comprehensive ASPSESSION detection.
	 */
	static extractSessionFromResponse(response: Response): SessionData | null {
		return SessionManager.extractSessionFromResponse(response);
	}

	/**
	 * Validate if a session is still healthy by making a lightweight test request.
	 * Uses the watchlist page as it's a simple authenticated endpoint.
	 */
	static async validateSessionHealth(internalSessionId: string): Promise<boolean> {
		return SessionManager.validateSessionHealth(internalSessionId);
	}

	/**
	 * Refresh session by making a test request and updating session cookies if they change.
	 * Now uses health-integrated refresh with automatic health monitoring updates.
	 * Returns true if session was refreshed successfully, false if session is invalid.
	 */
	static async refreshSession(internalSessionId: string): Promise<boolean> {
		return SessionManager.refreshSession(internalSessionId);
	}

	/**
	 * Fetch MIO watchlists using internalSessionId (handles session lookup and HTML parsing).
	 * Removed retry mechanism - fails immediately on session expiration.
	 */
	static async getWatchlistsWithSession(internalSessionId: string): Promise<Watchlist[]> {
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

			const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'getWatchlistsWithSession',
					internalSessionId
				);
				ErrorLogger.logError(error);
				throw error;
			}

			return await APIClient.getWatchlists(sessionKeyValue);
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
				undefined
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
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) throw new Error('No MIO session found for this user.');

		try {
			const result = await MIOService.addWatchlist({
				sessionKey: sessionKeyValue.key,
				sessionValue: sessionKeyValue.value,
				mioWlid,
				symbols,
			});

			// Update health monitor with successful operation
			await SessionManager.updateHealthMonitor(internalSessionId);

			return result;
		} catch (error) {
			// Health status will be updated automatically during next scheduled check
			// or when validation is called again
			console.warn('[MIOService] Operation failed, health status will be updated on next check');
			throw error;
		}
	}

	/**
	 * Add symbols to a watchlist using explicit session credentials
	 */
	static async addWatchlist(params: AddWatchlistParams): Promise<string> {
		return APIClient.addWatchlist(params);
	}

	/**
	 * Create a new watchlist
	 */
	static async createWatchlist(sessionKey: string, sessionValue: string, name: string): Promise<string> {
		return APIClient.createWatchlist(sessionKey, sessionValue, name);
	}

	/**
	 * Delete watchlists by IDs
	 */
	static async deleteWatchlists(sessionKey: string, sessionValue: string, todeleteIds: string[]): Promise<string> {
		return APIClient.deleteWatchlists(sessionKey, sessionValue, todeleteIds);
	}

	/**
	 * Delete watchlists using internalSessionId (fetches aspSessionId from session store).
	 * Removed retry mechanism - fails immediately on session expiration.
	 */
	static async deleteWatchlistsWithSession(internalSessionId: string, deleteIds: string[]): Promise<string> {
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) throw new Error('No MIO session found for this user.');

		try {
			return await APIClient.deleteWatchlists(sessionKeyValue.key, sessionKeyValue.value, deleteIds);
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

			const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'getFormulaListWithSession',
					internalSessionId
				);
				ErrorLogger.logError(error);
				throw error;
			}

			return await APIClient.getFormulaList(sessionKeyValue);
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
				undefined
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Extract API URL and formula text from a formula page
	 * Navigates to the formula page and looks for "Web API" button/link
	 * Also extracts formula text for editing
	 * Returns object with apiUrl and formulaText (both can be null if not found)
	 */
	static async extractApiUrlFromFormula(
		internalSessionId: string,
		formulaPageUrl: string
	): Promise<{ apiUrl: string | null; formulaText: string | null }> {
		try {
			const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'extractApiUrlFromFormula',
					internalSessionId
				);
				ErrorLogger.logError(error);
				throw error;
			}

			return await APIClient.extractApiUrlFromFormula(sessionKeyValue, formulaPageUrl);
		} catch (error) {
			if (error instanceof SessionError) {
				throw error;
			}

			console.error(`[MIOService] Error extracting data from ${formulaPageUrl}:`, error);
			return { apiUrl: null, formulaText: null };
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
					await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.FORMULA_EXTRACTION_DELAY_MS));
				}

				try {
					const extracted = await MIOService.extractApiUrlFromFormula(
						internalSessionId,
						formulaItem.pageUrl
					);

					const now = new Date().toISOString();
					const formula: MIOFormula = {
						id: `formula_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						name: formulaItem.name,
						pageUrl: formulaItem.pageUrl,
						apiUrl: extracted.apiUrl,
						screenId: formulaItem.screenId,
						formulaText: extracted.formulaText || undefined,
						createdAt: now,
						updatedAt: now,
						extractionStatus: extracted.apiUrl ? 'success' : 'failed',
						extractionError: extracted.apiUrl ? undefined : 'API URL not found on formula page',
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
						formulaText: undefined,
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

	/**
	 * Create new formula on MIO
	 */
	static async createFormulaWithSession(
		internalSessionId: string,
		params: {
			name: string;
			formula: string;
			categoryId?: string;
			groupId?: string;
			eventId?: string;
		}
	): Promise<FormulaCreateEditResult> {
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'createFormulaWithSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		return FormulaClient.createFormula({ sessionKeyValue, ...params });
	}

	/**
	 * Edit existing formula on MIO
	 */
	static async editFormulaWithSession(
		internalSessionId: string,
		params: {
			screenId: string;
			name: string;
			formula: string;
			categoryId?: string;
			groupId?: string;
			eventId?: string;
		}
	): Promise<FormulaCreateEditResult> {
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'editFormulaWithSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		return FormulaClient.editFormula({ sessionKeyValue, ...params });
	}

	/**
	 * Delete formula(s) from MIO
	 */
	static async deleteFormulaWithSession(
		internalSessionId: string,
		screenIds: string[]
	): Promise<void> {
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'deleteFormulaWithSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		return FormulaClient.deleteFormula(sessionKeyValue, screenIds);
	}
}
