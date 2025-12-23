#!/usr/bin/env tsx
/**
 * TradingView Combinations Test - COMPREHENSIVE
 * 
 * Tests ALL combinations of parameters to find what works and what doesn't:
 * - Multiple resolutions (1D, 1W, 1M, 15min, 30min, 60min, 3H)
 * - Multiple bar counts (100, 300, 500, 1000, 2000)
 * - CVD enabled/disabled
 * - Multiple symbols
 * 
 * Based on REAL WebSocket messages from tv-switch.json
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/tests/test-tradingview-combinations.ts <userEmail> <userPassword>
 * 
 * Example:
 *   tsx --env-file=.env scripts/migrated/tests/test-tradingview-combinations.ts user@example.com password
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
import { getCVDConfig } from '../../../src/lib/tradingview/cvdConfigService.js';
import { getConnectionPool } from '../../../src/lib/tradingview/connectionPool.js';

// ============================================================================
// TYPES
// ============================================================================

interface TestCombination {
  id: string;
  symbol: string;
  resolution: string;
  resolutionLabel: string;
  barCount: number;
  cvdEnabled: boolean;
  description: string;
}

interface CombinationTestResult {
  combination: TestCombination;
  success: boolean;
  duration: number;
  barsRequested: number;
  barsReceived: number;
  barsDifference: number;
  accuracyPercent: number;
  firstBarDate?: string;
  lastBarDate?: string;
  dateRangeDays?: number;
  hasCVD?: boolean;
  cvdDataPoints?: number;
  error?: string;
  errorType?: 'timeout' | 'connection' | 'no_data' | 'invalid_data' | 'unknown';
}

interface TestConfig {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  outputDir: string;
}

interface TestOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
    successRate: number;
  };
  results: CombinationTestResult[];
  analysis: {
    byResolution: Record<string, {
      total: number;
      passed: number;
      failed: number;
      successRate: number;
      avgLoadTime: number;
      avgBarsReceived: number;
    }>;
    byBarCount: Record<number, {
      total: number;
      passed: number;
      failed: number;
      successRate: number;
    }>;
    withCVD: {
      total: number;
      passed: number;
      avgCVDDataPoints: number;
    };
    failureReasons: Record<string, number>;
  };
  recommendations: {
    optimal: TestCombination[];
    safe: TestCombination[];
    risky: TestCombination[];
  };
}

// ============================================================================
// TEST COMBINATIONS MATRIX
// ============================================================================

/**
 * COMPREHENSIVE TEST MATRIX
 * 
 * Based on tv-switch.json analysis:
 * - Resolution "188" = 3H (3-hour bars) - seen in actual WebSocket traffic
 * - Resolution "195" = custom resolution - seen in actual traffic
 * - Standard resolutions: 1D, 1W, 1M work well
 * - Intraday: 15, 30, 60 (minutes)
 * - Bar counts: Real data shows ~300 bars being returned
 */
