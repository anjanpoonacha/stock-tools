#!/usr/bin/env tsx
/**
 * CVD Settings Combinations Test
 * 
 * Tests ALL combinations of CVD parameters (4 DIMENSIONS) to find what works:
 * 1. Chart Timeframes: 15, 60, 1D, 1W
 * 2. Anchor Periods: 1W, 1M, 3M, 6M, 12M (max is 12M, NOT 1Y)
 * 3. Delta Timeframes: 15S, 30S, 1, 5, 15, 30, 60, D, W
 * 4. Show Delta: true/false
 * 
 * CRITICAL CONSTRAINT: CVD delta timeframe CANNOT exceed chart timeframe!
 * - Chart 1D → delta can be: 15S, 30S, 1, 5, 15, 30, 60 (NOT D or W)
 * - Chart 15min → delta can be: 15S, 30S, 1, 5 (NOT 15, 30, 60, D, W)
 * 
 * Based on real CVD settings from tv-switch.json:
 * - Chart 1: 1D with CVD {in_0: "3M", in_1: false, in_2: "1"}
 * - Chart 2: 188 (3H) with CVD {in_0: "3M", in_1: true, in_2: "15S"}
 * 
 * CVD Parameters:
 * - in_0: Anchor period (resolution)
 * - in_1: Show delta (bool)
 * - in_2: Delta timeframe (resolution)
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/tests/test-cvd-settings-combinations.ts <userEmail> <userPassword>
 */

import {
  BasePOC,
  POCConfig,
  SessionProvider,
  OutputManager,
  ArgParser,
} from '../../framework/index.js';

import { getDataAccessToken } from '../../../src/lib/tradingview/jwtService.js';
import { getCVDConfig } from '../../../src/lib/tradingview/cvdConfigService.js';
import { getConnectionPool } from '../../../src/lib/tradingview/connectionPool.js';

// ============================================================================
// TYPES
// ============================================================================

interface CVDSettingsCombination {
  id: string;
  chartTimeframe: string;      // Main chart resolution: "15", "60", "1D", "1W"
  anchorPeriod: string;        // in_0: "3M", "6M", "12M", etc.
  showDelta: boolean;          // in_1: true/false
  deltaTimeframe: string;      // in_2: "15S", "1", "D", etc.
  description: string;
}

interface CVDTestResult {
  combination: CVDSettingsCombination;
  success: boolean;
  duration: number;
  hasCVD: boolean;
  cvdDataPoints: number;
  barsReceived: number;
  error?: string;
  errorType?: 'config_fetch_failed' | 'no_cvd_data' | 'connection_failed' | 'timeout' | 'unknown';
  // Validation details
  cvdStudyId?: string;
  cvdStudyName?: string;
  firstCVDValue?: any;
  lastCVDValue?: any;
}

interface TestConfig {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  outputDir: string;
  testSymbol: string;
  barsCount: number;
}

interface TestOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
    successRate: number;
  };
  results: CVDTestResult[];
  analysis: {
    byChartTimeframe: Record<string, {
      total: number;
      passed: number;
      successRate: number;
      avgCVDDataPoints: number;
    }>;
    byAnchorPeriod: Record<string, {
      total: number;
      passed: number;
      successRate: number;
      avgCVDDataPoints: number;
    }>;
    byDeltaTimeframe: Record<string, {
      total: number;
      passed: number;
      successRate: number;
    }>;
    withDeltaOn: {
      total: number;
      passed: number;
      successRate: number;
    };
    withDeltaOff: {
      total: number;
      passed: number;
      successRate: number;
    };
    failureReasons: Record<string, number>;
  };
  recommendations: {
    working: CVDSettingsCombination[];
    failing: CVDSettingsCombination[];
    optimal: CVDSettingsCombination[];
  };
}

// ============================================================================
// CVD SETTINGS TEST MATRIX
// ============================================================================

