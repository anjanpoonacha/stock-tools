#!/usr/bin/env tsx
/**
 * POC: Simple Bar Count Limit Test
 * 
 * Tests different bar counts using existing session data
 * Run: pnpm tsx scripts/poc-tradingview/poc-test-bar-limits-simple.ts
 */

import { readFileSync } from 'fs';
import { BaseWebSocketClient } from '../../src/lib/tradingview/baseWebSocketClient.js';

const INPUT_FILE = './scripts/poc-output/2-jwt-token.json';
const TEST_SYMBOL = 'NSE:RELIANCE';
const TEST_RESOLUTION = '1D';
const BAR_COUNTS = [300, 500, 1000, 2000];

interface TestResult {
	requested: number;
	received: number;
	time: number;
	success: boolean;
}

class SimpleTestClient extends BaseWebSocketClient {
	private _symbol: string;
	private _resolution: string;
	private _barsCount: number;
	
	constructor(sessionId: string, signature: string, authToken: string, symbol: string, resolution: string, barsCount: number) {
		super({ sessionId, signature, authToken });
		this._symbol = symbol;
		this._resolution = resolution;
		this._barsCount = barsCount;
	}
	
	protected async requestHistoricalBars(): Promise<void> {
		console.log(`   Requesting ${this._barsCount} bars...`);
		
		// Create chart session
		await this.createChartSession();
		await this.wait(200);
		
		// Resolve symbol
		await this.resolveSymbol(this._symbol);
		await this.wait(200);
		
		// Create series
		await this.createSeries(this._resolution, this._barsCount);
		
		// Wait for data
		await this.wait(3000);
	}
	
	public getBars() {
		return this.bars;
	}
	
	private wait(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

async function testBars(session: any, count: number): Promise<TestResult> {
	const start = Date.now();
	
	try {
		const client = new SimpleTestClient(
			session.sessionId,
			session.signature,
			session.authToken,
			TEST_SYMBOL,
			TEST_RESOLUTION,
			count
		);
		
		console.log(`\n📊 Testing ${count} bars for ${TEST_SYMBOL}...`);
		await client.connect();
		
		const bars = client.getBars();
		await client.disconnect();
		
		const time = Date.now() - start;
		console.log(`   ✅ Got ${bars.length} bars in ${time}ms`);
		
		return {
			requested: count,
			received: bars.length,
			time,
			success: true
		};
	} catch (error) {
		const time = Date.now() - start;
		console.log(`   ❌ Failed: ${error}`);
		
		return {
			requested: count,
			received: 0,
			time,
			success: false
		};
	}
}

async function main() {
	console.log('🚀 Bar Count Limit Test\n');
	
	// Load session
	let session: any;
	try {
		session = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
		console.log('✅ Loaded session');
	} catch (error) {
		console.error('❌ Run poc-2 first to get session');
		process.exit(1);
	}
	
	// Run tests
	const results: TestResult[] = [];
	for (const count of BAR_COUNTS) {
		const result = await testBars(session, count);
		results.push(result);
		await new Promise(r => setTimeout(r, 1000));
	}
	
	// Summary
	console.log('\n' + '='.repeat(60));
	console.log('📋 RESULTS');
	console.log('='.repeat(60));
	console.log('\nRequested | Received | Time    | Match');
	console.log('-'.repeat(60));
	
	for (const r of results) {
		const match = r.received === r.requested ? '✅' : `❌ (${r.received - r.requested})`;
		console.log(`${String(r.requested).padStart(9)} | ${String(r.received).padStart(8)} | ${String(r.time).padStart(6)}ms | ${match}`);
	}
	
	console.log('\n' + '='.repeat(60));
	
	const working = results.filter(r => r.success && r.received > 0);
	if (working.length > 0) {
		const max = Math.max(...working.map(r => r.requested));
		console.log(`\n✅ Maximum working: ${max} bars`);
	}
}

main().catch(console.error);