const TEST_COMBINATIONS: TestCombination[] = [
  // ========================================
  // DAILY (1D) - Most Common
  // ========================================
  {
    id: '1d-100',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 100,
    cvdEnabled: false,
    description: 'Daily, 100 bars (~3 months)',
  },
  {
    id: '1d-300',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 300,
    cvdEnabled: false,
    description: 'Daily, 300 bars (~1 year)',
  },
  {
    id: '1d-300-cvd',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 300,
    cvdEnabled: true,
    description: 'Daily, 300 bars with CVD',
  },
  {
    id: '1d-500',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 500,
    cvdEnabled: false,
    description: 'Daily, 500 bars (~2 years)',
  },
  {
    id: '1d-1000',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 1000,
    cvdEnabled: false,
    description: 'Daily, 1000 bars (~4 years)',
  },
  {
    id: '1d-2000',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 2000,
    cvdEnabled: false,
    description: 'Daily, 2000 bars (~8 years)',
  },

  // ========================================
  // WEEKLY (1W)
  // ========================================
  {
    id: '1w-100',
    symbol: 'NSE:RELIANCE',
    resolution: '1W',
    resolutionLabel: 'Weekly',
    barCount: 100,
    cvdEnabled: false,
    description: 'Weekly, 100 bars (~2 years)',
  },
  {
    id: '1w-300',
    symbol: 'NSE:RELIANCE',
    resolution: '1W',
    resolutionLabel: 'Weekly',
    barCount: 300,
    cvdEnabled: false,
    description: 'Weekly, 300 bars (~6 years)',
  },
  {
    id: '1w-500',
    symbol: 'NSE:RELIANCE',
    resolution: '1W',
    resolutionLabel: 'Weekly',
    barCount: 500,
    cvdEnabled: false,
    description: 'Weekly, 500 bars (~10 years)',
  },
  {
    id: '1w-1000',
    symbol: 'NSE:RELIANCE',
    resolution: '1W',
    resolutionLabel: 'Weekly',
    barCount: 1000,
    cvdEnabled: false,
    description: 'Weekly, 1000 bars (~20 years)',
  },

  // ========================================
  // MONTHLY (1M)
  // ========================================
  {
    id: '1m-100',
    symbol: 'NSE:RELIANCE',
    resolution: '1M',
    resolutionLabel: 'Monthly',
    barCount: 100,
    cvdEnabled: false,
    description: 'Monthly, 100 bars (~8 years)',
  },
  {
    id: '1m-300',
    symbol: 'NSE:RELIANCE',
    resolution: '1M',
    resolutionLabel: 'Monthly',
    barCount: 300,
    cvdEnabled: false,
    description: 'Monthly, 300 bars (~25 years)',
  },
  {
    id: '1m-500',
    symbol: 'NSE:RELIANCE',
    resolution: '1M',
    resolutionLabel: 'Monthly',
    barCount: 500,
    cvdEnabled: false,
    description: 'Monthly, 500 bars (~40 years)',
  },

  // ========================================
  // 15-MINUTE (Intraday)
  // ========================================
  {
    id: '15m-100',
    symbol: 'NSE:RELIANCE',
    resolution: '15',
    resolutionLabel: '15min',
    barCount: 100,
    cvdEnabled: false,
    description: '15min, 100 bars (~1 day)',
  },
  {
    id: '15m-300',
    symbol: 'NSE:RELIANCE',
    resolution: '15',
    resolutionLabel: '15min',
    barCount: 300,
    cvdEnabled: false,
    description: '15min, 300 bars (~3 days)',
  },
  {
    id: '15m-500',
    symbol: 'NSE:RELIANCE',
    resolution: '15',
    resolutionLabel: '15min',
    barCount: 500,
    cvdEnabled: false,
    description: '15min, 500 bars (~5 days)',
  },
  {
    id: '15m-1000',
    symbol: 'NSE:RELIANCE',
    resolution: '15',
    resolutionLabel: '15min',
    barCount: 1000,
    cvdEnabled: false,
    description: '15min, 1000 bars (~10 days)',
  },

  // ========================================
  // 30-MINUTE (Intraday)
  // ========================================
  {
    id: '30m-100',
    symbol: 'NSE:RELIANCE',
    resolution: '30',
    resolutionLabel: '30min',
    barCount: 100,
    cvdEnabled: false,
    description: '30min, 100 bars (~2 days)',
  },
  {
    id: '30m-300',
    symbol: 'NSE:RELIANCE',
    resolution: '30',
    resolutionLabel: '30min',
    barCount: 300,
    cvdEnabled: false,
    description: '30min, 300 bars (~6 days)',
  },
  {
    id: '30m-500',
    symbol: 'NSE:RELIANCE',
    resolution: '30',
    resolutionLabel: '30min',
    barCount: 500,
    cvdEnabled: false,
    description: '30min, 500 bars (~10 days)',
  },

  // ========================================
  // 60-MINUTE / 1H (Intraday)
  // ========================================
  {
    id: '60m-100',
    symbol: 'NSE:RELIANCE',
    resolution: '60',
    resolutionLabel: '60min/1H',
    barCount: 100,
    cvdEnabled: false,
    description: '60min, 100 bars (~4 days)',
  },
  {
    id: '60m-300',
    symbol: 'NSE:RELIANCE',
    resolution: '60',
    resolutionLabel: '60min/1H',
    barCount: 300,
    cvdEnabled: false,
    description: '60min, 300 bars (~12 days)',
  },
  {
    id: '60m-500',
    symbol: 'NSE:RELIANCE',
    resolution: '60',
    resolutionLabel: '60min/1H',
    barCount: 500,
    cvdEnabled: false,
    description: '60min, 500 bars (~20 days)',
  },
  {
    id: '60m-1000',
    symbol: 'NSE:RELIANCE',
    resolution: '60',
    resolutionLabel: '60min/1H',
    barCount: 1000,
    cvdEnabled: false,
    description: '60min, 1000 bars (~40 days)',
  },

  // ========================================
  // CUSTOM RESOLUTION 188 (3H from tv-switch.json)
  // ========================================
  {
    id: '188-100',
    symbol: 'NSE:RELIANCE',
    resolution: '188',
    resolutionLabel: '3H (188)',
    barCount: 100,
    cvdEnabled: false,
    description: '3H custom (188), 100 bars',
  },
  {
    id: '188-300',
    symbol: 'NSE:RELIANCE',
    resolution: '188',
    resolutionLabel: '3H (188)',
    barCount: 300,
    cvdEnabled: false,
    description: '3H custom (188), 300 bars',
  },
  {
    id: '188-500',
    symbol: 'NSE:RELIANCE',
    resolution: '188',
    resolutionLabel: '3H (188)',
    barCount: 500,
    cvdEnabled: false,
    description: '3H custom (188), 500 bars',
  },

  // ========================================
  // EXTREME TESTS (Edge Cases)
  // ========================================
  {
    id: '1d-5000',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 5000,
    cvdEnabled: false,
    description: 'Daily, 5000 bars (~20 years) - EXTREME',
  },
  {
    id: '1d-10000',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 10000,
    cvdEnabled: false,
    description: 'Daily, 10000 bars (~40 years) - EXTREME',
  },

  // ========================================
  // DIFFERENT SYMBOLS
  // ========================================
  {
    id: '1d-300-tcs',
    symbol: 'NSE:TCS',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 300,
    cvdEnabled: false,
    description: 'TCS: Daily, 300 bars',
  },
  {
    id: '1d-300-infy',
    symbol: 'NSE:INFY',
    resolution: '1D',
    resolutionLabel: 'Daily',
    barCount: 300,
    cvdEnabled: false,
    description: 'INFY: Daily, 300 bars',
  },

  // ========================================
  // CVD TESTS (Various resolutions)
  // ========================================
  {
    id: '1w-300-cvd',
    symbol: 'NSE:RELIANCE',
    resolution: '1W',
    resolutionLabel: 'Weekly',
    barCount: 300,
    cvdEnabled: true,
    description: 'Weekly, 300 bars with CVD',
  },
  {
    id: '15m-300-cvd',
    symbol: 'NSE:RELIANCE',
    resolution: '15',
    resolutionLabel: '15min',
    barCount: 300,
    cvdEnabled: true,
    description: '15min, 300 bars with CVD',
  },
];