/**
 * CVD Settings to Test
 * 
 * From tv-switch.json analysis:
 * Chart 1: 1D timeframe with CVD {anchor: "3M", showDelta: false, deltaTF: "1"}
 * Chart 2: 188 (3H) timeframe with CVD {anchor: "3M", showDelta: true, deltaTF: "15S"}
 * 
 * CRITICAL CONSTRAINT: CVD delta timeframe CANNOT exceed chart timeframe!
 * - Chart 1D → delta can be: 15S, 30S, 1, 5, 15, 30, 60 (NOT D or W)
 * - Chart 15 → delta can be: 15S, 30S, 1, 5 (NOT 15, 30, 60, D, W)
 * 
 * We'll test all valid combinations respecting this constraint
 */

const CHART_TIMEFRAMES = [
  '15',    // 15 minutes
  '60',    // 60 minutes / 1 hour
  '1D',    // Daily (user preference)
  '1W',    // Weekly
];

const ANCHOR_PERIODS = [
  '1W',    // 1 week
  '1M',    // 1 month
  '3M',    // 3 months (user's preference)
  '6M',    // 6 months
  '12M',   // 12 months (max, NOT 1Y)
];

const SHOW_DELTA_OPTIONS = [true, false];

/**
 * Get valid delta timeframes for a given chart timeframe
 * Delta TF must be SMALLER than chart TF
 */
function getValidDeltaTimeframes(chartTF: string): string[] {
  const timeframeOrder = ['15S', '30S', '1', '5', '15', '30', '60', 'D', 'W'];
  const chartIndex = timeframeOrder.indexOf(chartTF);
  
  if (chartIndex === -1) {
    // For unknown TF (like "188"), allow intraday only
    return timeframeOrder.slice(0, 7); // Up to 60 min
  }
  
  // Return all TFs smaller than chart TF
  return timeframeOrder.slice(0, chartIndex);
}

// Generate all valid combinations
function generateCombinations(): CVDSettingsCombination[] {
  const combinations: CVDSettingsCombination[] = [];
  let id = 1;

  for (const chartTF of CHART_TIMEFRAMES) {
    const validDeltaTFs = getValidDeltaTimeframes(chartTF);
    
    for (const anchor of ANCHOR_PERIODS) {
      for (const deltaTF of validDeltaTFs) {
        for (const showDelta of SHOW_DELTA_OPTIONS) {
          combinations.push({
            id: `cvd-${id}`,
            chartTimeframe: chartTF,
            anchorPeriod: anchor,
            showDelta,
            deltaTimeframe: deltaTF,
            description: `Chart: ${chartTF}, Anchor: ${anchor}, Delta TF: ${deltaTF}, Show Delta: ${showDelta ? 'ON' : 'OFF'}`,
          });
          id++;
        }
      }
    }
  }

  return combinations;
}

const CVD_COMBINATIONS = generateCombinations();

// ============================================================================
// CVD SETTINGS TEST POC
// ============================================================================

class CVDSettingsTestPOC extends BasePOC<TestConfig, TestOutput> {
  private sessionProvider!: SessionProvider;
  private output!: OutputManager;
  private results: CVDTestResult[] = [];
  private testStartTime!: number;
  
  // Session data
  private sessionId!: string;
  private sessionIdSign?: string;
  private userId!: number;
  private jwtToken!: string;

  protected async setup(): Promise<void> {
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    
    logger.section('CVD SETTINGS COMBINATIONS TEST');
    logger.info('Testing ALL CVD parameter combinations (4 DIMENSIONS)');
    logger.info(`Total combinations: ${CVD_COMBINATIONS.length}`);
    logger.info(`Symbol: ${this.config.testSymbol}`);
    logger.info(`Bars per test: ${this.config.barsCount}`);
    logger.info(`Dimensions: Chart TF × Anchor Period × Delta TF × Show Delta`);
    logger.newline();
    
    this.sessionProvider = new SessionProvider();
    this.testStartTime = Date.now();
  }

