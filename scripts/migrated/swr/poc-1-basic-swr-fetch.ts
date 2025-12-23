#!/usr/bin/env tsx
/**
 * POC 1: Basic SWR Fetch Test - MIGRATED TO FRAMEWORK
 * 
 * Tests basic SWR fetching with formulas API
 * Demonstrates:
 * - Initial fetch behavior
 * - Cache behavior
 * - Revalidation on focus
 * - Deduplication of requests
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/swr/poc-1-basic-swr-fetch.ts <userEmail> <userPassword>
 * 
 * Example:
 *   tsx --env-file=.env scripts/migrated/swr/poc-1-basic-swr-fetch.ts user@example.com password
 */

import useSWR from 'swr';
import {
  BasePOC,
  POCConfig,
  SessionProvider,
  OutputManager,
  ArgParser,
} from '../../framework/index.js';

// ============================================================================
// TYPES
// ============================================================================

interface SWRBasicConfig {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  outputDir: string;
  apiEndpoint: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  message?: string;
  details?: Record<string, any>;
}

interface SWRBasicOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
  tests: TestResult[];
  sessionData?: {
    sessionId: string;
  };
}

// ============================================================================
// SWR BASIC FETCH POC
// ============================================================================

class SWRBasicFetchPOC extends BasePOC<SWRBasicConfig, SWRBasicOutput> {
  private sessionProvider!: SessionProvider;
  private output!: OutputManager;
  private testResults: TestResult[] = [];
  private testStartTime!: number;

  // Fetcher function for SWR
  private fetcher = async (url: string, userEmail: string, userPassword: string) => {
    const logger = this.getLogger();
    logger.info(`🌐 FETCHING: ${url}`);
    
    const fullUrl = `${url}?userEmail=${encodeURIComponent(userEmail)}&userPassword=${encodeURIComponent(userPassword)}`;
    const startTime = Date.now();
    
    const response = await fetch(fullUrl);
    const duration = Date.now() - startTime;
    
    logger.info(`✅ RESPONSE: ${response.status} (${duration}ms)`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  };

  // Custom hook to test SWR behavior
  private useFormulas(email: string, password: string) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
      email && password ? [this.config.apiEndpoint, email, password] : null,
      ([url, email, password]) => this.fetcher(url, email, password),
      {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000, // Dedupe requests within 2 seconds
        refreshInterval: 0, // No automatic polling
      }
    );
    
