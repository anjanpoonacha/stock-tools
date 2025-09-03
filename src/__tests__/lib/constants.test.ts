import { describe, it, expect } from 'vitest';
import {
	API_ENDPOINTS,
	HTTP_STATUS,
	SESSION_CONFIG,
	ERROR_MESSAGES,
	SUCCESS_MESSAGES,
	LOG_PREFIXES,
	UI_CONSTANTS,
} from '@/lib/constants';

describe('constants', () => {
	describe('API_ENDPOINTS', () => {
		it('should export all API endpoint constants', () => {
			expect(API_ENDPOINTS.MIO_ACTION).toBe('/api/mio-action');
			expect(API_ENDPOINTS.SESSION_CURRENT).toBe('/api/session/current');
			expect(API_ENDPOINTS.TRADINGVIEW_WATCHLISTS).toBe('/api/tradingview-watchlists');
			expect(API_ENDPOINTS.PROXY).toBe('/api/proxy');
		});

		it('should have consistent API endpoint format', () => {
			Object.values(API_ENDPOINTS).forEach((endpoint) => {
				expect(endpoint).toMatch(/^\/api\//);
			});
		});

		it('should maintain consistent values', () => {
			// Verify constants maintain their expected values
			expect(API_ENDPOINTS.MIO_ACTION).toBe('/api/mio-action');
			expect(API_ENDPOINTS.SESSION_CURRENT).toBe('/api/session/current');
			expect(API_ENDPOINTS.TRADINGVIEW_WATCHLISTS).toBe('/api/tradingview-watchlists');
			expect(API_ENDPOINTS.PROXY).toBe('/api/proxy');
		});
	});

	describe('HTTP_STATUS', () => {
		it('should export all HTTP status codes', () => {
			expect(HTTP_STATUS.OK).toBe(200);
			expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
			expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
			expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
		});

		it('should have valid HTTP status code ranges', () => {
			expect(HTTP_STATUS.OK).toBeGreaterThanOrEqual(200);
			expect(HTTP_STATUS.OK).toBeLessThan(300);
			expect(HTTP_STATUS.BAD_REQUEST).toBeGreaterThanOrEqual(400);
			expect(HTTP_STATUS.BAD_REQUEST).toBeLessThan(500);
			expect(HTTP_STATUS.UNAUTHORIZED).toBeGreaterThanOrEqual(400);
			expect(HTTP_STATUS.UNAUTHORIZED).toBeLessThan(500);
			expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBeGreaterThanOrEqual(500);
			expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBeLessThan(600);
		});

		it('should maintain consistent values', () => {
			// Verify constants maintain their expected values
			expect(HTTP_STATUS.OK).toBe(200);
			expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
			expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
			expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
		});
	});

	describe('SESSION_CONFIG', () => {
		it('should export platform configurations', () => {
			expect(SESSION_CONFIG.PLATFORMS.MARKETINOUT).toBe('marketinout');
			expect(SESSION_CONFIG.PLATFORMS.TRADINGVIEW).toBe('tradingview');
		});

		it('should export default extracted timestamp', () => {
			expect(SESSION_CONFIG.DEFAULT_EXTRACTED_AT).toBe('1970-01-01T00:00:00.000Z');
		});

		it('should export excluded session keys', () => {
			expect(SESSION_CONFIG.EXCLUDED_SESSION_KEYS).toEqual([
				'sessionId',
				'extractedAt',
				'extractedFrom',
				'source',
			]);
		});

		it('should have valid ISO timestamp format for default extracted at', () => {
			const timestamp = SESSION_CONFIG.DEFAULT_EXTRACTED_AT;
			expect(new Date(timestamp).toISOString()).toBe(timestamp);
		});

		it('should maintain consistent platform values', () => {
			// Verify platform constants maintain their expected values
			expect(SESSION_CONFIG.PLATFORMS.MARKETINOUT).toBe('marketinout');
			expect(SESSION_CONFIG.PLATFORMS.TRADINGVIEW).toBe('tradingview');
		});
	});

	describe('ERROR_MESSAGES', () => {
		it('should export all error messages', () => {
			expect(ERROR_MESSAGES.NO_SESSION).toBe(
				'No MIO session found. Please use the browser extension to capture a session from marketinout.com'
			);
			expect(ERROR_MESSAGES.WATCHLIST_LOAD_FAILED).toBe(
				'Failed to load watchlists. Please capture a new session.'
			);
			expect(ERROR_MESSAGES.WATCHLIST_ADD_FAILED).toBe(
				'Failed to add to watchlist. Please capture a new session.'
			);
			expect(ERROR_MESSAGES.WATCHLIST_CREATE_FAILED).toBe(
				'Failed to create watchlist. Please capture a new session.'
			);
			expect(ERROR_MESSAGES.WATCHLIST_DELETE_FAILED).toBe(
				'Failed to delete watchlists. Please capture a new session.'
			);
			expect(ERROR_MESSAGES.UNKNOWN_ERROR).toBe('Unknown error');
			expect(ERROR_MESSAGES.NAME_REQUIRED).toBe('name is required.');
			expect(ERROR_MESSAGES.DELETE_IDS_REQUIRED).toBe('deleteIds array is required.');
		});

		it('should have meaningful error messages', () => {
			Object.values(ERROR_MESSAGES).forEach((message) => {
				expect(message.length).toBeGreaterThan(0);
				expect(typeof message).toBe('string');
			});
		});

		it('should maintain consistent error message values', () => {
			// Verify error messages maintain their expected values
			expect(ERROR_MESSAGES.NO_SESSION).toContain('MIO session');
			expect(ERROR_MESSAGES.WATCHLIST_LOAD_FAILED).toContain('Failed to load');
			expect(ERROR_MESSAGES.UNKNOWN_ERROR).toBe('Unknown error');
		});
	});

	describe('SUCCESS_MESSAGES', () => {
		it('should export all success messages', () => {
			expect(SUCCESS_MESSAGES.WATCHLIST_UPDATED).toBe('Watchlist updated successfully.');
			expect(SUCCESS_MESSAGES.WATCHLIST_CREATED).toBe('Watchlist created successfully.');
			expect(SUCCESS_MESSAGES.WATCHLISTS_DELETED).toBe('Watchlists deleted successfully.');
		});

		it('should have meaningful success messages', () => {
			Object.values(SUCCESS_MESSAGES).forEach((message) => {
				expect(message.length).toBeGreaterThan(0);
				expect(typeof message).toBe('string');
				expect(message).toMatch(/successfully/i);
			});
		});

		it('should maintain consistent success message values', () => {
			// Verify success messages maintain their expected values
			expect(SUCCESS_MESSAGES.WATCHLIST_UPDATED).toContain('successfully');
			expect(SUCCESS_MESSAGES.WATCHLIST_CREATED).toContain('successfully');
			expect(SUCCESS_MESSAGES.WATCHLISTS_DELETED).toContain('successfully');
		});
	});

	describe('LOG_PREFIXES', () => {
		it('should export all log prefixes', () => {
			expect(LOG_PREFIXES.API).toBe('[API]');
			expect(LOG_PREFIXES.SESSION_RESOLVER).toBe('[SessionResolver]');
			expect(LOG_PREFIXES.SESSION_MANAGER).toBe('[SessionManager]');
			expect(LOG_PREFIXES.MIO_SERVICE).toBe('[MIOService]');
			expect(LOG_PREFIXES.SYNC).toBe('[SYNC]');
		});

		it('should have consistent log prefix format', () => {
			Object.values(LOG_PREFIXES).forEach((prefix) => {
				expect(prefix).toMatch(/^\[.+\]$/);
			});
		});

		it('should maintain consistent log prefix values', () => {
			// Verify log prefixes maintain their expected values
			expect(LOG_PREFIXES.API).toBe('[API]');
			expect(LOG_PREFIXES.SESSION_RESOLVER).toBe('[SessionResolver]');
			expect(LOG_PREFIXES.MIO_SERVICE).toBe('[MIOService]');
		});
	});

	describe('UI_CONSTANTS', () => {
		it('should export all UI constants', () => {
			expect(UI_CONSTANTS.LOADING_TEXT).toBe('Loading watchlists...');
			expect(UI_CONSTANTS.NO_WATCHLISTS_FOUND).toBe('No watchlists found.');
			expect(UI_CONSTANTS.PLACEHOLDER_SYMBOLS).toBe('Symbols (comma separated)');
			expect(UI_CONSTANTS.PLACEHOLDER_GROUP_BY).toBe('Group By');
			expect(UI_CONSTANTS.PLACEHOLDER_WATCHLIST_NAME).toBe('New Watchlist Name');
			expect(UI_CONSTANTS.PLACEHOLDER_SELECT_WATCHLIST).toBe('Select a watchlist');
			expect(UI_CONSTANTS.PLACEHOLDER_SELECT_WATCHLISTS_DELETE).toBe('Select watchlists to delete');
		});

		it('should have meaningful UI text', () => {
			Object.values(UI_CONSTANTS).forEach((text) => {
				expect(text.length).toBeGreaterThan(0);
				expect(typeof text).toBe('string');
			});
		});

		it('should maintain consistent UI constant values', () => {
			// Verify UI constants maintain their expected values
			expect(UI_CONSTANTS.LOADING_TEXT).toBe('Loading watchlists...');
			expect(UI_CONSTANTS.NO_WATCHLISTS_FOUND).toBe('No watchlists found.');
			expect(UI_CONSTANTS.PLACEHOLDER_SYMBOLS).toBe('Symbols (comma separated)');
		});
	});

	describe('constant immutability', () => {
		it('should maintain array integrity', () => {
			// Verify array constants maintain their expected structure
			expect(Array.isArray(SESSION_CONFIG.EXCLUDED_SESSION_KEYS)).toBe(true);
			expect(SESSION_CONFIG.EXCLUDED_SESSION_KEYS.length).toBe(4);
			expect(SESSION_CONFIG.EXCLUDED_SESSION_KEYS).toContain('sessionId');
		});

		it('should maintain type safety', () => {
			// These should compile without errors
			const endpoint: string = API_ENDPOINTS.MIO_ACTION;
			const status: number = HTTP_STATUS.OK;
			const platform: string = SESSION_CONFIG.PLATFORMS.MARKETINOUT;
			const error: string = ERROR_MESSAGES.NO_SESSION;
			const success: string = SUCCESS_MESSAGES.WATCHLIST_UPDATED;
			const prefix: string = LOG_PREFIXES.API;
			const uiText: string = UI_CONSTANTS.LOADING_TEXT;

			expect(typeof endpoint).toBe('string');
			expect(typeof status).toBe('number');
			expect(typeof platform).toBe('string');
			expect(typeof error).toBe('string');
			expect(typeof success).toBe('string');
			expect(typeof prefix).toBe('string');
			expect(typeof uiText).toBe('string');
		});
	});

	describe('constant completeness', () => {
		it('should have all expected API endpoints', () => {
			const expectedEndpoints = ['MIO_ACTION', 'SESSION_CURRENT', 'TRADINGVIEW_WATCHLISTS', 'PROXY'];
			const actualEndpoints = Object.keys(API_ENDPOINTS);
			expect(actualEndpoints.sort()).toEqual(expectedEndpoints.sort());
		});

		it('should have all expected HTTP status codes', () => {
			const expectedStatuses = ['OK', 'BAD_REQUEST', 'UNAUTHORIZED', 'INTERNAL_SERVER_ERROR'];
			const actualStatuses = Object.keys(HTTP_STATUS);
			expect(actualStatuses.sort()).toEqual(expectedStatuses.sort());
		});

		it('should have all expected session config keys', () => {
			const expectedKeys = ['PLATFORMS', 'DEFAULT_EXTRACTED_AT', 'EXCLUDED_SESSION_KEYS'];
			const actualKeys = Object.keys(SESSION_CONFIG);
			expect(actualKeys.sort()).toEqual(expectedKeys.sort());
		});

		it('should have all expected error messages', () => {
			const expectedErrors = [
				'NO_SESSION',
				'WATCHLIST_LOAD_FAILED',
				'WATCHLIST_ADD_FAILED',
				'WATCHLIST_CREATE_FAILED',
				'WATCHLIST_DELETE_FAILED',
				'UNKNOWN_ERROR',
				'NAME_REQUIRED',
				'DELETE_IDS_REQUIRED',
			];
			const actualErrors = Object.keys(ERROR_MESSAGES);
			expect(actualErrors.sort()).toEqual(expectedErrors.sort());
		});

		it('should have all expected success messages', () => {
			const expectedSuccesses = ['WATCHLIST_UPDATED', 'WATCHLIST_CREATED', 'WATCHLISTS_DELETED'];
			const actualSuccesses = Object.keys(SUCCESS_MESSAGES);
			expect(actualSuccesses.sort()).toEqual(expectedSuccesses.sort());
		});

		it('should have all expected log prefixes', () => {
			const expectedPrefixes = ['API', 'SESSION_RESOLVER', 'SESSION_MANAGER', 'MIO_SERVICE', 'SYNC'];
			const actualPrefixes = Object.keys(LOG_PREFIXES);
			expect(actualPrefixes.sort()).toEqual(expectedPrefixes.sort());
		});

		it('should have all expected UI constants', () => {
			const expectedConstants = [
				'LOADING_TEXT',
				'NO_WATCHLISTS_FOUND',
				'PLACEHOLDER_SYMBOLS',
				'PLACEHOLDER_GROUP_BY',
				'PLACEHOLDER_WATCHLIST_NAME',
				'PLACEHOLDER_SELECT_WATCHLIST',
				'PLACEHOLDER_SELECT_WATCHLISTS_DELETE',
			];
			const actualConstants = Object.keys(UI_CONSTANTS);
			expect(actualConstants.sort()).toEqual(expectedConstants.sort());
		});
	});
});