  protected async execute(): Promise<TestOutput> {
    const logger = this.getLogger();
    
    // Step 1: Setup authentication
    await this.setupAuthentication();
    
    // Step 2: Test all CVD combinations
    logger.section('TESTING CVD COMBINATIONS');
    logger.info(`Testing ${CVD_COMBINATIONS.length} combinations...`);
    logger.info('This will take several minutes...');
    logger.newline();
    
    let completed = 0;
    for (const combination of CVD_COMBINATIONS) {
      completed++;
      logger.subsection(`Test ${completed}/${CVD_COMBINATIONS.length}: ${combination.id}`);
      logger.info(combination.description);
      
      const result = await this.testCVDCombination(combination);
      this.results.push(result);
      
      // Show result
      if (result.success) {
        logger.success(`✅ PASS (${result.duration}ms) - ${result.cvdDataPoints} CVD points, ${result.barsReceived} bars`);
      } else {
        logger.error(`❌ FAIL (${result.duration}ms) - ${result.error}`);
      }
      
      // Rate limiting (reduced to 500ms for faster testing)
      await this.delay(500);
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
    
    // Analysis by chart timeframe
    logger.subsection('Analysis by Chart Timeframe');
    for (const [chartTF, stats] of Object.entries(result.analysis.byChartTimeframe)) {
      const emoji = stats.successRate === 100 ? '✅' : stats.successRate >= 75 ? '⚠️' : '❌';
      logger.raw(`${emoji} ${chartTF.padEnd(10)}: ${stats.passed}/${stats.total} (${stats.successRate.toFixed(0)}%) | Avg CVD points: ${stats.avgCVDDataPoints.toFixed(0)}`);
    }
    logger.newline();
    
    // Analysis by anchor period
    logger.subsection('Analysis by Anchor Period');
    for (const [anchor, stats] of Object.entries(result.analysis.byAnchorPeriod)) {
      const emoji = stats.successRate === 100 ? '✅' : stats.successRate >= 75 ? '⚠️' : '❌';
      logger.raw(`${emoji} ${anchor.padEnd(10)}: ${stats.passed}/${stats.total} (${stats.successRate.toFixed(0)}%) | Avg CVD points: ${stats.avgCVDDataPoints.toFixed(0)}`);
    }
    logger.newline();
    
    // Analysis by delta timeframe
    logger.subsection('Analysis by Delta Timeframe');
    for (const [timeframe, stats] of Object.entries(result.analysis.byDeltaTimeframe)) {
      const emoji = stats.successRate === 100 ? '✅' : stats.successRate >= 75 ? '⚠️' : '❌';
      logger.raw(`${emoji} ${timeframe.padEnd(10)}: ${stats.passed}/${stats.total} (${stats.successRate.toFixed(0)}%)`);
    }
    logger.newline();
    
    // Delta on/off analysis
    logger.subsection('Show Delta Analysis');
    const deltaOn = result.analysis.withDeltaOn;
    const deltaOff = result.analysis.withDeltaOff;
    logger.info(`Delta ON:  ${deltaOn.passed}/${deltaOn.total} (${deltaOn.successRate.toFixed(0)}%)`);
    logger.info(`Delta OFF: ${deltaOff.passed}/${deltaOff.total} (${deltaOff.successRate.toFixed(0)}%)`);
    logger.newline();
    
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
    
    if (result.recommendations.working.length > 0) {
      logger.subsection('✅ WORKING COMBINATIONS');
      result.recommendations.working.slice(0, 10).forEach(c => {
        logger.success(`  • ${c.description}`);
      });
      if (result.recommendations.working.length > 10) {
        logger.info(`  ... and ${result.recommendations.working.length - 10} more`);
      }
      logger.newline();
    }
    
    if (result.recommendations.optimal.length > 0) {
      logger.subsection('🎯 OPTIMAL COMBINATIONS (Best Performance)');
      result.recommendations.optimal.forEach(c => {
        logger.success(`  • ${c.description}`);
      });
      logger.newline();
    }
    
    if (result.recommendations.failing.length > 0) {
      logger.subsection('❌ FAILING COMBINATIONS (Avoid These)');
      result.recommendations.failing.slice(0, 5).forEach(c => {
        logger.error(`  • ${c.description}`);
      });
      if (result.recommendations.failing.length > 5) {
        logger.info(`  ... and ${result.recommendations.failing.length - 5} more`);
      }
      logger.newline();
    }
    
    logger.raw('─'.repeat(80));
    logger.newline();
    
    if (result.summary.successRate === 100) {
      logger.success('🎉 ALL CVD COMBINATIONS WORK!\n');
    } else if (result.summary.successRate >= 75) {
      logger.info('✅ Most CVD combinations work!\n');
    } else if (result.summary.successRate >= 50) {
      logger.warning('⚠️  Many combinations failed - review results\n');
    } else {
      logger.error('❌ Most combinations failed - check CVD service\n');
    }
    
    logger.raw('─'.repeat(80) + '\n');
    
    // Save results
    await this.output.saveResult('cvd-settings-test-results.json', result);
    logger.info(`📄 Full results saved to: cvd-settings-test-results.json`);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('\n💥 Fatal error:');
    logger.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      logger.error('\nStack:');
      logger.error(error.stack);
    }
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  private async setupAuthentication(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Authentication Setup');
    
    const sessionInfo = await this.sessionProvider.getSessionForUser(
      'tradingview',
      this.config.credentials
    );
    
    if (!sessionInfo) {
      throw new Error('No TradingView session found');
    }
    
    const tvSession = this.sessionProvider.extractTVSession(sessionInfo);
    this.sessionId = tvSession.sessionId;
    this.sessionIdSign = tvSession.sessionIdSign;
    this.userId = tvSession.userId;
    
    logger.success('Session retrieved from KV');
    logger.detail('userId', this.userId);
    logger.detail('hasSessionIdSign', !!this.sessionIdSign);
    
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
  // CVD COMBINATION TESTING
  // ============================================================================

  private async testCVDCombination(combination: CVDSettingsCombination): Promise<CVDTestResult> {
    const start = Date.now();
    const pool = getConnectionPool();
    
    try {
      // Wrap in timeout (10 seconds max per test)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout after 10s')), 10000);
      });
      
      const testPromise = (async () => {
        // Fetch CVD config (will be used by pool)
        if (!this.sessionIdSign) {
          throw new Error('No sessionid_sign available');
        }
        
        await getCVDConfig(this.sessionId, this.sessionIdSign);
        
        // Fetch chart data with specific CVD settings
        const result = await pool.fetchChartData(
          this.jwtToken,
          this.config.testSymbol,
          combination.chartTimeframe,  // Use chart timeframe from combination
          this.config.barsCount,
          {
            cvdEnabled: true,
            cvdAnchorPeriod: combination.anchorPeriod,
            cvdTimeframe: combination.deltaTimeframe,
            sessionId: this.sessionId,
            sessionIdSign: this.sessionIdSign,
          }
        );
        return result;
      })();
      
      const result = await Promise.race([testPromise, timeoutPromise]);
      
      const duration = Date.now() - start;
      
      // Validate bars
      if (!result.bars || result.bars.length === 0) {
        return {
          combination,
          success: false,
          duration,
          hasCVD: false,
          cvdDataPoints: 0,
          barsReceived: 0,
          error: 'No bars received',
          errorType: 'no_cvd_data',
        };
      }
      
      // Validate CVD data
      const hasCVD = !!result.indicators?.cvd;
      const cvdDataPoints = result.indicators?.cvd?.values?.length || 0;
      
      if (!hasCVD || cvdDataPoints === 0) {
        return {
          combination,
          success: false,
          duration,
          hasCVD: false,
          cvdDataPoints: 0,
          barsReceived: result.bars.length,
          error: 'CVD data not returned',
          errorType: 'no_cvd_data',
        };
      }
      
      // Extract CVD details
      const cvdStudyId = result.indicators?.cvd?.studyId;
      const cvdStudyName = result.indicators?.cvd?.studyName;
      const firstCVDValue = result.indicators?.cvd?.values?.[0];
      const lastCVDValue = result.indicators?.cvd?.values?.[cvdDataPoints - 1];
      
      return {
        combination,
        success: true,
        duration,
        hasCVD: true,
        cvdDataPoints,
        barsReceived: result.bars.length,
        cvdStudyId,
        cvdStudyName,
        firstCVDValue,
        lastCVDValue,
      };
      
    } catch (error) {
      const duration = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      let errorType: CVDTestResult['errorType'] = 'unknown';
      if (errorMsg.includes('config') || errorMsg.includes('CVD')) {
        errorType = 'config_fetch_failed';
      } else if (errorMsg.includes('timeout')) {
        errorType = 'timeout';
      } else if (errorMsg.includes('connection')) {
        errorType = 'connection_failed';
      }
      
      return {
        combination,
        success: false,
        duration,
        hasCVD: false,
        cvdDataPoints: 0,
        barsReceived: 0,
        error: errorMsg,
        errorType,
      };
    }
  }

