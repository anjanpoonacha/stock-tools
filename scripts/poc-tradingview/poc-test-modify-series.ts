/**
 * POC: Test modify_series with Connection Pooling
 * 
 * This script tests:
 * 1. Creating a series for first symbol
 * 2. Using modify_series for subsequent symbols
 * 3. Logging all data keys to identify the pattern
 * 4. Verifying bars are collected properly
 */

import { BaseWebSocketClient } from '../../src/lib/tradingview/baseWebSocketClient';
import { createSymbolSpec, type TVMessage } from '../../src/lib/tradingview/protocol';

class DebugWebSocketClient extends BaseWebSocketClient {
	private requestCount = 0;
	private seriesId = 'sds_1';
	private targetSymbol: string = '';
	
	constructor(jwtToken: string) {
		super({ 
			jwtToken,
			enableLogging: true 
		});
	}
	
	/**
	 * Fetch data for a symbol (reuses connection)
	 */
	async fetchSymbol(symbol: string, resolution: string, barsCount: number): Promise<void> {
		console.log(`\n${'='.repeat(60)}`);
		console.log(`📊 Fetching: ${symbol} (Request #${this.requestCount + 1})`);
		console.log('='.repeat(60));
		
		// Clear previous data
		this.bars = [];
		this.symbolMetadata = {};
		this.targetSymbol = symbol;
		
		// Increment request count
		this.requestCount++;
		const symbolSessionId = `sds_sym_${this.requestCount}`;
		const turnaroundId = `s${this.requestCount}`;
		
		console.log(`🔑 Using: symbolSessionId="${symbolSessionId}", turnaroundId="${turnaroundId}"`);
		
		// Create symbol spec
		const symbolSpec = createSymbolSpec(symbol, 'dividends');
		
		// Resolve symbol
		await this.resolveSymbol(symbolSpec, symbolSessionId);
		
		// First request: create_series, subsequent: modify_series
		if (this.requestCount === 1) {
			console.log(`📝 Creating series (first request)`);
			await this.createSeries(resolution, barsCount);
		} else {
			console.log(`🔄 Modifying series (request #${this.requestCount})`);
			await this.modifySeries(
				this.seriesId,
				turnaroundId,
				symbolSessionId,
				resolution
			);
		}
		
		// Wait for data
		console.log(`⏳ Waiting for data...`);
		await this.waitForData(8000);
		
		// Check results
		const bars = this.getBars();
		const metadata = this.getMetadata();
		
		console.log(`\n📈 Results:`);
		console.log(`   - Bars collected: ${bars.length}`);
		console.log(`   - Symbol from metadata: ${(metadata as any).symbol || 'N/A'}`);
		console.log(`   - Expected symbol: ${symbol}`);
		
		if (bars.length > 0) {
			console.log(`   - First bar: ${new Date(bars[0].time * 1000).toISOString().split('T')[0]} OHLC=[${bars[0].open}, ${bars[0].high}, ${bars[0].low}, ${bars[0].close}]`);
			console.log(`   ✅ SUCCESS`);
		} else {
			console.log(`   ❌ FAILED - No bars received!`);
		}
	}
	
	/**
	 * Initialize connection
	 */
	protected async requestHistoricalBars(): Promise<void> {
		// Create chart session once
		await this.createChartSession();
		console.log(`✅ Chart session created: ${this.chartSessionId}`);
		await this.sleep(200);
	}
	
	/**
	 * Override to log all incoming messages
	 */
	protected onMessageReceived(message: TVMessage): void {
		// Only log data updates
		if (message.m === 'du' || message.m === 'timescale_update') {
			const [, dataObj] = message.p as [string, Record<string, unknown>];
			const dataKeys = Object.keys(dataObj);
			
			// Log data keys and check for our target series
			for (const dataKey of dataKeys) {
				const seriesData = dataObj[dataKey] as Record<string, unknown>;
				const series = seriesData.s || seriesData.st;
				
				if (series && Array.isArray(series) && series.length > 0) {
					const firstBar = series[0] as { v?: number[] };
					const hasOHLCV = firstBar.v && firstBar.v.length === 6;
					
					console.log(`   📦 Data received: key="${dataKey}", bars=${series.length}, isOHLCV=${hasOHLCV}`);
					
					if (hasOHLCV) {
						// This is OHLCV data - check if it's being processed
						console.log(`      🔍 Pattern check: /^s\\d+$/.test("${dataKey}") = ${/^s\d+$/.test(dataKey)}`);
					}
				}
			}
		}
	}
}

/**
 * Main test function
 */
async function main() {
	console.log('🚀 POC: Testing modify_series with Connection Pooling\n');
	
	// Get JWT token from command line
	const jwtToken = process.argv[2];
	
	if (!jwtToken) {
		console.error('❌ Usage: tsx poc-test-modify-series.ts <JWT_TOKEN>');
		console.error('\nGet JWT token by running: tsx scripts/get-session.ts');
		process.exit(1);
	}
	
	const client = new DebugWebSocketClient(jwtToken);
	
	try {
		// Connect and authenticate
		console.log('🔌 Connecting to TradingView WebSocket...');
		await client.connect();
		console.log('✅ Connected');
		
		console.log('🔐 Authenticating...');
		await client.authenticate();
		console.log('✅ Authenticated');
		
		// Initialize (create chart session)
		console.log('🎨 Initializing chart session...');
		await client['requestHistoricalBars']();
		
		// Test with 3 different symbols
		const testSymbols = [
			{ symbol: 'NSE:INFY', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:TCS', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:RELIANCE', resolution: '1D', barsCount: 50 }
		];
		
		console.log(`\n📋 Testing ${testSymbols.length} symbols with connection reuse:\n`);
		
		for (const test of testSymbols) {
			await client.fetchSymbol(test.symbol, test.resolution, test.barsCount);
			await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between requests
		}
		
		console.log('\n' + '='.repeat(60));
		console.log('✅ POC Complete!');
		console.log('='.repeat(60));
		
	} catch (error) {
		console.error('\n❌ Error:', error);
		process.exit(1);
	} finally {
		client.disconnect();
		console.log('\n👋 Disconnected');
	}
}

main();
