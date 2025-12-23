#!/usr/bin/env tsx
/**
 * POC Step 3: WebSocket Client - Fetch Historical Bars (Framework-based)
 * 
 * Migrated version using POC framework for:
 * - Automatic session management (no hardcoded sessions)
 * - Reusable HTTP client methods for JWT
 * - Standardized error handling
 * - Structured output management
 * 
 * Usage: tsx --env-file=.env scripts/migrated/tradingview/poc-3-websocket-client.ts <email> <password> [options]
 */

import {
  BasePOC,
  SessionProvider,
  TVHttpClient,
  OutputManager,
  ArgParser,
  POCConfig,
} from '../../framework/index.js';
import { BaseWebSocketClient, type BaseClientConfig } from '../../../src/lib/tradingview/baseWebSocketClient.js';
import { createSymbolSpec, type TVMessage } from '../../poc-tradingview/poc-protocol.js';
import type { OHLCVBar, StudyData, TVSymbolResolved } from '../../poc-tradingview/poc-types.js';
import type { StudyConfig } from '../../../src/lib/tradingview/types.js';
import { CVD_ENCRYPTED_TEXT, CVD_PINE_FEATURES, CVD_PINE_METADATA } from '../../../src/lib/tradingview/cvd-constants.js';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';

// ============================================================================
// Configuration & Output Types
// ============================================================================

interface POC3Config {
  credentials: {
    userEmail: string;
    userPassword: string;
  };
  chartId: string;
  symbol: string;
  resolution: string;
  barsCount: number;
  cvdEnabled: boolean;
  cvdAnchorPeriod: string;
  cvdTimeframe?: string;
  outputDir: string;
  loadJWTFromFile: boolean;
}

interface POC3Output {
  symbol: string;
  resolution: string;
  bars: OHLCVBar[];
  symbolMetadata: Partial<TVSymbolResolved>;
  websocketSession: string;
  messagesExchanged: {
    sent: number;
    received: number;
  };
  indicators?: {
    cvd?: StudyData;
  };
}

// ============================================================================
// WebSocket Client Implementation
// ============================================================================

interface WSClientConfig extends BaseClientConfig {
  symbol: string;
  resolution: string;
  barsCount: number;
  cvdEnabled?: boolean;
  cvdAnchorPeriod?: string;
  cvdTimeframe?: string;
  outputDir: string;
}

class TradingViewWebSocketClient extends BaseWebSocketClient {
  private symbol: string;
  private resolution: string;
  private barsCount: number;
  private cvdEnabled: boolean;
  private cvdAnchorPeriod: string;
  private cvdTimeframe?: string;
  private outputDir: string;
  private messagesLog: string;

  constructor(config: WSClientConfig) {
    super({ ...config, enableLogging: true });

    this.symbol = config.symbol;
    this.resolution = config.resolution;
    this.barsCount = config.barsCount;
    this.cvdEnabled = config.cvdEnabled ?? false;
    this.cvdAnchorPeriod = config.cvdAnchorPeriod ?? '3M';
    this.cvdTimeframe = config.cvdTimeframe;
    this.outputDir = config.outputDir;
    this.messagesLog = `${this.outputDir}/3-websocket-messages.log`;

    console.log(`🔑 Chart Session ID: ${this.chartSessionId}`);
    console.log(`🔑 Quote Session ID: ${this.quoteSessionId}`);
    if (this.cvdEnabled) {
      console.log(`📊 CVD Enabled: Anchor=${this.cvdAnchorPeriod}, Timeframe=${this.cvdTimeframe || 'chart'}`);
    }
    console.log();
  }

  // ========================================================================
  // FILE LOGGING
  // ========================================================================

