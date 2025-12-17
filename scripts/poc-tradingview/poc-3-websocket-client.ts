#!/usr/bin/env tsx
/**
 * POC Step 3: WebSocket Client - Fetch Historical Bars
 * 
 * Connects to TradingView WebSocket, authenticates with JWT, and fetches OHLCV data
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { config } from './poc-config.js';
import { BaseWebSocketClient, type BaseClientConfig } from '../../src/lib/tradingview/baseWebSocketClient.js';
import { createSymbolSpec, type TVMessage } from './poc-protocol.js';
import type { Step2Output, Step3Output, TVSymbolResolved } from './poc-types.js';
import type { StudyConfig } from '../../src/lib/tradingview/types.js';
import { CVD_ENCRYPTED_TEXT, CVD_PINE_FEATURES, CVD_PINE_METADATA } from '../../src/lib/tradingview/cvd-constants.js';

const INPUT_FILE = `${config.output.directory}/2-jwt-token.json`;
const OUTPUT_FILE = `${config.output.directory}/3-bars-output.json`;
const MESSAGES_LOG = `${config.output.directory}/3-websocket-messages.log`;

interface POCConfig extends BaseClientConfig {
	symbol: string;
	resolution: string;
	barsCount: number;
	// CVD configuration (optional)
	cvdEnabled?: boolean;
	cvdAnchorPeriod?: string;      // Default: "3M"
	cvdTimeframe?: string;          // e.g., "30S", "15S" (optional)
}

class TradingViewWebSocketClient extends BaseWebSocketClient {
	private symbol: string;
	private resolution: string;
	private barsCount: number;
	private cvdEnabled: boolean;
	private cvdAnchorPeriod: string;
	private cvdTimeframe?: string;
	
	constructor(config: POCConfig) {
		// Enable logging for POC
		super({ ...config, enableLogging: true });
		
		this.symbol = config.symbol;
		this.resolution = config.resolution;
		this.barsCount = config.barsCount;
		this.cvdEnabled = config.cvdEnabled ?? false;
		this.cvdAnchorPeriod = config.cvdAnchorPeriod ?? '3M';
		this.cvdTimeframe = config.cvdTimeframe;
		
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
		
		if (config.output.saveMessages) {
			appendFileSync(MESSAGES_LOG, logEntry);
		}
	}
	
	// ========================================================================
	// TEMPLATE METHOD IMPLEMENTATION
	// ========================================================================
	
	/**
	 * POC implementation: creates sessions, resolves symbol,
	 * requests series data (and optionally CVD indicator), and waits for data to arrive.
	 */
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
	
	/**
	 * Build CVD indicator configuration
	 */
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
	
	/**
	 * Public method to fetch bars (calls protected template method)
	 */
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
		// Call parent to extract metadata
		super.handleSymbolResolved(msg);
		
		// POC-specific logging
		const metadata = this.getMetadata();
		console.log(`   ✓ Symbol: ${metadata.name} (${metadata.exchange})`);
		console.log(`   ✓ Currency: ${metadata.currency_code}`);
		console.log(`   ✓ Price Scale: ${metadata.pricescale}\n`);
	}
	
	protected handleStudyLoading(msg: TVMessage): void {
		// Call parent (no-op)
		super.handleStudyLoading(msg);
		
		// POC-specific logging
		console.log(`   ✓ Study loading confirmed\n`);
	}
	
	protected handleDataUpdate(msg: TVMessage): void {
		const beforeCount = this.getBars().length;
		const beforeCVDCount = this.getStudy('cvd_1')?.values.length || 0;
		
		// Call parent to extract bars and study data
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
	
	getResult(): Step3Output {
		const stats = this.getMessageStats();
		const cvd = this.getStudy('cvd_1');
		
		return {
			success: this.getBars().length > 0,
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

// Main execution
async function main() {
	console.log('📊 POC Step 3: WebSocket Client - Fetch Historical Bars\n');
	console.log('═'.repeat(60) + '\n');
	
	// Clear previous log
	if (config.output.saveMessages) {
		writeFileSync(MESSAGES_LOG, '');
	}
	
	// Read JWT from Step 2
	let jwtToken: string;
	try {
		const step2Data = JSON.parse(readFileSync(INPUT_FILE, 'utf-8')) as Step2Output;
		if (!step2Data.success) {
			throw new Error('Step 2 failed - cannot proceed');
		}
		jwtToken = step2Data.jwtToken;
		console.log(`📂 Loaded JWT Token from Step 2 (${jwtToken.length} chars)\n`);
	} catch (error) {
		console.error(`❌ Error reading ${INPUT_FILE}:`, error);
		console.error('   Run: pnpm poc-2 first\n');
		process.exit(1);
	}
	
	const client = new TradingViewWebSocketClient({
		jwtToken,
		symbol: config.chart.symbol,
		resolution: config.chart.resolution,
		barsCount: config.chart.barsCount,
		chartId: config.chart.id,
		websocketUrl: config.websocket.url,
		timeout: config.websocket.timeout,
		// CVD configuration (set to true to enable)
		cvdEnabled: true,             // Enable CVD indicator
		cvdAnchorPeriod: '3M',        // 3 months lookback
		cvdTimeframe: '30S',          // 30-second bars
	});
	
	try {
		await client.connect();
		await client.authenticate();
		await client.fetchBars();
		
		const result = client.getResult();
		
		// Save output
		writeFileSync(
			OUTPUT_FILE,
			JSON.stringify(result, null, config.output.prettyPrint ? 2 : 0)
		);
		
		// Display sample bars
		console.log(`📈 Sample bars (first 5):\n`);
		result.bars.slice(0, 5).forEach((bar, idx) => {
			const date = new Date(bar.time * 1000).toISOString().split('T')[0];
			console.log(`  ${idx + 1}. ${date}: O=${bar.open} H=${bar.high} L=${bar.low} C=${bar.close} V=${bar.volume}`);
		});
		
		console.log(`\n💾 Output saved to: ${OUTPUT_FILE}`);
		if (config.output.saveMessages) {
			console.log(`📝 Messages log: ${MESSAGES_LOG}`);
		}
		
		console.log('\n═'.repeat(60));
		console.log('\n✅ Step 3 Complete!');
		console.log(`\n📊 Summary:`);
		console.log(`   Symbol: ${result.symbol}`);
		console.log(`   Resolution: ${result.resolution}`);
		console.log(`   Bars: ${result.bars.length}`);
		console.log(`   Exchange: ${result.symbolMetadata.exchange || 'N/A'}`);
		console.log(`   Currency: ${result.symbolMetadata.currency_code || 'N/A'}`);
		console.log(`   Messages Sent: ${result.messagesExchanged.sent}`);
		console.log(`   Messages Received: ${result.messagesExchanged.received}`);
		
		if (result.bars.length > 0) {
			const firstBar = result.bars[0];
			const lastBar = result.bars[result.bars.length - 1];
			const firstDate = new Date(firstBar.time * 1000).toISOString().split('T')[0];
			const lastDate = new Date(lastBar.time * 1000).toISOString().split('T')[0];
			console.log(`   Date Range: ${firstDate} to ${lastDate}`);
		}
		
		if (result.indicators?.cvd) {
			const cvdConfig = result.indicators.cvd.config;
			const in_0 = cvdConfig.in_0 as { v: string | number | boolean } | undefined;
			const in_1 = cvdConfig.in_1 as { v: boolean } | undefined;
			const in_2 = cvdConfig.in_2 as { v: string } | undefined;
			
			console.log(`\n📊 CVD Indicator:`);
			console.log(`   Data Points: ${result.indicators.cvd.values.length}`);
			console.log(`   Anchor Period: ${in_0?.v || 'N/A'}`);
			console.log(`   Custom Timeframe: ${in_1?.v ? in_2?.v : 'chart'}`);
			
			if (result.indicators.cvd.values.length > 0) {
				const firstCVD = result.indicators.cvd.values[0];
				const lastCVD = result.indicators.cvd.values[result.indicators.cvd.values.length - 1];
				const firstDate = new Date(firstCVD.time * 1000).toISOString();
				const lastDate = new Date(lastCVD.time * 1000).toISOString();
				console.log(`   Date Range: ${firstDate} to ${lastDate}`);
				console.log(`   Sample (first): time=${firstCVD.time}, values=${firstCVD.values.join(', ')}`);
				console.log(`   Sample (last): time=${lastCVD.time}, values=${lastCVD.values.join(', ')}`);
			}
		}
		
		console.log('\n▶  Next: Use this data to render charts in your application!\n');
		
		client.disconnect();
		process.exit(0);
		
	} catch (error) {
		console.error('\n' + '═'.repeat(60));
		console.error('\n❌ Error:', error);
		console.error('\nTroubleshooting:');
		console.error('  - Check that JWT token is not expired (Step 2)');
		console.error('  - Verify WebSocket URL is accessible');
		console.error('  - Check symbol format (e.g., NSE:JUNIPER)');
		console.error('  - Review messages log for details\n');
		
		client.disconnect();
		process.exit(1);
	}
}

main();
