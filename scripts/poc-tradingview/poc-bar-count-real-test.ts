#!/usr/bin/env tsx
/**
 * POC: REAL Bar Count Testing with Live Data from KV
 * 
 * Uses KV storage to get TradingView session (no manual config needed)
 * Tests ACTUAL bar counts with REAL API responses
 * 
 * Usage: 
 *   pnpm tsx --env-file=.env scripts/poc-tradingview/poc-bar-count-real-test.ts
 */

import { writeFileSync } from 'fs';
import { SessionResolver } from '../../src/lib/SessionResolver.js';
import { BaseWebSocketClient } from '../../src/lib/tradingview/baseWebSocketClient.js';
import { getDataAccessToken } from '../../src/lib/tradingview/jwtService.js';

const OUTPUT_FILE = './scripts/poc-output/bar-count-real-test-results.json';
const TEST_SYMBOL = 'NSE:RELIANCE';

// Test matrix: Resolution × Bar Count
const TEST_MATRIX = [
	// Daily - most common
	{ resolution: '1D', label: 'Daily', barCounts: [300, 500, 1000, 1500, 2000] },
	
	// 15min - important for intraday
	{ resolution: '15', label: '15min', barCounts: [300, 500, 1000, 1500, 2000] },
	
	// Weekly - long term
	{ resolution: '1W', label: 'Weekly', barCounts: [300, 500, 1000, 1500] },
	
	// 5min - high frequency
	{ resolution: '5', label: '5min', barCounts: [300, 500, 1000] },
];

interface TestResult {
	resolution: string;
	resolutionLabel: string;
	requested: number;
	received: number;
	firstBarTime?: string;
	lastBarTime?: string;
	timeRangeDays?: number;
	loadTime: number;
	success: boolean;
	error?: string;
}

class BarTestClient extends BaseWebSocketClient {
	private _symbol: string;
	private _resolution: string;
	private _barCount: number;
	private _dataReceived: boolean = false;
	
	constructor(jwtToken: string, symbol: string, resolution: string, barCount: number) {
		super({ jwtToken, enableLogging: false });
		this._symbol = symbol;
		this._resolution = resolution;
		this._barCount = barCount;
	}
	
	protected async requestHistoricalBars(): Promise<void> {
		// Create chart session
		await this.createChartSession();
		
		// Resolve symbol
		await this.resolveSymbol(this._symbol);
		
		// Create series with specific bar count
		await this.createSeries(this._resolution, this._barCount);
		
		// Wait for data using base class method (event-driven)
		// Longer timeout for larger bar counts
		const timeoutMs = 5000 + Math.floor(this._barCount / 500) * 1000;
		await this.waitForData(timeoutMs);
		
		this._dataReceived = this.getBars().length > 0;
	}
	
	public hasData(): boolean {
		return this._dataReceived;
	}
	
	/**
	 * Public method to fetch bars (calls protected template method)
	 */
	async fetchBars(): Promise<void> {
		await this.requestHistoricalBars();
	}
}

function formatDate(timestamp: number): string {
	return new Date(timestamp * 1000).toISOString().split('T')[0];
}

function calculateDaysDiff(firstTime: number, lastTime: number): number {
	return Math.floor((lastTime - firstTime) / 86400);
}

async function testBarCount(
	jwtToken: string,
	symbol: string,
	resolution: string,
	resolutionLabel: string,
	barCount: number
): Promise<TestResult> {
	const start = Date.now();
	
	console.log(`   Testing ${barCount} bars...`);
	
	try {
		const client = new BarTestClient(
			jwtToken,
			symbol,
			resolution,
			barCount
		);
		
		await client.connect();
		await client.authenticate();
		await client.fetchBars();
		
		const bars = client.getBars();
		await client.disconnect();
		
		const loadTime = Date.now() - start;
		const received = bars.length;
		
		const result: TestResult = {
			resolution,
			resolutionLabel,
			requested: barCount,
			received,
			loadTime,
			success: received > 0,
		};
		
		if (received > 0) {
			const firstBar = bars[0];
			const lastBar = bars[received - 1];
			result.firstBarTime = formatDate(firstBar.time);
			result.lastBarTime = formatDate(lastBar.time);
			result.timeRangeDays = calculateDaysDiff(firstBar.time, lastBar.time);
			
			console.log(`      ✅ ${received} bars received in ${loadTime}ms`);
			console.log(`      📅 ${result.firstBarTime} to ${result.lastBarTime} (${result.timeRangeDays} days)`);
			
			if (received !== barCount) {
				const diff = received - barCount;
				const pct = ((diff / barCount) * 100).toFixed(1);
				console.log(`      ⚠️  Got ${diff > 0 ? '+' : ''}${diff} bars (${pct}% ${diff > 0 ? 'more' : 'less'})`);
			}
		} else {
			result.success = false;
			result.error = 'No bars received';
			console.log(`      ❌ No bars received in ${loadTime}ms`);
		}
		
		return result;
		
	} catch (error) {
		const loadTime = Date.now() - start;
		const errorMsg = error instanceof Error ? error.message : String(error);
		
		console.log(`      ❌ Error: ${errorMsg}`);
		
		return {
			resolution,
			resolutionLabel,
			requested: barCount,
			received: 0,
			loadTime,
			success: false,
			error: errorMsg,
		};
	}
}