// ============================================================================
// COMBINATION TEST POC
// ============================================================================

class TradingViewCombinationsTestPOC extends BasePOC<TestConfig, TestOutput> {
  private sessionProvider!: SessionProvider;
  private output!: OutputManager;
  private results: CombinationTestResult[] = [];
  private testStartTime!: number;
  
  // Session data
  private sessionId!: string;
  private sessionIdSign?: string;
  private userId!: number;
  private jwtToken!: string;

  protected async setup(): Promise<void> {
    // Initialize output manager
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    
    logger.section('TRADINGVIEW COMBINATIONS TEST SUITE');
    logger.info('Testing ALL parameter combinations to find what works');
    logger.info(`Total combinations: ${TEST_COMBINATIONS.length}`);
    logger.info(`User: ${this.config.credentials.userEmail}`);
    logger.newline();
    
    // Initialize session provider
    this.sessionProvider = new SessionProvider();
    
    this.testStartTime = Date.now();
  }

  protected async execute(): Promise<TestOutput> {
    const logger = this.getLogger();
    
    // Step 1: Get session and JWT
    await this.setupAuthentication();
    
    // Step 2: Test all combinations
    logger.section('RUNNING COMBINATION TESTS');
    logger.info(`Testing ${TEST_COMBINATIONS.length} combinations...`);
    logger.info('This may take several minutes...');
    logger.newline();
    
    let completed = 0;
    for (const combination of TEST_COMBINATIONS) {
      completed++;
      logger.subsection(`Test ${completed}/${TEST_COMBINATIONS.length}: ${combination.id}`);
      logger.info(combination.description);
      
      const result = await this.testCombination(combination);
      this.results.push(result);
      
      // Show result
      if (result.success) {
        logger.success(`✅ PASS (${result.duration}ms) - ${result.barsReceived}/${result.barsRequested} bars`);
        if (result.barsDifference !== 0) {
          logger.warning(`   Difference: ${result.barsDifference > 0 ? '+' : ''}${result.barsDifference} bars`);
        }
      } else {
        logger.error(`❌ FAIL (${result.duration}ms) - ${result.error}`);
      }
      
      // Rate limiting - delay between tests
      await this.delay(1500);
    }
    
    // Step 3: Analyze results
    const analysis = this.analyzeResults();
    const recommendations = this.generateRecommendations();
    
    const totalDuration = Date.now() - this.testStartTime;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const successRate = (passed / this.results.length) * 100;
    
    return {
      summary: {
        total: this.results.length,
        passed,
        failed,
        duration: totalDuration,
        successRate,
      },
      results: this.results,
      analysis,
      recommendations,
    };
  }

