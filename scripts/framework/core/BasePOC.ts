/**
 * Base POC Class
 * 
 * Abstract base class for all POC implementations using Template Method pattern
 * Provides standardized workflow and error handling
 */

import type { POCResult } from './types.js';

/**
 * Abstract base class for POC implementations
 * @template TConfig - Configuration type for the POC
 * @template TOutput - Output data type returned by the POC
 */
export abstract class BasePOC<TConfig, TOutput> {
  protected config: TConfig;
  protected startTime: number = 0;

  constructor(config: TConfig) {
    this.config = config;
  }

  /**
   * Template method - orchestrates the POC workflow
   * This is the main entry point that should be called to run the POC
   * 
   * @returns POCResult with success/error/meta information
   */
  async run(): Promise<POCResult<TOutput>> {
    this.startTime = Date.now();
    
    try {
      // Execute hooks in order
      await this.onStart();
      
      await this.setup();
      const result = await this.execute();
      await this.cleanup();
      
      await this.onSuccess(result);
      
      // Calculate duration
      const duration = Date.now() - this.startTime;
      
      return {
        success: true,
        data: result,
        meta: {
          duration,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      // Handle errors gracefully
      await this.onError(error);
      
      const duration = Date.now() - this.startTime;
      
      return {
        success: false,
        error: {
          code: this.getErrorCode(error),
          message: this.getErrorMessage(error),
        },
        meta: {
          duration,
          timestamp: new Date().toISOString(),
        },
      };
    } finally {
      // Always execute completion hook
      await this.onComplete();
    }
  }

  // ============================================================
  // Lifecycle Hooks (can be overridden by subclasses)
  // ============================================================

  /**
   * Called before setup() - useful for logging or initialization
   */
  protected async onStart(): Promise<void> {
    // Default implementation: do nothing
  }

  /**
   * Called after successful execution with the result
   * @param _result - The output data from execute()
   */
  protected async onSuccess(_result: TOutput): Promise<void> {
    // Default implementation: do nothing
  }

  /**
   * Called when an error occurs during execution
   * @param error - The error that occurred
   */
  protected async onError(error: unknown): Promise<void> {
    // Default implementation: log error to console
    console.error('[BasePOC] Error:', this.getErrorMessage(error));
  }

  /**
   * Called at the end of run(), regardless of success or failure
   * Useful for cleanup that should always happen
   */
  protected async onComplete(): Promise<void> {
    // Default implementation: do nothing
  }

  // ============================================================
  // Abstract Methods (must be implemented by subclasses)
  // ============================================================

  /**
   * Setup phase - prepare resources, validate configuration, etc.
   * Called before execute()
   */
  protected abstract setup(): Promise<void>;

  /**
   * Execute phase - perform the main POC logic
   * Called after setup() and before cleanup()
   * @returns The output data of type TOutput
   */
  protected abstract execute(): Promise<TOutput>;

  /**
   * Cleanup phase - release resources, close connections, etc.
   * Called after execute(), even if execute() throws an error
   */
  protected abstract cleanup(): Promise<void>;

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Extract error code from unknown error
   * @param error - The error object
   * @returns Error code string
   */
  protected getErrorCode(error: unknown): string {
    if (error && typeof error === 'object') {
      if ('code' in error && typeof error.code === 'string') {
        return error.code;
      }
      if ('name' in error && typeof error.name === 'string') {
        return error.name;
      }
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Extract error message from unknown error
   * @param error - The error object
   * @returns Error message string
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'An unknown error occurred';
  }

  /**
   * Get elapsed time since POC started
   * @returns Elapsed time in milliseconds
   */
  protected getElapsedTime(): number {
    return Date.now() - this.startTime;
  }
}
