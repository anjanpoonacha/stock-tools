#!/usr/bin/env tsx
/**
 * POC: Test TradingView Bar Count Limits
 * 
 * This POC tests different bar counts to find:
 * 1. Maximum bars we can request
 * 2. Actual bars returned vs requested
 * 3. Response times for different counts
 * 4. API behavior with large requests
 */

import { readFileSync } from 'fs';
import { config } from './poc-config.js';
import { BaseWebSocketClient, type BaseClientConfig } from '../../src/lib/tradingview/baseWebSocketClient.js';
import type { TVMessage } from './poc-protocol.js';

const INPUT_FILE = `${config.output.directory}/2-jwt-token.json`;

const TEST_SYMBOL = 'NSE:RELIANCE';
const TEST_RESOLUTION = '1D';

// Test different bar counts - progressively larger
const BAR_COUNTS = [100, 300, 500, 1000, 2000, 5000, 10000];

interface TestResult {
	requested: number;
	received: number;
	timeTaken: number;
	success: boolean;
	error?: string;
}

interface POCConfig extends BaseClientConfig {
	symbol: string;
	resolution: string;
	barsCount: number;
}

class TestWebSocketClient extends BaseWebSocketClient {
	private symbol: string;
	private resolution: string;
	private barsCount: number;
	
	constructor(config: POCConfig) {
		super({ ...config, enableLogging: false });
		
		this.symbol = config.symbol;
		this.resolution = config.resolution;
		this.barsCount = config.barsCount;
	}
	
	protected async requestHistoricalBars(): Promise<void> {
		// Create chart session
		await this.createChartSession();
		await this.delay(100);
		
		// Resolve symbol
		await this.resolveSymbol(this.symbol);
		await this.delay(100);
		
		// Create series with specific bar count
		await this.createSeries(this.resolution, this.barsCount);
		await this.delay(500); // Wait for data
	}
	
	public async getBarsData(): Promise<any[]> {
		return this.bars;
	}
	
	protected handleDataUpdate(message: TVMessage): void {
		// Handle incoming data
		super.handleDataUpdate(message);
	}
	
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

async function testBarCount(step2Data: any, count: number): Promise<TestResult> {
	console.log(`\n📊 Testing ${count} bars...`);
	const startTime = Date.now();

	try {
		const client = new TestWebSocketClient({
			sessionId: step2Data.sessionId,
			signature: step2Data.signature,
			authToken: step2Data.authToken,
			symbol: TEST_SYMBOL,
			resolution: TEST_RESOLUTION,
			barsCount: count,
		});

		await client.connect();
		
		// Wait for bars to be received (max 10 seconds)
		let attempts = 0;
		const maxAttempts = 100; // 10 seconds
		while (attempts < maxAttempts) {
			const bars = await client.getBarsData();
			if (bars.length > 0) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 100));
			attempts++;
		}

		const bars = await client.getBarsData();
		await client.disconnect();

		const timeTaken = Date.now() - startTime;
		const received = bars.length;

		console.log(`   ✅ Received: ${received} bars in ${timeTaken}ms`);
		if (received !== count) {
			console.log(`   ⚠️  Expected ${count}, got ${received} (diff: ${received - count})`);
		}

		return {
			requested: count,
			received,
			timeTaken,
			success: true,
		};
	} catch (error) {
		const timeTaken = Date.now() - startTime;
		console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);

		return {
			requested: count,
			received: 0,
			timeTaken,
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function runTests() {
	console.log('🚀 Starting Bar Count Limit Tests');
	console.log(`   Symbol: ${TEST_SYMBOL}`);
	console.log(`   Resolution: ${TEST_RESOLUTION}`);
	console.log(`   Test counts: ${BAR_COUNTS.join(', ')}`);
	console.log('\n' + '='.repeat(80));

	// Load session from step 2
	let step2Data: any;
	try {
		const fileContents = readFileSync(INPUT_FILE, 'utf-8');
		step2Data = JSON.parse(fileContents);
		console.log('✅ Loaded session from', INPUT_FILE);
	} catch (error) {
		console.error('❌ Failed to load session. Run poc-2-get-jwt-token.ts first.');
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}

	const results: TestResult[] = [];

	// Test each bar count
	for (const count of BAR_COUNTS) {
		const result = await testBarCount(step2Data, count);
		results.push(result);

		// Small delay between tests to avoid rate limiting
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	// Print summary
	console.log('\n' + '='.repeat(80));
	console.log('📋 TEST RESULTS SUMMARY');
	console.log('='.repeat(80));
	console.log('\n┌────────────┬────────────┬──────────────┬─────────────┬──────────┐');
	console.log('│ Requested  │ Received   │ Difference   │ Time (ms)   │ Status   │');
	console.log('├────────────┼────────────┼──────────────┼─────────────┼──────────┤');

	for (const result of results) {
		const diff = result.received - result.requested;
		const diffStr = diff === 0 ? 'Perfect' : `${diff > 0 ? '+' : ''}${diff}`;
		const status = result.success ? '✅ OK' : '❌ FAIL';

		console.log(
			`│ ${String(result.requested).padStart(10)} │ ${String(result.received).padStart(10)} │ ${diffStr.padStart(12)} │ ${String(result.timeTaken).padStart(11)} │ ${status.padEnd(8)} │`
		);
	}

	console.log('└────────────┴────────────┴──────────────┴─────────────┴──────────┘');

	// Analysis
	console.log('\n📊 ANALYSIS:');

	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);

	if (successful.length > 0) {
		const maxSuccessful = successful[successful.length - 1];
		console.log(`   ✅ Maximum successful bar count: ${maxSuccessful.requested}`);
		console.log(
			`   ⏱️  Average response time: ${(successful.reduce((sum, r) => sum + r.timeTaken, 0) / successful.length).toFixed(0)}ms`
		);

		// Check if we got all requested bars
		const perfectMatches = successful.filter((r) => r.received === r.requested);
		if (perfectMatches.length === successful.length) {
			console.log(`   🎯 All successful requests returned exact bar count`);
		} else {
			console.log(`   ⚠️  ${successful.length - perfectMatches.length} requests returned different bar count`);
			const avgDiff = successful.reduce((sum, r) => sum + (r.received - r.requested), 0) / successful.length;
			console.log(`   📊 Average difference: ${avgDiff.toFixed(0)} bars`);
		}
	}

	if (failed.length > 0) {
		console.log(`\n   ❌ ${failed.length} requests failed:`);
		failed.forEach((r) => {
			console.log(`      - ${r.requested} bars: ${r.error}`);
		});
	}

	// Recommendations
	console.log('\n💡 RECOMMENDATIONS:');
	if (successful.length > 0) {
		const maxBars = Math.max(...successful.map((r) => r.requested));
		const avgTime = successful.reduce((sum, r) => sum + r.timeTaken, 0) / successful.length;
		
		console.log(`   • Safe maximum: ${maxBars} bars`);
		console.log(`   • Average fetch time: ${avgTime.toFixed(0)}ms`);

		if (maxBars >= 1000) {
			console.log(`   • For intraday: Use 500-1000 bars (fast load)`);
		}
		if (maxBars >= 2000) {
			console.log(`   • For daily charts: Use up to 2000 bars (~8 years)`);
		}
		if (maxBars >= 5000) {
			console.log(`   • Maximum history: ${maxBars} bars available`);
		}
	}

	console.log('\n' + '='.repeat(80));
	console.log('✅ Test complete!');
}

// Run tests
runTests().catch((error) => {
	console.error('\n❌ Test failed:', error);
	process.exit(1);
});
