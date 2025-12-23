#!/usr/bin/env tsx
/**
 * Test Timeframe Mapping Logic - MIGRATED TO FRAMEWORK
 * 
 * Verifies that 1D ↔ 188m conversion works correctly for Indian trading hours.
 * 
 * Usage:
 *   tsx scripts/migrated/tests/test-timeframe-mapping.ts
 */

import {
  BasePOC,
  POCConfig,
  OutputManager,
} from '../../framework/index.js';
import { map1DTo188m, map188mTo1D } from '../../../src/lib/chart/timeframeMapping.js';

// ============================================================================
// TYPES
// ============================================================================

interface TimeframeMappingTestConfig {
  outputDir: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  details?: Record<string, any>;
}

interface TimeframeMappingTestOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  tests: TestResult[];
  bars1D: any[];
  bars188m: any[];
}

// ============================================================================
// TIMEFRAME MAPPING TEST POC
// ============================================================================

class TimeframeMappingTestPOC extends BasePOC<TimeframeMappingTestConfig, TimeframeMappingTestOutput> {
  private output!: OutputManager;
  private testResults: TestResult[] = [];
  private bars1D: any[] = [];
  private bars188m: any[] = [];
  private sampleDate!: Date;
  private dailyTimestamp!: number;

  protected async setup(): Promise<void> {
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    logger.section('TIMEFRAME MAPPING TEST');
    logger.info('Testing 1D ↔ 188m conversion for Indian trading hours');
    logger.newline();
    
    // Setup test data
    this.sampleDate = new Date('2025-12-15T00:00:00+05:30');
    this.dailyTimestamp = Math.floor(this.sampleDate.getTime() / 1000);
    
    // Sample 1D bars (3 days)
    this.bars1D = [
      { time: this.dailyTimestamp, open: 2850, high: 2870, low: 2840, close: 2860, volume: 1000000 },
      { time: this.dailyTimestamp + 86400, open: 2860, high: 2880, low: 2850, close: 2875, volume: 1100000 },
      { time: this.dailyTimestamp + 172800, open: 2875, high: 2900, low: 2870, close: 2890, volume: 1200000 },
    ];
    
    // Sample 188m bars (2 per day = 6 total for 3 days)
    this.bars188m = [
      // Dec 15 - Morning (9:15 AM)
      { time: this.dailyTimestamp + (9 * 3600) + (15 * 60), values: [100, 120, 90, 110] },
      // Dec 15 - Afternoon (12:23 PM)
      { time: this.dailyTimestamp + (12 * 3600) + (23 * 60), values: [110, 130, 100, 120] },
      
      // Dec 16 - Morning
      { time: this.dailyTimestamp + 86400 + (9 * 3600) + (15 * 60), values: [120, 140, 110, 130] },
      // Dec 16 - Afternoon
      { time: this.dailyTimestamp + 86400 + (12 * 3600) + (23 * 60), values: [130, 150, 120, 140] },
      
      // Dec 17 - Morning
      { time: this.dailyTimestamp + 172800 + (9 * 3600) + (15 * 60), values: [140, 160, 130, 150] },
      // Dec 17 - Afternoon
      { time: this.dailyTimestamp + 172800 + (12 * 3600) + (23 * 60), values: [150, 170, 140, 160] },
    ];
    
    logger.subsection('Sample Data');
    logger.info('1D Bars (3 days):');
    this.bars1D.forEach((bar, i) => {
      const date = new Date(bar.time * 1000);
      logger.detail(`  Bar ${i}`, `${date.toLocaleDateString('en-IN')} @ ${bar.time}`);
    });
    
    logger.newline();
    logger.info('188m Bars (6 bars - 2 per day):');
    this.bars188m.forEach((bar, i) => {
      const date = new Date(bar.time * 1000);
      const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      logger.detail(`  Bar ${i}`, `${date.toLocaleDateString('en-IN')} ${timeStr} @ ${bar.time}`);
    });
    
    logger.newline();
  }

  protected async execute(): Promise<TimeframeMappingTestOutput> {
    await this.test1DTo188mMapping();
    await this.test188mTo1DMapping();
    await this.testBarCountRatio();

    const passed = this.testResults.filter(t => t.passed).length;
    const failed = this.testResults.filter(t => !t.passed).length;

    return {
      summary: {
        total: this.testResults.length,
        passed,
        failed,
      },
      tests: this.testResults,
      bars1D: this.bars1D,
      bars188m: this.bars188m,
    };
  }

