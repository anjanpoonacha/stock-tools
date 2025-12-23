#!/usr/bin/env tsx
/**
 * CVD Integration Test - MIGRATED TO FRAMEWORK
 * 
 * This is a framework-based version of scripts/test-cvd-integration.ts
 * 
 * Tests complete CVD flow:
 * 1. Session Resolution from KV
 * 2. JWT Token Extraction
 * 3. CVD Config Fetching (with cache)
 * 4. Connection Pool with CVD enabled
 * 5. CVD Data Verification
 * 
 * Usage:
 *   tsx scripts/migrated/tests/test-cvd-integration.ts <userEmail> <userPassword>
 * 
 * Example:
 *   tsx --env-file=.env scripts/migrated/tests/test-cvd-integration.ts user@example.com password
 */

import {
  BasePOC,
  POCConfig,
  SessionProvider,
  OutputManager,
  ArgParser,
} from '../../framework/index.js';

// Import TradingView services
import { getDataAccessToken } from '../../../src/lib/tradingview/jwtService.js';
import { getCVDConfig, cvdConfigService } from '../../../src/lib/tradingview/cvdConfigService.js';
import { getConnectionPool } from '../../../src/lib/tradingview/connectionPool.js';

// ============================================================================
// TYPES
// ============================================================================

interface CVDTestConfig {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  outputDir: string;
  testSymbol: string;
  resolution: string;
  barsCount: number;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  message?: string;
  details?: Record<string, any>;
}

interface CVDTestOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
  tests: TestResult[];
  sessionData?: {
    sessionId: string;
    userId: number;
  };
  jwtToken?: string;
  cvdConfig?: {
    source: string;
    pineId: string;
    pineVersion: string;
  };
  chartData?: {
    barsReceived: number;
    cvdDataPoints: number;
    hasCVD: boolean;
  };
}

// ============================================================================
// CVD INTEGRATION TEST POC
// ============================================================================

class CVDIntegrationTestPOC extends BasePOC<CVDTestConfig, CVDTestOutput> {
  private sessionProvider!: SessionProvider;
  private output!: OutputManager;
  private testResults: TestResult[] = [];
  private testStartTime!: number;
  
  // Test data storage
  private sessionId!: string;
  private sessionIdSign?: string;
  private userId!: number;
  private jwtToken!: string;

  protected async setup(): Promise<void> {
    // Initialize output manager FIRST (needed for getLogger())
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    
    logger.section('CVD INTEGRATION TEST SUITE');
    logger.info(`Testing CVD after recent fixes`);
    logger.info(`User: ${this.config.credentials.userEmail}`);
    logger.newline();
    
    // Initialize session provider
    this.sessionProvider = new SessionProvider();
    
    this.testStartTime = Date.now();
  }

