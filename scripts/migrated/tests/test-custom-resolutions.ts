#!/usr/bin/env tsx
/**
 * Test Custom Resolution Support - MIGRATED TO FRAMEWORK
 * 
 * Tests whether TradingView API supports custom minute-based resolutions:
 * - 5 minutes
 * - 15 minutes
 * - 75 minutes
 * - 188 minutes
 * 
 * This test uses the existing chart-data API endpoint.
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/tests/test-custom-resolutions.ts <userEmail> <userPassword>
 * 
 * Prerequisites:
 *   - Next.js dev server must be running on localhost:3000
 *   - Valid credentials required
 */

import {
  BasePOC,
  POCConfig,
  OutputManager,
  ArgParser,
} from '../../framework/index.js';

// ============================================================================
// TYPES
// ============================================================================

interface CustomResolutionsTestConfig {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  outputDir: string;
  testSymbol: string;
  resolutions: Array<{
    value: string;
    label: string;
    barsCount: number;
  }>;
}

interface TestResult {
  resolution: string;
  label: string;
  supported: boolean;
  barsReceived: number;
  error?: string;
  details?: string;
}

interface CustomResolutionsTestOutput {
  summary: {
    total: number;
    supported: number;
    unsupported: number;
    successRate: number;
  };
  tests: TestResult[];
}

// ============================================================================
// CUSTOM RESOLUTIONS TEST POC
// ============================================================================

class CustomResolutionsTestPOC extends BasePOC<CustomResolutionsTestConfig, CustomResolutionsTestOutput> {
  private output!: OutputManager;
  private testResults: TestResult[] = [];

  protected async setup(): Promise<void> {
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    logger.section('CUSTOM RESOLUTION SUPPORT TEST');
    logger.info('Testing custom minute-based resolutions via Chart Data API');
    logger.info('Prerequisites: Next.js dev server running on localhost:3000');
    logger.newline();
    
    logger.detail('Test Symbol', this.config.testSymbol);
    logger.detail('User', this.config.credentials.userEmail);
    logger.detail('Resolutions', this.config.resolutions.map(r => r.label).join(', '));
    logger.newline();
  }

