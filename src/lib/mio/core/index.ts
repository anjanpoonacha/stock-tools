/**
 * MIO Core Module
 * 
 * Centralized exports for MIO API integration utilities.
 * 
 * This module provides a unified interface for working with the MIO API including:
 * - Type-safe response structures (MIOResponse<T>)
 * - Request validation (RequestValidator)
 * - Response parsing (ResponseParser)
 * - Response validation (ResponseValidator)
 * - HTTP client (MIOHttpClient)
 * 
 * All utilities are designed to work together following the POC-first development principle.
 * See scripts/poc-mio/RESPONSE_ANALYSIS.md for API patterns.
 * 
 * @module @/lib/mio/core
 * 
 * @example
 * ```typescript
 * import { MIOHttpClient, RequestValidator, ResponseParser, type MIOResponse } from '@/lib/mio/core';
 * 
 * // Validate before making request
 * const validation = RequestValidator.validateSymbol('TCS.NS');
 * if (!validation.valid) {
 *   console.error(validation.error);
 *   return;
 * }
 * 
 * // Make authenticated request
 * const response = await MIOHttpClient.request<Watchlist[]>(
 *   url,
 *   { method: 'GET', sessionKeyValue: session },
 *   (html) => ResponseParser.parseWatchlistList(html)
 * );
 * 
 * // Handle response
 * if (response.success) {
 *   console.log(response.data);
 * } else {
 *   if (response.error?.needsRefresh) {
 *     // Session expired
 *   }
 * }
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

// Export all types from response-types
export type {
  MIOError,
  ResponseMeta,
  MIOResponse,
  Watchlist,
  GetWatchlistsResponse,
  CreateWatchlistResponse,
  AddStocksBulkResponse,
  SingleStockResponse,
  DeleteWatchlistResponse,
  ValidationResult,
  BulkValidationResult,
} from './response-types';

// Export ErrorCode enum
export { ErrorCode } from './response-types';

// ============================================================================
// Utility Exports
// ============================================================================

// Export RequestValidator class
export { RequestValidator } from './request-validator';

// Export ResponseParser class
export { ResponseParser } from './response-parser';

// Export ResponseValidator class
export { ResponseValidator } from './response-validator';

// Export MIOHttpClient class
export { MIOHttpClient } from './http-client';
