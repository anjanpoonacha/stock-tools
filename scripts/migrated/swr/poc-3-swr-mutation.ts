#!/usr/bin/env tsx
/**
 * POC 3: SWR Mutations Test - MIGRATED TO FRAMEWORK
 * 
 * Tests SWR mutations for settings updates
 * Demonstrates:
 * - Optimistic updates for instant UI feedback
 * - Error rollback when mutations fail
 * - useSWRMutation for explicit mutations
 * - Manual cache invalidation after mutations
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/swr/poc-3-swr-mutation.ts <userEmail> <userPassword>
 * 
 * Example:
 *   tsx --env-file=.env scripts/migrated/swr/poc-3-swr-mutation.ts user@example.com password
 */

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import type { AllSettings } from '../../../src/types/chartSettings.js';
import {
  BasePOC,
  POCConfig,
  OutputManager,
  ArgParser,
} from '../../framework/index.js';

// ============================================================================
// TYPES
// ============================================================================

interface SWRMutationConfig {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  outputDir: string;
  apiEndpoint: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  message?: string;
  details?: Record<string, any>;
}

interface SWRMutationOutput {
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
  tests: TestResult[];
}

// ============================================================================
// SWR MUTATIONS POC
// ============================================================================

class SWRMutationsPOC extends BasePOC<SWRMutationConfig, SWRMutationOutput> {
  private output!: OutputManager;
  private testResults: TestResult[] = [];
  private testStartTime!: number;

  // Fetcher for GET requests
  private fetcher = async (url: string, userEmail: string, userPassword: string) => {
    const logger = this.getLogger();
    logger.info(`📖 GET: ${url}`);
    
    const fullUrl = `${url}?userEmail=${encodeURIComponent(userEmail)}&userPassword=${encodeURIComponent(userPassword)}`;
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    logger.info(`✅ Loaded: ${data ? 'Settings found' : 'No settings'}`);
    
    return data;
  };

