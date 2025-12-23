#!/usr/bin/env tsx
/**
 * Verify CVD Fixes - MIGRATED TO FRAMEWORK
 * 
 * Checks that all CVD code changes are in place.
 * 
 * Usage:
 *   tsx scripts/migrated/tests/verify-cvd-fixes.ts
 */

import {
  BasePOC,
  POCConfig,
  OutputManager,
} from '../../framework/index.js';
import fs from 'fs';

// ============================================================================
// TYPES
// ============================================================================

interface VerifyCVDFixesConfig {
  outputDir: string;
}

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'success';
}

interface VerifyCVDFixesOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  checks: CheckResult[];
  allGood: boolean;
}

// ============================================================================
// VERIFY CVD FIXES POC
// ============================================================================

class VerifyCVDFixesPOC extends BasePOC<VerifyCVDFixesConfig, VerifyCVDFixesOutput> {
  private output!: OutputManager;
  private checks: CheckResult[] = [];
  private allGood = true;

  protected async setup(): Promise<void> {
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });
    
    const logger = this.getLogger();
    logger.section('VERIFYING CVD FIXES');
    logger.info('Checking that all code changes are in place');
    logger.newline();
  }

  protected async execute(): Promise<VerifyCVDFixesOutput> {
    await this.checkConnectionPoolImports();
    await this.checkConnectionPoolCVDConfig();
    await this.checkConnectionPoolValidation();
    await this.checkConnectionPoolText();
    await this.checkFetchBatchSignature();
    await this.checkTimeout();

    const passed = this.checks.filter(c => c.passed).length;
    const failed = this.checks.filter(c => !c.passed && c.severity === 'error').length;
    const warnings = this.checks.filter(c => !c.passed && c.severity === 'warning').length;

    return {
      summary: {
        total: this.checks.length,
        passed,
        failed,
        warnings,
      },
      checks: this.checks,
      allGood: this.allGood,
    };
  }

  protected async cleanup(): Promise<void> {
    // No cleanup needed
  }

  protected async onSuccess(result: VerifyCVDFixesOutput): Promise<void> {
    const logger = this.getLogger();
    
    logger.section('VERIFICATION SUMMARY');
    logger.newline();
    logger.success(`Passed: ${result.summary.passed}/${result.summary.total}`);
    logger.error(`Failed: ${result.summary.failed}/${result.summary.total}`);
    logger.warning(`Warnings: ${result.summary.warnings}/${result.summary.total}`);
    
    logger.newline();
    logger.raw('─'.repeat(80));
    
    if (result.allGood) {
      logger.success('\nAll CVD fixes verified!\n');
      logger.info('Next steps:');
      logger.info('1. Ensure TradingView session is in KV (via browser extension)');
      logger.info('2. Start dev server: pnpm dev');
      logger.info('3. Test CVD in chart component');
      logger.info('4. Check console for CVD diagnostic logs');
    } else {
      logger.error('\nSome fixes are missing or incomplete\n');
      logger.warning('Please review the changes above.');
      
      // Show failed checks
      logger.newline();
      logger.error('Failed Checks:');
      result.checks
        .filter(c => !c.passed && c.severity === 'error')
        .forEach(c => {
          logger.error(`  • ${c.name}: ${c.message}`);
        });
      
      if (result.summary.warnings > 0) {
        logger.newline();
        logger.warning('Warnings:');
        result.checks
          .filter(c => !c.passed && c.severity === 'warning')
          .forEach(c => {
            logger.warning(`  • ${c.name}: ${c.message}`);
          });
      }
    }
    
    logger.raw('─'.repeat(80) + '\n');
    
    await this.output.saveResult('verify-cvd-fixes-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('Fatal error during verification:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // CHECK METHODS
  // ============================================================================

  private async checkConnectionPoolImports(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Check 1: Connection Pool Imports');
    
    try {
      const poolFile = fs.readFileSync('src/lib/tradingview/connectionPool.ts', 'utf-8');
      
      const hasCVDConfigImport = poolFile.includes('getCVDConfig');
      const hasPineFeaturesImport = poolFile.includes('CVD_PINE_FEATURES');
      
      if (hasCVDConfigImport && hasPineFeaturesImport) {
        this.recordCheck('Connection Pool Imports', true, 'getCVDConfig and CVD_PINE_FEATURES imported', 'success');
        logger.success('getCVDConfig imported');
        logger.success('CVD_PINE_FEATURES imported');
      } else {
        this.recordCheck('Connection Pool Imports', false, 'Missing imports', 'error');
        if (!hasCVDConfigImport) logger.error('Missing getCVDConfig import');
        if (!hasPineFeaturesImport) logger.error('Missing CVD_PINE_FEATURES import');
        this.allGood = false;
      }
      
    } catch (error) {
      this.recordCheck('Connection Pool Imports', false, 'Failed to read file', 'error');
      logger.error('Failed to read connectionPool.ts');
      this.allGood = false;
    }
  }

  private async checkConnectionPoolCVDConfig(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Check 2: Connection Pool CVD Config');
    
    try {
      const poolFile = fs.readFileSync('src/lib/tradingview/connectionPool.ts', 'utf-8');
      
      const callsCVDConfig = poolFile.includes('await getCVDConfig(request.sessionId, request.sessionIdSign)');
      
      if (callsCVDConfig) {
        this.recordCheck('Dynamic CVD Config', true, 'Dynamic CVD config fetch implemented', 'success');
        logger.success('Dynamic CVD config fetch implemented');
      } else {
        this.recordCheck('Dynamic CVD Config', false, 'Still using empty CVD text', 'error');
        logger.error('Still using empty CVD text');
        this.allGood = false;
      }
      
    } catch (error) {
      this.recordCheck('Dynamic CVD Config', false, 'Failed to read file', 'error');
      logger.error('Failed to read connectionPool.ts');
      this.allGood = false;
    }
  }

  private async checkConnectionPoolValidation(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Check 3: Connection Pool Validation');
    
    try {
      const poolFile = fs.readFileSync('src/lib/tradingview/connectionPool.ts', 'utf-8');
      
      const hasValidation = poolFile.includes('if (!request.sessionId || !request.sessionIdSign)');
      
      if (hasValidation) {
        this.recordCheck('Credential Validation', true, 'Credential validation added', 'success');
        logger.success('Credential validation added');
      } else {
        this.recordCheck('Credential Validation', false, 'No credential validation', 'warning');
        logger.warning('No credential validation found');
      }
      
    } catch (error) {
      this.recordCheck('Credential Validation', false, 'Failed to read file', 'error');
      logger.error('Failed to read connectionPool.ts');
      this.allGood = false;
    }
  }

  private async checkConnectionPoolText(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Check 4: Connection Pool Text Usage');
    
    try {
      const poolFile = fs.readFileSync('src/lib/tradingview/connectionPool.ts', 'utf-8');
      
      const usesFetchedText = poolFile.includes('text: fetchedConfig.text');
      
      if (usesFetchedText) {
        this.recordCheck('Dynamic Encrypted Text', true, 'Using dynamic encrypted text', 'success');
        logger.success('Using dynamic encrypted text');
      } else {
        this.recordCheck('Dynamic Encrypted Text', false, 'Not using fetched config text', 'error');
        logger.error('Not using fetched config text');
        this.allGood = false;
      }
      
    } catch (error) {
      this.recordCheck('Dynamic Encrypted Text', false, 'Failed to read file', 'error');
      logger.error('Failed to read connectionPool.ts');
      this.allGood = false;
    }
  }

  private async checkFetchBatchSignature(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Check 5: FetchBatch Signature');
    
    try {
      const poolFile = fs.readFileSync('src/lib/tradingview/connectionPool.ts', 'utf-8');
      
      const hasSessionId = poolFile.match(/sessionId\?\s*:\s*string/);
      const hasSessionIdSign = poolFile.match(/sessionIdSign\?\s*:\s*string/);
      
      if (hasSessionId && hasSessionIdSign) {
        this.recordCheck('FetchBatch Signature', true, 'fetchBatch signature includes credentials', 'success');
        logger.success('fetchBatch signature includes credentials');
      } else {
        this.recordCheck('FetchBatch Signature', false, 'fetchBatch missing credential types', 'error');
        logger.error('fetchBatch missing credential types');
        this.allGood = false;
      }
      
    } catch (error) {
      this.recordCheck('FetchBatch Signature', false, 'Failed to read file', 'error');
      logger.error('Failed to read connectionPool.ts');
      this.allGood = false;
    }
  }

  private async checkTimeout(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('Check 6: Timeout Configuration');
    
    try {
      const baseFile = fs.readFileSync('src/lib/tradingview/baseWebSocketClient.ts', 'utf-8');
      
      const has2000msTimeout = baseFile.includes('Math.min(timeout, 2000)');
      const has800msTimeout = baseFile.includes('Math.min(timeout, 800)');
      
      if (has2000msTimeout) {
        this.recordCheck('CVD Timeout', true, 'CVD timeout increased to 2000ms', 'success');
        logger.success('CVD timeout increased to 2000ms');
      } else if (has800msTimeout) {
        this.recordCheck('CVD Timeout', false, 'Still using 800ms timeout', 'warning');
        logger.warning('Still using 800ms timeout');
      } else {
        this.recordCheck('CVD Timeout', false, 'Timeout configuration unclear', 'error');
        logger.error('Timeout configuration unclear');
        this.allGood = false;
      }
      
    } catch (error) {
      this.recordCheck('CVD Timeout', false, 'Failed to read file', 'error');
      logger.error('Failed to read baseWebSocketClient.ts');
      this.allGood = false;
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private recordCheck(name: string, passed: boolean, message: string, severity: 'error' | 'warning' | 'success'): void {
    this.checks.push({ name, passed, message, severity });
  }

  private getLogger() {
    return this.output.getLogger();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const poc = new VerifyCVDFixesPOC({
    outputDir: POCConfig.getOutputDir('verify-cvd-fixes'),
  });
  
  const result = await poc.run();
  const exitCode = result.success && result.data?.allGood ? 0 : 1;
  process.exit(exitCode);
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
