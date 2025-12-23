/**
 * POC Runner Utilities
 * 
 * Utility class for running POCs and orchestrating multiple POC executions
 */

import type { BasePOC } from './BasePOC.js';
import type { POCResult } from './types.js';

export class POCRunner {
  /**
   * Run a single POC
   * @param poc - The POC instance to run
   * @returns Promise that resolves to POCResult
   */
  static async runPOC<T>(poc: BasePOC<any, T>): Promise<POCResult<T>> {
    return poc.run();
  }

  /**
   * Run multiple POCs in sequence
   * @param pocs - Array of POC instances to run
   * @returns Promise that resolves to array of POCResults
   */
  static async runMultiple(pocs: BasePOC<any, any>[]): Promise<POCResult<any>[]> {
    const results: POCResult<any>[] = [];
    
    for (const poc of pocs) {
      const result = await poc.run();
      results.push(result);
      
      // Stop execution if any POC fails
      if (!result.success) {
        console.error(`POC failed: ${result.error?.message}`);
        break;
      }
    }
    
    return results;
  }

  /**
   * Run multiple POCs in parallel
   * @param pocs - Array of POC instances to run
   * @returns Promise that resolves to array of POCResults
   */
  static async runParallel(pocs: BasePOC<any, any>[]): Promise<POCResult<any>[]> {
    const promises = pocs.map(poc => poc.run());
    return Promise.all(promises);
  }

  /**
   * Run multiple POCs with automatic error recovery
   * Continues execution even if individual POCs fail
   * @param pocs - Array of POC instances to run
   * @returns Promise that resolves to array of POCResults
   */
  static async runWithRecovery(pocs: BasePOC<any, any>[]): Promise<POCResult<any>[]> {
    const results: POCResult<any>[] = [];
    
    for (const poc of pocs) {
      try {
        const result = await poc.run();
        results.push(result);
      } catch (error) {
        // If POC.run() throws, wrap it in a POCResult
        results.push({
          success: false,
          error: {
            code: 'POC_RUNNER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            duration: 0,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
    
    return results;
  }

  /**
   * Print summary of POC results
   * @param results - Array of POC results
   */
  static printSummary(results: POCResult<any>[]): void {
    const totalPOCs = results.length;
    const successfulPOCs = results.filter(r => r.success).length;
    const failedPOCs = totalPOCs - successfulPOCs;
    const totalDuration = results.reduce((sum, r) => sum + r.meta.duration, 0);

    console.log('\n=== POC Execution Summary ===');
    console.log(`Total POCs: ${totalPOCs}`);
    console.log(`Successful: ${successfulPOCs}`);
    console.log(`Failed: ${failedPOCs}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Average Duration: ${Math.round(totalDuration / totalPOCs)}ms`);
    console.log('============================\n');

    // Print details for failed POCs
    if (failedPOCs > 0) {
      console.log('Failed POCs:');
      results.forEach((result, index) => {
        if (!result.success) {
          console.log(`  ${index + 1}. ${result.error?.code}: ${result.error?.message}`);
        }
      });
      console.log('');
    }
  }
}