  // ============================================================================
  // ANALYSIS
  // ============================================================================

  private analyzeResults(): TestOutput['analysis'] {
    const byChartTimeframe: TestOutput['analysis']['byChartTimeframe'] = {};
    const byAnchorPeriod: TestOutput['analysis']['byAnchorPeriod'] = {};
    const byDeltaTimeframe: TestOutput['analysis']['byDeltaTimeframe'] = {};
    const withDeltaOn = { total: 0, passed: 0, successRate: 0 };
    const withDeltaOff = { total: 0, passed: 0, successRate: 0 };
    const failureReasons: Record<string, number> = {};
    
    // Group by chart timeframe
    for (const result of this.results) {
      const chartTF = result.combination.chartTimeframe;
      if (!byChartTimeframe[chartTF]) {
        byChartTimeframe[chartTF] = {
          total: 0,
          passed: 0,
          successRate: 0,
          avgCVDDataPoints: 0,
        };
      }
      
      const chartStats = byChartTimeframe[chartTF];
      chartStats.total++;
      if (result.success) {
        chartStats.passed++;
        chartStats.avgCVDDataPoints += result.cvdDataPoints;
      }
    }
    
    // Calculate averages for chart timeframe
    for (const stats of Object.values(byChartTimeframe)) {
      stats.successRate = (stats.passed / stats.total) * 100;
      if (stats.passed > 0) {
        stats.avgCVDDataPoints /= stats.passed;
      }
    }
    
    // Group by anchor period
    for (const result of this.results) {
      const anchor = result.combination.anchorPeriod;
      if (!byAnchorPeriod[anchor]) {
        byAnchorPeriod[anchor] = {
          total: 0,
          passed: 0,
          successRate: 0,
          avgCVDDataPoints: 0,
        };
      }
      
      const anchorStats = byAnchorPeriod[anchor];
      anchorStats.total++;
      if (result.success) {
        anchorStats.passed++;
        anchorStats.avgCVDDataPoints += result.cvdDataPoints;
      }
    }
    
    // Calculate averages for anchor period
    for (const stats of Object.values(byAnchorPeriod)) {
      stats.successRate = (stats.passed / stats.total) * 100;
      if (stats.passed > 0) {
        stats.avgCVDDataPoints /= stats.passed;
      }
    }
    
    // Group by delta timeframe
    for (const result of this.results) {
      const timeframe = result.combination.deltaTimeframe;
      if (!byDeltaTimeframe[timeframe]) {
        byDeltaTimeframe[timeframe] = {
          total: 0,
          passed: 0,
          successRate: 0,
        };
      }
      
      const tfStats = byDeltaTimeframe[timeframe];
      tfStats.total++;
      if (result.success) {
        tfStats.passed++;
      }
    }
    
    // Calculate success rates for delta timeframe
    for (const stats of Object.values(byDeltaTimeframe)) {
      stats.successRate = (stats.passed / stats.total) * 100;
    }
    
    // Delta on/off analysis
    for (const result of this.results) {
      if (result.combination.showDelta) {
        withDeltaOn.total++;
        if (result.success) withDeltaOn.passed++;
      } else {
        withDeltaOff.total++;
        if (result.success) withDeltaOff.passed++;
      }
    }
    
    withDeltaOn.successRate = (withDeltaOn.passed / withDeltaOn.total) * 100;
    withDeltaOff.successRate = (withDeltaOff.passed / withDeltaOff.total) * 100;
    
    // Failure reasons
    for (const result of this.results.filter(r => !r.success)) {
      const reason = result.error || 'Unknown error';
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    }
    
    return {
      byChartTimeframe,
      byAnchorPeriod,
      byDeltaTimeframe,
      withDeltaOn,
      withDeltaOff,
      failureReasons,
    };
  }

