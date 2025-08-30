// src/lib/constants.ts

/**
 * Application-wide constants for better maintainability and consistency
 */

// API Endpoints
export const API_ENDPOINTS = {
	MIO_ACTION: '/api/mio-action',
	SESSION_CURRENT: '/api/session/current',
	TRADINGVIEW_WATCHLISTS: '/api/tradingview-watchlists',
	PROXY: '/api/proxy',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
	OK: 200,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	INTERNAL_SERVER_ERROR: 500,
} as const;

// Session Management
export const SESSION_CONFIG = {
	PLATFORMS: {
		MARKETINOUT: 'marketinout',
		TRADINGVIEW: 'tradingview',
	},
	DEFAULT_EXTRACTED_AT: '1970-01-01T00:00:00.000Z',
	EXCLUDED_SESSION_KEYS: ['sessionId', 'extractedAt', 'extractedFrom', 'source'] as const,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
	NO_SESSION: 'No MIO session found. Please use the browser extension to capture a session from marketinout.com',
	WATCHLIST_LOAD_FAILED: 'Failed to load watchlists. Please capture a new session.',
	WATCHLIST_ADD_FAILED: 'Failed to add to watchlist. Please capture a new session.',
	WATCHLIST_CREATE_FAILED: 'Failed to create watchlist. Please capture a new session.',
	WATCHLIST_DELETE_FAILED: 'Failed to delete watchlists. Please capture a new session.',
	UNKNOWN_ERROR: 'Unknown error',
	NAME_REQUIRED: 'name is required.',
	DELETE_IDS_REQUIRED: 'deleteIds array is required.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
	WATCHLIST_UPDATED: 'Watchlist updated successfully.',
	WATCHLIST_CREATED: 'Watchlist created successfully.',
	WATCHLISTS_DELETED: 'Watchlists deleted successfully.',
} as const;

// Logging Prefixes
export const LOG_PREFIXES = {
	API: '[API]',
	SESSION_RESOLVER: '[SessionResolver]',
	SESSION_MANAGER: '[SessionManager]',
	MIO_SERVICE: '[MIOService]',
	SYNC: '[SYNC]',
} as const;

// UI Constants
export const UI_CONSTANTS = {
	LOADING_TEXT: 'Loading watchlists...',
	NO_WATCHLISTS_FOUND: 'No watchlists found.',
	PLACEHOLDER_SYMBOLS: 'Symbols (comma separated)',
	PLACEHOLDER_GROUP_BY: 'Group By',
	PLACEHOLDER_WATCHLIST_NAME: 'New Watchlist Name',
	PLACEHOLDER_SELECT_WATCHLIST: 'Select a watchlist',
	PLACEHOLDER_SELECT_WATCHLISTS_DELETE: 'Select watchlists to delete',
} as const;
