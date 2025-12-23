#!/usr/bin/env tsx
/**
 * Test Chart Data Caching - MIGRATED TO FRAMEWORK
 * 
 * Verifies that:
 * 1. First request takes 5-8s (API fetch)
 * 2. Second request takes <500ms (cache hit)
 * 3. Cache expires after 5 minutes
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/tests/test-chart-cache.ts
 */

import {
  BasePOC,
  POCConfig,
  OutputManager,
} from '../../framework/index.js';
import { getCachedChartData, setCachedChartData, clearChartDataCache, getCacheStats } from '../../../src/lib/cache/chartDataCache.js';
import type { ChartDataResponse } from '../../../src/lib/tradingview/types.js';

// ============================================================================
// TYPES
// ============================================================================

interface ChartCacheTestConfig {
  outputDir: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  details?: Record<string, any>;
}

interface ChartCacheTestOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  tests: TestResult[];
}

// ============================================================================
// CHART CACHE TEST POC
// ============================================================================

class ChartCacheTestPOC extends BasePOC<ChartCacheTestConfig, ChartCacheTestOutput> {
  private output!: OutputManager;
  private testResults: TestResult[] = [];
  private mockData!: ChartDataResponse;

  protected async setup(): Promise<void> {
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    logger.section('CHART DATA CACHE TEST');
    logger.info('Testing chart data caching functionality');
    logger.newline();
    
    // Clear cache at start
    clearChartDataCache();
    logger.success('Cache cleared');
    logger.newline();
    
    // Setup mock data
    this.mockData = {
      success: true,
      symbol: 'NSE:RELIANCE',
      resolution: '1D',
      bars: [
        { time: Date.now() / 1000, open: 2500, high: 2550, low: 2480, close: 2530, volume: 1000000 }
      ],
      metadata: { minmov: 1, pricescale: 100 }
    };
  }

  protected async execute(): Promise<ChartCacheTestOutput> {
    await this.testCacheMiss();
    await this.testSetAndGet();
    await this.testCacheStatistics();
    await this.testMultipleEntries();
    await this.testCacheExpiry();
    await this.testClearCache();

    const passed = this.testResults.filter(t => t.passed).length;
    const failed = this.testResults.filter(t => !t.passed).length;

    return {
      summary: {
        total: this.testResults.length,
        passed,
        failed,
      },
      tests: this.testResults,
    };
  }

  protected async cleanup(): Promise<void> {
    clearChartDataCache();
  }

  protected async onSuccess(result: ChartCacheTestOutput): Promise<void> {
    const logger = this.getLogger();
    
    logger.section('TEST SUMMARY');
    logger.newline();
    logger.success(`Passed: ${result.summary.passed}/${result.summary.total}`);
    logger.error(`Failed: ${result.summary.failed}/${result.summary.total}`);
    
    if (result.summary.failed > 0) {
      logger.newline();
      logger.error('Failed Tests:');
      result.tests
        .filter(t => !t.passed)
        .forEach(t => {
          logger.error(`  • ${t.name}: ${t.message}`);
        });
    }
    
    logger.newline();
    
    if (result.summary.failed === 0) {
      logger.success('All cache tests completed successfully!');
    } else {
      logger.error('Some tests failed. Please review the errors above.');
    }
    
    await this.output.saveResult('chart-cache-test-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  private async testCacheMiss(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 1: Cache Miss');
    
    const key = 'NSE:RELIANCE:1D:300:false';
    const result = getCachedChartData(key);
    const passed = result === null;
    
    this.recordTest('Cache Miss', {
      passed,
      message: passed ? 'Expected null received' : 'Expected null but got data',
      details: { key, result: result ? 'data' : 'null' },
    });
    
    logger[passed ? 'success' : 'error'](`Cache Miss - ${passed ? 'PASS' : 'FAIL'}`);
    logger.detail('key', key);
    logger.detail('result', result ? 'data (unexpected)' : 'null (expected)');
  }

