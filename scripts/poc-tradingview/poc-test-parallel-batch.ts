/**
 * POC: Test Parallel Batch Processing
 * 
 * Tests the connection pool's ability to fetch multiple symbols in parallel
 */

import { getConnectionPool } from '../../src/lib/tradingview/connectionPool';

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
		throw new Error('Failed to extract JWT token from chart page');
	}
	
	return match[1];
}

async function main() {
	console.log('🚀 Testing Parallel Batch Processing\n');
	
	const sessionId = process.argv[2];
	const sessionIdSign = process.argv[3];
	
	if (!sessionId) {
		console.error('❌ Usage: tsx poc-test-parallel-batch.ts <session-id> [session-id-sign]');
		process.exit(1);
	}
	
	try {
		// Get JWT token
		console.log('🔐 Fetching JWT token...');
		const jwtToken = await getJWTToken(sessionId, sessionIdSign);
		console.log('✅ JWT obtained\n');
		
		// Test with 20 symbols to simulate real usage
		const testSymbols = [
			'NSE:INFY', 'NSE:TCS', 'NSE:RELIANCE', 'NSE:HDFCBANK',
			'NSE:ICICIBANK', 'NSE:KOTAKBANK', 'NSE:SBIN', 'NSE:AXISBANK',
			'NSE:BAJFINANCE', 'NSE:HDFCLIFE', 'NSE:BHARTIARTL', 'NSE:WIPRO',
			'NSE:ITC', 'NSE:LT', 'NSE:MARUTI', 'NSE:HINDUNILVR',
			'NSE:TITAN', 'NSE:SUNPHARMA', 'NSE:ASIANPAINT', 'NSE:NESTLEIND'
		];
		
		const requests = testSymbols.map(symbol => ({
			symbol,
			resolution: '1D',
			barsCount: 50,
			cvdEnabled: false
		}));
		
		console.log('=' + '='.repeat(70));
		console.log(`📋 Batch Test: ${requests.length} symbols with PARALLEL processing`);
		console.log('=' + '='.repeat(70) + '\n');
		
		const pool = getConnectionPool();
		const stats = pool.getStats();
		console.log(`Pool config: ${stats.maxConnections} parallel connections, ${stats.requestsPerConnection} requests per connection\n`);
		
		const startTime = Date.now();
		
		// Use the new batch API for parallel processing
		const results = await pool.fetchBatch(jwtToken, requests);
		
		const totalDuration = Date.now() - startTime;
		
		// Analyze results
		console.log('\n' + '=' + '='.repeat(70));
		console.log('📊 Results');
		console.log('=' + '='.repeat(70) + '\n');
		
		const successful = results.filter(r => r.result).length;
		const failed = results.filter(r => r.error).length;
		
		console.log(`Total Requests: ${results.length}`);
		console.log(`Successful: ${successful} ✅`);
		console.log(`Failed: ${failed} ❌`);
		console.log(`Total Time: ${(totalDuration / 1000).toFixed(1)}s`);
		console.log(`Average Time per Symbol: ${Math.round(totalDuration / results.length)}ms`);
		console.log(`Throughput: ${(results.length / (totalDuration / 1000)).toFixed(1)} symbols/second\n`);
		
		if (failed > 0) {
			console.log('Failed symbols:');
			results.filter(r => r.error).forEach(r => {
				console.log(`  ❌ ${r.symbol}: ${r.error}`);
			});
			console.log('');
		}
		
		// Show sample of successful results
		if (successful > 0) {
			console.log('Sample successful results:');
			results.filter(r => r.result).slice(0, 5).forEach(r => {
				console.log(`  ✅ ${r.symbol}: ${r.result!.bars.length} bars`);
			});
			if (successful > 5) {
				console.log(`  ... and ${successful - 5} more`);
			}
		}
		
		console.log('\n' + '=' + '='.repeat(70));
		console.log('\n✅ Parallel Batch Test Complete!\n');
		
	} catch (error) {
		console.error('\n❌ Error:', error);
		process.exit(1);
	}
}

main();
