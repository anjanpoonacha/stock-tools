/**
 * POC Framework - Main Entry Point
 * 
 * A comprehensive framework for building POC scripts with:
 * - Unified session management (no hardcoded sessions)
 * - Reusable HTTP clients (MIO, TradingView)
 * - Structured output and logging
 * - CLI argument parsing
 * - Common utilities (retry, validation, etc.)
 * 
 * @example
 * ```typescript
 * import { BasePOC, SessionProvider, MIOHttpClient, OutputManager } from './framework';
 * 
 * class MyPOC extends BasePOC<Config, Result> {
 *   protected async setup() {
 *     const session = await this.sessionProvider.getSession('marketinout');
 *     this.client = new MIOHttpClient(session.key, session.value);
 *   }
 *   
 *   protected async execute() {
 *     return await this.client.request('/api/endpoint', { method: 'GET' });
 *   }
 *   
 *   protected async cleanup() {
 *     // Cleanup resources
 *   }
 * }
 * ```
 */

// ============================================================================
// CORE
// ============================================================================
export {
  BasePOC,
  POCConfig,
  POCRunner,
} from './core/index.js';

export type {
  Platform,
  SessionData,
  POCResult,
  POCOptions,
  UserCredentials,
} from './core/index.js';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================
export {
  SessionProvider,
  KVAdapter,
} from './session/index.js';

export type {
  SessionInfo,
  SessionCache,
  MIOSessionCookie,
  TVSessionData,
} from './session/index.js';

// ============================================================================
// HTTP CLIENTS
// ============================================================================
export {
  BaseHttpClient,
  MIOHttpClient,
  TVHttpClient,
} from './http/index.js';

export type {
  HttpResponse,
  RequestOptions,
  RetryConfig,
} from './http/index.js';

// ============================================================================
// OUTPUT & LOGGING
// ============================================================================
export {
  LogFormatter,
  FileWriter,
  OutputManager,
} from './output/index.js';

export type {
  OutputConfig,
  LogLevel,
  LogMessage,
} from './output/index.js';

// ============================================================================
// CLI
// ============================================================================
export {
  ArgParser,
  Validator,
} from './cli/index.js';

// ============================================================================
// UTILITIES
// ============================================================================
export {
  sleep,
  retry,
  validateSymbol,
  validateWatchlistId,
  validateJWT,
  PATTERNS,
} from './utils/index.js';