  protected async cleanup(): Promise<void> {
    this.sessionProvider.clearCache();
  }

  protected async onSuccess(result: TestOutput): Promise<void> {
    const logger = this.getLogger();
    
    // Print summary
    logger.section('TEST SUMMARY');
    logger.newline();
    logger.success(`✅ Passed:  ${result.summary.passed}/${result.summary.total} (${result.summary.successRate.toFixed(1)}%)`);
    logger.error(`❌ Failed:  ${result.summary.failed}/${result.summary.total} (${(100 - result.summary.successRate).toFixed(1)}%)`);
    logger.info(`⏱️  Duration: ${(result.summary.duration / 1000).toFixed(1)}s`);
    logger.newline();
    
    // Analysis by resolution
    logger.subsection('Analysis by Resolution');
    for (const [resolution, stats] of Object.entries(result.analysis.byResolution)) {
      const emoji = stats.successRate === 100 ? '✅' : stats.successRate >= 75 ? '⚠️' : '❌';
      logger.raw(`${emoji} ${resolution.padEnd(15)}: ${stats.passed}/${stats.total} (${stats.successRate.toFixed(0)}%) | Avg: ${stats.avgLoadTime.toFixed(0)}ms, ${stats.avgBarsReceived.toFixed(0)} bars`);
    }
    logger.newline();
    
    // Analysis by bar count
    logger.subsection('Analysis by Bar Count');
    for (const [count, stats] of Object.entries(result.analysis.byBarCount)) {
      const emoji = stats.successRate === 100 ? '✅' : stats.successRate >= 75 ? '⚠️' : '❌';
      logger.raw(`${emoji} ${count.padStart(5)} bars: ${stats.passed}/${stats.total} (${stats.successRate.toFixed(0)}%)`);
    }
    logger.newline();
    
    // CVD Analysis
    if (result.analysis.withCVD.total > 0) {
      logger.subsection('CVD Analysis');
      logger.info(`CVD Tests: ${result.analysis.withCVD.passed}/${result.analysis.withCVD.total} passed`);
      if (result.analysis.withCVD.passed > 0) {
        logger.info(`Avg CVD Data Points: ${result.analysis.withCVD.avgCVDDataPoints.toFixed(0)}`);
      }
      logger.newline();
    }
    
    // Failure reasons
    if (result.summary.failed > 0) {
      logger.subsection('Failure Reasons');
      for (const [reason, count] of Object.entries(result.analysis.failureReasons)) {
        logger.error(`  • ${reason}: ${count} times`);
      }
      logger.newline();
    }
    
    // Recommendations
    logger.section('RECOMMENDATIONS');
    logger.newline();
    
    if (result.recommendations.optimal.length > 0) {
      logger.subsection('🎯 OPTIMAL CONFIGURATIONS (Best Performance)');
      result.recommendations.optimal.forEach(c => {
        logger.success(`  • ${c.resolutionLabel} (${c.resolution}), ${c.barCount} bars${c.cvdEnabled ? ' + CVD' : ''}`);
      });
      logger.newline();
    }
    
    if (result.recommendations.safe.length > 0) {
      logger.subsection('✅ SAFE CONFIGURATIONS (Reliable)');
      result.recommendations.safe.forEach(c => {
        logger.info(`  • ${c.resolutionLabel} (${c.resolution}), ${c.barCount} bars${c.cvdEnabled ? ' + CVD' : ''}`);
      });
      logger.newline();
    }
    
    if (result.recommendations.risky.length > 0) {
      logger.subsection('⚠️  RISKY CONFIGURATIONS (May Fail)');
      result.recommendations.risky.forEach(c => {
        logger.warning(`  • ${c.resolutionLabel} (${c.resolution}), ${c.barCount} bars${c.cvdEnabled ? ' + CVD' : ''}`);
      });
      logger.newline();
    }
    
    logger.raw('─'.repeat(80));
    logger.newline();
    
    if (result.summary.successRate === 100) {
      logger.success('🎉 ALL COMBINATIONS PASSED!\n');
    } else if (result.summary.successRate >= 75) {
      logger.info('✅ Most combinations work well!\n');
    } else if (result.summary.successRate >= 50) {
      logger.warning('⚠️  Many combinations failed - review results carefully\n');
    } else {
      logger.error('❌ Most combinations failed - check authentication and network\n');
    }
    
    logger.raw('─'.repeat(80) + '\n');
    
    // Save results to file
    await this.output.saveResult('tradingview-combinations-test-results.json', result);
    logger.info(`📄 Full results saved to: tradingview-combinations-test-results.json`);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('\n💥 Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      logger.error('\nStack trace:');
      logger.error(error.stack);
    }
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  private async setupAuthentication(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Authentication Setup');
    
    // Get session
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
    
    logger.success('Session retrieved from KV');
    logger.detail('userId', this.userId);
    logger.detail('hasSessionIdSign', !!this.sessionIdSign);
    
    // Get JWT token
    this.jwtToken = await getDataAccessToken(
      this.sessionId,
      this.sessionIdSign || '',
      this.userId
    );
    
    logger.success('JWT token obtained');
    logger.detail('tokenLength', this.jwtToken.length);
    logger.newline();
  }

  // ============================================================================
  // COMBINATION TESTING
  // ============================================================================

  private async testCombination(combination: TestCombination): Promise<CombinationTestResult> {
    const start = Date.now();
    const pool = getConnectionPool();
    
    try {
      // Fetch CVD config if needed (cached after first call)
      if (combination.cvdEnabled && this.sessionIdSign) {
        await getCVDConfig(this.sessionId, this.sessionIdSign);
      }
      
      // Fetch chart data
      const result = await pool.fetchChartData(
        this.jwtToken,
        combination.symbol,
        combination.resolution,
        combination.barCount,
        {
          cvdEnabled: combination.cvdEnabled,
          cvdAnchorPeriod: '3M',
          cvdTimeframe: undefined,
          sessionId: this.sessionId,
          sessionIdSign: this.sessionIdSign,
        }
      );
      
      const duration = Date.now() - start;
      
      // Validate bars
      if (!result.bars || result.bars.length === 0) {
        return {
          combination,
          success: false,
          duration,
          barsRequested: combination.barCount,
          barsReceived: 0,
          barsDifference: -combination.barCount,
          accuracyPercent: 0,
          error: 'No bars returned',
          errorType: 'no_data',
        };
      }
      
      // Calculate metrics
      const barsReceived = result.bars.length;
      const barsDifference = barsReceived - combination.barCount;
      const accuracyPercent = (barsReceived / combination.barCount) * 100;
      
      const firstBar = result.bars[0];
      const lastBar = result.bars[barsReceived - 1];
      const firstBarDate = new Date(firstBar.time * 1000).toISOString().split('T')[0];
      const lastBarDate = new Date(lastBar.time * 1000).toISOString().split('T')[0];
      const dateRangeDays = Math.floor((lastBar.time - firstBar.time) / 86400);
      
      // CVD validation
      const hasCVD = !!result.indicators?.cvd;
      const cvdDataPoints = result.indicators?.cvd?.values?.length || 0;
      
      // Check for invalid data
      const hasInvalidBars = result.bars.some(bar => 
        bar.open === null || bar.high === null || bar.low === null || 
        bar.close === null || bar.volume === null ||
        isNaN(bar.open) || isNaN(bar.high) || isNaN(bar.low) || 
        isNaN(bar.close) || isNaN(bar.volume)
      );
      
      if (hasInvalidBars) {
        return {
          combination,
          success: false,
          duration,
          barsRequested: combination.barCount,
          barsReceived,
          barsDifference,
          accuracyPercent,
          error: 'Invalid bar data (nulls or NaN)',
          errorType: 'invalid_data',
        };
      }
      
      // CVD validation if enabled
      if (combination.cvdEnabled && !hasCVD) {
        return {
          combination,
          success: false,
          duration,
          barsRequested: combination.barCount,
          barsReceived,
          barsDifference,
          accuracyPercent,
          firstBarDate,
          lastBarDate,
          dateRangeDays,
          hasCVD: false,
          error: 'CVD requested but not returned',
          errorType: 'no_data',
        };
      }
      
      return {
        combination,
        success: true,
        duration,
        barsRequested: combination.barCount,
        barsReceived,
        barsDifference,
        accuracyPercent,
        firstBarDate,
        lastBarDate,
        dateRangeDays,
        hasCVD,
        cvdDataPoints,
      };
      
    } catch (error) {
      const duration = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Classify error type
      let errorType: CombinationTestResult['errorType'] = 'unknown';
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        errorType = 'timeout';
      } else if (errorMsg.includes('connection') || errorMsg.includes('socket')) {
        errorType = 'connection';
      } else if (errorMsg.includes('no data') || errorMsg.includes('no bars')) {
        errorType = 'no_data';
      }
      
      return {
        combination,
        success: false,
        duration,
        barsRequested: combination.barCount,
        barsReceived: 0,
        barsDifference: -combination.barCount,
        accuracyPercent: 0,
        error: errorMsg,
        errorType,
      };
    }
  }