  protected async execute(): Promise<CVDTestOutput> {
    // Test 1: Session Resolution
    await this.testSessionResolution();
    
    // Test 2: JWT Token Extraction
    await this.testJWTExtraction();
    
    // Test 3: CVD Config Fetching
    await this.testCVDConfig();
    
    // Test 4: Connection Pool with CVD
    await this.testConnectionPoolWithCVD();
    
    // Test 5: Pool Statistics
    await this.testPoolStatistics();
    
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
      sessionData: {
        sessionId: this.sessionId?.substring(0, 10) + '...',
        userId: this.userId,
      },
      jwtToken: this.jwtToken?.substring(0, 20) + '...',
      cvdConfig: this.testResults.find(t => t.name === 'CVD Config Fetch (First)')?.details as any,
      chartData: this.testResults.find(t => t.name === 'Connection Pool Fetch')?.details as any,
    };
  }

  protected async cleanup(): Promise<void> {
    this.sessionProvider.clearCache();
  }

  protected async onSuccess(result: CVDTestOutput): Promise<void> {
    const logger = this.getLogger();
    
    // Print summary
    logger.section('TEST SUMMARY');
    logger.newline();
    logger.raw('Results:');
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
    }
    
    logger.newline();
    logger.raw('─'.repeat(80));
    
    if (result.summary.failed === 0) {
      logger.success('\n  🎉 ALL TESTS PASSED! CVD integration is working correctly.\n');
    } else {
      logger.error('\n  ❌ SOME TESTS FAILED. Please review the errors above.\n');
    }
    
    logger.raw('─'.repeat(80) + '\n');
    
    // Save results to file
    await this.output.saveResult('cvd-integration-test-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('\n💥 Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  private async testSessionResolution(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 1: Session Resolution from KV');
    
    const start = Date.now();
    try {
      const sessionInfo = await this.sessionProvider.getSessionForUser(
        'tradingview',
        this.config.credentials
      );
      
      if (!sessionInfo) {
        throw new Error('No TradingView session found for this user');
      }
      
      const tvSession = this.sessionProvider.extractTVSession(sessionInfo);
      this.sessionId = tvSession.sessionId;
      this.sessionIdSign = tvSession.sessionIdSign;
      this.userId = tvSession.userId;
      
      const duration = Date.now() - start;
      
      this.recordTest('Session Resolution', {
        passed: true,
        duration,
        message: 'Session retrieved from KV',
        details: {
          sessionId: this.sessionId.substring(0, 10) + '...',
          hasSessionIdSign: !!this.sessionIdSign,
          userId: this.userId,
          source: sessionInfo.sessionData.source || 'unknown',
        },
      });
      
      logger.success(`Session Resolution (${duration}ms)`);
      logger.detail('sessionId', this.sessionId.substring(0, 10) + '...');
      logger.detail('hasSessionIdSign', !!this.sessionIdSign);
      logger.detail('userId', this.userId);
      logger.detail('source', sessionInfo.sessionData.source || 'unknown');
      
      if (!this.sessionIdSign) {
        logger.warning('sessionid_sign is missing - CVD may not work correctly');
      }
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Session Resolution', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async testJWTExtraction(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 2: JWT Token Extraction');
    
    const start = Date.now();
    try {
      const token = await getDataAccessToken(
        this.sessionId,
        this.sessionIdSign || '',
        this.userId
      );
      
      if (!token || token.length < 100) {
        throw new Error('Invalid JWT token received');
      }
      
      this.jwtToken = token;
      const duration = Date.now() - start;
      
      this.recordTest('JWT Token Extraction', {
        passed: true,
        duration,
        message: 'JWT token extracted successfully',
        details: {
          tokenLength: token.length,
          tokenStart: token.substring(0, 20) + '...',
        },
      });
      
      logger.success(`JWT Token Extraction (${duration}ms)`);
      logger.detail('tokenLength', token.length);
      logger.detail('tokenStart', token.substring(0, 20) + '...');
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('JWT Token Extraction', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async testCVDConfig(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 3: CVD Config Fetching');
    
    // Check cache status before
    logger.info('Checking initial cache status...');
    const cacheStatusBefore = await cvdConfigService.getCacheStatus();
    logger.detail('Cache status before', cacheStatusBefore.cached ? 'CACHED' : 'EMPTY');
    
    if (cacheStatusBefore.cached && cacheStatusBefore.ttl) {
      const hoursRemaining = Math.round(cacheStatusBefore.ttl / 3600);
      logger.detail('Cache TTL remaining', `${cacheStatusBefore.ttl}s (~${hoursRemaining} hours)`);
    }
    
    // Test first fetch
    const start1 = Date.now();
    try {
      const config1 = await getCVDConfig(this.sessionId, this.sessionIdSign);
      const duration1 = Date.now() - start1;
      
      this.recordTest('CVD Config Fetch (First)', {
        passed: true,
        duration: duration1,
        message: 'CVD config fetched successfully',
        details: {
          source: config1.source,
          pineId: config1.pineId,
          pineVersion: config1.pineVersion,
          encryptedTextLength: config1.text.length,
          textStartsWith: config1.text.substring(0, 20) + '...',
          fetchedAt: config1.fetchedAt?.toISOString() || 'N/A',
        },
      });
      
      logger.success(`CVD Config Fetch (First) (${duration1}ms)`);
      logger.detail('source', config1.source);
      logger.detail('pineId', config1.pineId);
      logger.detail('pineVersion', config1.pineVersion);
      logger.detail('encryptedTextLength', config1.text.length);
      logger.detail('textStartsWith', config1.text.substring(0, 20) + '...');
      logger.detail('fetchedAt', config1.fetchedAt?.toISOString() || 'N/A');
      
      // Validate config
      if (!config1.text || config1.text.length < 1000) {
        logger.warning('Encrypted text seems too short');
      }
      
    } catch (error) {
      const duration1 = Date.now() - start1;
      this.recordTest('CVD Config Fetch (First)', {
        passed: false,
        duration: duration1,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    
    // Test cache hit
    logger.info('Testing cache hit...');
    const start2 = Date.now();
    try {
      const config2 = await getCVDConfig(this.sessionId, this.sessionIdSign);
      const duration2 = Date.now() - start2;
      const isCacheHit = config2.source === 'kv-cache';
      
      this.recordTest('CVD Config Fetch (Cached)', {
        passed: isCacheHit,
        duration: duration2,
        message: isCacheHit ? 'Cache hit confirmed' : `Expected cache hit but got: ${config2.source}`,
        details: {
          source: config2.source,
          textLength: config2.text.length,
        },
      });
      
      if (isCacheHit) {
        logger.success(`CVD Config Fetch (Cached) (${duration2}ms)`);
      } else {
        logger.error(`CVD Config Fetch (Cached): Expected cache hit but got: ${config2.source}`);
      }
      logger.detail('source', config2.source);
      logger.detail('textLength', config2.text.length);
      
      if (!isCacheHit) {
        logger.warning('Cache is not working correctly - may impact performance');
      }
      
    } catch (error) {
      const duration2 = Date.now() - start2;
      this.recordTest('CVD Config Fetch (Cached)', {
        passed: false,
        duration: duration2,
        message: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cache test is not critical
    }
    
    // Check cache status after
    const cacheStatusAfter = await cvdConfigService.getCacheStatus();
    logger.detail('Cache status after', cacheStatusAfter.cached ? 'CACHED' : 'EMPTY');
    if (cacheStatusAfter.cached && cacheStatusAfter.config) {
      logger.detail('Cached Pine version', cacheStatusAfter.config.pineVersion);
    }
  }

  private async testConnectionPoolWithCVD(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 4: Connection Pool with CVD Enabled');
    
    const pool = getConnectionPool();
    const start = Date.now();
    
    try {
      logger.info(`Fetching ${this.config.testSymbol} with CVD enabled...`);
      
      const result = await pool.fetchChartData(
        this.jwtToken,
        this.config.testSymbol,
        this.config.resolution,
        this.config.barsCount,
        {
          cvdEnabled: true,
          cvdAnchorPeriod: '3M',
          cvdTimeframe: undefined,
          sessionId: this.sessionId,
          sessionIdSign: this.sessionIdSign,
        }
      );
      
      const duration = Date.now() - start;
      
      if (!result.bars || result.bars.length === 0) {
        throw new Error('No bars returned from connection pool');
      }
      
      const hasCVD = !!result.indicators?.cvd;
      const cvdDataCount = result.indicators?.cvd?.values?.length || 0;
      
      this.recordTest('Connection Pool Fetch', {
        passed: true,
        duration,
        message: 'Chart data fetched successfully',
        details: {
          symbol: this.config.testSymbol,
          barsReceived: result.bars.length,
          hasCVD,
          cvdDataPoints: cvdDataCount,
          firstBarTime: new Date(result.bars[0].time * 1000).toISOString(),
          lastBarTime: new Date(result.bars[result.bars.length - 1].time * 1000).toISOString(),
        },
      });
      
      logger.success(`Connection Pool Fetch (${duration}ms)`);
      logger.detail('symbol', this.config.testSymbol);
      logger.detail('barsReceived', result.bars.length);
      logger.detail('hasCVD', hasCVD);
      logger.detail('cvdDataPoints', cvdDataCount);
      logger.detail('firstBarTime', new Date(result.bars[0].time * 1000).toISOString());
      logger.detail('lastBarTime', new Date(result.bars[result.bars.length - 1].time * 1000).toISOString());
      
      // Validate CVD data
      if (!hasCVD) {
        this.recordTest('CVD Data Verification', {
          passed: false,
          duration: 0,
          message: 'CVD indicator data not found in response',
        });
        logger.warning('CVD was requested but not returned');
      } else {
        this.recordTest('CVD Data Verification', {
          passed: true,
          duration: 0,
          message: 'CVD indicator data present',
          details: {
            dataPoints: cvdDataCount,
            studyId: result.indicators?.cvd?.studyId || 'unknown',
            studyName: result.indicators?.cvd?.studyName || 'unknown',
            hasData: cvdDataCount > 0,
          },
        });
        
        logger.success('CVD Data Verification');
        logger.detail('dataPoints', cvdDataCount);
        logger.detail('studyId', result.indicators?.cvd?.studyId || 'unknown');
        logger.detail('studyName', result.indicators?.cvd?.studyName || 'unknown');
        logger.detail('hasData', cvdDataCount > 0);
        
        // Show sample CVD values
        if (result.indicators?.cvd?.values && result.indicators.cvd.values.length > 0) {
          logger.info('Sample CVD values (first 5):');
          const sampleSize = Math.min(5, result.indicators.cvd.values.length);
          for (let i = 0; i < sampleSize; i++) {
            const dataPoint = result.indicators.cvd.values[i];
            logger.detail(`  [${i}]`, JSON.stringify(dataPoint));
          }
        }
      }
      
      // Show metadata if available
      if (result.metadata) {
        logger.detail('Symbol metadata', JSON.stringify(result.metadata, null, 2));
      }
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Connection Pool Fetch', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async testPoolStatistics(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 5: Connection Pool Statistics');
    
    const pool = getConnectionPool();
    const stats = pool.getStats();
    
    logger.detail('Max Connections', stats.maxConnections);
    logger.detail('Requests Per Connection', stats.requestsPerConnection);
    logger.detail('Persistent Mode', stats.persistentMode ? 'ENABLED' : 'DISABLED');
    logger.detail('Persistent Connections', stats.persistentConnections);
    
    this.recordTest('Pool Statistics', {
      passed: true,
      duration: 0,
      message: 'Pool statistics retrieved',
      details: stats,
    });
    
    logger.success('Pool Statistics');
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
    console.error('\n❌ Usage: tsx scripts/migrated/tests/test-cvd-integration.ts <userEmail> <userPassword>');
    console.error('Example: tsx scripts/migrated/tests/test-cvd-integration.ts user@example.com password\n');
    process.exit(1);
  }
  
  // Create POC instance
  const poc = new CVDIntegrationTestPOC({
    credentials: {
      userEmail,
      userPassword,
    },
    outputDir: POCConfig.getOutputDir('cvd-integration-test'),
    testSymbol: 'NSE:RELIANCE',
    resolution: '1D',
    barsCount: 100,
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