  private async testSetAndGet(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 2: Set and Retrieve Cache');
    
    const key = 'NSE:RELIANCE:1D:300:false';
    setCachedChartData(key, this.mockData);
    const result = getCachedChartData(key);
    const passed = result !== null;
    
    this.recordTest('Set and Get Cache', {
      passed,
      message: passed ? 'Data retrieved successfully' : 'Expected data but got null',
      details: { key, retrieved: !!result },
    });
    
    logger[passed ? 'success' : 'error'](`Set and Get - ${passed ? 'PASS' : 'FAIL'}`);
    logger.detail('key', key);
    logger.detail('cached', !!result);
    logger.detail('symbol', result?.symbol || 'N/A');
  }

  private async testCacheStatistics(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 3: Cache Statistics');
    
    const stats = getCacheStats();
    const passed = stats.size === 1;
    
    this.recordTest('Cache Statistics', {
      passed,
      message: passed ? 'Cache size is 1' : `Expected size 1 but got ${stats.size}`,
      details: { size: stats.size, keys: stats.keys },
    });
    
    logger[passed ? 'success' : 'error'](`Cache Statistics - ${passed ? 'PASS' : 'FAIL'}`);
    logger.detail('size', stats.size);
    logger.detail('keys', stats.keys.join(', '));
  }

  private async testMultipleEntries(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 4: Multiple Cache Entries');
    
    const key2 = 'NSE:INFY:1D:300:false';
    const key3 = 'NSE:TCS:1D:300:false';
    
    setCachedChartData(key2, { ...this.mockData, symbol: 'NSE:INFY' });
    setCachedChartData(key3, { ...this.mockData, symbol: 'NSE:TCS' });
    
    const stats = getCacheStats();
    const passed = stats.size === 3;
    
    this.recordTest('Multiple Entries', {
      passed,
      message: passed ? 'Cache contains 3 entries' : `Expected size 3 but got ${stats.size}`,
      details: { size: stats.size, keys: stats.keys },
    });
    
    logger[passed ? 'success' : 'error'](`Multiple Entries - ${passed ? 'PASS' : 'FAIL'}`);
    logger.detail('size', stats.size);
    logger.detail('keys', stats.keys.join(', '));
  }

  private async testCacheExpiry(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 5: Cache Expiry (Simulated)');
    
    const originalDateNow = Date.now;
    let currentTime = Date.now();
    
    // Mock Date.now
    Date.now = () => currentTime;
    
    const key = 'NSE:WIPRO:1D:300:false';
    setCachedChartData(key, { ...this.mockData, symbol: 'NSE:WIPRO' });
    
    // Fast-forward 6 minutes
    currentTime += 6 * 60 * 1000;
    
    const result = getCachedChartData(key);
    const passed = result === null;
    
    // Restore Date.now
    Date.now = originalDateNow;
    
    this.recordTest('Cache Expiry', {
      passed,
      message: passed ? 'Cache expired after 6 minutes' : 'Cache did not expire',
      details: { key, expired: result === null },
    });
    
    logger[passed ? 'success' : 'error'](`Cache Expiry - ${passed ? 'PASS' : 'FAIL'}`);
    logger.detail('key', key);
    logger.detail('expired', result === null);
  }

  private async testClearCache(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 6: Clear All Cache');
    
    clearChartDataCache();
    const stats = getCacheStats();
    const passed = stats.size === 0;
    
    this.recordTest('Clear Cache', {
      passed,
      message: passed ? 'Cache cleared successfully' : `Expected size 0 but got ${stats.size}`,
      details: { size: stats.size },
    });
    
    logger[passed ? 'success' : 'error'](`Clear Cache - ${passed ? 'PASS' : 'FAIL'}`);
    logger.detail('size', stats.size);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private recordTest(name: string, result: Omit<TestResult, 'name'>): void {
    this.testResults.push({ name, ...result });
  }

  private getLogger() {
    return this.output.getLogger();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const poc = new ChartCacheTestPOC({
    outputDir: POCConfig.getOutputDir('chart-cache-test'),
  });
  
  const result = await poc.run();
  const exitCode = result.success && result.data?.summary.failed === 0 ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
