/**
 * MIO API Response Type Definitions
 * 
 * Based on real production API responses from marketinout.com
 * All MIO API responses follow a consistent pattern:
 * - 5 out of 6 operations return HTTP 302 redirects
 * - 1 out of 6 returns full HTML (watchlist list)
 * - 0 operations return JSON
 * - All operations use cookies for authentication
 * 
 * @see scripts/poc-mio/RESPONSE_ANALYSIS.md
 */

// ============================================================================
// Core Response Types
// ============================================================================

/**
 * Error codes for MIO API responses
 */
export enum ErrorCode {
  /** Session expired - login required */
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  /** Validation failed - invalid input */
  INVALID_INPUT = 'INVALID_INPUT',
  
  /** Resource not found */
  NOT_FOUND = 'NOT_FOUND',
  
  /** Network error - fetch failed */
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  /** Response parsing failed */
  PARSE_ERROR = 'PARSE_ERROR',
  
  /** HTTP 4xx/5xx error */
  HTTP_ERROR = 'HTTP_ERROR',
  
  /** Unexpected error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * MIO API error details
 */
export type MIOError = {
  /** Error code identifying the type of error */
  code: ErrorCode;
  
  /** Human-readable error message */
  message: string;
  
  /** If true, session needs to be refreshed */
  needsRefresh?: boolean;
  
  /** Additional error details for debugging */
  details?: string;
};

/**
 * Response metadata
 */
export type ResponseMeta = {
  /** HTTP status code */
  statusCode: number;
  
  /** Response content type */
  responseType: 'html' | 'redirect' | 'json' | 'text';
  
  /** Request URL */
  url: string;
  
  /** Raw response body for debugging */
  rawResponse?: string;
  
  /** Extracted redirect URL (for 302 responses) */
  redirectUrl?: string;
};

/**
 * Standardized MIO API Response
 * 
 * All MIO API operations return this structure for consistency
 * 
 * @template T - The data type for successful responses
 * 
 * @example
 * ```typescript
 * const response: MIOResponse<Watchlist[]> = await getWatchlists();
 * if (response.success) {
 *   console.log(response.data); // Watchlist[]
 * } else {
 *   console.error(response.error.message);
 * }
 * ```
 */
export type MIOResponse<T = unknown> = {
  /** Whether the operation succeeded */
  success: boolean;
  
  /** Response data (only present on success) */
  data?: T;
  
  /** Error details (only present on failure) */
  error?: MIOError;
  
  /** Response metadata */
  meta: ResponseMeta;
};

// ============================================================================
// Watchlist Types
// ============================================================================

/**
 * Watchlist item
 */
export type Watchlist = {
  /** Numeric watchlist ID */
  id: string;
  
  /** Watchlist name */
  name: string;
};

// ============================================================================
// Endpoint-Specific Response Types
// ============================================================================

/**
 * Response from GET /wl/watch_list.php?mode=list
 * 
 * Returns HTML with watchlist selector:
 * ```html
 * <select id="sel_wlid">
 *   <option value="74562">AnalysedAlready</option>
 *   <option value="52736">IndexWatchlist</option>
 * </select>
 * ```
 */
export type GetWatchlistsResponse = {
  /** Array of watchlists */
  watchlists: Watchlist[];
};

/**
 * Response from GET /wl/my_watch_lists.php?mode=new
 * 
 * Returns HTTP 302 redirect with watchlist ID in URL:
 * ```
 * Location: watch_list.php?wlid=75859
 * ```
 */
export type CreateWatchlistResponse = {
  /** Whether watchlist was created */
  created: boolean;
  
  /** Numeric watchlist ID (extracted from redirect) */
  wlid?: string;
  
  /** Watchlist name */
  name: string;
  
  /** Success/error message */
  message?: string;
};

/**
 * Response from POST /wl/watch_list.php (mode=add)
 * 
 * Returns HTTP 302 redirect on success:
 * ```
 * Location: watch_list.php?wlid=75859
 * ```
 */
export type AddStocksBulkResponse = {
  /** Whether stocks were added */
  added: boolean;
  
  /** Watchlist ID */
  wlid: string;
  
  /** Array of symbols that were added */
  symbols: string[];
  
  /** Number of symbols added */
  count: number;
  
  /** Success/error message */
  message?: string;
};

/**
 * Response from GET /wl/wl_add_all.php (action=add|remove)
 * 
 * Returns HTTP 302 redirect:
 * ```
 * Location: wl_add_all_done.php?action=add&symbol=WIPRO.NS
 * ```
 */
export type SingleStockResponse = {
  /** Whether operation succeeded */
  success: boolean;
  
  /** Operation type */
  action: 'add' | 'remove';
  
  /** Watchlist ID */
  wlid: string;
  
  /** Stock symbol */
  symbol: string;
  
  /** Success/error message */
  message?: string;
};

/**
 * Response from GET /wl/my_watch_lists.php?mode=delete
 * or GET /wl/wl_del.php?action=delete
 * 
 * Returns HTTP 302 redirect:
 * ```
 * Location: my_watch_lists.php
 * ```
 */
export type DeleteWatchlistResponse = {
  /** Whether deletion succeeded */
  deleted: boolean;
  
  /** Array of watchlist IDs that were deleted */
  wlids?: string[];
  
  /** Single watchlist ID (for single deletion) */
  wlid?: string;
  
  /** Ticker ID (for stock deletion by tid) */
  tid?: string;
  
  /** Symbol (for stock deletion by symbol) */
  symbol?: string;
  
  /** Success/error message */
  message?: string;
};

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of validation operation
 */
export type ValidationResult = {
  /** Whether validation passed */
  valid: boolean;
  
  /** Error message if validation failed */
  error?: string;
  
  /** If true, session needs to be refreshed */
  needsRefresh?: boolean;
};

/**
 * Result of bulk symbol validation
 */
export type BulkValidationResult = {
  /** Whether all symbols are valid */
  valid: boolean;
  
  /** Array of invalid symbols */
  invalid: string[];
};