// JWT fetching is now handled by imported production jwtService.getDataAccessToken()

async function main() {
	console.log('🚀 REAL Bar Count Testing - Using KV Session Data');
	console.log(`   Symbol: ${TEST_SYMBOL}`);
	console.log('   Data Source: Vercel KV Storage');
	console.log('   NO ASSUMPTIONS - Only real API responses\n');
	console.log('='.repeat(80) + '\n');
	
	// Get session from KV
	console.log('🔍 Fetching TradingView session from KV...');
	
	let sessionInfo;
	try {
		sessionInfo = await SessionResolver.getLatestSession('tradingview');
		
		if (!sessionInfo) {
			console.error('❌ No TradingView session found in KV storage');
			console.error('\nPlease ensure:');
			console.error('1. Browser extension has captured a TradingView session');
			console.error('2. KV_REST_API_URL and KV_REST_API_TOKEN are set in .env');
			process.exit(1);
		}
		
		console.log('✅ Session found!');
		console.log(`   Session ID: ${sessionInfo.sessionData.sessionId.substring(0, 20)}...`);
		console.log(`   User: ${sessionInfo.sessionData.userEmail || 'N/A'}`);
		console.log(`   Internal ID: ${sessionInfo.internalId}\n`);
		
	} catch (error) {
		console.error('❌ Failed to fetch session from KV:', error);
		console.error('\nCheck your .env file:');
		console.error('  - KV_REST_API_URL');
		console.error('  - KV_REST_API_TOKEN');
		process.exit(1);
	}
	
	const sessionId = sessionInfo.sessionData.sessionId;
	const sessionIdSign = sessionInfo.sessionData.sessionid_sign || '';
	
	if (!sessionIdSign) {
		console.error('❌ No sessionid_sign found in session data');
		process.exit(1);
	}
	
	// Get JWT Token using production jwtService (extracts from chart page HTML)
	console.log('🔐 Fetching JWT Token from TradingView...');
	// We need userId for caching but getDataAccessToken will extract it from the token itself
	// So we can use a dummy userId (0) - the service will get the real one from the JWT payload
	const jwtToken = await getDataAccessToken(sessionId, sessionIdSign, 0);
	console.log(`✅ JWT Token obtained (${jwtToken.length} chars)\n`);
	
	console.log('='.repeat(80) + '\n');
	
	// Run tests
	const allResults: TestResult[] = [];
	
	for (const test of TEST_MATRIX) {
		console.log(`\n📊 Testing ${test.label} Resolution`);
		console.log('─'.repeat(80));
		
		for (const barCount of test.barCounts) {
			const result = await testBarCount(
				jwtToken,
				TEST_SYMBOL,
				test.resolution,
				test.label,
				barCount
			);
			
			allResults.push(result);
			
			// Delay between tests to avoid rate limiting
			await new Promise(r => setTimeout(r, 2000));
		}
	}
	
	// Print summary
	printSummary(allResults);
	
	// Save results
	const output = {
		timestamp: new Date().toISOString(),
		symbol: TEST_SYMBOL,
		sessionSource: 'Vercel KV',
		testMatrix: TEST_MATRIX,
		results: allResults,
		summary: {
			total: allResults.length,
			successful: allResults.filter(r => r.success).length,
			failed: allResults.filter(r => !r.success).length,
		}
	};
	
	writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
	console.log(`\n💾 Full results saved to: ${OUTPUT_FILE}`);
}

