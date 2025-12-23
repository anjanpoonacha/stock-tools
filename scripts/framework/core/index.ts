/**
 * Framework Core Module
 * 
 * Barrel export for all core framework components
 */

// Export types
export type {
  Platform,
  SessionData,
  POCResult,
  POCOptions,
  UserCredentials,
} from './types.js';

// Export classes
export { POCConfig } from './POCConfig.js';
export { BasePOC } from './BasePOC.js';
export { POCRunner } from './POCRunner.js';
