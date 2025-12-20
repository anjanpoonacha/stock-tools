// src/lib/mio/types.ts

/**
 * Parameters for adding a watchlist with session
 */
export type AddWatchlistWithSessionParams = {
	internalSessionId: string;
	mioWlid: string;
	symbols: string;
};

/**
 * Parameters for adding a watchlist with explicit session credentials
 */
export type AddWatchlistParams = {
	sessionKey: string;
	sessionValue: string;
	mioWlid: string;
	symbols: string;
};

/**
 * Represents a watchlist item
 */
export type Watchlist = {
	id: string;
	name: string;
};

/**
 * Session key-value pair returned from session store
 */
export type SessionKeyValue = {
	key: string;
	value: string;
};

/**
 * Session data stored as key-value pairs
 */
export type SessionData = {
	[key: string]: string;
};

/**
 * Constants for MIO API URLs
 */
export const MIO_URLS = {
	BASE: 'https://www.marketinout.com',
	WATCHLIST_PAGE: 'https://www.marketinout.com/wl/watch_list.php?mode=list',
	WATCHLIST_API: 'https://www.marketinout.com/wl/watch_list.php',
	MY_WATCHLISTS: 'https://www.marketinout.com/wl/my_watch_lists.php',
	FORMULA_LIST: 'https://www.marketinout.com/stock-screener/my_stock_screens.php',
	MY_STOCK_SCREENS: 'https://www.marketinout.com/stock-screener/my_stock_screens.php',
	FORMULA_PAGE_BASE: 'https://www.marketinout.com/stock-screener/stocks.php',
	FORMULA_SCREENER: 'https://www.marketinout.com/stock-screener/formula_screener.php',
	API_BASE: 'https://api.marketinout.com/run/screen',
} as const;

/**
 * Regular expressions for parsing
 */
export const PATTERNS = {
	NUMERIC_ID: /^\d+$/,
	SCREEN_ID: /screen(\d+)/,
	API_KEY_ONCLICK: /api_info\(['"]([^'"]+)['"]\)/,
	API_URL_ONCLICK: /(https?:\/\/api\.marketinout\.com\/run\/screen\?key=[^'"&\s]+)/,
} as const;

/**
 * Indicators that a page is a login page (session expired)
 */
export const LOGIN_INDICATORS = ['login', 'signin', 'password'] as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT = {
	FORMULA_EXTRACTION_DELAY_MS: 100,
} as const;