function printSummary(allResults: TestResult[]) {
	console.log('\n\n' + '='.repeat(80));
	console.log('📋 COMPREHENSIVE TEST RESULTS');
	console.log('='.repeat(80));
	
	// Group by resolution
	const byResolution = allResults.reduce((acc, r) => {
		if (!acc[r.resolutionLabel]) acc[r.resolutionLabel] = [];
		acc[r.resolutionLabel].push(r);
		return acc;
	}, {} as Record<string, TestResult[]>);
	
	for (const [resLabel, results] of Object.entries(byResolution)) {
		console.log(`\n${resLabel} Resolution:`);
		console.log('┌─────────────┬─────────────┬──────────────┬──────────────┬─────────────┬──────────┐');
		console.log('│  Requested  │  Received   │  Difference  │  Days Range  │  Time (ms)  │  Status  │');
		console.log('├─────────────┼─────────────┼──────────────┼──────────────┼─────────────┼──────────┤');
		
		for (const r of results) {
			const diff = r.received - r.requested;
			const diffStr = diff === 0 ? 'Perfect' : `${diff > 0 ? '+' : ''}${diff}`;
			const daysStr = r.timeRangeDays ? String(r.timeRangeDays) : 'N/A';
			const status = r.success ? '✅ OK' : '❌ FAIL';
			
			console.log(
				`│ ${String(r.requested).padStart(11)} │ ${String(r.received).padStart(11)} │ ${diffStr.padStart(12)} │ ${daysStr.padStart(12)} │ ${String(r.loadTime).padStart(11)} │ ${status.padEnd(8)} │`
			);
		}
		
		console.log('└─────────────┴─────────────┴──────────────┴──────────────┴─────────────┴──────────┘');
	}
	
	// Analysis
	const successful = allResults.filter(r => r.success);
	const failed = allResults.filter(r => !r.success);
	
	console.log('\n' + '='.repeat(80));
	console.log('📊 ANALYSIS');
	console.log('='.repeat(80));
	
	console.log(`\n✅ Successful: ${successful.length}/${allResults.length} tests`);
	console.log(`❌ Failed: ${failed.length}/${allResults.length} tests`);
	
	if (successful.length > 0) {
		// Find max successful bar count per resolution
		console.log('\n🎯 Maximum Verified Bar Counts (REAL DATA):');
		for (const [resLabel, results] of Object.entries(byResolution)) {
			const successfulInRes = results.filter(r => r.success);
			if (successfulInRes.length > 0) {
				const max = Math.max(...successfulInRes.map(r => r.requested));
				const maxResult = successfulInRes.find(r => r.requested === max)!;
				console.log(`   ${resLabel.padEnd(10)}: ${max.toString().padStart(4)} bars → ${maxResult.received} received, ${maxResult.timeRangeDays} days, ${maxResult.loadTime}ms`);
			}
		}
		
		// Accuracy check
		const exactMatches = successful.filter(r => r.received === r.requested);
		console.log(`\n🎯 Accuracy:`);
		console.log(`   Exact matches: ${exactMatches.length}/${successful.length} (${((exactMatches.length / successful.length) * 100).toFixed(1)}%)`);
		
		if (exactMatches.length < successful.length) {
			const avgDiff = successful.reduce((sum, r) => sum + (r.received - r.requested), 0) / successful.length;
			console.log(`   Average difference: ${avgDiff.toFixed(1)} bars`);
		}
		
		// Performance
		console.log(`\n⏱️  Performance:`);
		const avgTime = successful.reduce((sum, r) => sum + r.loadTime, 0) / successful.length;
		console.log(`   Average load time: ${avgTime.toFixed(0)}ms`);
		
		const byBarCount = successful.reduce((acc, r) => {
			if (!acc[r.requested]) acc[r.requested] = [];
			acc[r.requested].push(r.loadTime);
			return acc;
		}, {} as Record<number, number[]>);
		
		for (const [count, times] of Object.entries(byBarCount)) {
			const avg = times.reduce((a, b) => a + b, 0) / times.length;
			console.log(`      ${count} bars: ${avg.toFixed(0)}ms`);
		}
	}
	
	if (failed.length > 0) {
		console.log(`\n❌ Failed Tests:`);
		failed.forEach(r => {
			console.log(`   ${r.resolutionLabel} ${r.requested} bars: ${r.error}`);
		});
	}
	
	// Final recommendations
	console.log('\n' + '='.repeat(80));
	console.log('💡 RECOMMENDATIONS (Based on REAL Data)');
	console.log('='.repeat(80));
	
	for (const [resLabel, results] of Object.entries(byResolution)) {
		const successfulInRes = results.filter(r => r.success && r.received > 0);
		if (successfulInRes.length > 0) {
			const maxWorking = Math.max(...successfulInRes.map(r => r.requested));
			const maxResult = successfulInRes.find(r => r.requested === maxWorking)!;
			
			// Find optimal (good coverage, fast load)
			const optimal = successfulInRes
				.filter(r => r.loadTime < 5000) // Under 5 seconds
				.sort((a, b) => b.requested - a.requested)[0] || maxResult;
			
			console.log(`\n${resLabel}:`);
			console.log(`   Maximum tested: ${maxWorking} bars (${maxResult.timeRangeDays} days coverage)`);
			console.log(`   Optimal choice: ${optimal.requested} bars (${optimal.loadTime}ms, ${optimal.timeRangeDays} days)`);
			console.log(`   Use in code: { value: '${results[0].resolution}', label: '${resLabel}', barsCount: ${optimal.requested} }`);
		}
	}
	
	console.log('\n' + '='.repeat(80));
	console.log('✅ REAL DATA TEST COMPLETE - Apply findings to implementation!');
	console.log('='.repeat(80));
}

// Run
main().catch(error => {
	console.error('\n❌ Test failed:', error);
	console.error('\nStack:', error.stack);
	process.exit(1);
});