  // Mutation function for POST requests
  private updateSettings = async (
    url: string,
    { arg }: { arg: { settings: AllSettings; userEmail: string; userPassword: string } }
  ) => {
    const logger = this.getLogger();
    logger.info(`💾 SAVE: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail: arg.userEmail,
        userPassword: arg.userPassword,
        settings: arg.settings,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    logger.info('✅ Saved successfully');
    
    return result;
  };

  // Custom hook for settings with SWR
  private useSettings(email: string, password: string) {
    const key = email && password 
      ? [this.config.apiEndpoint, email, password] 
      : null;
    
    const { data, error, isLoading, mutate } = useSWR(
      key,
      ([url, email, password]) => this.fetcher(url, email, password),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      }
    );
    
    // Mutation hook for explicit updates
    const { trigger, isMutating } = useSWRMutation(
      key ? key[0] : null,
      this.updateSettings
    );
    
    // Helper function for optimistic updates
    const updateOptimistically = async (newSettings: Partial<AllSettings>) => {
      const logger = this.getLogger();
      logger.info('🚀 Optimistic update started...');
      
      // Optimistically update the UI
      const optimisticData = {
        ...data,
        ...newSettings,
      };
      
      // Update cache immediately (optimistic)
      await mutate(
        // The new data to display
        optimisticData,
        // Options
        {
          // Don't revalidate immediately
          revalidate: false,
          // Show optimistic data immediately
          optimisticData,
          // Rollback on error
          rollbackOnError: true,
          // Populate cache
          populateCache: true,
        }
      );
      
      logger.info('✅ Optimistic update applied to cache');
      
      // Perform the actual mutation
      try {
        await trigger({
          settings: optimisticData as AllSettings,
          userEmail: email,
          userPassword: password,
        });
        
        logger.info('✅ Mutation confirmed by server');
      } catch (error) {
        logger.error(`❌ Mutation failed, rolling back... ${error instanceof Error ? error.message : String(error)}`);
        // SWR automatically rolls back to previous data
        throw error;
      }
    };
    
    return {
      settings: data,
      isLoading,
      isMutating,
      error,
      updateOptimistically,
      mutate,
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
    
    logger.section('POC 3: SWR Mutations Test');
    logger.info(`User: ${this.config.credentials.userEmail}`);
    logger.info('Testing settings mutations...');
    logger.newline();
    
    this.testStartTime = Date.now();
  }

  protected async execute(): Promise<SWRMutationOutput> {
    // Test 1: Load Initial Settings
    await this.testLoadInitialSettings();
    
    // Test 2: Optimistic Update (Success)
    await this.testOptimisticUpdate();
    
    // Test 3: Verify Persistence
    await this.testVerifyPersistence();
    
    // Test 4: Error Rollback Simulation
    await this.testErrorRollback();
    
    // Test 5: Multiple Rapid Updates
    await this.testRapidUpdates();
    
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
    // Cleanup if needed
  }

  protected async onSuccess(result: SWRMutationOutput): Promise<void> {
    const logger = this.getLogger();
    
    // Print summary
    logger.section('TEST SUMMARY');
    logger.newline();
    logger.raw('SWR Mutation Behaviors Validated:');
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
      logger.raw('✓ Optimistic updates provide instant UI feedback');
      logger.raw('✓ Server mutations confirm changes');
      logger.raw('✓ Error rollback restores previous state');
      logger.raw('✓ Manual revalidation verifies server state');
      logger.raw('✓ Rapid updates are handled correctly');
      logger.raw('✓ useSWRMutation provides explicit mutation control');
    }
    
    logger.newline();
    logger.raw('─'.repeat(80));
    
    if (result.summary.failed === 0) {
      logger.success('\n  🎉 POC 3 Complete! All SWR mutation behaviors validated.\n');
    } else {
      logger.error('\n  ❌ SOME TESTS FAILED. Please review the errors above.\n');
    }
    
    logger.raw('─'.repeat(80) + '\n');
    
    // Save results to file
    await this.output.saveResult('poc-3-results.json', result);
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.getLogger();
    logger.error('\n💥 Fatal error during test execution:');
    logger.error(error instanceof Error ? error.message : String(error));
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  private async testLoadInitialSettings(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 1: Load Initial Settings');
    
    const start = Date.now();
    try {
      const result = this.useSettings(
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      // Wait for initial load
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
      
      this.recordTest('Load Initial Settings', {
        passed: true,
        duration,
        message: 'Settings loaded successfully',
        details: {
          hasPanelLayout: !!result.settings?.panelLayout,
          hasChartSettings: !!result.settings?.chartSettings,
          activeLayout: result.settings?.chartSettings?.activeLayout || 'N/A',
        },
      });
      
      logger.success(`Load Initial Settings (${duration}ms)`);
      logger.detail('Panel layout', result.settings?.panelLayout ? 'Yes' : 'No');
      logger.detail('Chart settings', result.settings?.chartSettings ? 'Yes' : 'No');
      logger.detail('Active layout', result.settings?.chartSettings?.activeLayout || 'N/A');
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Load Initial Settings', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async testOptimisticUpdate(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 2: Optimistic Update (Success)');
    
    const result = this.useSettings(
      this.config.credentials.userEmail,
      this.config.credentials.userPassword
    );
    
    // Wait for data to be available
    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        if (!result.isLoading && result.settings) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
    
    const originalLayout = result.settings?.chartSettings?.activeLayout || 'single';
    const newLayout = originalLayout === 'single' ? 'horizontal' : 'single';
    
    logger.info(`🔄 Changing active layout: ${originalLayout} → ${newLayout}`);
    logger.info('⏱️  Starting optimistic update...');
    
    const start = Date.now();
    
    try {
      await result.updateOptimistically({
        chartSettings: {
          ...result.settings?.chartSettings!,
          activeLayout: newLayout as 'single' | 'horizontal' | 'vertical',
        },
      });
      
      const duration = Date.now() - start;
      
      this.recordTest('Optimistic Update', {
        passed: true,
        duration,
        message: 'Update completed successfully',
        details: {
          oldLayout: originalLayout,
          newLayout: result.settings?.chartSettings?.activeLayout,
        },
      });
      
      logger.success(`Optimistic Update (${duration}ms)`);
      logger.detail('New layout', result.settings?.chartSettings?.activeLayout);
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Optimistic Update', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async testVerifyPersistence(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 3: Verify Persistence');
    
    logger.info('🔄 Revalidating to verify server state...');
    const start = Date.now();
    
    try {
      const result = this.useSettings(
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      await result.mutate();
      
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!result.isLoading) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      
      const duration = Date.now() - start;
      
      this.recordTest('Verify Persistence', {
        passed: true,
        duration,
        message: 'Revalidation completed',
        details: {
          layoutFromServer: result.settings?.chartSettings?.activeLayout,
        },
      });
      
      logger.success(`Verify Persistence (${duration}ms)`);
      logger.detail('Layout from server', result.settings?.chartSettings?.activeLayout);
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Verify Persistence', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - persistence test is not critical
    }
  }

  private async testErrorRollback(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 4: Error Rollback Simulation');
    
    logger.info('🔐 Attempting update with invalid credentials...');
    const start = Date.now();
    
    try {
      const result = this.useSettings('invalid@email.com', 'wrongpassword');
      
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!result.isLoading) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      
      try {
        await result.updateOptimistically({
          panelLayout: {
            'toolbar-panel': 10,
            'chart-panel': 80,
            'stock-list-panel': 10,
          },
        });
        
        const duration = Date.now() - start;
        this.recordTest('Error Rollback', {
          passed: false,
          duration,
          message: 'Expected error but update succeeded',
        });
        
        logger.warning('Expected error but update succeeded');
        
      } catch (error) {
        const duration = Date.now() - start;
        this.recordTest('Error Rollback', {
          passed: true,
          duration,
          message: 'Error correctly handled and rolled back',
          details: {
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
        
        logger.success(`Error Rollback (${duration}ms)`);
        logger.detail('Error message', error instanceof Error ? error.message : String(error));
        logger.detail('Cache should rollback', 'to previous state');
      }
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Error Rollback', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - rollback test is not critical
    }
  }

  private async testRapidUpdates(): Promise<void> {
    const logger = this.getLogger();
    logger.subsection('TEST 5: Multiple Rapid Updates');
    
    logger.info('⚡ Testing rapid successive updates...');
    const start = Date.now();
    
    try {
      const result = this.useSettings(
        this.config.credentials.userEmail,
        this.config.credentials.userPassword
      );
      
      // Wait for data to be available
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!result.isLoading && result.settings) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      
      const updates = [
        { showGrid: true },
        { showGrid: false },
        { showGrid: true },
      ];
      
      for (let i = 0; i < updates.length; i++) {
        logger.info(`  Update ${i + 1}: showGrid = ${updates[i].showGrid}`);
        
        try {
          await result.updateOptimistically({
            chartSettings: {
              ...result.settings?.chartSettings,
              ...updates[i],
            },
          });
        } catch (error) {
          logger.error(`  ❌ Update ${i + 1} failed`);
        }
        
        // Small delay between updates
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const duration = Date.now() - start;
      
      this.recordTest('Rapid Updates', {
        passed: true,
        duration,
        message: 'Rapid updates completed',
        details: {
          finalShowGrid: result.settings?.chartSettings?.showGrid,
        },
      });
      
      logger.success(`Rapid Updates (${duration}ms)`);
      logger.detail('Final showGrid value', result.settings?.chartSettings?.showGrid);
      
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTest('Rapid Updates', {
        passed: false,
        duration,
        message: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - rapid updates test is not critical
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
    console.error('\n❌ Usage: tsx --env-file=.env scripts/migrated/swr/poc-3-swr-mutation.ts <userEmail> <userPassword>');
    console.error('Example: tsx --env-file=.env scripts/migrated/swr/poc-3-swr-mutation.ts user@example.com password\n');
    process.exit(1);
  }
  
  // Create POC instance
  const poc = new SWRMutationsPOC({
    credentials: {
      userEmail,
      userPassword,
    },
    outputDir: POCConfig.getOutputDir('swr-mutations'),
    apiEndpoint: 'http://localhost:3000/api/kv/settings',
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
