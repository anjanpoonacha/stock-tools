/**
 * Sleep utility for adding delays in async code
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 * 
 * @example
 * ```ts
 * await sleep(1000); // Wait 1 second
 * ```
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
