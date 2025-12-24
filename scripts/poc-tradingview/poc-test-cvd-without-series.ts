#!/usr/bin/env tsx
/**
 * POC: Test CVD Indicator WITHOUT Creating OHLCV Series
 * 
 * GOAL: Validate if TradingView's CVD indicator can work WITHOUT fetching OHLCV bars
 * 
 * CONTEXT:
 * - Current implementation: resolveSymbol() → createSeries() → createStudy('cvd_1')
 * - Line 575 in baseWebSocketClient.ts references 'sds_1' series ID in create_study message
 * - Question: Is this series reference REQUIRED by TradingView protocol?
 * 
 * TEST SCENARIOS:
 * A. CVD with series reference 'sds_1' (but no series actually created)
 * B. CVD with empty/null series reference
 * 
 * EXPECTED OUTCOMES:
 * ✅ CVD works without series → Can optimize by skipping OHLCV fetch
 * ❌ CVD requires series → Protocol constraint, must keep current flow
 * 
 * FINDINGS WILL BE DOCUMENTED BELOW AFTER EXECUTION
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { config } from './poc-config.js';
import { BaseWebSocketClient, type BaseClientConfig } from '../../src/lib/tradingview/baseWebSocketClient.js';
import { createSymbolSpec, type TVMessage } from './poc-protocol.js';
import type { Step2Output } from './poc-types.js';
import type { StudyConfig } from '../../src/lib/tradingview/types.js';
import { CVD_ENCRYPTED_TEXT, CVD_PINE_FEATURES, CVD_PINE_METADATA } from '../../src/lib/tradingview/cvd-constants.js';

const INPUT_FILE = `${config.output.directory}/2-jwt-token.json`;
const OUTPUT_FILE = `${config.output.directory}/poc-cvd-without-series.json`;
const MESSAGES_LOG = `${config.output.directory}/poc-cvd-without-series.log`;

interface POCConfig extends BaseClientConfig {
	symbol: string;
	resolution: string;
	barsCount: number;
	cvdAnchorPeriod: string;
	cvdTimeframe?: string;
	scenarioMode: 'WITH_SERIES_REF' | 'WITHOUT_SERIES_REF';
}

interface POCResult {
	scenario: string;
	success: boolean;
	cvdDataReceived: boolean;
	cvdDataPointCount: number;
	errorOccurred: boolean;
	errorMessage?: string;
	protocolMessages: {
		sent: number;
		received: number;
	};
	notes: string[];
}

/**
 * POC Client - Tests CVD without creating series
 */
class CVDWithoutSeriesClient extends BaseWebSocketClient {
	private symbol: string;
	private resolution: string;
	private barsCount: number;
	private cvdAnchorPeriod: string;
	private cvdTimeframe?: string;
	private scenarioMode: 'WITH_SERIES_REF' | 'WITHOUT_SERIES_REF';
	
	private pocResult: POCResult;
	
