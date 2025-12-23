/**
 * Core Framework Type Definitions
 * 
 * Shared TypeScript types used across all POC implementations
 */

/**
 * Supported platforms for POC testing
 */
export type Platform = 'marketinout' | 'tradingview';

/**
 * Session data structure for platform authentication
 */
export interface SessionData {
  sessionId: string;
  platform: Platform;
  userEmail?: string;
  [key: string]: any;
}

/**
 * Standardized result wrapper for POC operations
 * @template T - The type of data returned on success
 */
export interface POCResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    duration: number;
    timestamp: string;
  };
}

/**
 * Configuration options for POC execution
 */
export interface POCOptions {
  outputDir: string;
  saveToFile: boolean;
  prettyPrint: boolean;
  verbose: boolean;
}

/**
 * User credentials loaded from environment variables
 */
export interface UserCredentials {
  userEmail: string;
  userPassword: string;
}