  private log(direction: 'SEND' | 'RECV', message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${direction}: ${message}\n`;
    appendFileSync(this.messagesLog, logEntry);
  }

  // ========================================================================
  // TEMPLATE METHOD IMPLEMENTATION
  // ========================================================================

  protected async requestHistoricalBars(): Promise<void> {
    console.log('📊 Requesting historical bars...\n');

    // Create chart session
    await this.createChartSession();

    // Create quote session (optional but mimics real flow)
    await this.createQuoteSession();

    // Create symbol specification
    const symbolSpec = createSymbolSpec(this.symbol);

    // Resolve symbol (get metadata)
    await this.resolveSymbol(symbolSpec);

    // Request historical bars
    await this.createSeries(this.resolution, this.barsCount);

    // Request CVD indicator if enabled
    if (this.cvdEnabled) {
      console.log('📊 Requesting CVD indicator...');
      const cvdConfig = this.buildCVDConfig();
      await this.createStudy('cvd_1', 'Script@tv-scripting-101!', cvdConfig);
    }

    console.log(`⏳ Waiting for data...`);
    console.log(`   Symbol: ${this.symbol}`);
    console.log(`   Resolution: ${this.resolution}`);
    console.log(`   Bars Count: ${this.barsCount}`);
    if (this.cvdEnabled) {
      console.log(`   CVD: Anchor=${this.cvdAnchorPeriod}, Timeframe=${this.cvdTimeframe || 'chart'}`);
    }
    console.log();

    // Wait for data to arrive
    await this.waitForData(5000);

    console.log('═'.repeat(60));
    console.log(`\n✅ Received ${this.getBars().length} bars`);
    if (this.cvdEnabled) {
      const cvd = this.getStudy('cvd_1');
      console.log(`✅ Received ${cvd?.values.length || 0} CVD data points`);
    }
    console.log();
  }

  private buildCVDConfig(): StudyConfig {
    return {
      text: CVD_ENCRYPTED_TEXT,
      pineId: CVD_PINE_METADATA.pineId,
      pineVersion: CVD_PINE_METADATA.pineVersion,
      pineFeatures: CVD_PINE_FEATURES,
      in_0: { v: this.cvdAnchorPeriod, f: true, t: 'resolution' },
      in_1: { v: !!this.cvdTimeframe, f: true, t: 'bool' },
      in_2: { v: this.cvdTimeframe || '', f: true, t: 'resolution' },
      __profile: { v: false, f: true, t: 'bool' }
    };
  }

  async fetchBars(): Promise<void> {
    await this.requestHistoricalBars();
  }

  // ========================================================================
  // LIFECYCLE HOOKS (POC-specific logging)
  // ========================================================================

  protected onBeforeConnect(url: string): void {
    console.log('🔌 Connecting to WebSocket...\n');
    console.log(`📡 WebSocket URL: ${url}\n`);
  }

  protected onConnected(): void {
    console.log('✅ WebSocket connected\n');
  }

  protected onAuthenticated(): void {
    console.log('✅ Authentication sent\n');
  }

  protected onMessageSent(message: TVMessage): void {
    console.log(`📤 Sending: ${message.m}`);
    const encoded = JSON.stringify(message);
    this.log('SEND', encoded);
  }

  protected onMessageReceived(message: TVMessage): void {
    console.log(`📥 Received: ${message.m || 'handshake'}`);
    const encoded = JSON.stringify(message);
    this.log('RECV', encoded);
  }

  protected onBeforeDisconnect(): void {
    console.log('\n🔌 Disconnecting WebSocket...');
  }

  protected onDisconnected(): void {
    console.log('🔌 WebSocket closed\n');
  }

  // ========================================================================
  // MESSAGE HANDLERS (POC-specific logging)
  // ========================================================================

  protected handleHandshake(_msg: unknown): void {
    console.log(`   ✓ Session ID: ${this.getSessionId()}\n`);
  }

  protected handleSymbolResolved(msg: TVMessage): void {
    super.handleSymbolResolved(msg);

    const metadata = this.getMetadata();
    console.log(`   ✓ Symbol: ${metadata.name} (${metadata.exchange})`);
    console.log(`   ✓ Currency: ${metadata.currency_code}`);
    console.log(`   ✓ Price Scale: ${metadata.pricescale}\n`);
  }

  protected handleStudyLoading(msg: TVMessage): void {
    super.handleStudyLoading(msg);
    console.log(`   ✓ Study loading confirmed\n`);
  }

  protected handleDataUpdate(msg: TVMessage): void {
    const beforeCount = this.getBars().length;
    const beforeCVDCount = this.getStudy('cvd_1')?.values.length || 0;

    super.handleDataUpdate(msg);

    const afterCount = this.getBars().length;
    const afterCVDCount = this.getStudy('cvd_1')?.values.length || 0;

    const newBars = afterCount - beforeCount;
    const newCVDPoints = afterCVDCount - beforeCVDCount;

    if (newBars > 0) {
      console.log(`   ✓ Bars received: ${newBars}`);
    }
    if (newCVDPoints > 0) {
      console.log(`   ✓ CVD points received: ${newCVDPoints}`);
    }
    if (newBars > 0 || newCVDPoints > 0) {
      console.log();
    }
  }

  // ========================================================================
  // POC-SPECIFIC OUTPUT
  // ========================================================================

  getResult(): POC3Output {
    const stats = this.getMessageStats();
    const cvd = this.getStudy('cvd_1');

    return {
      symbol: this.symbol,
      resolution: this.resolution,
      bars: this.getBars(),
      symbolMetadata: this.getMetadata() as Partial<TVSymbolResolved>,
      websocketSession: this.getSessionId(),
      messagesExchanged: {
        sent: stats?.sent || 0,
        received: stats?.received || 0,
      },
      indicators: cvd ? { cvd } : undefined
    };
  }
}

// ============================================================================
// POC Implementation
// ============================================================================

class WebSocketClientPOC extends BasePOC<POC3Config, POC3Output> {
  private sessionProvider!: SessionProvider;
  private tvClient!: TVHttpClient;
  private output!: OutputManager;
  private wsClient!: TradingViewWebSocketClient;
  private jwtToken!: string;

  protected async setup(): Promise<void> {
    // Initialize output manager FIRST (needed for logging)
    this.output = new OutputManager({
      directory: this.config.outputDir,
      saveToFile: true,
      prettyPrint: true,
    });

    const logger = this.output.getLogger();
    
    logger.section('POC Step 3: WebSocket Client - Fetch Historical Bars');
    logger.info(`User: ${this.config.credentials.userEmail}`);
    logger.info(`Symbol: ${this.config.symbol}`);
    logger.info(`Resolution: ${this.config.resolution}`);
    logger.info(`Bars Count: ${this.config.barsCount}`);
    logger.newline();

    // Clear previous messages log
    const messagesLog = `${this.config.outputDir}/3-websocket-messages.log`;
    writeFileSync(messagesLog, '');

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

    // Get JWT token (either from Step 2 output or fetch dynamically)
    if (this.config.loadJWTFromFile) {
      this.jwtToken = await this.loadJWTFromFile();
      logger.info(`Loaded JWT Token from Step 2 (${this.jwtToken.length} chars)`);
    } else {
      logger.info('Fetching User ID...');
      const userResponse = await this.tvClient.getUserId();
      if (!userResponse.success || !userResponse.data) {
        throw new Error(userResponse.error?.message || 'Failed to fetch user ID');
      }
      const userId = userResponse.data.userId;
      logger.success(`User ID: ${userId}`);

      logger.info('Fetching JWT Token...');
      const jwtResponse = await this.tvClient.getJWTToken(userId, this.config.chartId);
      if (!jwtResponse.success || !jwtResponse.data) {
        throw new Error(jwtResponse.error?.message || 'Failed to fetch JWT token');
      }
      this.jwtToken = jwtResponse.data;
      logger.success(`JWT Token obtained (${this.jwtToken.length} chars)`);
    }
    logger.newline();

    // Initialize WebSocket client
    this.wsClient = new TradingViewWebSocketClient({
      jwtToken: this.jwtToken,
      symbol: this.config.symbol,
      resolution: this.config.resolution,
      barsCount: this.config.barsCount,
      chartId: this.config.chartId,
      websocketUrl: 'wss://prodata.tradingview.com/socket.io/websocket',
      timeout: 30000,
      cvdEnabled: this.config.cvdEnabled,
      cvdAnchorPeriod: this.config.cvdAnchorPeriod,
      cvdTimeframe: this.config.cvdTimeframe,
      outputDir: this.config.outputDir,
    });
  }

  protected async execute(): Promise<POC3Output> {
    // Connect and authenticate
    await this.wsClient.connect();
    await this.wsClient.authenticate();

    // Fetch bars
    await this.wsClient.fetchBars();

    // Get result
    const result = this.wsClient.getResult();

    // Display sample bars
    console.log(`📈 Sample bars (first 5):\n`);
    result.bars.slice(0, 5).forEach((bar, idx) => {
      const date = new Date(bar.time * 1000).toISOString().split('T')[0];
      console.log(`  ${idx + 1}. ${date}: O=${bar.open} H=${bar.high} L=${bar.low} C=${bar.close} V=${bar.volume}`);
    });
    console.log();

    return result;
  }

  protected async cleanup(): Promise<void> {
    // Disconnect WebSocket
    if (this.wsClient) {
      this.wsClient.disconnect();
    }

    // Clear session cache
    this.sessionProvider.clearCache();
  }

  protected async onSuccess(result: POC3Output): Promise<void> {
    // Save result to file
    await this.output.saveResult('3-bars-output.json', result);
    
    const logger = this.output.getLogger();
    logger.section('Step 3 Complete!');
    logger.newline();
    logger.info('Summary:');
    logger.info(`  Symbol: ${result.symbol}`);
    logger.info(`  Resolution: ${result.resolution}`);
    logger.info(`  Bars: ${result.bars.length}`);
    logger.info(`  Exchange: ${result.symbolMetadata.exchange || 'N/A'}`);
    logger.info(`  Currency: ${result.symbolMetadata.currency_code || 'N/A'}`);
    logger.info(`  Messages Sent: ${result.messagesExchanged.sent}`);
    logger.info(`  Messages Received: ${result.messagesExchanged.received}`);

    if (result.bars.length > 0) {
      const firstBar = result.bars[0];
      const lastBar = result.bars[result.bars.length - 1];
      const firstDate = new Date(firstBar.time * 1000).toISOString().split('T')[0];
      const lastDate = new Date(lastBar.time * 1000).toISOString().split('T')[0];
      logger.info(`  Date Range: ${firstDate} to ${lastDate}`);
    }

    if (result.indicators?.cvd) {
      const cvdConfig = result.indicators.cvd.config;
      const in_0 = cvdConfig.in_0 as { v: string | number | boolean } | undefined;
      const in_1 = cvdConfig.in_1 as { v: boolean } | undefined;
      const in_2 = cvdConfig.in_2 as { v: string } | undefined;

      logger.newline();
      logger.info('CVD Indicator:');
      logger.info(`  Data Points: ${result.indicators.cvd.values.length}`);
      logger.info(`  Anchor Period: ${in_0?.v || 'N/A'}`);
      logger.info(`  Custom Timeframe: ${in_1?.v ? in_2?.v : 'chart'}`);
    }

    logger.newline();
    logger.info('Next: Use this data to render charts in your application!');
    logger.newline();
  }

  protected async onError(error: unknown): Promise<void> {
    const logger = this.output.getLogger();
    logger.section('Error');
    logger.error(this.getErrorMessage(error));
    logger.newline();
    logger.info('Troubleshooting:');
    logger.info('  - Check that JWT token is not expired (Step 2)');
    logger.info('  - Verify WebSocket URL is accessible');
    logger.info('  - Check symbol format (e.g., NSE:JUNIPER)');
    logger.info('  - Review messages log for details');
    logger.newline();
  }

  /**
   * Load JWT token from Step 2 output file
   */
  private async loadJWTFromFile(): Promise<string> {
    try {
      const filePath = `${this.config.outputDir}/2-jwt-token.json`;
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (!data.jwtToken) {
        throw new Error('No jwtToken found in Step 2 output');
      }
      return data.jwtToken;
    } catch (error) {
      throw new Error(
        `Failed to load JWT token from Step 2 output. Run Step 2 first or omit the --load-from-file flag. Error: ${error instanceof Error ? error.message : String(error)}`
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
  const symbol = parser.getFlag('--symbol') || 'NSE:JUNIPER';
  const resolution = parser.getFlag('--resolution') || '1D';
  const barsCount = parseInt(parser.getFlag('--bars') || '300', 10);
  const chartId = parser.getFlag('--chart') || 'S09yY40x';
  const cvdEnabled = parser.hasFlag('--cvd');
  const cvdAnchorPeriod = parser.getFlag('--cvd-anchor') || '3M';
  const cvdTimeframe = parser.getFlag('--cvd-timeframe');
  const loadFromFile = parser.hasFlag('--load-from-file');

  if (!userEmail || !userPassword) {
    console.error('Usage: tsx --env-file=.env scripts/migrated/tradingview/poc-3-websocket-client.ts <email> <password> [options]');
    console.error('');
    console.error('Arguments:');
    console.error('  email         - TradingView email');
    console.error('  password      - TradingView password');
    console.error('');
    console.error('Options:');
    console.error('  --symbol <symbol>          - Symbol to fetch (default: NSE:JUNIPER)');
    console.error('  --resolution <resolution>  - Resolution (default: 1D)');
    console.error('  --bars <count>             - Number of bars (default: 300)');
    console.error('  --chart <chartId>          - Chart ID (default: S09yY40x)');
    console.error('  --cvd                      - Enable CVD indicator');
    console.error('  --cvd-anchor <period>      - CVD anchor period (default: 3M)');
    console.error('  --cvd-timeframe <tf>       - CVD custom timeframe (e.g., 30S)');
    console.error('  --load-from-file           - Load JWT from Step 2 output instead of fetching');
    console.error('');
    console.error('Example:');
    console.error('  tsx --env-file=.env scripts/migrated/tradingview/poc-3-websocket-client.ts user@example.com password123');
    console.error('  tsx --env-file=.env scripts/migrated/tradingview/poc-3-websocket-client.ts user@example.com password123 --cvd --cvd-timeframe 30S');
    console.error('');
    process.exit(1);
  }

  const poc = new WebSocketClientPOC({
    credentials: { userEmail, userPassword },
    chartId,
    symbol,
    resolution,
    barsCount,
    cvdEnabled,
    cvdAnchorPeriod,
    cvdTimeframe,
    outputDir: POCConfig.getOutputDir('tradingview'),
    loadJWTFromFile: loadFromFile,
  });

  const result = await poc.run();
  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