  // ============================================================================
  // ANALYSIS
  // ============================================================================

  private analyzeResults(): TestOutput['analysis'] {
    const byResolution: TestOutput['analysis']['byResolution'] = {};
    const byBarCount: TestOutput['analysis']['byBarCount'] = {};
    const withCVD = {
      total: 0,
      passed: 0,
      avgCVDDataPoints: 0,
    };
    const failureReasons: Record<string, number> = {};
    
    // Group by resolution
    for (const result of this.results) {
      const resLabel = result.combination.resolutionLabel;
      if (!byResolution[resLabel]) {
        byResolution[resLabel] = {
          total: 0,
          passed: 0,
          failed: 0,
          successRate: 0,
          avgLoadTime: 0,
          avgBarsReceived: 0,
        };
      }
      
      const resStats = byResolution[resLabel];
      resStats.total++;
      if (result.success) {
        resStats.passed++;
        resStats.avgLoadTime += result.duration;
        resStats.avgBarsReceived += result.barsReceived;
      } else {
        resStats.failed++;
      }
    }
    
    // Calculate averages for resolution
    for (const stats of Object.values(byResolution)) {
      stats.successRate = (stats.passed / stats.total) * 100;
      if (stats.passed > 0) {
        stats.avgLoadTime /= stats.passed;
        stats.avgBarsReceived /= stats.passed;
      }
    }
    
    // Group by bar count
    for (const result of this.results) {
      const count = result.barsRequested;
      if (!byBarCount[count]) {
        byBarCount[count] = {
          total: 0,
          passed: 0,
          failed: 0,
          successRate: 0,
        };
      }
      
      const countStats = byBarCount[count];
      countStats.total++;
      if (result.success) {
        countStats.passed++;
      } else {
        countStats.failed++;
      }
    }
    
    // Calculate success rates for bar count
    for (const stats of Object.values(byBarCount)) {
      stats.successRate = (stats.passed / stats.total) * 100;
    }
    
    // CVD analysis
    const cvdResults = this.results.filter(r => r.combination.cvdEnabled);
    withCVD.total = cvdResults.length;
    withCVD.passed = cvdResults.filter(r => r.success && r.hasCVD).length;
    
    const cvdDataPoints = cvdResults
      .filter(r => r.success && r.cvdDataPoints)
      .map(r => r.cvdDataPoints!);
    
    if (cvdDataPoints.length > 0) {
      withCVD.avgCVDDataPoints = cvdDataPoints.reduce((a, b) => a + b, 0) / cvdDataPoints.length;
    }
    
    // Failure reasons
    for (const result of this.results.filter(r => !r.success)) {
      const reason = result.error || 'Unknown error';
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    }
    
    return {
      byResolution,
      byBarCount,
      withCVD,
      failureReasons,
    };
  }

