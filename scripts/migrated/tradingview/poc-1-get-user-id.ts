#!/usr/bin/env tsx
/**
 * POC Step 1: Get TradingView User ID (Framework-based)
 * 
 * Migrated version using POC framework for:
 * - Automatic session management (no hardcoded sessions)
 * - Standardized error handling
 * - Structured output management
 * 
 * Usage: tsx --env-file=.env scripts/migrated/tradingview/poc-1-get-user-id.ts <email> <password>
 */

import {
  BasePOC,
  SessionProvider,
  TVHttpClient,
  OutputManager,
  ArgParser,
  POCConfig,
} from '../../framework/index.js';

// ============================================================================
// Configuration & Output Types
// ============================================================================

interface POC1Config {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  outputDir: string;
}

interface POC1Output {
  userId: number;
  username?: string;
}

// ============================================================================
// POC Implementation
// ============================================================================

class GetUserIdPOC extends BasePOC<POC1Config, POC1Output> {
  private sessionProvider!: SessionProvider;
  private tvClient!: TVHttpClient;
  private output!: OutputManager;

  protected async setup(): Promise<void> {
    // Initialize output manager FIRST (needed for logging)
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });

    const logger = this.output.getLogger();
    
    logger.section('POC Step 1: Fetching TradingView User ID');
    logger.info(`User: ${this.config.credentials.userEmail}`);
    logger.newline();

    // Initialize session provider
    this.sessionProvider = new SessionProvider();

    // Get TradingView session for user
    logger.info('Fetching TradingView session...');
    const sessionInfo = await this.sessionProvider.getSessionForUser(
      'tradingview',
      this.config.credentials
    );

    // Extract session data
    const tvSession = this.sessionProvider.extractTVSession(sessionInfo);
    logger.success(`Session ID: ${tvSession.sessionId.substring(0, 20)}...`);
    logger.newline();

    // Initialize TV HTTP client
    this.tvClient = new TVHttpClient(tvSession.sessionId, tvSession.sessionIdSign);
  }

  protected async execute(): Promise<POC1Output> {
    const logger = this.output.getLogger();
    
    logger.info('Requesting user data from TradingView API...');
    
    // Fetch user ID
    const response = await this.tvClient.getUserId();

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch user ID');
    }

    const userId = response.data.userId;
    const username = response.data.username;
    
    logger.success(`User ID: ${userId}`);
    if (username) {
      logger.success(`Username: ${username}`);
    }
    logger.newline();

    return {
      userId,
      username,
    };
  }

  protected async cleanup(): Promise<void> {
    // Clear session cache
    this.sessionProvider.clearCache();
  }

  protected async onSuccess(result: POC1Output): Promise<void> {
    // Save result to file
    await this.output.saveResult('1-user-data.json', result);
    
    const logger = this.output.getLogger();
    logger.section('Step 1 Complete!');
    logger.info('Next step: Run `tsx --env-file=.env scripts/migrated/tradingview/poc-2-get-jwt-token.ts <email> <password>`');
    logger.newline();
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.output.getLogger();
    logger.section('Error');
    logger.error(this.getErrorMessage(error));
    logger.newline();
    logger.info('Troubleshooting:');
    logger.info('  - Check that session cookie is valid');
    logger.info('  - Try refreshing session with browser extension');
    logger.info('  - Verify you can access TradingView.com in browser');
    logger.newline();
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  const parser = new ArgParser();
  const userEmail = parser.get(0);
  const userPassword = parser.get(1);

  if (!userEmail || !userPassword) {
    console.error('Usage: tsx --env-file=.env scripts/migrated/tradingview/poc-1-get-user-id.ts <email> <password>');
    console.error('');
    console.error('Example:');
    console.error('  tsx --env-file=.env scripts/migrated/tradingview/poc-1-get-user-id.ts user@example.com password123');
    console.error('');
    process.exit(1);
  }

  const poc = new GetUserIdPOC({
    credentials: { userEmail, userPassword },
    outputDir: POCConfig.getOutputDir('tradingview'),
  });

  const result = await poc.run();
  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
