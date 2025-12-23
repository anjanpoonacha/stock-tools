#!/usr/bin/env tsx
/**
 * POC Step 2: Get JWT Token (Framework-based)
 * 
 * Migrated version using POC framework for:
 * - Automatic session management (no hardcoded sessions)
 * - Reusable HTTP client methods
 * - Standardized error handling
 * - Structured output management
 * 
 * Usage: tsx --env-file=.env scripts/migrated/tradingview/poc-2-get-jwt-token.ts <email> <password> [chartId]
 */

import {
  BasePOC,
  SessionProvider,
  TVHttpClient,
  OutputManager,
  ArgParser,
  POCConfig,
} from '../../framework/index.js';
import { readFileSync } from 'fs';

// ============================================================================
// Configuration & Output Types
// ============================================================================

interface POC2Config {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  chartId: string;
  outputDir: string;
  loadUserIdFromFile: boolean;
}

interface POC2Output {
  jwtToken: string;
  userId: number;
  chartId: string;
  expiresAt: number;
  expiresIn: number; // minutes
}

// ============================================================================
// POC Implementation
// ============================================================================

class GetJWTTokenPOC extends BasePOC<POC2Config, POC2Output> {
  private sessionProvider!: SessionProvider;
  private tvClient!: TVHttpClient;
  private output!: OutputManager;
  private userId!: number;

  protected async setup(): Promise<void> {
    // Initialize output manager FIRST (needed for logging)
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });

    const logger = this.output.getLogger();
    
    logger.section('POC Step 2: Fetching JWT Token');
    logger.info(`User: ${this.config.credentials.userEmail}`);
    logger.info(`Chart ID: ${this.config.chartId}`);
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

    // Get user ID (either from Step 1 output or fetch dynamically)
    if (this.config.loadUserIdFromFile) {
      this.userId = await this.loadUserIdFromFile();
      logger.info(`Loaded User ID from Step 1: ${this.userId}`);
    } else {
      logger.info('Fetching User ID...');
      const response = await this.tvClient.getUserId();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch user ID');
      }
      this.userId = response.data.userId;
      logger.success(`User ID: ${this.userId}`);
    }
    logger.newline();
  }

  protected async execute(): Promise<POC2Output> {
    const logger = this.output.getLogger();
    
    logger.info('Requesting JWT token from TradingView API...');
    logger.info(`  User ID: ${this.userId}`);
    logger.info(`  Chart ID: ${this.config.chartId}`);
    logger.newline();
    
    // Fetch JWT token
    const response = await this.tvClient.getJWTToken(this.userId, this.config.chartId);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch JWT token');
    }

    const jwtToken = response.data;
    
    // Decode JWT payload to get expiry
    const payloadBase64 = jwtToken.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    const expiresAt = payload.exp;
    const expiresIn = Math.round((expiresAt * 1000 - Date.now()) / 60000);
    
    logger.success(`JWT token obtained (${jwtToken.length} characters)`);
    logger.success(`Token expires in: ${expiresIn} minutes`);
    logger.success(`Token preview: ${jwtToken.substring(0, 50)}...`);
    logger.newline();

    return {
      jwtToken,
      userId: this.userId,
      chartId: this.config.chartId,
      expiresAt,
      expiresIn,
    };
  }

  protected async cleanup(): Promise<void> {
    // Clear session cache
    this.sessionProvider.clearCache();
  }

  protected async onSuccess(result: POC2Output): Promise<void> {
    // Save result to file
    await this.output.saveResult('2-jwt-token.json', result);
    
    const logger = this.output.getLogger();
    logger.section('Step 2 Complete!');
    logger.info('Next step: Run `tsx --env-file=.env scripts/migrated/tradingview/poc-3-websocket-client.ts <email> <password>`');
    logger.newline();
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.output.getLogger();
    logger.section('Error');
    logger.error(this.getErrorMessage(error));
    logger.newline();
    logger.info('Troubleshooting:');
    logger.info('  - Verify user_id is correct (from Step 1)');
    logger.info('  - Check that session cookie is still valid');
    logger.info('  - Try refreshing session with browser extension');
    logger.info('  - Ensure chart_id exists in config');
    logger.newline();
  }

  /**
   * Load user ID from Step 1 output file
   */
  private async loadUserIdFromFile(): Promise<number> {
    try {
      const filePath = `${this.config.outputDir}/1-user-data.json`;
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (!data.userId) {
        throw new Error('No userId found in Step 1 output');
      }
      return data.userId;
    } catch (error) {
      throw new Error(
        `Failed to load user ID from Step 1 output. Run Step 1 first or omit the --load-from-file flag. Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  const parser = new ArgParser();
  const userEmail = parser.get(0);
  const userPassword = parser.get(1);
  const chartId = parser.get(2) || 'S09yY40x'; // Default chart ID
  const loadFromFile = parser.hasFlag('--load-from-file');

  if (!userEmail || !userPassword) {
    console.error('Usage: tsx --env-file=.env scripts/migrated/tradingview/poc-2-get-jwt-token.ts <email> <password> [chartId] [--load-from-file]');
    console.error('');
    console.error('Arguments:');
    console.error('  email         - TradingView email');
    console.error('  password      - TradingView password');
    console.error('  chartId       - Chart ID (default: S09yY40x)');
    console.error('');
    console.error('Options:');
    console.error('  --load-from-file  - Load user ID from Step 1 output instead of fetching');
    console.error('');
    console.error('Example:');
    console.error('  tsx --env-file=.env scripts/migrated/tradingview/poc-2-get-jwt-token.ts user@example.com password123');
    console.error('  tsx --env-file=.env scripts/migrated/tradingview/poc-2-get-jwt-token.ts user@example.com password123 --load-from-file');
    console.error('');
    process.exit(1);
  }

  const poc = new GetJWTTokenPOC({
    credentials: { userEmail, userPassword },
    chartId,
    outputDir: POCConfig.getOutputDir('tradingview'),
    loadUserIdFromFile: loadFromFile,
  });

  const result = await poc.run();
  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
