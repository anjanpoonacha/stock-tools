/**
 * MIO API Request Validator
 * 
 * Provides pre-request validation for all MIO API operations.
 * Validation happens before making API calls to:
 * - Catch errors early
 * - Save network bandwidth
 * - Provide faster feedback
 * - Ensure consistent validation rules
 * 
 * @see scripts/poc-mio/RESPONSE_ANALYSIS.md
 * @see scripts/poc-mio/poc-mio-watchlist-client.ts
 */

import type { ValidationResult, BulkValidationResult } from './response-types';

// ============================================================================
// Validation Patterns
// ============================================================================

/** Pattern for numeric IDs (watchlist IDs, ticker IDs) */
const NUMERIC_ID_PATTERN = /^\d+$/;

/** Pattern for stock symbols (e.g., TCS.NS, INFY.NS, or just TCS) */
const SYMBOL_PATTERN = /^[A-Z0-9]+(\.[A-Z]+)?$/i;

/** Maximum length for watchlist names */
const MAX_WATCHLIST_NAME_LENGTH = 100;

// ============================================================================
// Request Validator Class
// ============================================================================

/**
 * RequestValidator provides static methods for validating MIO API request parameters
 * 
 * @example
 * ```typescript
 * const result = RequestValidator.validateWatchlistId('12345');
 * if (!result.valid) {
 *   console.error(result.error);
 *   return;
 * }
 * // Proceed with API call
 * ```
 */
export class RequestValidator {
  /**
   * Validate watchlist ID
   * 
   * Rules:
   * - Must not be empty
   * - Must be numeric (digits only)
   * 
   * @param wlid - Watchlist ID to validate
   * @returns Validation result with error message if invalid
   * 
   * @example
   * ```typescript
   * RequestValidator.validateWatchlistId('12345'); // { valid: true }
   * RequestValidator.validateWatchlistId('abc');   // { valid: false, error: '...' }
   * RequestValidator.validateWatchlistId('');      // { valid: false, error: '...' }
   * ```
   */
  static validateWatchlistId(wlid: string): ValidationResult {
    if (!wlid || wlid.trim() === '') {
      return { 
        valid: false, 
        error: 'Watchlist ID cannot be empty' 
      };
    }
    
    if (!NUMERIC_ID_PATTERN.test(wlid)) {
      return { 
        valid: false, 
        error: `Invalid watchlist ID format: ${wlid}. Must be numeric.` 
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate stock symbol
   * 
   * Rules:
   * - Must not be empty
   * - Must match pattern: SYMBOL.EXCHANGE or just SYMBOL
   * - Alphanumeric characters only
   * - Case insensitive
   * 
   * @param symbol - Stock symbol to validate (e.g., 'TCS.NS', 'INFY.NS')
   * @returns Validation result with error message if invalid
   * 
   * @example
   * ```typescript
   * RequestValidator.validateSymbol('TCS.NS');    // { valid: true }
   * RequestValidator.validateSymbol('INFY');      // { valid: true }
   * RequestValidator.validateSymbol('TCS NS');    // { valid: false, error: '...' }
   * RequestValidator.validateSymbol('');          // { valid: false, error: '...' }
   * ```
   */
  static validateSymbol(symbol: string): ValidationResult {
    if (!symbol || symbol.trim() === '') {
      return { 
        valid: false, 
        error: 'Symbol cannot be empty' 
      };
    }
    
    if (!SYMBOL_PATTERN.test(symbol)) {
      return { 
        valid: false, 
        error: `Invalid symbol format: ${symbol}. Expected format: SYMBOL.EXCHANGE (e.g., TCS.NS)` 
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate multiple stock symbols
   * 
   * Validates an array of symbols and returns which ones are invalid.
   * 
   * @param symbols - Array of stock symbols to validate
   * @returns Bulk validation result with list of invalid symbols
   * 
   * @example
   * ```typescript
   * RequestValidator.validateSymbols(['TCS.NS', 'INFY.NS']); 
   * // { valid: true, invalid: [] }
   * 
   * RequestValidator.validateSymbols(['TCS.NS', 'INVALID SYMBOL', 'INFY.NS']); 
   * // { valid: false, invalid: ['INVALID SYMBOL'] }
   * ```
   */
  static validateSymbols(symbols: string[]): BulkValidationResult {
    const invalid = symbols.filter(s => !this.validateSymbol(s).valid);
    return { 
      valid: invalid.length === 0, 
      invalid 
    };
  }

  /**
   * Validate ticker ID (tid)
   * 
   * Rules:
   * - Must not be empty
   * - Must be numeric (digits only)
   * 
   * @param tid - Ticker ID to validate
   * @returns Validation result with error message if invalid
   * 
   * @example
   * ```typescript
   * RequestValidator.validateTid('789');  // { valid: true }
   * RequestValidator.validateTid('abc');  // { valid: false, error: '...' }
   * RequestValidator.validateTid('');     // { valid: false, error: '...' }
   * ```
   */
  static validateTid(tid: string): ValidationResult {
    if (!tid || tid.trim() === '') {
      return { 
        valid: false, 
        error: 'Ticker ID cannot be empty' 
      };
    }
    
    if (!NUMERIC_ID_PATTERN.test(tid)) {
      return { 
        valid: false, 
        error: `Invalid ticker ID format: ${tid}. Must be numeric.` 
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate watchlist name
   * 
   * Rules:
   * - Must not be empty
   * - Must not exceed maximum length (100 characters)
   * 
   * @param name - Watchlist name to validate
   * @returns Validation result with error message if invalid
   * 
   * @example
   * ```typescript
   * RequestValidator.validateWatchlistName('My Watchlist'); 
   * // { valid: true }
   * 
   * RequestValidator.validateWatchlistName(''); 
   * // { valid: false, error: 'Watchlist name cannot be empty' }
   * 
   * RequestValidator.validateWatchlistName('a'.repeat(101)); 
   * // { valid: false, error: 'Watchlist name too long (max 100 chars)' }
   * ```
   */
  static validateWatchlistName(name: string): ValidationResult {
    if (!name || name.trim() === '') {
      return { 
        valid: false, 
        error: 'Watchlist name cannot be empty' 
      };
    }
    
    if (name.length > MAX_WATCHLIST_NAME_LENGTH) {
      return { 
        valid: false, 
        error: `Watchlist name too long (max ${MAX_WATCHLIST_NAME_LENGTH} chars)` 
      };
    }
    
    return { valid: true };
  }
}