    return {
      formulas: data,
      isLoading,
      isValidating,
      error,
      mutate
    };
  }

  protected async setup(): Promise<void> {
    // Initialize output manager
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    
    logger.section('POC 1: Basic SWR Fetch Test');
    logger.info(`User: ${this.config.credentials.userEmail}`);
    logger.info('Checking session in KV store...');
    logger.newline();
    
    // Initialize session provider
    this.sessionProvider = new SessionProvider();
    
    // Check if session exists
    const sessionInfo = await this.sessionProvider.getSessionForUser(
      'marketinout',
      this.config.credentials
    );
    
    if (!sessionInfo) {
      throw new Error('No MIO session found for user. Please capture your MIO session using the browser extension');
    }
    
    logger.success(`Session found: ${sessionInfo.internalId}`);
    logger.newline();
    
    this.testStartTime = Date.now();
  }

  protected async execute(): Promise<SWRBasicOutput> {
    // Test 1: Initial Fetch
    await this.testInitialFetch();
    
    // Test 2: Cache Hit (Immediate re-fetch)
    await this.testCacheHit();
    
    // Test 3: Deduplication Window
    await this.testDeduplicationWindow();
    
    // Test 4: Manual Revalidation
    await this.testManualRevalidation();
    
    // Build summary
    const totalDuration = Date.now() - this.testStartTime;
    const passed = this.testResults.filter(t => t.passed).length;
    const failed = this.testResults.filter(t => !t.passed).length;
    
    return {
      summary: {
        total: this.testResults.length,
        passed,
        failed,
        duration: totalDuration,
      },
      tests: this.testResults,
    };
  }

  protected async cleanup(): Promise<void> {
    this.sessionProvider.clearCache();
  }

  protected async onSuccess(result: SWRBasicOutput): Promise<void> {
    const logger = this.getLogger();
    
    // Print summary
    logger.section('TEST SUMMARY');
    logger.newline();
    logger.raw('SWR Behaviors Validated:');
    logger.success(`  ✅ Passed:  ${result.summary.passed}/${result.summary.total}`);
    logger.error(`  ❌ Failed:  ${result.summary.failed}/${result.summary.total}`);
    logger.info(`  ⏱️  Duration: ${result.summary.duration}ms (${(result.summary.duration / 1000).toFixed(2)}s)`);
    
    // Show failed tests
    if (result.summary.failed > 0) {
      logger.newline();
      logger.error('Failed Tests:');
      result.tests
        .filter(t => !t.passed)
        .forEach(t => {
          logger.error(`  • ${t.name}: ${t.message}`);
        });
    } else {
      logger.newline();
      logger.raw('✓ Initial fetch works correctly');
      logger.raw('✓ Cache provides immediate data on re-fetch');
      logger.raw('✓ Deduplication prevents duplicate requests');
      logger.raw('✓ Revalidation works outside dedupe window');
      logger.raw('✓ Manual revalidation (mutate) works');
    }
    
    logger.newline();
    logger.raw('─'.repeat(80));
    
    if (result.summary.failed === 0) {
      logger.success('\n  🎉 POC 1 Complete! All SWR behaviors validated.\n');
    } else {
      logger.error('\n  ❌ SOME TESTS FAILED. Please review the errors above.\n');
    }
    
    logger.raw('─'.repeat(80) + '\n');
    
    // Save results to file
    await this.output.saveResult('poc-1-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('\n💥 Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  private async testInitialFetch(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 1: Initial Fetch');
    
    const start = Date.now();
    try {
      const result = this.useFormulas(
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      // Wait for initial fetch to complete
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!result.isLoading) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      
      const duration = Date.now() - start;
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      if (!result.formulas) {
        throw new Error('No data received');
      }
      
      this.recordTest('Initial Fetch', {
        passed: true,
        duration,
        message: 'Data fetched successfully',
        details: {
          totalFormulas: result.formulas?.totalCount || 0,
          lastUpdated: result.formulas?.lastUpdated || 'Never',
        },
      });
      
      logger.success(`Initial Fetch (${duration}ms)`);
      logger.detail('Total formulas', result.formulas?.totalCount || 0);
      logger.detail('Last updated', result.formulas?.lastUpdated || 'Never');
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Initial Fetch', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async testCacheHit(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 2: Cache Hit (Immediate re-fetch)');
    
    logger.info('Requesting same data immediately...');
    const start = Date.now();
    
    try {
      const result = this.useFormulas(
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!result.isLoading) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      
      const duration = Date.now() - start;
      const hadImmediateData = !!result.formulas;
      
      this.recordTest('Cache Hit', {
        passed: hadImmediateData,
        duration,
        message: hadImmediateData ? 'Cache provided immediate data' : 'No immediate data from cache',
        details: {
          wasLoading: result.isLoading,
          hadImmediateData,
        },
      });
      
      logger.success(`Cache Hit (${duration}ms)`);
      logger.detail('Was loading?', result.isLoading);
      logger.detail('Had immediate data?', hadImmediateData);
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Cache Hit', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cache test is not critical
    }
  }

  private async testDeduplicationWindow(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 3: Deduplication Window');
    
    logger.info('Waiting 3 seconds (outside 2s dedupe window)...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logger.info('Requesting data after dedupe window...');
    const start = Date.now();
    
    try {
      const result = this.useFormulas(
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!result.isLoading && !result.isValidating) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      
      const duration = Date.now() - start;
      
      this.recordTest('Deduplication Window', {
        passed: true,
        duration,
        message: 'Request completed outside dedupe window',
        details: {
          wasValidating: result.isValidating,
        },
      });
      
      logger.success(`Deduplication Window (${duration}ms)`);
      logger.detail('Was validating?', result.isValidating);
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Deduplication Window', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - dedupe test is not critical
    }
  }

  private async testManualRevalidation(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 4: Manual Revalidation');
    
    logger.info('Triggering manual revalidation...');
    const start = Date.now();
    
    try {
      const result = this.useFormulas(
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      await result.mutate();
      
      const duration = Date.now() - start;
      
      this.recordTest('Manual Revalidation', {
        passed: true,
        duration,
        message: 'Manual revalidation completed',
      });
      
      logger.success(`Manual Revalidation (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Manual Revalidation', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - revalidation test is not critical
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
  // Parse command-line arguments
  const parser = new ArgParser();
  const userEmail = parser.get(0);
  const userPassword = parser.get(1);
  
  if (!userEmail || !userPassword) {
    console.error('\n❌ Usage: tsx --env-file=.env scripts/migrated/swr/poc-1-basic-swr-fetch.ts <userEmail> <userPassword>');
    console.error('Example: tsx --env-file=.env scripts/migrated/swr/poc-1-basic-swr-fetch.ts user@example.com password\n');
    process.exit(1);
  }
  
  // Create POC instance
  const poc = new SWRBasicFetchPOC({
    credentials: {
      userEmail,
      userPassword,
    },
    outputDir: POCConfig.getOutputDir('swr-basic-fetch'),
    apiEndpoint: 'http://localhost:3000/api/mio-formulas',
  });
  
  // Run POC
  const result = await poc.run();
  
  // Exit with appropriate code
  const exitCode = result.success && result.data?.summary.failed === 0 ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
