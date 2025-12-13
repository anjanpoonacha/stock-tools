// src/lib/mio/index.ts

/**
 * MIO Module - MarketInOut integration
 *
 * This module provides a clean interface for interacting with MarketInOut.com,
 * managing sessions, watchlists, and formula extraction.
 */

// Export main service facade
export { MIOService } from './MIOService';

// Export sub-modules for advanced usage
export { SessionManager } from './sessionManager';
export { APIClient } from './apiClient';

// Export types
export type {
	AddWatchlistWithSessionParams,
	AddWatchlistParams,
	Watchlist,
	SessionKeyValue,
	SessionData
} from './types';

// Export constants
export { MIO_URLS, PATTERNS, LOGIN_INDICATORS, RATE_LIMIT } from './types';
