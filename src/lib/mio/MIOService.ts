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
import { ErrorCode, type MIOResponse } from './core';

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
	 * Returns MIOResponse structure for consistent error handling.
	 */
	static async getWatchlistsWithSession(internalSessionId: string): Promise<MIOResponse<Watchlist[]>> {
		// Validate input parameters
		if (!internalSessionId) {
			return {
				success: false,
				error: {
					code: ErrorCode.INVALID_INPUT,
					message: 'Missing required parameter: internalSessionId',
				},
				meta: {
					statusCode: 400,
					responseType: 'text',
					url: 'N/A',
				},
			};
		}

		console.log('[MIOService] getWatchlistsWithSession called with internalSessionId:', internalSessionId);
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		console.log('[MIOService] sessionKeyValue lookup result:', sessionKeyValue ? '✓ Found' : '✗ Not found');
		
		if (!sessionKeyValue) {
			return {
				success: false,
				error: {
					code: ErrorCode.SESSION_EXPIRED,
					message: 'No MIO session found for this user',
					needsRefresh: true,
				},
				meta: {
					statusCode: 401,
					responseType: 'text',
					url: 'N/A',
				},
			};
		}

		return await APIClient.getWatchlists(sessionKeyValue);
	}

	/**
	 * Add watchlist using internalSessionId (fetches aspSessionId from session store).
	 * Returns MIOResponse structure for consistent error handling.
	 */
	static async addWatchlistWithSession({
		internalSessionId,
		mioWlid,
		symbols,
	}: AddWatchlistWithSessionParams): Promise<MIOResponse<{ added: boolean; wlid: string; message: string }>> {
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		
		if (!sessionKeyValue) {
			return {
				success: false,
				error: {
					code: ErrorCode.SESSION_EXPIRED,
					message: 'No MIO session found for this user.',
					needsRefresh: true,
				},
				meta: {
					statusCode: 401,
					responseType: 'text',
					url: 'N/A',
				},
			};
		}

		const result = await MIOService.addWatchlist({
			sessionKey: sessionKeyValue.key,
			sessionValue: sessionKeyValue.value,
			mioWlid,
			symbols,
		});

		// Update health monitor with successful operation
		if (result.success) {
			await SessionManager.updateHealthMonitor(internalSessionId);
		}

		return result;
	}

	/**
	 * Add symbols to a watchlist using explicit session credentials
	 * Returns MIOResponse structure for consistent error handling.
	 */
	static async addWatchlist(params: AddWatchlistParams): Promise<MIOResponse<{ added: boolean; wlid: string; message: string }>> {
		return APIClient.addWatchlist(params);
	}

	/**
	 * Create a new watchlist
	 * Returns MIOResponse structure for consistent error handling.
	 */
	static async createWatchlist(sessionKey: string, sessionValue: string, name: string): Promise<MIOResponse<{ created: boolean; name: string; wlid?: string; message: string }>> {
		return APIClient.createWatchlist(sessionKey, sessionValue, name);
	}

	/**
	 * Delete watchlists by IDs
	 * Returns MIOResponse structure for consistent error handling.
	 */
	static async deleteWatchlists(sessionKey: string, sessionValue: string, todeleteIds: string[]): Promise<MIOResponse<{ deleted: boolean; wlids: string[]; message: string }>> {
		return APIClient.deleteWatchlists(sessionKey, sessionValue, todeleteIds);
	}

	/**
	 * Delete watchlists using internalSessionId (fetches aspSessionId from session store).
	 * Returns MIOResponse structure for consistent error handling.
	 */
	static async deleteWatchlistsWithSession(internalSessionId: string, deleteIds: string[]): Promise<MIOResponse<{ deleted: boolean; wlids: string[]; message: string }>> {
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		
		if (!sessionKeyValue) {
			return {
				success: false,
				error: {
					code: ErrorCode.SESSION_EXPIRED,
					message: 'No MIO session found for this user.',
					needsRefresh: true,
				},
				meta: {
					statusCode: 401,
					responseType: 'text',
					url: 'N/A',
				},
			};
		}

		return await APIClient.deleteWatchlists(sessionKeyValue.key, sessionKeyValue.value, deleteIds);
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

	/**
	 * Add single stock to watchlist (NEW endpoint)
	 * Uses wl_add_all.php endpoint which is faster for single stock operations
	 */
	static async addSingleStockWithSession(
		internalSessionId: string,
		wlid: string,
		symbol: string
	) {
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'addSingleStockWithSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		return APIClient.addSingleStock(sessionKeyValue, wlid, symbol);
	}

	/**
	 * Remove single stock from watchlist (NEW endpoint)
	 * Uses wl_add_all.php endpoint which is faster for single stock operations
	 */
	static async removeSingleStockWithSession(
		internalSessionId: string,
		wlid: string,
		symbol: string
	) {
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'removeSingleStockWithSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		return APIClient.removeSingleStock(sessionKeyValue, wlid, symbol);
	}

	/**
	 * Delete stock by ticker ID (NEW endpoint)
	 * Uses wl_del.php endpoint
	 */
	static async deleteStockByTidWithSession(
		internalSessionId: string,
		wlid: string,
		tid: string
	) {
		const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'deleteStockByTidWithSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		return APIClient.deleteStockByTid(sessionKeyValue, wlid, tid);
	}
}
