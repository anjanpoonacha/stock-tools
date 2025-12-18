/**
 * POC: Test Parallel Optimized Connection Pool
 * 
 * Tests the optimized client with parallel connection pool
 * Expected: 88 symbols in ~5-10 seconds
 */

import { OptimizedPooledClient } from './poc-optimized-client';

async function getJWTToken(sessionId: string, sessionIdSign?: string): Promise<string> {
	const chartUrl = 'https://www.tradingview.com/chart/S09yY40x/';
	const cookies = sessionIdSign 
		? `sessionid=${sessionId}; sessionid_sign=${sessionIdSign}`
		: `sessionid=${sessionId}`;
	
	const response = await fetch(chartUrl, {
		headers: {
			'Cookie': cookies,
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
			'Accept': 'text/html,application/xhtml+xml',
		},
	});
	
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	
	const html = await response.text();
	const match = html.match(/auth_token":"([^"]+)"/);
	
	if (!match || !match[1]) {
		throw new Error('Failed to extract JWT token from chart page. Session may be invalid.');
	}
	
	return match[1];
}

async function fetchBatchParallel(
	jwtToken: string,
	symbols: Array<{ symbol: string; resolution: string; barsCount: number }>,
	parallelConnections: number = 5
): Promise<Array<{ symbol: string; bars: number; duration: number; error?: string }>> {
	const results: Array<{ symbol: string; bars: number; duration: number; error?: string }> = [];
	
	// Split symbols into batches
	const batchSize = Math.ceil(symbols.length / parallelConnections);
	const batches: typeof symbols[] = [];
	
	for (let i = 0; i < symbols.length; i += batchSize) {
		batches.push(symbols.slice(i, i + batchSize));
	}
	
	console.log(`📦 Split ${symbols.length} symbols into ${batches.length} batches (${batchSize} symbols each)\n`);
	
	// Process batches in parallel
	const batchPromises = batches.map(async (batch, batchIndex) => {
		const batchResults: typeof results = [];
		
		// Create connection for this batch
		const client = new OptimizedPooledClient({
			jwtToken,
			eventDrivenWaits: true,
			dataTimeout: 10000
		});
		
		try {
			console.log(`[Batch ${batchIndex + 1}] 🔌 Initializing connection...`);
			const initStart = Date.now();
			await client.initialize();
			console.log(`[Batch ${batchIndex + 1}] ✅ Connection ready in ${Date.now() - initStart}ms\n`);
			
			// Process symbols in this batch sequentially (connection reuse)
			for (let i = 0; i < batch.length; i++) {
				const req = batch[i];
				const reqStart = Date.now();
				
				try {
					const result = await client.fetchChartData(
						req.symbol,
						req.resolution,
						req.barsCount,
						{ cvdEnabled: false }
					);
					
					const reqDuration = Date.now() - reqStart;
					console.log(`[Batch ${batchIndex + 1}] ✅ ${req.symbol}: ${result.bars.length} bars in ${reqDuration}ms`);
					
					batchResults.push({
						symbol: req.symbol,
						bars: result.bars.length,
						duration: reqDuration
					});
				} catch (error) {
					const reqDuration = Date.now() - reqStart;
					console.error(`[Batch ${batchIndex + 1}] ❌ ${req.symbol}: ${error instanceof Error ? error.message : String(error)}`);
					
					batchResults.push({
						symbol: req.symbol,
						bars: 0,
						duration: reqDuration,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
			
			console.log(`[Batch ${batchIndex + 1}] 🎉 Batch complete!\n`);
		} finally {
			client.disconnect();
		}
		
		return batchResults;
	});
	
	// Wait for all batches
	const allBatchResults = await Promise.all(batchPromises);
	return allBatchResults.flat();
}

async function main() {
	console.log('🚀 Testing Parallel Optimized Connection Pool\n');
	
	const sessionId = process.argv[2];
	const sessionIdSign = process.argv[3];
	
	if (!sessionId) {
		console.error('❌ Usage: tsx poc-test-parallel-optimized.ts <session-id> [session-id-sign]');
		process.exit(1);
	}
	
	try {
		// Get JWT token
		console.log('🔐 Fetching JWT token...');
		const jwtToken = await getJWTToken(sessionId, sessionIdSign);
		console.log('✅ JWT obtained\n');
		
		// Generate 88 test symbols (44 stocks × 2 resolutions)
		const baseSymbols = [
			'NSE:INFY', 'NSE:TCS', 'NSE:RELIANCE', 'NSE:HDFCBANK', 'NSE:WIPRO',
			'NSE:ICICIBANK', 'NSE:SBIN', 'NSE:LT', 'NSE:AXISBANK', 'NSE:BHARTIARTL',
			'NSE:TITAN', 'NSE:BAJFINANCE', 'NSE:MARUTI', 'NSE:ASIANPAINT', 'NSE:SUNPHARMA',
			'NSE:KOTAKBANK', 'NSE:ITC', 'NSE:ULTRACEMCO', 'NSE:TATAMOTORS', 'NSE:NESTLEIND',
			'NSE:HINDALCO', 'NSE:POWERGRID', 'NSE:NTPC', 'NSE:ONGC', 'NSE:JSWSTEEL',
			'NSE:GRASIM', 'NSE:COALINDIA', 'NSE:DIVISLAB', 'NSE:DRREDDY', 'NSE:EICHERMOT',
			'NSE:BAJAJFINSV', 'NSE:ADANIPORTS', 'NSE:INDUSINDBK', 'NSE:TECHM', 'NSE:M&M',
			'NSE:SHREECEM', 'NSE:BRITANNIA', 'NSE:UPL', 'NSE:APOLLOHOSP', 'NSE:CIPLA',
			'NSE:HEROMOTOCO', 'NSE:TATASTEEL', 'NSE:BPCL', 'NSE:TATACONSUM'
		];
		
		const testSymbols: Array<{ symbol: string; resolution: string; barsCount: number }> = [];
		
		// Add Weekly (1W) resolution for all
		for (const symbol of baseSymbols) {
			testSymbols.push({ symbol, resolution: '1W', barsCount: 300 });
		}
		
		// Add Daily (1D) resolution for all
		for (const symbol of baseSymbols) {
			testSymbols.push({ symbol, resolution: '1D', barsCount: 300 });
		}
		
		console.log('=' + '='.repeat(79));
		console.log(`📊 Testing ${testSymbols.length} symbols (${baseSymbols.length} × 2 resolutions)`);
		console.log(`🔥 Using 5 PARALLEL connections with optimized client`);
		console.log('=' + '='.repeat(79) + '\n');
		
		const startTime = Date.now();
		
		// Fetch all symbols in parallel batches
		const results = await fetchBatchParallel(jwtToken, testSymbols, 5);
		
		const totalDuration = Date.now() - startTime;
		
		// Summary
		console.log('\n' + '=' + '='.repeat(79));
		console.log('📊 FINAL RESULTS');
		console.log('=' + '='.repeat(79) + '\n');
		
		const successful = results.filter(r => !r.error).length;
		const failed = results.filter(r => r.error).length;
		const totalBars = results.reduce((sum, r) => sum + r.bars, 0);
		const avgTime = results.filter(r => !r.error).reduce((sum, r) => sum + r.duration, 0) / successful;
		
		console.log(`Total Symbols: ${testSymbols.length}`);
		console.log(`Successful: ${successful} ✅`);
		console.log(`Failed: ${failed} ❌`);
		console.log(`Total Bars: ${totalBars.toLocaleString()}`);
		console.log(`Total Time: ${(totalDuration / 1000).toFixed(1)}s`);
		console.log(`Average Time: ${Math.round(avgTime)}ms per symbol\n`);
		
		// Performance comparison
		console.log('─'.repeat(80));
		console.log('📈 PERFORMANCE COMPARISON');
		console.log('─'.repeat(80) + '\n');
		
		const baselineSequential = 2950 * 88 / 1000; // Old: 2950ms per symbol
		const optimizedSequential = 244 * 88 / 1000; // Optimized: 244ms per symbol
		const actualParallel = totalDuration / 1000;
		
		console.log(`Baseline (sequential, unoptimized): ${baselineSequential.toFixed(1)}s`);
		console.log(`Optimized (sequential): ${optimizedSequential.toFixed(1)}s`);
		console.log(`Optimized (parallel, 5 connections): ${actualParallel.toFixed(1)}s`);
		console.log(``);
		console.log(`Speedup vs baseline: ${(baselineSequential / actualParallel).toFixed(1)}× faster! 🚀`);
		console.log(`Time saved: ${(baselineSequential - actualParallel).toFixed(1)}s`);
		
		console.log('\n' + '=' + '='.repeat(79));
		
		console.log('\n✅ Parallel Optimized Test Complete!\n');
		
	} catch (error) {
		console.error('\n❌ Error:', error);
		process.exit(1);
	}
}

main();