  private generateRecommendations(): TestOutput['recommendations'] {
    const working: CVDSettingsCombination[] = [];
    const failing: CVDSettingsCombination[] = [];
    const optimal: CVDSettingsCombination[] = [];
    
    for (const result of this.results) {
      if (result.success) {
        working.push(result.combination);
        
        // Optimal: Fast (<3s), good CVD data (>100 points), common settings
        if (
          result.duration < 3000 &&
          result.cvdDataPoints > 100 &&
          ['3M', '6M', '1Y'].includes(result.combination.anchorPeriod) &&
          ['15S', '1', '5', '15'].includes(result.combination.deltaTimeframe)
        ) {
          optimal.push(result.combination);
        }
      } else {
        failing.push(result.combination);
      }
    }
    
    return {
      working,
      failing,
      optimal: optimal.slice(0, 5), // Top 5
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
  const parser = new ArgParser();
  const userEmail = parser.get(0);
  const userPassword = parser.get(1);
  const batchStart = parser.get(2) ? parseInt(parser.get(2)!) : undefined;
  const batchEnd = parser.get(3) ? parseInt(parser.get(3)!) : undefined;
  
  if (!userEmail || !userPassword) {
    console.error('\n❌ Usage: tsx scripts/migrated/tests/test-cvd-settings-combinations.ts <userEmail> <userPassword> [batchStart] [batchEnd]');
    console.error('Example: tsx scripts/migrated/tests/test-cvd-settings-combinations.ts user@example.com password');
    console.error('Batch:   tsx scripts/migrated/tests/test-cvd-settings-combinations.ts user@example.com password 0 30\n');
    process.exit(1);
  }
  
  // Filter combinations for batch processing
  let combinations = CVD_COMBINATIONS;
  let batchSuffix = '';
  
  if (batchStart !== undefined && batchEnd !== undefined) {
    combinations = CVD_COMBINATIONS.slice(batchStart, batchEnd);
    batchSuffix = `-batch-${batchStart}-${batchEnd}`;
    console.log(`\n🔄 Running BATCH ${batchStart}-${batchEnd} (${combinations.length} combinations)\n`);
  }
  
  // Temporarily replace global combinations with batch
  const originalCombinations = [...CVD_COMBINATIONS];
  CVD_COMBINATIONS.length = 0;
  CVD_COMBINATIONS.push(...combinations);
  
  const poc = new CVDSettingsTestPOC({
    credentials: {
      userEmail,
      userPassword,
    },
    outputDir: POCConfig.getOutputDir(`cvd-settings-test${batchSuffix}`),
    testSymbol: 'NSE:RELIANCE',
    barsCount: 100, // Keep bar count constant to focus on CVD settings
  });
  
  const result = await poc.run();
  
  // Restore original combinations
  CVD_COMBINATIONS.length = 0;
  CVD_COMBINATIONS.push(...originalCombinations);
  
  const exitCode = result.success && result.data?.summary.successRate === 100 ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
