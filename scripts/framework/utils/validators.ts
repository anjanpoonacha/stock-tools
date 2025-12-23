/**
 * Common validation patterns extracted from POCs
 * 
 * Provides reusable validation patterns for symbols, IDs, tokens, etc.
 */

/**
 * Validation patterns as frozen constants
 */
export const PATTERNS = {
  /** Numeric ID (digits only) */
  NUMERIC_ID: /^\d+$/,
  
  /** Stock symbol (e.g., TCS or TCS.NS) */
  STOCK_SYMBOL: /^[A-Z0-9]+(\.[A-Z]+)?$/,
  
  /** Watchlist ID (numeric) */
  WATCHLIST_ID: /^\d+$/,
  
  /** JWT Token format */
  JWT_TOKEN: /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
} as const;

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate stock symbol format
 * Supports formats: TCS or TCS.NS
 * 
 * @param symbol - Stock symbol to validate
 * @returns Validation result
 * 
 * @example
 * ```ts
 * const result = validateSymbol('TCS.NS');
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateSymbol(symbol: string): ValidationResult {
  if (!symbol || symbol.trim() === '') {
    return { valid: false, error: 'Symbol cannot be empty' };
  }
  
  // Allow both formats: TCS.NS or TCS (case-insensitive)
  if (!PATTERNS.STOCK_SYMBOL.test(symbol.toUpperCase())) {
    return { 
      valid: false, 
      error: `Invalid symbol format: ${symbol}. Expected format: TCS or TCS.NS` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate watchlist ID
 * Must be a numeric ID
 * 
 * @param wlid - Watchlist ID to validate
 * @returns Validation result
 */
export function validateWatchlistId(wlid: string): ValidationResult {
  if (!wlid || wlid.trim() === '') {
    return { valid: false, error: 'Watchlist ID cannot be empty' };
  }
  
  if (!PATTERNS.WATCHLIST_ID.test(wlid)) {
    return { 
      valid: false, 
      error: `Invalid watchlist ID format: ${wlid}. Must be numeric.` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate JWT token format
 * 
 * @param token - JWT token to validate
 * @returns Validation result
 */
export function validateJWT(token: string): ValidationResult {
  if (!token || token.trim() === '') {
    return { valid: false, error: 'JWT token cannot be empty' };
  }
  
  if (!PATTERNS.JWT_TOKEN.test(token)) {
    return { 
      valid: false, 
      error: 'Invalid JWT token format. Expected format: eyJxxx.eyJxxx.xxx' 
    };
  }
  
  return { valid: true };
}
