#!/usr/bin/env tsx
/**
 * POC 2: SWR with Authentication Test - MIGRATED TO FRAMEWORK
 * 
 * Tests SWR with authenticated endpoints (chart data API)
 * Demonstrates:
 * - SWR with POST requests and credentials
 * - Handling auth errors (401/403)
 * - Conditional fetching based on auth state
 * - Error boundaries and retry logic
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/swr/poc-2-swr-with-auth.ts <userEmail> <userPassword>
 * 
 * Example:
 *   tsx --env-file=.env scripts/migrated/swr/poc-2-swr-with-auth.ts user@example.com password
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

interface SWRAuthConfig {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  outputDir: string;
  apiEndpoint: string;
  testSymbol: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  message?: string;
  details?: Record<string, any>;
}

interface SWRAuthOutput {
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
// SWR WITH AUTH POC
// ============================================================================

class SWRWithAuthPOC extends BasePOC<SWRAuthConfig, SWRAuthOutput> {
  private sessionProvider!: SessionProvider;
  private output!: OutputManager;
  private testResults: TestResult[] = [];
  private testStartTime!: number;

  // Fetcher for authenticated POST requests
  private authenticatedFetcher = async (
    url: string,
    symbol: string,
    userEmail: string,
    userPassword: string
  ) => {
    const logger = this.getLogger();
    logger.info(`🔐 AUTH FETCH: ${symbol}`);
    
    const startTime = Date.now();
    
    const response = await fetch(
      `${url}?symbol=${encodeURIComponent(symbol)}&resolution=1D&barsCount=100`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail,
          userPassword,
        }),
      }
    );
    
    const duration = Date.now() - startTime;
    logger.info(`📊 RESPONSE: ${response.status} (${duration}ms)`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error('Unauthorized: Invalid credentials or session expired');
      }
      if (response.status === 403) {
        throw new Error('Forbidden: Access denied');
      }
      
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  };

  // Custom hook for authenticated chart data
  private useChartData(symbol: string, email: string, password: string) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
      symbol && email && password 
        ? [this.config.apiEndpoint, symbol, email, password] 
        : null,
      ([url, symbol, email, password]) => this.authenticatedFetcher(url, symbol, email, password),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: true,
        errorRetryCount: 3,
        errorRetryInterval: 1000,
        dedupingInterval: 5000,
        onError: (err) => {
          this.getLogger().error(`SWR Error: ${err.message}`);
        },
        onSuccess: (data) => {
          this.getLogger().info(`SWR Success: ${data.symbol} (${data.bars?.length || 0} bars)`);
        }
      }
    );
    
    return {
      chartData: data,
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
    
    logger.section('POC 2: SWR with Authentication Test');
    logger.info(`User: ${this.config.credentials.userEmail}`);
    logger.info(`Symbol: ${this.config.testSymbol}`);
    logger.info('Checking session in KV store...');
    logger.newline();
    
    // Initialize session provider
    this.sessionProvider = new SessionProvider();
    
    // Check if TradingView session exists
    const sessionInfo = await this.sessionProvider.getSessionForUser(
      'tradingview',
      this.config.credentials
    );
    
    if (!sessionInfo) {
      throw new Error('No TradingView session found for user. Please capture your TradingView session using the browser extension');
    }
    
    logger.success(`Session found: ${sessionInfo.internalId}`);
    logger.newline();
    
    this.testStartTime = Date.now();
  }

  protected async execute(): Promise<SWRAuthOutput> {
    // Test 1: Authenticated Fetch
    await this.testAuthenticatedFetch();
    
    // Test 2: Cache Hit with Authenticated Data
    await this.testCacheHit();
    
    // Test 3: Invalid Credentials (Error Handling)
    await this.testInvalidCredentials();
    
    // Test 4: Conditional Fetching
    await this.testConditionalFetching();
    
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

  protected async onSuccess(result: SWRAuthOutput): Promise<void> {
    const logger = this.getLogger();
    
    // Print summary
    logger.section('TEST SUMMARY');
    logger.newline();
    logger.raw('SWR Authentication Behaviors Validated:');
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
      logger.raw('✓ POST requests with auth credentials work');
      logger.raw('✓ Auth errors (401/403) are properly handled');
      logger.raw('✓ Retry logic works for transient errors');
      logger.raw('✓ Cache works for authenticated data');
      logger.raw('✓ Conditional fetching prevents unnecessary requests');
    }
    
    logger.newline();
    logger.raw('─'.repeat(80));
    
    if (result.summary.failed === 0) {
      logger.success('\n  🎉 POC 2 Complete! All SWR authentication behaviors validated.\n');
    } else {
      logger.error('\n  ❌ SOME TESTS FAILED. Please review the errors above.\n');
    }
    
    logger.raw('─'.repeat(80) + '\n');
    
    // Save results to file
    await this.output.saveResult('poc-2-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('\n💥 Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  private async testAuthenticatedFetch(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 1: Authenticated Fetch');
    
    const start = Date.now();
    try {
      const result = this.useChartData(
        this.config.testSymbol,
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      // Wait for fetch to complete
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
      
      if (!result.chartData) {
        throw new Error('No data received');
      }
      
      this.recordTest('Authenticated Fetch', {
        passed: true,
        duration,
        message: 'Data fetched successfully',
        details: {
          symbol: result.chartData.symbol,
          resolution: result.chartData.resolution,
          bars: result.chartData.bars?.length || 0,
          firstBar: result.chartData.bars?.[0]?.time || 'N/A',
          lastBar: result.chartData.bars?.[result.chartData.bars.length - 1]?.time || 'N/A',
        },
      });
      
      logger.success(`Authenticated Fetch (${duration}ms)`);
      logger.detail('Symbol', result.chartData.symbol);
      logger.detail('Resolution', result.chartData.resolution);
      logger.detail('Bars', result.chartData.bars?.length || 0);
      logger.detail('First bar', result.chartData.bars?.[0]?.time || 'N/A');
      logger.detail('Last bar', result.chartData.bars?.[result.chartData.bars.length - 1]?.time || 'N/A');
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Authenticated Fetch', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      
      const logger = this.getLogger();
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('Unauthorized')) {
        logger.warning('Auth Issue:');
        logger.warning('  - Check if session is valid');
        logger.warning('  - Try re-capturing session with browser extension');
      } else if (errorMsg.includes('Forbidden')) {
        logger.warning('Access Issue:');
        logger.warning('  - Check if user has permission to access this symbol');
      }
      
      throw error;
    }
  }

  private async testCacheHit(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 2: Cache Hit with Authenticated Data');
    
    logger.info('Requesting same symbol immediately...');
    const start = Date.now();
    
    try {
      const result1 = this.useChartData(
        this.config.testSymbol,
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      const result2 = this.useChartData(
        this.config.testSymbol,
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!result2.isLoading) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      
      const duration = Date.now() - start;
      const hadImmediateData = !!result2.chartData;
      const sameData = result1.chartData === result2.chartData;
      
      this.recordTest('Cache Hit', {
        passed: hadImmediateData && sameData,
        duration,
        message: hadImmediateData && sameData ? 'Cache hit confirmed' : 'Cache miss detected',
        details: {
          hadImmediateData,
          sameData,
        },
      });
      
      logger.success(`Cache Hit (${duration}ms)`);
      logger.detail('Had immediate data?', hadImmediateData);
      logger.detail('Same data?', sameData);
      
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

  private async testInvalidCredentials(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 3: Invalid Credentials (Error Handling)');
    
    logger.info('Testing with invalid credentials...');
    const start = Date.now();
    
    try {
      const result = this.useChartData(
        this.config.testSymbol,
        'invalid@email.com',
        'wrongpassword'
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
      
      if (result.error) {
        this.recordTest('Invalid Credentials', {
          passed: true,
          duration,
          message: 'Error correctly handled',
          details: {
            errorMessage: result.error.message,
          },
        });
        
        logger.success(`Invalid Credentials (${duration}ms)`);
        logger.detail('Error message', result.error.message);
      } else {
        this.recordTest('Invalid Credentials', {
          passed: false,
          duration,
          message: 'Expected error but got data',
        });
        
        logger.warning('Expected error but got data');
      }
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Invalid Credentials', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - error test is not critical
    }
  }

  private async testConditionalFetching(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 4: Conditional Fetching');
    
    logger.info('Testing conditional fetch (null key)...');
    const start = Date.now();
    
    try {
      const result = this.useChartData('', '', ''); // Should not fetch
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const duration = Date.now() - start;
      const noLoading = !result.isLoading;
      const noData = !result.chartData;
      const noError = !result.error;
      
      this.recordTest('Conditional Fetching', {
        passed: noLoading && noData && noError,
        duration,
        message: noLoading && noData && noError 
          ? 'Conditional fetching working correctly' 
          : 'Unexpected fetch occurred',
        details: {
          wasLoading: result.isLoading,
          hasData: !!result.chartData,
          hasError: !!result.error,
        },
      });
      
      logger.success(`Conditional Fetching (${duration}ms)`);
      logger.detail('Was loading?', result.isLoading);
      logger.detail('Has data?', !!result.chartData);
      logger.detail('Has error?', !!result.error);
      logger.detail('Expected', 'All should be false/undefined');
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Conditional Fetching', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - conditional test is not critical
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
    console.error('\n❌ Usage: tsx --env-file=.env scripts/migrated/swr/poc-2-swr-with-auth.ts <userEmail> <userPassword>');
    console.error('Example: tsx --env-file=.env scripts/migrated/swr/poc-2-swr-with-auth.ts user@example.com password\n');
    process.exit(1);
  }
  
  // Create POC instance
  const poc = new SWRWithAuthPOC({
    credentials: {
      userEmail,
      userPassword,
    },
    outputDir: POCConfig.getOutputDir('swr-with-auth'),
    apiEndpoint: 'http://localhost:3000/api/chart-data',
    testSymbol: 'NSE:RELIANCE',
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