	constructor(config: POCConfig) {
		super({ ...config, enableLogging: true });
		
		this.symbol = config.symbol;
		this.resolution = config.resolution;
		this.barsCount = config.barsCount;
		this.cvdAnchorPeriod = config.cvdAnchorPeriod;
		this.cvdTimeframe = config.cvdTimeframe;
		this.scenarioMode = config.scenarioMode;
		
		this.pocResult = {
			scenario: config.scenarioMode,
			success: false,
			cvdDataReceived: false,
			cvdDataPointCount: 0,
			errorOccurred: false,
			protocolMessages: { sent: 0, received: 0 },
			notes: []
		};
		
		console.log('═'.repeat(70));
		console.log(`🧪 POC: CVD Without Series - Scenario ${this.scenarioMode}`);
		console.log('═'.repeat(70));
		console.log(`📊 Symbol: ${this.symbol}`);
		console.log(`📊 Resolution: ${this.resolution}`);
		console.log(`📊 Bars Count: ${this.barsCount} (NOT creating series)`);
		console.log(`📊 CVD: Anchor=${this.cvdAnchorPeriod}, Timeframe=${this.cvdTimeframe || 'chart'}`);
		console.log(`🔬 Test Mode: ${this.scenarioMode}`);
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
	 * POC Implementation: Tests CVD without creating series
	 * 
	 * Flow:
	 * 1. Create chart session ✓
	 * 2. Resolve symbol (get metadata) ✓
	 * 3. SKIP createSeries() ← KEY DIFFERENCE
	 * 4. Create CVD study (with or without series reference)
	 * 5. Wait for data and observe results
	 */
	protected async requestHistoricalBars(): Promise<void> {
		try {
			this.pocResult.notes.push('Starting POC flow');
			
			// Step 1: Create chart session
			console.log('📊 Creating chart session...');
			await this.createChartSession();
			this.pocResult.notes.push('Chart session created successfully');
			
			// Step 2: Resolve symbol (required for metadata)
			console.log('📊 Resolving symbol...');
			const symbolSpec = createSymbolSpec(this.symbol);
			await this.resolveSymbol(symbolSpec);
			await this.sleep(500); // Wait for symbol_resolved response
			this.pocResult.notes.push('Symbol resolved successfully');
			
			// Step 3: SKIP createSeries() - This is the key test
			console.log('⚠️  SKIPPING createSeries() - Testing CVD without OHLCV bars');
			this.pocResult.notes.push('Deliberately skipped createSeries() call');
			
			// Step 4: Create CVD study
			console.log(`📊 Creating CVD study (${this.scenarioMode})...`);
			const cvdConfig = this.buildCVDConfig();
			
			if (this.scenarioMode === 'WITH_SERIES_REF') {
				// Scenario A: Use series reference 'sds_1' (but series doesn't exist)
				console.log('   → Using series reference "sds_1" (but series not created)');
				await this.createStudyWithSeriesRef('cvd_1', 'Script@tv-scripting-101!', cvdConfig, 'sds_1');
				this.pocResult.notes.push('Created CVD with series reference "sds_1"');
			} else {
				// Scenario B: Use empty series reference
				console.log('   → Using empty series reference');
				await this.createStudyWithSeriesRef('cvd_1', 'Script@tv-scripting-101!', cvdConfig, '');
				this.pocResult.notes.push('Created CVD with empty series reference');
			}
			
			// Step 5: Wait for data
			console.log('⏳ Waiting for CVD data (5 seconds)...');
			console.log();
			await this.waitForData(5000);
			
			// Analyze results
			const cvd = this.getStudy('cvd_1');
			const stats = this.getMessageStats();
			
			this.pocResult.cvdDataReceived = cvd !== undefined && cvd.values.length > 0;
			this.pocResult.cvdDataPointCount = cvd?.values.length || 0;
			this.pocResult.success = this.pocResult.cvdDataReceived;
			this.pocResult.protocolMessages = {
				sent: stats?.sent || 0,
				received: stats?.received || 0
			};
			
			// Summary
			console.log('═'.repeat(70));
			console.log('📊 POC RESULTS:');
			console.log('═'.repeat(70));
			
			if (this.pocResult.cvdDataReceived) {
				console.log('✅ CVD DATA RECEIVED!');
				console.log(`   - Data Points: ${this.pocResult.cvdDataPointCount}`);
				console.log('   - Conclusion: CVD CAN work without createSeries()');
				console.log('   - Optimization Possible: Skip OHLCV fetch for CVD-only requests');
				this.pocResult.notes.push('CVD data received successfully without creating series');
			} else {
				console.log('❌ NO CVD DATA RECEIVED');
				console.log('   - Conclusion: CVD REQUIRES createSeries()');
				console.log('   - Protocol Constraint: Must keep current flow');
				this.pocResult.notes.push('CVD did not return data without series creation');
			}
			
			console.log();
			console.log(`📨 Protocol Messages: Sent=${stats?.sent}, Received=${stats?.received}`);
			console.log();
			
		} catch (error) {
			this.pocResult.errorOccurred = true;
			this.pocResult.errorMessage = error instanceof Error ? error.message : String(error);
			this.pocResult.notes.push(`Error occurred: ${this.pocResult.errorMessage}`);
			throw error;
		}
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
	 * Create study with custom series reference (for testing)
	 */
	private async createStudyWithSeriesRef(
		studyId: string,
		studyName: string,
		config: StudyConfig,
		seriesRef: string
	): Promise<void> {
		// Initialize study data storage
		this.studies.set(studyId, {
			studyId,
			studyName,
			config,
			values: []
		});
		
		// Send create_study message with custom series reference
		const message = {
			m: 'create_study',
			p: [
				this.chartSessionId,
				studyId,
				'st1',
				seriesRef, // ← THIS IS THE KEY PARAMETER WE'RE TESTING
				studyName,
				config
			]
		};
		
		this.send(message);
	}
	
	/**
	 * Simple sleep helper
	 */
	protected sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	/**
	 * Get POC result
	 */
	getResult(): POCResult {
		return this.pocResult;
	}
	
	/**
	 * Public method to run the test
	 */
	async runTest(): Promise<void> {
		await this.requestHistoricalBars();
	}
	
	// ========================================================================
	// LIFECYCLE HOOKS
	// ========================================================================
	
	protected onBeforeConnect(_url: string): void {
		console.log('🔌 Connecting to WebSocket...');
	}
	
	protected onConnected(): void {
		console.log('✅ WebSocket connected\n');
	}
	
	protected onAuthenticated(): void {
		console.log('✅ Authentication sent\n');
	}
	
	protected onMessageSent(message: TVMessage): void {
		console.log(`📤 SEND: ${message.m}`);
		this.log('SEND', JSON.stringify(message));
	}
	
	protected onMessageReceived(message: TVMessage): void {
		console.log(`📥 RECV: ${message.m || 'handshake'}`);
		this.log('RECV', JSON.stringify(message));
	}
	
	protected onBeforeDisconnect(): void {
		console.log('🔌 Disconnecting...');
	}
	
	protected onDisconnected(): void {
		console.log('🔌 Disconnected\n');
	}
	
	// ========================================================================
	// MESSAGE HANDLERS
	// ========================================================================
	
	protected handleHandshake(_msg: unknown): void {
		console.log(`   ✓ Session ID: ${this.getSessionId()}`);
	}
	
	protected handleSymbolResolved(msg: TVMessage): void {
		super.handleSymbolResolved(msg);
		const metadata = this.getMetadata();
		console.log(`   ✓ Symbol: ${metadata.name} (${metadata.exchange})`);
		console.log(`   ✓ Currency: ${metadata.currency_code}`);
		console.log();
	}
	
	protected handleDataUpdate(msg: TVMessage): void {
		const beforeCount = this.getStudy('cvd_1')?.values.length || 0;
		super.handleDataUpdate(msg);
		const afterCount = this.getStudy('cvd_1')?.values.length || 0;
		
		if (afterCount > beforeCount) {
			const newPoints = afterCount - beforeCount;
			console.log(`   ✓ CVD data received: +${newPoints} points (total: ${afterCount})`);
		}
	}
	
	protected handleStudyLoading(msg: TVMessage): void {
		super.handleStudyLoading(msg);
		console.log('   ✓ Study loading confirmed');
	}
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runScenario(scenarioMode: 'WITH_SERIES_REF' | 'WITHOUT_SERIES_REF', jwtToken: string): Promise<POCResult> {
	console.log();
	console.log('═'.repeat(70));
	console.log(`🧪 Running Scenario: ${scenarioMode}`);
	console.log('═'.repeat(70));
	console.log();
	
	const client = new CVDWithoutSeriesClient({
		jwtToken,
		symbol: 'NSE:BSOFT',         // Known working CVD symbol
		resolution: '188',            // 188-minute resolution
		barsCount: 100,               // Would normally request 100 bars (but we skip this)
		cvdAnchorPeriod: '3M',        // 3 months lookback
		cvdTimeframe: '30S',          // 30-second bars
		chartId: config.chart.id,
		websocketUrl: config.websocket.url,
		timeout: config.websocket.timeout,
		scenarioMode
	});
	
	try {
		await client.connect();
		await client.authenticate();
		await client.runTest();
		
		return client.getResult();
		
	} catch (error) {
		console.error('❌ Error:', error);
		return client.getResult();
		
	} finally {
		client.disconnect();
	}
}

async function main() {
	console.log('╔' + '═'.repeat(68) + '╗');
	console.log('║ POC: Test CVD Indicator WITHOUT Creating OHLCV Series             ║');
	console.log('╚' + '═'.repeat(68) + '╝');
	console.log();
	
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
		console.log(`✅ Loaded JWT Token from Step 2 (${jwtToken.length} chars)\n`);
	} catch (error) {
		console.error(`❌ Error reading ${INPUT_FILE}:`, error);
		console.error('   Run: pnpm poc-2 first\n');
		process.exit(1);
	}
	
	const results: { [key: string]: POCResult } = {};
	
	// Run Scenario A: With series reference (but no series created)
	try {
		results.WITH_SERIES_REF = await runScenario('WITH_SERIES_REF', jwtToken);
		await new Promise(resolve => setTimeout(resolve, 2000)); // Cool-down between tests
	} catch (error) {
		console.error('Scenario A failed:', error);
	}
	
	// Run Scenario B: Without series reference
	try {
		results.WITHOUT_SERIES_REF = await runScenario('WITHOUT_SERIES_REF', jwtToken);
	} catch (error) {
		console.error('Scenario B failed:', error);
	}
	
	// Save results
	writeFileSync(
		OUTPUT_FILE,
		JSON.stringify(results, null, 2)
	);
	
	// Final Summary
	console.log();
	console.log('╔' + '═'.repeat(68) + '╗');
	console.log('║ FINAL SUMMARY: CVD Without Series POC                             ║');
	console.log('╚' + '═'.repeat(68) + '╝');
	console.log();
	
	console.log('📊 Scenario A: WITH_SERIES_REF ("sds_1" but no series created)');
	console.log(`   Result: ${results.WITH_SERIES_REF?.cvdDataReceived ? '✅ CVD Data Received' : '❌ No CVD Data'}`);
	console.log(`   Data Points: ${results.WITH_SERIES_REF?.cvdDataPointCount || 0}`);
	console.log(`   Error: ${results.WITH_SERIES_REF?.errorOccurred ? results.WITH_SERIES_REF.errorMessage : 'None'}`);
	console.log();
	
	console.log('📊 Scenario B: WITHOUT_SERIES_REF (empty series reference)');
	console.log(`   Result: ${results.WITHOUT_SERIES_REF?.cvdDataReceived ? '✅ CVD Data Received' : '❌ No CVD Data'}`);
	console.log(`   Data Points: ${results.WITHOUT_SERIES_REF?.cvdDataPointCount || 0}`);
	console.log(`   Error: ${results.WITHOUT_SERIES_REF?.errorOccurred ? results.WITHOUT_SERIES_REF.errorMessage : 'None'}`);
	console.log();
	
	// Conclusion
	console.log('═'.repeat(70));
	console.log('🎯 CONCLUSION:');
	console.log('═'.repeat(70));
	
	const anySuccess = results.WITH_SERIES_REF?.cvdDataReceived || results.WITHOUT_SERIES_REF?.cvdDataReceived;
	
	if (anySuccess) {
		console.log('✅ CVD CAN WORK WITHOUT createSeries()!');
		console.log();
		console.log('Optimization Opportunities:');
		console.log('  1. Skip OHLCV bar fetching for CVD-only requests');
		console.log('  2. Reduce data transfer and processing time');
		console.log('  3. Improve chart load performance');
		console.log();
		console.log('Implementation Notes:');
		if (results.WITH_SERIES_REF?.cvdDataReceived) {
			console.log('  - Series reference "sds_1" works even without creating series');
			console.log('  - TradingView may use a default/placeholder series');
		}
		if (results.WITHOUT_SERIES_REF?.cvdDataReceived) {
			console.log('  - Empty series reference also works');
			console.log('  - CVD can operate independently');
		}
	} else {
		console.log('❌ CVD REQUIRES createSeries() - Protocol Constraint');
		console.log();
		console.log('Current Flow Must Be Maintained:');
		console.log('  1. resolveSymbol() → Get metadata');
		console.log('  2. createSeries() → Fetch OHLCV bars');
		console.log('  3. createStudy() → Add CVD indicator');
		console.log();
		console.log('Reason: TradingView protocol requires base series for indicators');
	}
	
	console.log();
	console.log(`💾 Results saved to: ${OUTPUT_FILE}`);
	if (config.output.saveMessages) {
		console.log(`📝 Messages log: ${MESSAGES_LOG}`);
	}
	console.log();
}

main().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
