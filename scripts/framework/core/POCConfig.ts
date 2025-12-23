/**
 * POC Configuration Management
 * 
 * Centralized configuration handling for POC framework
 * - Loads configuration from environment variables
 * - Validates required environment variables
 * - Creates output directories automatically
 * - NEVER hardcodes credentials or sessions
 */

import { mkdirSync } from 'fs';
import { join } from 'path';
import type { UserCredentials } from './types.js';

export class POCConfig {
  /**
   * Base directory for POC outputs
   */
  private static readonly BASE_OUTPUT_DIR = join(process.cwd(), 'scripts', 'poc-output');

  /**
   * Get output directory path with automatic creation
   * @param subdir - Optional subdirectory name
   * @returns Absolute path to output directory
   */
  static getOutputDir(subdir?: string): string {
    const outputPath = subdir 
      ? join(this.BASE_OUTPUT_DIR, subdir)
      : this.BASE_OUTPUT_DIR;
    
    // Create directory if it doesn't exist
    mkdirSync(outputPath, { recursive: true });
    
    return outputPath;
  }

  /**
   * Get user credentials from environment variables
   * @throws Error if credentials are not configured
   * @returns User credentials object
   */
  static getCredentials(): UserCredentials {
    const userEmail = this.getEnv('ADMIN_EMAIL', true);
    const userPassword = this.getEnv('ADMIN_PASSWORD', true);

    if (!userEmail || !userPassword) {
      throw new Error(
        'Missing required credentials. Please set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file'
      );
    }

    return {
      userEmail,
      userPassword,
    };
  }

  /**
   * Get environment variable value
   * @param key - Environment variable name
   * @param required - Whether the variable is required
   * @returns Environment variable value or undefined
   * @throws Error if required variable is missing
   */
  static getEnv(key: string, required: boolean = false): string | undefined {
    const value = process.env[key];

    if (required && !value) {
      throw new Error(
        `Missing required environment variable: ${key}. Please check your .env file`
      );
    }

    return value;
  }

  /**
   * Get KV configuration for session storage
   * @returns KV configuration object
   */
  static getKVConfig() {
    return {
      url: this.getEnv('KV_REST_API_URL', true),
      token: this.getEnv('KV_REST_API_TOKEN', true),
    };
  }

  /**
   * Check if verbose logging is enabled
   * @returns true if verbose mode is enabled
   */
  static isVerbose(): boolean {
    return this.getEnv('POC_VERBOSE') === 'true';
  }

  /**
   * Get timeout value for operations (in milliseconds)
   * @param defaultValue - Default timeout value
   * @returns Timeout value in milliseconds
   */
  static getTimeout(defaultValue: number = 30000): number {
    const timeoutStr = this.getEnv('POC_TIMEOUT');
    return timeoutStr ? parseInt(timeoutStr, 10) : defaultValue;
  }
}
