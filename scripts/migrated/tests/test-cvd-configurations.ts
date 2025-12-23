#!/usr/bin/env tsx
/**
 * CVD Configuration Matrix Test - POC
 * 
 * Tests all combinations of CVD configurations to identify intermittent failure patterns.
 * 
 * Bug Report: CVD data doesn't appear randomly with different configurations
 * - Chart timeframe: 188 minutes
 * - CVD anchor: 3M, 6M, 1Y (testing all)
 * - Custom period: none, 15S, 30S, 5min
 * 
 * Test Matrix: 3 anchors × 4 custom periods = 12 combinations
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/tests/test-cvd-configurations.ts <userEmail> <userPassword>
 * 
 * Example:
 *   tsx --env-file=.env scripts/migrated/tests/test-cvd-configurations.ts anjan 1234
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

interface CVDConfigTestConfig {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  outputDir: string;
  testSymbol: string;
  chartResolution: string;
  barsCount: number;
  testMatrix: {
    cvdAnchorPeriods: string[];
    cvdCustomPeriods: (string | undefined)[];
  };
}

interface ConfigurationTestResult {
  configId: number;
  anchor: string;
  customPeriod: string | undefined;
  customPeriodLabel: string;
  success: boolean;
  hasCVD: boolean;
  cvdDataPoints: number;
  barsReceived: number;
  duration: number;
  error?: string;
  details?: {
    sessionIdSignPresent: boolean;
    cvdConfigFetched: boolean;
    studyCreated: boolean;
  };
}

interface CVDConfigTestOutput {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: string;
    totalDuration: number;
  };
  testMatrix: {
    chartResolution: string;
    anchors: string[];
    customPeriods: string[];
    totalCombinations: number;
  };
  sessionInfo: {
    sessionId: string;
    hasSessionIdSign: boolean;
    userId: number;
  };
  jwtToken: string;
  results: ConfigurationTestResult[];
  patternAnalysis: {
    workingConfigs: number;
    failingConfigs: number;
    anchorResults: Record<string, { passed: number; failed: number }>;
    customPeriodResults: Record<string, { passed: number; failed: number }>;
    failurePattern?: string;
  };
}

// ============================================================================
// CVD CONFIGURATION MATRIX TEST POC
// ============================================================================

class CVDConfigurationTestPOC extends BasePOC<CVDConfigTestConfig, CVDConfigTestOutput> {
  private sessionProvider!: SessionProvider;
  private output!: OutputManager;
  private configResults: ConfigurationTestResult[] = [];
  private testStartTime!: number;
  
  // Session data (reused across all tests)
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
    
    logger.section('CVD CONFIGURATION MATRIX TEST');
    logger.info('Testing CVD with all configuration combinations');
    logger.info(`User: ${this.config.credentials.userEmail}`);
    logger.info(`Chart: ${this.config.testSymbol} @ ${this.config.chartResolution}`);
    logger.newline();
    
    // Initialize session provider
    this.sessionProvider = new SessionProvider();
    
    // One-time session setup
    await this.setupSession();
    await this.setupJWT();
    
    this.testStartTime = Date.now();
    
    // Display test matrix
    logger.subsection('Test Matrix');
    logger.info(`Chart Resolution: ${this.config.chartResolution}`);
    logger.info(`CVD Anchors: ${this.config.testMatrix.cvdAnchorPeriods.join(', ')}`);
    logger.info(`Custom Periods: ${this.config.testMatrix.cvdCustomPeriods.map(p => p || 'chart-timeframe').join(', ')}`);
    logger.info(`Total Combinations: ${this.config.testMatrix.cvdAnchorPeriods.length * this.config.testMatrix.cvdCustomPeriods.length}`);
    logger.newline();
  }

  protected async execute(): Promise<CVDConfigTestOutput> {
    const logger = this.getLogger();
    
    logger.section('RUNNING CONFIGURATION TESTS');
    logger.newline();
    
    const anchors = this.config.testMatrix.cvdAnchorPeriods;
    const customPeriods = this.config.testMatrix.cvdCustomPeriods;
    
    let configId = 1;
    const totalTests = anchors.length * customPeriods.length;
    
    // Test each combination
    for (const anchor of anchors) {
      logger.subsection(`Testing Anchor: ${anchor}`);
      
      for (const customPeriod of customPeriods) {
        const customLabel = customPeriod || 'chart-timeframe';
        logger.info(`[${configId}/${totalTests}] Testing: ${anchor} anchor + ${customLabel}`);
        
        const result = await this.testConfiguration(configId, anchor, customPeriod);
        this.configResults.push(result);
        
        // Log result
        if (result.success && result.hasCVD) {
          logger.success(`  ✅ PASS - ${result.cvdDataPoints} CVD points (${result.duration}ms)`);
        } else if (result.success && !result.hasCVD) {
          logger.warning(`  ⚠️  WARN - No CVD data (${result.duration}ms)`);
        } else {
          logger.error(`  ❌ FAIL - ${result.error || 'Unknown error'} (${result.duration}ms)`);
        }
        
        logger.newline();
        configId++;
        
        // Small delay between tests to avoid rate limiting
        await this.sleep(1000);
      }
    }
    
    // Calculate summary
    const totalDuration = Date.now() - this.testStartTime;
    const passed = this.configResults.filter(r => r.success && r.hasCVD).length;
    const failed = this.configResults.filter(r => !r.success || !r.hasCVD).length;
    const successRate = ((passed / totalTests) * 100).toFixed(1);
    
    // Analyze patterns
    const patternAnalysis = this.analyzePatterns();
    
    return {
      summary: {
        totalTests,
        passed,
        failed,
        successRate: `${successRate}%`,
        totalDuration,
      },
      testMatrix: {
        chartResolution: this.config.chartResolution,
        anchors: this.config.testMatrix.cvdAnchorPeriods,
        customPeriods: this.config.testMatrix.cvdCustomPeriods.map(p => p || 'chart-timeframe'),
        totalCombinations: totalTests,
      },
      sessionInfo: {
        sessionId: this.sessionId.substring(0, 10) + '...',
        hasSessionIdSign: !!this.sessionIdSign,
        userId: this.userId,
      },
      jwtToken: this.jwtToken.substring(0, 20) + '...',
      results: this.configResults,
      patternAnalysis,
    };
  }

  protected async cleanup(): Promise<void> {
    this.sessionProvider.clearCache();
  }

  protected async onSuccess(result: CVDConfigTestOutput): Promise<void> {
    const logger = this.getLogger();
    
    logger.section('TEST RESULTS SUMMARY');
    logger.newline();
    
    // Overall stats
    logger.subsection('Overall Statistics');
    logger.info(`Total Tests: ${result.summary.totalTests}`);
    logger.success(`✅ Passed: ${result.summary.passed}`);
    logger.error(`❌ Failed: ${result.summary.failed}`);
    logger.info(`Success Rate: ${result.summary.successRate}`);
    logger.info(`Total Duration: ${(result.summary.totalDuration / 1000).toFixed(2)}s`);
    logger.newline();
    
    // Pattern analysis
    logger.subsection('Pattern Analysis');
    logger.newline();
    
    // By anchor period
    logger.info('Results by Anchor Period:');
    for (const [anchor, stats] of Object.entries(result.patternAnalysis.anchorResults)) {
      const total = stats.passed + stats.failed;
      const rate = ((stats.passed / total) * 100).toFixed(0);
      const status = stats.failed === 0 ? '✅' : '❌';
      logger.raw(`  ${status} ${anchor}: ${stats.passed}/${total} passed (${rate}%)`);
    }
    logger.newline();
    
    // By custom period
    logger.info('Results by Custom Period:');
    for (const [period, stats] of Object.entries(result.patternAnalysis.customPeriodResults)) {
      const total = stats.passed + stats.failed;
      const rate = ((stats.passed / total) * 100).toFixed(0);
      const status = stats.failed === 0 ? '✅' : '❌';
      logger.raw(`  ${status} ${period}: ${stats.passed}/${total} passed (${rate}%)`);
    }
    logger.newline();
    
    // Failure pattern
    if (result.patternAnalysis.failurePattern) {
      logger.subsection('Failure Pattern Detected');
      logger.error(result.patternAnalysis.failurePattern);
      logger.newline();
    }
    
    // Failed configurations
    if (result.summary.failed > 0) {
      logger.subsection('Failed Configurations');
      result.results
        .filter(r => !r.success || !r.hasCVD)
        .forEach(r => {
          logger.error(`  • ${r.anchor} + ${r.customPeriodLabel}: ${r.error || 'No CVD data'}`);
          if (r.details) {
            logger.detail('    sessionIdSign', r.details.sessionIdSignPresent ? 'present' : 'MISSING');
            logger.detail('    cvdConfigFetched', r.details.cvdConfigFetched ? 'yes' : 'NO');
          }
        });
      logger.newline();
    }
    
    // Success message
    logger.raw('─'.repeat(80));
    if (result.summary.failed === 0) {
      logger.success('\n  🎉 ALL CONFIGURATIONS PASSED! CVD is working correctly.\n');
    } else {
      logger.error(`\n  ❌ ${result.summary.failed}/${result.summary.totalTests} CONFIGURATIONS FAILED\n`);
      logger.info('  📊 Check the pattern analysis above to identify the root cause.\n');
    }
    logger.raw('─'.repeat(80) + '\n');
    
    // Save results to file
    await this.output.saveResult('cvd-config-matrix-results.json', result);
    logger.info(`Results saved to: ${this.config.outputDir}/cvd-config-matrix-results.json`);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('\n💥 Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // SESSION & JWT SETUP (ONE-TIME)
  // ============================================================================

  private async setupSession(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Session Setup');
    
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
      
      logger.success('Session retrieved from KV');
      logger.detail('sessionId', this.sessionId.substring(0, 10) + '...');
      logger.detail('hasSessionIdSign', !!this.sessionIdSign);
      logger.detail('userId', this.userId);
      
      if (!this.sessionIdSign) {
        logger.warning('⚠️  sessionid_sign is MISSING - CVD will fail!');
      }
      
      logger.newline();
    } catch (error) {
      throw new Error(`Session setup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async setupJWT(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('JWT Token Setup');
    
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
      
      logger.success('JWT token extracted');
      logger.detail('tokenLength', token.length);
      logger.detail('tokenStart', token.substring(0, 20) + '...');
      logger.newline();
      
    } catch (error) {
      throw new Error(`JWT setup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================================
  // CONFIGURATION TESTING
  // ============================================================================

  private async testConfiguration(
    configId: number,
    anchor: string,
    customPeriod: string | undefined
  ): Promise<ConfigurationTestResult> {
    const start = Date.now();
    const customLabel = customPeriod || 'chart-timeframe';
    
    const result: ConfigurationTestResult = {
      configId,
      anchor,
      customPeriod,
      customPeriodLabel: customLabel,
      success: false,
      hasCVD: false,
      cvdDataPoints: 0,
      barsReceived: 0,
      duration: 0,
      details: {
        sessionIdSignPresent: !!this.sessionIdSign,
        cvdConfigFetched: false,
        studyCreated: false,
      },
    };
    
    try {
      // Verify CVD config can be fetched
      try {
        await getCVDConfig(this.sessionId, this.sessionIdSign);
        result.details!.cvdConfigFetched = true;
      } catch (error) {
        result.error = `CVD config fetch failed: ${error instanceof Error ? error.message : String(error)}`;
        result.duration = Date.now() - start;
        return result;
      }
      
      // Fetch chart data with CVD
      const pool = getConnectionPool();
      
      const chartResult = await pool.fetchChartData(
        this.jwtToken,
        this.config.testSymbol,
        this.config.chartResolution,
        this.config.barsCount,
        {
          cvdEnabled: true,
          cvdAnchorPeriod: anchor,
          cvdTimeframe: customPeriod,
          sessionId: this.sessionId,
          sessionIdSign: this.sessionIdSign,
        }
      );
      
      result.duration = Date.now() - start;
      
      // Validate results
      if (!chartResult.bars || chartResult.bars.length === 0) {
        result.error = 'No bars returned from connection pool';
        return result;
      }
      
      result.barsReceived = chartResult.bars.length;
      result.success = true;
      
      // Check CVD data
      const hasCVD = !!chartResult.indicators?.cvd;
      const cvdDataCount = chartResult.indicators?.cvd?.values?.length || 0;
      
      result.hasCVD = hasCVD;
      result.cvdDataPoints = cvdDataCount;
      
      if (hasCVD) {
        result.details!.studyCreated = true;
      } else {
        result.error = 'CVD was requested but not returned in response';
      }
      
    } catch (error) {
      result.duration = Date.now() - start;
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
    }
    
    return result;
  }

  // ============================================================================
  // PATTERN ANALYSIS
  // ============================================================================

  private analyzePatterns(): CVDConfigTestOutput['patternAnalysis'] {
    const anchorResults: Record<string, { passed: number; failed: number }> = {};
    const customPeriodResults: Record<string, { passed: number; failed: number }> = {};
    
    // Analyze by anchor period
    for (const result of this.configResults) {
      const anchorKey = result.anchor;
      if (!anchorResults[anchorKey]) {
        anchorResults[anchorKey] = { passed: 0, failed: 0 };
      }
      
      if (result.success && result.hasCVD) {
        anchorResults[anchorKey].passed++;
      } else {
        anchorResults[anchorKey].failed++;
      }
    }
    
    // Analyze by custom period
    for (const result of this.configResults) {
      const periodKey = result.customPeriodLabel;
      if (!customPeriodResults[periodKey]) {
        customPeriodResults[periodKey] = { passed: 0, failed: 0 };
      }
      
      if (result.success && result.hasCVD) {
        customPeriodResults[periodKey].passed++;
      } else {
        customPeriodResults[periodKey].failed++;
      }
    }
    
    // Detect failure pattern
    let failurePattern: string | undefined;
    
    // Check if specific anchor always fails
    const failingAnchors = Object.entries(anchorResults)
      .filter(([_, stats]) => stats.failed > 0 && stats.passed === 0)
      .map(([anchor, _]) => anchor);
    
    if (failingAnchors.length > 0) {
      failurePattern = `All tests with anchor period(s) [${failingAnchors.join(', ')}] failed. This anchor may be invalid or unsupported.`;
    }
    
    // Check if specific custom period always fails
    const failingPeriods = Object.entries(customPeriodResults)
      .filter(([_, stats]) => stats.failed > 0 && stats.passed === 0)
      .map(([period, _]) => period);
    
    if (failingPeriods.length > 0) {
      const periodMsg = `All tests with custom period(s) [${failingPeriods.join(', ')}] failed. This period format may be invalid.`;
      failurePattern = failurePattern ? `${failurePattern} ${periodMsg}` : periodMsg;
    }
    
    // Check if sessionIdSign missing
    const missingSessionIdSign = this.configResults.every(r => !r.details?.sessionIdSignPresent);
    if (missingSessionIdSign) {
      failurePattern = 'sessionid_sign is MISSING from session data. CVD requires this credential.';
    }
    
    // Check for random failures
    const allFailed = this.configResults.every(r => !r.success || !r.hasCVD);
    const someFailed = this.configResults.some(r => !r.success || !r.hasCVD);
    const allPassed = this.configResults.every(r => r.success && r.hasCVD);
    
    if (allFailed && !failurePattern) {
      failurePattern = 'ALL configurations failed. Likely issue: missing sessionIdSign, expired credentials, or CVD service unavailable.';
    } else if (someFailed && !failurePattern) {
      failurePattern = 'Random failures detected. No clear pattern. Possible causes: rate limiting, network issues, or WebSocket timeouts.';
    } else if (allPassed) {
      failurePattern = undefined; // No failures
    }
    
    const workingConfigs = this.configResults.filter(r => r.success && r.hasCVD).length;
    const failingConfigs = this.configResults.filter(r => !r.success || !r.hasCVD).length;
    
    return {
      workingConfigs,
      failingConfigs,
      anchorResults,
      customPeriodResults,
      failurePattern,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getLogger() {
    return this.output.getLogger();
  }

  private sleep(ms: number): Promise<void> {
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
    console.error('\n❌ Usage: tsx scripts/migrated/tests/test-cvd-configurations.ts <userEmail> <userPassword>');
    console.error('Example: tsx --env-file=.env scripts/migrated/tests/test-cvd-configurations.ts anjan 1234\n');
    process.exit(1);
  }
  
  // Test matrix based on bug report
  // User reported: Chart 188min, CVD anchors 3M/6M/12M, Custom periods 15S/30S/5min
  // Note: Constants show '1Y' (1 year = 12 months), not '12M'
  const testMatrix = {
    cvdAnchorPeriods: ['3M', '6M', '1Y'], // Testing all three mentioned anchors
    cvdCustomPeriods: [
      undefined,  // Use chart timeframe (188min)
      '15S',      // 15 seconds
      '30S',      // 30 seconds
      '5',        // 5 minutes (format per constants)
    ],
  };
  
  // Create POC instance
  const poc = new CVDConfigurationTestPOC({
    credentials: {
      userEmail,
      userPassword,
    },
    outputDir: POCConfig.getOutputDir('cvd-config-matrix'),
    testSymbol: 'NSE:RELIANCE',
    chartResolution: '188', // 188 minutes - per bug report
    barsCount: 100,
    testMatrix,
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