  private generateRecommendations(): TestOutput['recommendations'] {
    const optimal: TestCombination[] = [];
    const safe: TestCombination[] = [];
    const risky: TestCombination[] = [];
    
    for (const result of this.results) {
      if (!result.success) {
        risky.push(result.combination);
        continue;
      }
      
      // Optimal: Fast (<3s), accurate (>95%), common resolutions
      if (
        result.duration < 3000 &&
        result.accuracyPercent >= 95 &&
        ['Daily', 'Weekly', 'Monthly', '15min', '30min', '60min/1H'].includes(result.combination.resolutionLabel)
      ) {
        optimal.push(result.combination);
      }
      // Safe: Reliable (passed), reasonable performance
      else if (result.accuracyPercent >= 90) {
        safe.push(result.combination);
      }
    }
    
    // Limit recommendations
    return {
      optimal: optimal.slice(0, 10),
      safe: safe.slice(0, 10),
      risky: risky.slice(0, 10),
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getLogger() {
    return this.output.getLogger();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    console.error('\n❌ Usage: tsx scripts/migrated/tests/test-tradingview-combinations.ts <userEmail> <userPassword>');
    console.error('Example: tsx scripts/migrated/tests/test-tradingview-combinations.ts user@example.com password\n');
    process.exit(1);
  }
  
  // Create POC instance
  const poc = new TradingViewCombinationsTestPOC({
    credentials: {
      userEmail,
      userPassword,
    },
    outputDir: POCConfig.getOutputDir('tradingview-combinations-test'),
  });
  
  // Run POC
  const result = await poc.run();
  
  // Exit with appropriate code
  const exitCode = result.success && result.data?.summary.successRate === 100 ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