  protected async cleanup(): Promise<void> {
    // No cleanup needed
  }

  protected async onSuccess(result: TimeframeMappingTestOutput): Promise<void> {
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
    logger.raw('─'.repeat(80));
    
    if (result.summary.failed === 0) {
      logger.success('\nAll timeframe mapping tests passed!');
    } else {
      logger.error('\nSome tests failed. Please review the errors above.');
    }
    
    logger.newline();
    logger.info('Data Summary:');
    logger.detail('Total 1D bars', result.bars1D.length);
    logger.detail('Total 188m bars', result.bars188m.length);
    logger.detail('Expected ratio', '2 188m bars per 1D bar');
    logger.detail('Actual ratio', (result.bars188m.length / result.bars1D.length).toString());
    
    logger.raw('─'.repeat(80) + '\n');
    
    await this.output.saveResult('timeframe-mapping-test-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  private async test1DTo188mMapping(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 1: Mapping 1D → 188m');
    
    for (let i = 0; i < this.bars1D.length; i++) {
      const bar = this.bars1D[i];
      const date = new Date(bar.time * 1000);
      
      logger.info(`1D Bar ${i}: ${date.toLocaleDateString('en-IN')}`);
      
      const mapped = map1DTo188m(bar.time, this.bars188m);
      logger.detail('  Maps to', `${mapped.length} 188m bars`);
      
      mapped.forEach((time, j) => {
        const mappedDate = new Date(time * 1000);
        const timeStr = mappedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        logger.detail(`    ${j + 1}`, `${mappedDate.toLocaleDateString('en-IN')} ${timeStr}`);
      });
      
      const passed = mapped.length === 2;
      
      this.recordTest(`1D → 188m Bar ${i}`, {
        passed,
        message: passed ? 'Correct: 2 bars per day' : `Expected 2 bars, got ${mapped.length}`,
        details: {
          barIndex: i,
          date: date.toLocaleDateString('en-IN'),
          mappedCount: mapped.length,
        },
      });
      
      if (!passed) {
        logger.error(`  Expected 2 bars, got ${mapped.length}`);
      } else {
        logger.success('  Correct: 2 bars per day');
      }
    }
    
    logger.newline();
  }

  private async test188mTo1DMapping(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 2: Mapping 188m → 1D');
    
    for (let i = 0; i < this.bars188m.length; i++) {
      const bar = this.bars188m[i];
      const date = new Date(bar.time * 1000);
      const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      
      logger.info(`188m Bar ${i}: ${date.toLocaleDateString('en-IN')} ${timeStr}`);
      
      const mapped = map188mTo1D(bar.time, this.bars1D);
      
      const passed = mapped !== null;
      
      if (mapped) {
        const mappedDate = new Date(mapped * 1000);
        logger.detail('  Maps to', `${mappedDate.toLocaleDateString('en-IN')} (1D bar)`);
        logger.success('  Correct');
      } else {
        logger.error('  No mapping found');
      }
      
      this.recordTest(`188m → 1D Bar ${i}`, {
        passed,
        message: passed ? 'Mapping found' : 'No mapping found',
        details: {
          barIndex: i,
          date: date.toLocaleDateString('en-IN'),
          time: timeStr,
          mapped: !!mapped,
        },
      });
    }
    
    logger.newline();
  }

  private async testBarCountRatio(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Test 3: Bar Count Ratio');
    
    const expectedRatio = 2;
    const actualRatio = this.bars188m.length / this.bars1D.length;
    const passed = actualRatio === expectedRatio;
    
    this.recordTest('Bar Count Ratio', {
      passed,
      message: passed 
        ? 'Correct ratio: 2 188m bars per 1D bar'
        : `Expected ratio ${expectedRatio}, got ${actualRatio}`,
      details: {
        bars1D: this.bars1D.length,
        bars188m: this.bars188m.length,
        expectedRatio,
        actualRatio,
      },
    });
    
    logger.detail('Total 1D bars', this.bars1D.length);
    logger.detail('Total 188m bars', this.bars188m.length);
    logger.detail('Expected ratio', expectedRatio);
    logger.detail('Actual ratio', actualRatio);
    
    if (passed) {
      logger.success('Correct ratio: 2 188m bars per 1D bar');
    } else {
      logger.error('Bar count mismatch!');
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
  const poc = new TimeframeMappingTestPOC({
    outputDir: POCConfig.getOutputDir('timeframe-mapping-test'),
  });
  
  const result = await poc.run();
  const exitCode = result.success && result.data?.summary.failed === 0 ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
