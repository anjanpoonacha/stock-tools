#!/usr/bin/env tsx
/**
 * CVD Settings Combinations Test - CORRECTED VERSION
 * 
 * Tests CVD with proper understanding of 4 parameters:
 * 1. Chart Timeframe (main resolution like 1D, 1W, 15, 60, etc.)
 * 2. CVD Anchor Period (in_0: how far back to calculate CVD)
 * 3. CVD Show Delta (in_1: true/false)
 * 4. CVD Delta Timeframe (in_2: resolution for delta calculation)
 * 
 * CRITICAL CONSTRAINT: CVD delta timeframe CANNOT exceed chart timeframe!
 * - Chart 1D → CVD delta can be: 15S, 30S, 1, 5, 15, 30, 60 (NOT D or W)
 * - Chart 1W → CVD delta can be: all up to D (NOT W)
 * - Chart 15 (15min) → CVD delta can be: 15S, 30S, 1, 5 (NOT 15, 30, 60, D, W)
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/tests/test-cvd-settings-combinations-correct.ts <userEmail> <userPassword>
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

interface CVDCombination {
  id: string;
  chartTimeframe: string;          // Main chart resolution
  chartTimeframeLabel: string;
  cvdAnchorPeriod: string;          // in_0: CVD anchor
  cvdShowDelta: boolean;            // in_1: show delta
  cvdDeltaTimeframe: string;        // in_2: delta resolution
  description: string;
}

interface CVDTestResult {
  combination: CVDCombination;
  success: boolean;
  duration: number;
  hasCVD: boolean;
  cvdDataPoints: number;
  barsReceived: number;
  error?: string;
  errorType?: 'config_fetch_failed' | 'no_cvd_data' | 'connection_failed' | 'timeout' | 'unknown';
  cvdStudyId?: string;
  cvdStudyName?: string;
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
    byChartTimeframe: Record<string, { total: number; passed: number; successRate: number }>;
    byAnchorPeriod: Record<string, { total: number; passed: number; successRate: number }>;
    byDeltaTimeframe: Record<string, { total: number; passed: number; successRate: number }>;
    withDeltaOn: { total: number; passed: number; successRate: number };
    withDeltaOff: { total: number; passed: number; successRate: number };
    failureReasons: Record<string, number>;
  };
  recommendations: {
    working: CVDCombination[];
    failing: CVDCombination[];
    optimal: CVDCombination[];
  };
}

// ============================================================================
// TEST MATRIX WITH PROPER CONSTRAINTS
// ============================================================================

// Helper to check if delta timeframe is valid for chart timeframe
function isValidDeltaForChart(chartTF: string, deltaTF: string): boolean {
  const timeframeOrder = ['15S', '30S', '1', '5', '15', '30', '60', 'D', 'W', 'M'];
  
  const chartIdx = timeframeOrder.indexOf(chartTF);
  const deltaIdx = timeframeOrder.indexOf(deltaTF);
  
  // Delta must be less than chart timeframe
  return deltaIdx < chartIdx;
}

// Generate combinations respecting constraints
function generateCVDCombinations(): CVDCombination[] {
  const combinations: CVDCombination[] = [];
  let id = 1;
  
  // Chart timeframes to test
  const chartTimeframes = [
    { value: '15', label: '15min' },
    { value: '60', label: '1H' },
    { value: 'D', label: 'Daily' },
    { value: 'W', label: 'Weekly' },
  ];
  
  // CVD anchor periods (corrected - max 12M)
  const anchorPeriods = ['1W', '1M', '3M', '6M', '12M'];
  
  // CVD delta timeframes (will be filtered per chart)
  const allDeltaTimeframes = ['15S', '30S', '1', '5', '15', '30', '60', 'D'];
  
  // Show delta options
  const showDeltaOptions = [true, false];
  
  for (const chart of chartTimeframes) {
    // Filter valid delta timeframes for this chart
    const validDeltaTimeframes = allDeltaTimeframes.filter(deltaTF => 
      isValidDeltaForChart(chart.value, deltaTF)
    );
    
    for (const anchor of anchorPeriods) {
      for (const deltaTF of validDeltaTimeframes) {
        for (const showDelta of showDeltaOptions) {
          combinations.push({
            id: `cvd-${id}`,
            chartTimeframe: chart.value,
            chartTimeframeLabel: chart.label,
            cvdAnchorPeriod: anchor,
            cvdShowDelta: showDelta,
            cvdDeltaTimeframe: deltaTF,
            description: `Chart ${chart.label} | Anchor ${anchor} | Delta ${deltaTF} | Show: ${showDelta ? 'ON' : 'OFF'}`,
          });
          id++;
        }
      }
    }
  }
  
  return combinations;
}

const CVD_COMBINATIONS = generateCVDCombinations();

// ============================================================================
// CVD TEST POC
// ============================================================================

class CVDSettingsTestPOC extends BasePOC<TestConfig, TestOutput> {
  private sessionProvider!: SessionProvider;
  private output!: OutputManager;
  private results: CVDTestResult[] = [];
  private testStartTime!: number;
  
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
    
    logger.section('CVD SETTINGS COMBINATIONS TEST (CORRECTED)');
    logger.info('Testing CVD with proper chart timeframe constraint');
    logger.info(`Total combinations: ${CVD_COMBINATIONS.length}`);
    logger.info(`Symbol: ${this.config.testSymbol}`);
    logger.info(`Bars: ${this.config.barsCount}`);
    logger.newline();
    logger.warning('CONSTRAINT: CVD delta timeframe < Chart timeframe');
    logger.newline();
    
    this.sessionProvider = new SessionProvider();
    this.testStartTime = Date.now();
  }

  protected async execute(): Promise<TestOutput> {
    const logger = this.getLogger();
    
    await this.setupAuthentication();
    
    logger.section('TESTING CVD COMBINATIONS');
    logger.info(`Testing ${CVD_COMBINATIONS.length} combinations...`);
    logger.newline();
    
    let completed = 0;
    for (const combination of CVD_COMBINATIONS) {
      completed++;
      logger.subsection(`Test ${completed}/${CVD_COMBINATIONS.length}: ${combination.id}`);
      logger.info(combination.description);
      
      const result = await this.testCVDCombination(combination);
      this.results.push(result);
      
      if (result.success) {
        logger.success(`✅ PASS (${result.duration}ms) - ${result.cvdDataPoints} CVD points`);
      } else {
        logger.error(`❌ FAIL (${result.duration}ms) - ${result.error}`);
      }
      
      await this.delay(1500);
    }
    
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
    
    logger.section('TEST SUMMARY');
    logger.newline();
    logger.success(`✅ Passed:  ${result.summary.passed}/${result.summary.total} (${result.summary.successRate.toFixed(1)}%)`);
    logger.error(`❌ Failed:  ${result.summary.failed}/${result.summary.total} (${(100 - result.summary.successRate).toFixed(1)}%)`);
    logger.info(`⏱️  Duration: ${(result.summary.duration / 1000).toFixed(1)}s`);
    logger.newline();
    
    // Analysis by chart timeframe
    logger.subsection('Analysis by Chart Timeframe');
    for (const [tf, stats] of Object.entries(result.analysis.byChartTimeframe)) {
      const emoji = stats.successRate === 100 ? '✅' : stats.successRate >= 75 ? '⚠️' : '❌';
      logger.raw(`${emoji} ${tf.padEnd(10)}: ${stats.passed}/${stats.total} (${stats.successRate.toFixed(0)}%)`);
    }
    logger.newline();
    
    // Analysis by anchor period
    logger.subsection('Analysis by CVD Anchor Period');
    for (const [anchor, stats] of Object.entries(result.analysis.byAnchorPeriod)) {
      const emoji = stats.successRate === 100 ? '✅' : stats.successRate >= 75 ? '⚠️' : '❌';
      logger.raw(`${emoji} ${anchor.padEnd(10)}: ${stats.passed}/${stats.total} (${stats.successRate.toFixed(0)}%)`);
    }
    logger.newline();
    
    // Analysis by delta timeframe
    logger.subsection('Analysis by CVD Delta Timeframe');
    for (const [delta, stats] of Object.entries(result.analysis.byDeltaTimeframe)) {
      const emoji = stats.successRate === 100 ? '✅' : stats.successRate >= 75 ? '⚠️' : '❌';
      logger.raw(`${emoji} ${delta.padEnd(10)}: ${stats.passed}/${stats.total} (${stats.successRate.toFixed(0)}%)`);
    }
    logger.newline();
    
    // Delta on/off
    logger.subsection('Show Delta Analysis');
    logger.info(`Delta ON:  ${result.analysis.withDeltaOn.passed}/${result.analysis.withDeltaOn.total} (${result.analysis.withDeltaOn.successRate.toFixed(0)}%)`);
    logger.info(`Delta OFF: ${result.analysis.withDeltaOff.passed}/${result.analysis.withDeltaOff.total} (${result.analysis.withDeltaOff.successRate.toFixed(0)}%)`);
    logger.newline();
    
    // Failures
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
      logger.subsection('🎯 OPTIMAL COMBINATIONS');
      result.recommendations.optimal.forEach(c => {
        logger.success(`  • ${c.description}`);
      });
      logger.newline();
    }
    
    if (result.recommendations.failing.length > 0) {
      logger.subsection('❌ FAILING COMBINATIONS');
      result.recommendations.failing.slice(0, 5).forEach(c => {
        logger.error(`  • ${c.description}`);
      });
      logger.newline();
    }
    
    logger.raw('─'.repeat(80) + '\n');
    
    await this.output.saveResult('cvd-settings-correct-test-results.json', result);
    logger.info(`📄 Results saved to: cvd-settings-correct-test-results.json`);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('\n💥 Fatal error:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // HELPERS
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
    
    logger.success('Session retrieved');
    
    this.jwtToken = await getDataAccessToken(
      this.sessionId,
      this.sessionIdSign || '',
      this.userId
    );
    
    logger.success('JWT token obtained');
    logger.newline();
  }

  private async testCVDCombination(combination: CVDCombination): Promise<CVDTestResult> {
    const start = Date.now();
    const pool = getConnectionPool();
    
    try {
      if (!this.sessionIdSign) {
        throw new Error('No sessionid_sign available');
      }
      
      await getCVDConfig(this.sessionId, this.sessionIdSign);
      
      const result = await pool.fetchChartData(
        this.jwtToken,
        this.config.testSymbol,
        combination.chartTimeframe,  // Use the chart timeframe from combination
        this.config.barsCount,
        {
          cvdEnabled: true,
          cvdAnchorPeriod: combination.cvdAnchorPeriod,
          cvdTimeframe: combination.cvdDeltaTimeframe,
          sessionId: this.sessionId,
          sessionIdSign: this.sessionIdSign,
        }
      );
      
      const duration = Date.now() - start;
      
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
      
      return {
        combination,
        success: true,
        duration,
        hasCVD: true,
        cvdDataPoints,
        barsReceived: result.bars.length,
        cvdStudyId: result.indicators?.cvd?.studyId,
        cvdStudyName: result.indicators?.cvd?.studyName,
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

  private analyzeResults(): TestOutput['analysis'] {
    const byChartTimeframe: Record<string, any> = {};
    const byAnchorPeriod: Record<string, any> = {};
    const byDeltaTimeframe: Record<string, any> = {};
    const withDeltaOn = { total: 0, passed: 0, successRate: 0 };
    const withDeltaOff = { total: 0, passed: 0, successRate: 0 };
    const failureReasons: Record<string, number> = {};
    
    // Group by chart timeframe
    for (const result of this.results) {
      const tf = result.combination.chartTimeframeLabel;
      if (!byChartTimeframe[tf]) {
        byChartTimeframe[tf] = { total: 0, passed: 0, successRate: 0 };
      }
      byChartTimeframe[tf].total++;
      if (result.success) byChartTimeframe[tf].passed++;
    }
    
    for (const stats of Object.values(byChartTimeframe)) {
      stats.successRate = (stats.passed / stats.total) * 100;
    }
    
    // Group by anchor period
    for (const result of this.results) {
      const anchor = result.combination.cvdAnchorPeriod;
      if (!byAnchorPeriod[anchor]) {
        byAnchorPeriod[anchor] = { total: 0, passed: 0, successRate: 0 };
      }
      byAnchorPeriod[anchor].total++;
      if (result.success) byAnchorPeriod[anchor].passed++;
    }
    
    for (const stats of Object.values(byAnchorPeriod)) {
      stats.successRate = (stats.passed / stats.total) * 100;
    }
    
    // Group by delta timeframe
    for (const result of this.results) {
      const delta = result.combination.cvdDeltaTimeframe;
      if (!byDeltaTimeframe[delta]) {
        byDeltaTimeframe[delta] = { total: 0, passed: 0, successRate: 0 };
      }
      byDeltaTimeframe[delta].total++;
      if (result.success) byDeltaTimeframe[delta].passed++;
    }
    
    for (const stats of Object.values(byDeltaTimeframe)) {
      stats.successRate = (stats.passed / stats.total) * 100;
    }
    
    // Delta on/off
    for (const result of this.results) {
      if (result.combination.cvdShowDelta) {
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
    const working: CVDCombination[] = [];
    const failing: CVDCombination[] = [];
    const optimal: CVDCombination[] = [];
    
    for (const result of this.results) {
      if (result.success) {
        working.push(result.combination);
        
        // Optimal: Fast, common settings, matches user's usage
        if (
          result.duration < 3000 &&
          result.cvdDataPoints > 100 &&
          ['3M', '6M'].includes(result.combination.cvdAnchorPeriod) &&
          ['15S', '1', '5'].includes(result.combination.cvdDeltaTimeframe)
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
      optimal: optimal.slice(0, 5),
    };
  }

  private getLogger() {
    return this.output.getLogger();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const parser = new ArgParser();
  const userEmail = parser.get(0);
  const userPassword = parser.get(1);
  
  if (!userEmail || !userPassword) {
    console.error('\n❌ Usage: tsx scripts/migrated/tests/test-cvd-settings-combinations-correct.ts <userEmail> <userPassword>');
    console.error('Example: tsx scripts/migrated/tests/test-cvd-settings-combinations-correct.ts user@example.com password\n');
    process.exit(1);
  }
  
  console.log('\n📊 CVD Combinations to test:');
  console.log(`   Total: ${CVD_COMBINATIONS.length}`);
  console.log('\n   Breakdown:');
  const byChart = CVD_COMBINATIONS.reduce((acc, c) => {
    acc[c.chartTimeframeLabel] = (acc[c.chartTimeframeLabel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  for (const [chart, count] of Object.entries(byChart)) {
    console.log(`   - ${chart}: ${count} combinations`);
  }
  console.log('');
  
  const poc = new CVDSettingsTestPOC({
    credentials: { userEmail, userPassword },
    outputDir: POCConfig.getOutputDir('cvd-settings-correct-test'),
    testSymbol: 'NSE:RELIANCE',
    barsCount: 100,
  });
  
  const result = await poc.run();
  const exitCode = result.success && result.data?.summary.successRate === 100 ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\n💥 Error:', error);
  process.exit(1);
});
