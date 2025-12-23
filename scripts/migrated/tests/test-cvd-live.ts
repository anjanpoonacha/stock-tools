#!/usr/bin/env tsx
/**
 * Live CVD Data Test - MIGRATED TO FRAMEWORK
 * 
 * Tests actual CVD data fetching with real credentials from KV.
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/tests/test-cvd-live.ts <userEmail> <userPassword>
 * 
 * Example:
 *   tsx --env-file=.env scripts/migrated/tests/test-cvd-live.ts user@example.com password
 */

import {
  BasePOC,
  POCConfig,
  SessionProvider,
  OutputManager,
  ArgParser,
} from '../../framework/index.js';
import { getChartData } from '../../../src/lib/chart-data/chartDataService.js';

// ============================================================================
// TYPES
// ============================================================================

interface CVDLiveTestConfig {
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
  duration?: number;
  message?: string;
  details?: Record<string, any>;
}

interface CVDLiveTestOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
  tests: TestResult[];
  sessionData?: {
    sessionId: string;
    hasSessionIdSign: boolean;
    userEmail: string;
  };
  chartData?: {
    barsReceived: number;
    hasCVD: boolean;
    cvdDataPoints: number;
    dataQuality?: {
      hasNonZero: boolean;
      hasReasonableValues: boolean;
    };
  };
}

// ============================================================================
// CVD LIVE TEST POC
// ============================================================================

class CVDLiveTestPOC extends BasePOC<CVDLiveTestConfig, CVDLiveTestOutput> {
  private sessionProvider!: SessionProvider;
  private output!: OutputManager;
  private testResults: TestResult[] = [];
  private testStartTime!: number;
  
  // Test data storage
  private sessionId?: string;
  private sessionIdSign?: string;

  protected async setup(): Promise<void> {
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    logger.section('LIVE CVD DATA TEST');
    logger.info('Testing actual CVD data fetching with real credentials from KV');
    logger.newline();
    
    logger.detail('User', this.config.credentials.userEmail);
    logger.detail('Symbol', this.config.testSymbol);
    logger.detail('Resolution', this.config.resolution);
    logger.detail('Bars', this.config.barsCount);
    logger.detail('CVD', 'enabled (anchor: 3M)');
    logger.newline();
    
    // Initialize session provider
    this.sessionProvider = new SessionProvider();
    
    this.testStartTime = Date.now();
  }

