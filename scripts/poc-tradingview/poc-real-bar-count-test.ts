#!/usr/bin/env tsx
/**
 * POC: REAL Bar Count Testing with Live Data
 * 
 * This tests ACTUAL bar counts with REAL TradingView API calls.
 * NO ASSUMPTIONS - only real data.
 * 
 * Tests:
 * 1. Different bar counts (300, 500, 1000, 1500, 2000, 5000)
 * 2. Different resolutions (5min, 15min, 1D, 1W)
 * 3. Verifies actual bars received
 * 4. Measures response times
 * 
 * Usage: pnpm tsx scripts/poc-tradingview/poc-real-bar-count-test.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { BaseWebSocketClient, type BaseClientConfig } from '../../src/lib/tradingview/baseWebSocketClient.js';

const INPUT_FILE = './scripts/poc-output/2-jwt-token.json';
const OUTPUT_FILE = './scripts/poc-output/bar-count-test-results.json';

const TEST_SYMBOL = 'NSE:RELIANCE';

// Test matrix: Resolution × Bar Count
const TEST_MATRIX = [
	// 15min resolution - most important for intraday
	{ resolution: '15', label: '15min', barCounts: [300, 500, 1000, 1500] },
	
	// Daily resolution - most common use case
	{ resolution: '1D', label: '1D', barCounts: [300, 500, 1000, 1500, 2000] },
	
	// Weekly resolution - long-term analysis
	{ resolution: '1W', label: '1W', barCounts: [300, 500, 1000, 1500] },
	
	// 5min resolution - high frequency
	{ resolution: '5', label: '5min', barCounts: [300, 500, 1000] },
];

interface TestResult {
	resolution: string;
	resolutionLabel: string;
	requested: number;
	received: number;
	firstBarTime?: number;
	lastBarTime?: number;
	timeRange?: string;
	loadTime: number;
	success: boolean;
	error?: string;
}

class RealTestClient extends BaseWebSocketClient {
	private testSymbol: string;
	private testResolution: string;
	private testBarCount: number;
	private receivedBars: any[] = [];
	
	constructor(sessionId: string, signature: string, authToken: string, symbol: string, resolution: string, barCount: number) {
		super({ sessionId, signature, authToken, enableLogging: false });
		this.testSymbol = symbol;
		this.testResolution = resolution;
		this.testBarCount = barCount;
	}
	
	protected async requestHistoricalBars(): Promise<void> {
		// Create chart session
		await this.createChartSession();
		await this.wait(150);
		
		// Resolve symbol
		await this.resolveSymbol(this.testSymbol);
		await this.wait(150);
		
		// Create series with specific bar count
		await this.createSeries(this.testResolution, this.testBarCount);
		
		// Wait for data to arrive
		// Wait longer for larger bar counts
		const waitTime = this.testBarCount > 1000 ? 5000 : 3000;
		await this.wait(waitTime);
		
		// Give a bit more time if no bars yet
		if (this.bars.length === 0) {
			await this.wait(2000);
		}
	}
	
	public getReceivedBars() {
		return this.bars;
	}
	
	private wait(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

function formatTimeRange(firstTime: number, lastTime: number): string {
	const first = new Date(firstTime * 1000);
	const last = new Date(lastTime * 1000);
	const days = Math.floor((lastTime - firstTime) / 86400);
	
	return `${days} days (${first.toISOString().split('T')[0]} to ${last.toISOString().split('T')[0]})`;
}

async function testBarCount(session: any, symbol: string, resolution: string, resolutionLabel: string, barCount: number): Promise<TestResult> {
	const start = Date.now();
	
	console.log(`\n   Testing ${barCount} bars...`);
	
	try {
		const client = new RealTestClient(
			session.sessionId,
			session.signature,
			session.authToken,
			symbol,
			resolution,
			barCount
		);
		
		await client.connect();
		
		const bars = client.getReceivedBars();
		await client.disconnect();
		
		const loadTime = Date.now() - start;
		const received = bars.length;
		
		let result: TestResult = {
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
			result.firstBarTime = firstBar.time;
			result.lastBarTime = lastBar.time;
			result.timeRange = formatTimeRange(firstBar.time, lastBar.time);
			
			console.log(`      ✅ Received: ${received} bars in ${loadTime}ms`);
			console.log(`      📅 Range: ${result.timeRange}`);
			
			if (received !== barCount) {
				const diff = received - barCount;
				console.log(`      ⚠️  Difference: ${diff > 0 ? '+' : ''}${diff} bars`);
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

async function runAllTests() {
	console.log('🚀 REAL Bar Count Testing with Live Data');
	console.log(`   Symbol: ${TEST_SYMBOL}`);
	console.log('   NO ASSUMPTIONS - Testing actual API responses');
	console.log('\n' + '='.repeat(80) + '\n');
	
	// Load session
	let session: any;
	try {
		session = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
		console.log('✅ Session loaded from', INPUT_FILE);
	} catch (error) {
		console.error('\n❌ Failed to load session.');
		console.error('   Run: pnpm poc-2');
		console.error('   Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
	
	const allResults: TestResult[] = [];
	
	// Test each resolution
	for (const test of TEST_MATRIX) {
		console.log(`\n📊 Testing ${test.label} resolution`);
		console.log('─'.repeat(60));
		
		for (const barCount of test.barCounts) {
			const result = await testBarCount(
				session,
				TEST_SYMBOL,
				test.resolution,
				test.label,
				barCount
			);
			
			allResults.push(result);
			
			// Small delay between tests
			await new Promise(r => setTimeout(r, 1500));
		}
	}
	
	// Print comprehensive summary
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
		console.log('┌─────────────┬─────────────┬──────────────┬──────────────┬──────────┐');
		console.log('│  Requested  │  Received   │  Difference  │   Time (ms)  │  Status  │');
		console.log('├─────────────┼─────────────┼──────────────┼──────────────┼──────────┤');
		
		for (const r of results) {
			const diff = r.received - r.requested;
			const diffStr = diff === 0 ? 'Perfect' : `${diff > 0 ? '+' : ''}${diff}`;
			const status = r.success ? '✅ OK' : '❌ FAIL';
			
			console.log(
				`│ ${String(r.requested).padStart(11)} │ ${String(r.received).padStart(11)} │ ${diffStr.padStart(12)} │ ${String(r.loadTime).padStart(12)} │ ${status.padEnd(8)} │`
			);
		}
		
		console.log('└─────────────┴─────────────┴──────────────┴──────────────┴──────────┘');
		
		// Show time range for successful tests
		const successful = results.filter(r => r.success && r.timeRange);
		if (successful.length > 0) {
			console.log('\nTime Ranges:');
			for (const r of successful) {
				console.log(`   ${r.requested} bars: ${r.timeRange}`);
			}
		}
	}
	
	// Analysis
	console.log('\n' + '='.repeat(80));
	console.log('📊 ANALYSIS');
	console.log('='.repeat(80));
	
	const successful = allResults.filter(r => r.success);
	const failed = allResults.filter(r => !r.success);
	
	console.log(`\n✅ Successful: ${successful.length}/${allResults.length} tests`);
	console.log(`❌ Failed: ${failed.length}/${allResults.length} tests`);
	
	if (successful.length > 0) {
		// Find max successful bar count per resolution
		console.log('\n🎯 Maximum Working Bar Counts:');
		for (const [resLabel, results] of Object.entries(byResolution)) {
			const successfulInRes = results.filter(r => r.success);
			if (successfulInRes.length > 0) {
				const max = Math.max(...successfulInRes.map(r => r.requested));
				const maxResult = successfulInRes.find(r => r.requested === max)!;
				console.log(`   ${resLabel.padEnd(8)}: ${max} bars (${maxResult.received} received, ${maxResult.loadTime}ms)`);
			}
		}
		
		// Average load times
		console.log('\n⏱️  Average Load Times:');
		const avgByCount = successful.reduce((acc, r) => {
			if (!acc[r.requested]) acc[r.requested] = [];
			acc[r.requested].push(r.loadTime);
			return acc;
		}, {} as Record<number, number[]>);
		
		for (const [count, times] of Object.entries(avgByCount)) {
			const avg = times.reduce((a, b) => a + b, 0) / times.length;
			console.log(`   ${count} bars: ${avg.toFixed(0)}ms average`);
		}
		
		// Check if we got exact counts
		const exactMatches = successful.filter(r => r.received === r.requested);
		const partialMatches = successful.filter(r => r.received !== r.requested);
		
		console.log(`\n🎯 Accuracy:`);
		console.log(`   Exact matches: ${exactMatches.length}/${successful.length}`);
		if (partialMatches.length > 0) {
			console.log(`   Partial matches: ${partialMatches.length}/${successful.length}`);
			const avgDiff = partialMatches.reduce((sum, r) => sum + (r.received - r.requested), 0) / partialMatches.length;
			console.log(`   Average difference: ${avgDiff.toFixed(0)} bars`);
		}
	}
	
	if (failed.length > 0) {
		console.log(`\n❌ Failed Tests:`);
		failed.forEach(r => {
			console.log(`   ${r.resolutionLabel} ${r.requested} bars: ${r.error}`);
		});
	}
	
	// Recommendations based on REAL data
	console.log('\n' + '='.repeat(80));
	console.log('💡 RECOMMENDATIONS (Based on Real Data)');
	console.log('='.repeat(80));
	
	for (const [resLabel, results] of Object.entries(byResolution)) {
		const successfulInRes = results.filter(r => r.success && r.received > 0);
		if (successfulInRes.length > 0) {
			const maxWorking = Math.max(...successfulInRes.map(r => r.requested));
			const maxResult = successfulInRes.find(r => r.requested === maxWorking)!;
			
			console.log(`\n${resLabel}:`);
			console.log(`   ✅ Tested up to: ${maxWorking} bars`);
			console.log(`   📊 Data coverage: ${maxResult.timeRange}`);
			console.log(`   ⏱️  Load time: ${maxResult.loadTime}ms`);
			console.log(`   💡 Recommended: ${maxWorking} bars for production`);
		}
	}
	
	// Save results
	const output = {
		timestamp: new Date().toISOString(),
		symbol: TEST_SYMBOL,
		testMatrix: TEST_MATRIX,
		results: allResults,
		summary: {
			total: allResults.length,
			successful: successful.length,
			failed: failed.length,
		}
	};
	
	writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
	console.log(`\n💾 Results saved to: ${OUTPUT_FILE}`);
	
	console.log('\n' + '='.repeat(80));
	console.log('✅ REAL DATA TEST COMPLETE!');
	console.log('='.repeat(80));
}

// Run tests
runAllTests().catch(error => {
	console.error('\n❌ Test failed:', error);
	process.exit(1);
});
