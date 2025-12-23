import { sleep } from './sleep.js';

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds between retries */
  delay: number;
  /** Use exponential backoff (delay * 2^attempt) */
  backoff?: boolean;
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 * 
 * @example
 * ```ts
 * const result = await retry(
 *   () => fetchData(),
 *   { maxRetries: 3, delay: 1000, backoff: true }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, delay, backoff = false } = options;
  
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't sleep after the last attempt
      if (attempt < maxRetries - 1) {
        const currentDelay = backoff ? delay * Math.pow(2, attempt) : delay;
        await sleep(currentDelay);
      }
    }
  }
  
  // All retries exhausted, throw the last error
  throw lastError;
}