  protected async execute(): Promise<CustomResolutionsTestOutput> {
    for (const resConfig of this.config.resolutions) {
      await this.testResolution(resConfig);
      // Wait between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const supported = this.testResults.filter(t => t.supported).length;
    const unsupported = this.testResults.filter(t => !t.supported).length;
    const successRate = (supported / this.testResults.length) * 100;

    return {
      summary: {
        total: this.testResults.length,
        supported,
        unsupported,
        successRate,
      },
      tests: this.testResults,
    };
  }

  protected async cleanup(): Promise<void> {
    // No cleanup needed
  }

  protected async onSuccess(result: CustomResolutionsTestOutput): Promise<void> {
    const logger = this.getLogger();
    
    logger.section('TEST RESULTS');
    logger.newline();
    
    // Supported resolutions
    logger.subsection('Supported Resolutions');
    const supported = result.tests.filter(t => t.supported);
    if (supported.length === 0) {
      logger.warning('None - TradingView API may not support these custom resolutions');
    } else {
      supported.forEach(t => {
        logger.success(`${t.label} (${t.resolution}) - ${t.details}`);
      });
    }
    
    logger.newline();
    
    // Unsupported resolutions
    logger.subsection('Unsupported Resolutions');
    const unsupported = result.tests.filter(t => !t.supported);
    if (unsupported.length === 0) {
      logger.success('None - All resolutions supported! 🎉');
    } else {
      unsupported.forEach(t => {
        logger.error(`${t.label} (${t.resolution}) - ${t.error}`);
      });
    }
    
    logger.newline();
    
    // Summary
    logger.section('SUMMARY');
    logger.detail('Total Tested', result.summary.total);
    logger.detail('Supported', `${result.summary.supported} (${result.summary.successRate.toFixed(0)}%)`);
    logger.detail('Unsupported', `${result.summary.unsupported} (${(100 - result.summary.successRate).toFixed(0)}%)`);
    
    logger.newline();
    logger.raw('─'.repeat(80));
    
    if (result.summary.supported === result.summary.total) {
      logger.success('\nSUCCESS! All custom resolutions are supported by TradingView API.\n');
    } else if (result.summary.supported > 0) {
      logger.warning('\nPARTIAL: Some resolutions work, others don\'t.');
      logger.warning('Consider removing unsupported resolutions from the UI.\n');
    } else {
      logger.error('\nFAILURE: None of the custom resolutions are supported.');
      logger.warning('Recommend using standard resolutions only (1D, 1W, etc.)\n');
    }
    
    logger.raw('─'.repeat(80));
    
    logger.newline();
    logger.info('NOTE: Standard TradingView resolutions that always work:');
    logger.info('  • 1, 5, 15, 30, 60 (minutes)');
    logger.info('  • 1D, 1W, 1M (day, week, month)');
    logger.info('If custom resolutions fail, the UI will fall back to these.');
    logger.newline();
    
    await this.output.saveResult('custom-resolutions-test-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  private async testResolution(config: { value: string; label: string; barsCount: number }): Promise<void> {
    const logger = this.getLogger();
    logger.subsection(`Testing ${config.label} (${config.value})`);
    logger.detail('Requesting bars', config.barsCount);
    
    try {
      const url = new URL('http://localhost:3000/api/chart-data');
      url.searchParams.set('symbol', this.config.testSymbol);
      url.searchParams.set('resolution', config.value);
      url.searchParams.set('barsCount', config.barsCount.toString());
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userEmail: this.config.credentials.userEmail,
          userPassword: this.config.credentials.userPassword,
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.bars && result.bars.length > 0) {
        const testResult: TestResult = {
          resolution: config.value,
          label: config.label,
          supported: true,
          barsReceived: result.bars.length,
          details: `${result.bars.length} bars returned`,
        };
        
        this.testResults.push(testResult);
        
        logger.success(`Received ${result.bars.length} bars`);
        logger.detail('barsReceived', result.bars.length);
        
      } else {
        const errorMsg = result.error || 'No bars returned';
        
        const testResult: TestResult = {
          resolution: config.value,
          label: config.label,
          supported: false,
          barsReceived: 0,
          error: errorMsg,
        };
        
        this.testResults.push(testResult);
        
        logger.error(`Failed: ${errorMsg}`);
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      const testResult: TestResult = {
        resolution: config.value,
        label: config.label,
        supported: false,
        barsReceived: 0,
        error: errorMsg,
      };
      
      this.testResults.push(testResult);
      
      logger.error(`Error: ${errorMsg}`);
    }
    
    logger.newline();
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

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
  const userEmail = parser.get(0) || process.env.MIO_USER_EMAIL;
  const userPassword = parser.get(1) || process.env.MIO_USER_PASSWORD;
  
  if (!userEmail || !userPassword) {
    console.error('\n❌ Usage: tsx scripts/migrated/tests/test-custom-resolutions.ts <userEmail> <userPassword>');
    console.error('Or set environment variables: MIO_USER_EMAIL and MIO_USER_PASSWORD\n');
    process.exit(1);
  }
  
  const poc = new CustomResolutionsTestPOC({
    credentials: {
      userEmail,
      userPassword,
    },
    outputDir: POCConfig.getOutputDir('custom-resolutions-test'),
    testSymbol: 'NSE:RELIANCE',
    resolutions: [
      { value: '5', label: '5min', barsCount: 5760 },
      { value: '15', label: '15min', barsCount: 1920 },
      { value: '75', label: '75min', barsCount: 384 },
      { value: '188', label: '188min', barsCount: 154 },
    ],
  });
  
  const result = await poc.run();
  const exitCode = result.success && result.data?.summary.supported === result.data?.summary.total ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
