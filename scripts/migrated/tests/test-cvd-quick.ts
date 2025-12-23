#!/usr/bin/env tsx
/**
 * Quick CVD Test - MIGRATED TO FRAMEWORK
 * 
 * Tests CVD config fetching from KV store.
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/tests/test-cvd-quick.ts
 */

import {
  BasePOC,
  POCConfig,
  OutputManager,
} from '../../framework/index.js';
import { kv } from '@vercel/kv';

// ============================================================================
// TYPES
// ============================================================================

interface CVDQuickTestConfig {
  outputDir: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  details?: Record<string, any>;
}

interface CVDQuickTestOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  tests: TestResult[];
}

// ============================================================================
// CVD QUICK TEST POC
// ============================================================================

class CVDQuickTestPOC extends BasePOC<CVDQuickTestConfig, CVDQuickTestOutput> {
  private output!: OutputManager;
  private testResults: TestResult[] = [];

  protected async setup(): Promise<void> {
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    logger.section('QUICK CVD CONFIG TEST');
    logger.info('Testing CVD config fetching from KV store');
    logger.newline();
  }

  protected async execute(): Promise<CVDQuickTestOutput> {
    await this.testKVConnection();
    await this.testCVDConfigInKV();
    await this.testTradingViewSessions();

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
    // No cleanup needed for this test
  }

  protected async onSuccess(result: CVDQuickTestOutput): Promise<void> {
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
      logger.success('All tests passed! Quick CVD test complete.');
    } else {
      logger.error('Some tests failed. Please review the errors above.');
    }
    
    await this.output.saveResult('cvd-quick-test-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  private async testKVConnection(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 1: KV Connection');
    
    try {
      const testKey = 'test:cvd:' + Date.now();
      await kv.set(testKey, 'test', { ex: 10 });
      const testVal = await kv.get(testKey);
      const success = testVal === 'test';
      await kv.del(testKey);
      
      this.recordTest('KV Connection', {
        passed: success,
        message: success ? 'KV connection working' : 'KV connection test failed',
        details: { testValue: testVal },
      });
      
      logger.success('KV Connection');
      logger.detail('status', success ? 'working' : 'failed');
      
    } catch (error) {
      this.recordTest('KV Connection', {
        passed: false,
        message: error instanceof Error ? error.message : String(error),
      });
      logger.error('KV Connection failed');
      logger.detail('error', error instanceof Error ? error.message : String(error));
    }
  }

  private async testCVDConfigInKV(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 2: CVD Config in KV Cache');
    
    try {
      const cvdConfig = await kv.get('tradingview:cvd:config');
      const exists = !!cvdConfig;
      
      this.recordTest('CVD Config in KV', {
        passed: true, // Test passes whether config exists or not
        message: exists 
          ? 'CVD config found in KV cache'
          : 'No CVD config in KV cache (will be fetched on first request)',
        details: {
          exists,
          configPreview: cvdConfig 
            ? JSON.stringify(cvdConfig).substring(0, 200) + '...'
            : null,
        },
      });
      
      if (exists) {
        logger.success('CVD Config in KV');
        logger.detail('status', 'found in cache');
        logger.detail('preview', JSON.stringify(cvdConfig).substring(0, 100) + '...');
      } else {
        logger.warning('CVD Config in KV');
        logger.detail('status', 'not cached (will be fetched on first request)');
      }
      
    } catch (error) {
      this.recordTest('CVD Config in KV', {
        passed: false,
        message: error instanceof Error ? error.message : String(error),
      });
      logger.error('Failed to check CVD config');
      logger.detail('error', error instanceof Error ? error.message : String(error));
    }
  }

  private async testTradingViewSessions(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 3: TradingView Sessions in KV');
    
    try {
      let cursor = 0;
      let sessionCount = 0;
      const sessionKeys: string[] = [];
      
      do {
        const result = await kv.scan(cursor, { match: '*tradingview*', count: 100 });
        cursor = Number(result[0]);
        const keys = result[1] as string[];
        sessionKeys.push(...keys);
        sessionCount += keys.length;
      } while (cursor !== 0);
      
      this.recordTest('TradingView Sessions', {
        passed: true,
        message: `Found ${sessionCount} TradingView-related keys`,
        details: {
          count: sessionCount,
          sampleKeys: sessionKeys.slice(0, 5),
        },
      });
      
      logger.success('TradingView Sessions');
      logger.detail('count', sessionCount);
      if (sessionKeys.length > 0) {
        logger.detail('sampleKeys', sessionKeys.slice(0, 5).join(', '));
      }
      
    } catch (error) {
      this.recordTest('TradingView Sessions', {
        passed: false,
        message: error instanceof Error ? error.message : String(error),
      });
      logger.error('Failed to scan for sessions');
      logger.detail('error', error instanceof Error ? error.message : String(error));
    }
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
  const poc = new CVDQuickTestPOC({
    outputDir: POCConfig.getOutputDir('cvd-quick-test'),
  });
  
  const result = await poc.run();
  const exitCode = result.success && result.data?.summary.failed === 0 ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