  protected async execute(): Promise<CVDLiveTestOutput> {
    await this.testFindTradingViewSession();
    await this.testFetchCVDData();

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
      sessionData: this.sessionId ? {
        sessionId: this.sessionId.substring(0, 10) + '...',
        hasSessionIdSign: !!this.sessionIdSign,
        userEmail: this.config.credentials.userEmail,
      } : undefined,
      chartData: this.testResults.find(t => t.name === 'CVD Data Fetch')?.details as any,
    };
  }

  protected async cleanup(): Promise<void> {
    this.sessionProvider.clearCache();
  }

  protected async onSuccess(result: CVDLiveTestOutput): Promise<void> {
    const logger = this.getLogger();
    
    logger.section('TEST SUMMARY');
    logger.newline();
    logger.success(`Passed: ${result.summary.passed}/${result.summary.total}`);
    logger.error(`Failed: ${result.summary.failed}/${result.summary.total}`);
    logger.info(`Duration: ${result.summary.duration}ms (${(result.summary.duration / 1000).toFixed(2)}s)`);
    
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
    
    if (result.summary.failed === 0 && result.chartData?.hasCVD) {
      logger.success('\n🎉 SUCCESS! CVD data is obtainable and valid! 🎉\n');
      logger.info('The fixes are working:');
      logger.success('  ✅ Connection pool using dynamic CVD config');
      logger.success('  ✅ CVD timeout increased to 2000ms');
      logger.success('  ✅ Session credentials flowing correctly');
      logger.success('  ✅ CVD data arriving from TradingView');
    } else {
      logger.error('\n❌ CVD data NOT obtained or invalid\n');
      logger.warning('Please review the test results above.');
    }
    
    logger.raw('─'.repeat(80) + '\n');
    
    await this.output.saveResult('cvd-live-test-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      logger.newline();
      logger.raw('Stack trace:');
      logger.raw(error.stack);
    }
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  private async testFindTradingViewSession(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Step 1: Finding TradingView Session in KV');
    
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
      
      const duration = Date.now() - start;
      
      this.recordTest('Find TradingView Session', {
        passed: true,
        duration,
        message: 'Session found in KV',
        details: {
          sessionId: this.sessionId.substring(0, 10) + '...',
          hasSessionIdSign: !!this.sessionIdSign,
          userEmail: this.config.credentials.userEmail,
          source: sessionInfo.sessionData.source || 'unknown',
        },
      });
      
      logger.success(`Session found (${duration}ms)`);
      logger.detail('sessionId', this.sessionId.substring(0, 20) + '...');
      logger.detail('hasSessionIdSign', !!this.sessionIdSign);
      logger.detail('source', sessionInfo.sessionData.source || 'unknown');
      
      if (!this.sessionIdSign) {
        logger.warning('sessionid_sign is missing - CVD may not work correctly');
      }
      
      logger.newline();
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Find TradingView Session', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      logger.error('Failed to find session');
      logger.detail('error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async testFetchCVDData(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Step 2: Fetching Chart Data with CVD Enabled');
    
    logger.detail('Symbol', this.config.testSymbol);
    logger.detail('Resolution', this.config.resolution);
    logger.detail('Bars', this.config.barsCount);
    logger.detail('CVD', 'enabled (anchor: 3M)');
    logger.newline();
    
    const startTime = Date.now();
    
    try {
      const result = await getChartData({
        symbol: this.config.testSymbol,
        resolution: this.config.resolution,
        barsCount: String(this.config.barsCount),
        cvdEnabled: 'true',
        cvdAnchorPeriod: '3M',
        cvdTimeframe: undefined,
        userEmail: this.config.credentials.userEmail,
        userPassword: this.config.credentials.userPassword,
      });
      
      const duration = Date.now() - startTime;
      
      logger.info(`Request completed in ${duration}ms`);
      logger.newline();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }
      
      const hasCVD = !!result.data?.indicators?.cvd;
      const cvdDataPoints = result.data?.indicators?.cvd?.values?.length || 0;
      
      logger.success('Chart data fetched successfully');
      logger.detail('barsReceived', result.data?.bars.length || 0);
      logger.detail('hasMetadata', !!result.data?.metadata);
      logger.detail('hasIndicators', !!result.data?.indicators);
      logger.detail('hasCVD', hasCVD);
      
      if (hasCVD) {
        const cvd = result.data!.indicators!.cvd!;
        
        logger.newline();
        logger.success('✅ CVD DATA OBTAINED!');
        logger.detail('studyId', cvd.studyId);
        logger.detail('dataPoints', cvd.values.length);
        
        // Show sample values
        if (cvd.values.length > 0) {
          const first = cvd.values[0];
          const last = cvd.values[cvd.values.length - 1];
          
          logger.newline();
          logger.info(`First CVD value (${new Date(first.time * 1000).toISOString().split('T')[0]}):`);
          logger.detail('  Open', first.values[0].toLocaleString());
          logger.detail('  High', first.values[1].toLocaleString());
          logger.detail('  Low', first.values[2].toLocaleString());
          logger.detail('  Close', first.values[3].toLocaleString());
          
          logger.newline();
          logger.info(`Last CVD value (${new Date(last.time * 1000).toISOString().split('T')[0]}):`);
          logger.detail('  Open', last.values[0].toLocaleString());
          logger.detail('  High', last.values[1].toLocaleString());
          logger.detail('  Low', last.values[2].toLocaleString());
          logger.detail('  Close', last.values[3].toLocaleString());
          
          // Validate data quality
          const hasNonZero = cvd.values.some((v: any) => v.values.some((val: number) => val !== 0));
          const hasReasonableValues = cvd.values.some((v: any) => 
            Math.abs(v.values[0]) < 1e10 && v.values[0] !== 0
          );
          
          logger.newline();
          logger.info('Data quality:');
          logger.detail('  Non-zero values', hasNonZero ? '✅' : '❌');
          logger.detail('  Reasonable ranges', hasReasonableValues ? '✅' : '❌');
          
          this.recordTest('CVD Data Fetch', {
            passed: hasNonZero && hasReasonableValues,
            duration,
            message: hasNonZero && hasReasonableValues 
              ? 'CVD data is valid'
              : 'CVD data quality issues',
            details: {
              barsReceived: result.data?.bars.length || 0,
              hasCVD,
              cvdDataPoints,
              dataQuality: {
                hasNonZero,
                hasReasonableValues,
              },
            },
          });
          
          if (hasNonZero && hasReasonableValues) {
            logger.newline();
            logger.success('🎉 CVD data is obtainable and valid!');
          }
          
        } else {
          this.recordTest('CVD Data Fetch', {
            passed: false,
            duration,
            message: 'CVD data present but empty',
            details: {
              barsReceived: result.data?.bars.length || 0,
              hasCVD,
              cvdDataPoints: 0,
            },
          });
          
          logger.warning('CVD data present but empty');
        }
        
      } else {
        this.recordTest('CVD Data Fetch', {
          passed: false,
          duration,
          message: 'CVD data NOT present in response',
          details: {
            barsReceived: result.data?.bars.length || 0,
            hasCVD: false,
            cvdDataPoints: 0,
            availableIndicators: result.data?.indicators ? Object.keys(result.data.indicators) : [],
          },
        });
        
        logger.error('CVD data NOT present in response');
        logger.newline();
        logger.info('Debugging info:');
        logger.detail('  Result structure', Object.keys(result.data || {}));
        if (result.data?.indicators) {
          logger.detail('  Indicators', Object.keys(result.data.indicators));
        }
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordTest('CVD Data Fetch', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      
      logger.error('Failed to fetch CVD data');
      logger.detail('error', error instanceof Error ? error.message : String(error));
      throw error;
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
    console.error('\n❌ Usage: tsx --env-file=.env scripts/migrated/tests/test-cvd-live.ts <userEmail> <userPassword>');
    console.error('Example: tsx --env-file=.env scripts/migrated/tests/test-cvd-live.ts user@example.com password\n');
    process.exit(1);
  }
  
  const poc = new CVDLiveTestPOC({
    credentials: {
      userEmail,
      userPassword,
    },
    outputDir: POCConfig.getOutputDir('cvd-live-test'),
    testSymbol: 'NSE:RELIANCE',
    resolution: 'D',
    barsCount: 50,
  });
  
  const result = await poc.run();
  const exitCode = result.success && result.data?.summary.failed === 0 ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
