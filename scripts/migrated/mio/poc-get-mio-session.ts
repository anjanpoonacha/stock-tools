#!/usr/bin/env tsx
/**
 * Get MIO Session - MIGRATED TO FRAMEWORK
 * 
 * Helper to get MarketInOut session from KV storage
 * 
 * Usage:
 *   tsx --env-file=.env scripts/migrated/mio/poc-get-mio-session.ts
 * 
 * Before Framework: 58 lines
 * After Framework: ~80 lines (but better structured with proper error handling)
 */

import {
  BasePOC,
  POCConfig,
  SessionProvider,
  OutputManager,
} from '../../framework/index.js';

// ============================================================================
// TYPES
// ============================================================================

interface SessionConfig {
  outputDir: string;
}

interface SessionOutput {
  internalId: string;
  userEmail?: string;
  sessionKey: string;
  sessionValue: string;
  sessionValuePreview: string;
}

// ============================================================================
// GET MIO SESSION POC
// ============================================================================

class GetMIOSessionPOC extends BasePOC<SessionConfig, SessionOutput> {
  private sessionProvider!: SessionProvider;
  private output!: OutputManager;

  protected async setup(): Promise<void> {
    // Initialize output manager
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: false, // No need to save for simple display
      prettyPrint: true,
    });

    const logger = this.output.getLogger();
    logger.section('GET MIO SESSION FROM KV');
    logger.info('Searching for MarketInOut session...');
    logger.newline();

    // Initialize session provider
    this.sessionProvider = new SessionProvider();
  }

  protected async execute(): Promise<SessionOutput> {
    const logger = this.output.getLogger();

    try {
      // Get latest MIO session
      const sessionInfo = await this.sessionProvider.getSession('marketinout');

      if (!sessionInfo) {
        throw new Error('No MarketInOut session found in KV storage');
      }

      logger.success('Found MarketInOut session!');
      logger.newline();
      logger.detail('Internal ID', sessionInfo.internalId);

      if (sessionInfo.sessionData.userEmail) {
        logger.detail('User', sessionInfo.sessionData.userEmail);
      }

      // Extract ASPSESSION cookie
      const mioCookie = this.sessionProvider.extractMIOSession(sessionInfo);

      logger.newline();
      logger.raw('📋 Session found:');
      logger.detail('Key', mioCookie.key);
      logger.detail('Value', mioCookie.value.substring(0, 20) + '...');
      logger.newline();
      logger.success('Ready to use for POC testing!');

      return {
        internalId: sessionInfo.internalId,
        userEmail: sessionInfo.sessionData.userEmail,
        sessionKey: mioCookie.key,
        sessionValue: mioCookie.value,
        sessionValuePreview: mioCookie.value.substring(0, 20) + '...',
      };
    } catch (error) {
      logger.error('Error retrieving session');
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    // No cleanup needed for simple session fetch
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.output.getLogger();
    logger.newline();
    logger.error('Failed to retrieve MarketInOut session');
    logger.error(error instanceof Error ? error.message : String(error));
    logger.newline();
    logger.raw('Options:');
    logger.raw('1. Use browser extension to capture session from marketinout.com');
    logger.raw('2. Get ASPSESSION cookie from browser DevTools');
    logger.raw('3. Login to marketinout.com and check cookies');
    logger.newline();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  // Create POC instance
  const poc = new GetMIOSessionPOC({
    outputDir: POCConfig.getOutputDir('mio-session'),
  });

  // Run POC
  const result = await poc.run();

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
