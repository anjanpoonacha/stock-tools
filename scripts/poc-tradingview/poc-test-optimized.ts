/**
 * POC: Test Optimized WebSocket Client
 * 
 * Compares optimized client vs base implementation
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

async function main() {
	console.log('🚀 Testing Optimized WebSocket Client\n');
	
	const sessionId = process.argv[2];
	const sessionIdSign = process.argv[3];
	
	if (!sessionId) {
		console.error('❌ Usage: tsx poc-test-optimized.ts <session-id> [session-id-sign]');
		process.exit(1);
	}
	
	try {
		// Get JWT token
		console.log('🔐 Fetching JWT token...');
		const jwtToken = await getJWTToken(sessionId, sessionIdSign);
		console.log('✅ JWT obtained\n');
		
		// Test symbols
		const testSymbols = [
			{ symbol: 'NSE:INFY', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:TCS', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:RELIANCE', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:HDFCBANK', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:WIPRO', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:ICICIBANK', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:SBIN', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:LT', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:AXISBANK', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:BHARTIARTL', resolution: '1D', barsCount: 50 }
		];
		
		console.log('=' + '='.repeat(79));
		console.log(`📊 Testing ${testSymbols.length} symbols with OPTIMIZED client`);
		console.log('=' + '='.repeat(79) + '\n');
		
		const client = new OptimizedPooledClient({
			jwtToken,
			eventDrivenWaits: true, // Enable event-driven waits
			dataTimeout: 10000
		});
		
		console.log('🔌 Initializing connection...');
		const initStart = Date.now();
		await client.initialize();
		console.log(`✅ Connection initialized in ${Date.now() - initStart}ms\n`);
		
		const results: any[] = [];
		const overallStart = Date.now();
		
		// Test each symbol
		for (let i = 0; i < testSymbols.length; i++) {
			const test = testSymbols[i];
			console.log(`${'─'.repeat(80)}`);
			console.log(`🔄 Request ${i + 1}/${testSymbols.length}: ${test.symbol}`);
			console.log('─'.repeat(80));
			
			const reqStart = Date.now();
			
			try {
				const result = await client.fetchChartData(
					test.symbol,
					test.resolution,
					test.barsCount,
					{ cvdEnabled: false }
				);
				
				const reqDuration = Date.now() - reqStart;
				
				console.log(`✅ ${test.symbol}: ${result.bars.length} bars in ${reqDuration}ms`);
				
				results.push({
					symbol: test.symbol,
					success: true,
					bars: result.bars.length,
					duration: reqDuration
				});
			} catch (error) {
				const reqDuration = Date.now() - reqStart;
				console.error(`❌ ${test.symbol}: ${error instanceof Error ? error.message : String(error)} (${reqDuration}ms)`);
				
				results.push({
					symbol: test.symbol,
					success: false,
					error: error instanceof Error ? error.message : String(error),
					duration: reqDuration
				});
			}
		}
		
		const totalDuration = Date.now() - overallStart;
		
		// Summary
		console.log('\n' + '=' + '='.repeat(79));
		console.log('📊 PERFORMANCE SUMMARY');
		console.log('=' + '='.repeat(79) + '\n');
		
		const successful = results.filter(r => r.success).length;
		const failed = results.filter(r => !r.success).length;
		
		console.log(`Total Requests: ${results.length}`);
		console.log(`Successful: ${successful} ✅`);
		console.log(`Failed: ${failed} ❌`);
		console.log(`Total Time: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
		console.log(`Average Time: ${Math.round(totalDuration / results.length)}ms per symbol\n`);
		
		if (successful > 0) {
			const successfulResults = results.filter(r => r.success);
			const avgSuccessful = Math.round(
				successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length
			);
			console.log(`Average Time (successful): ${avgSuccessful}ms`);
			
			// Check connection reuse performance
			const firstDuration = successfulResults[0]?.duration || 0;
			const subsequentDurations = successfulResults.slice(1).map(r => r.duration);
			
			if (subsequentDurations.length > 0) {
				const avgSubsequent = Math.round(
					subsequentDurations.reduce((sum, d) => sum + d, 0) / subsequentDurations.length
				);
				
				console.log(`\nFirst Request: ${firstDuration}ms (new connection)`);
				console.log(`Subsequent Requests (avg): ${avgSubsequent}ms (connection reused)`);
				
				if (avgSubsequent < firstDuration * 0.8) {
					const improvement = Math.round((1 - avgSubsequent/firstDuration) * 100);
					console.log(`\n🎉 Connection reuse working! ${improvement}% faster`);
				}
			}
		}
		
		// Performance comparison
		console.log('\n' + '─'.repeat(80));
		console.log('📈 PERFORMANCE COMPARISON');
		console.log('─'.repeat(80) + '\n');
		
		const avgTime = totalDuration / results.length;
		const baselineTime = 2950; // From previous POC tests
		const improvement = ((baselineTime - avgTime) / baselineTime) * 100;
		
		console.log(`Baseline (unoptimized): ~${baselineTime}ms per symbol`);
		console.log(`Optimized: ~${Math.round(avgTime)}ms per symbol`);
		console.log(`Improvement: ${improvement > 0 ? '+' : ''}${Math.round(improvement)}% ${improvement > 0 ? 'faster' : 'slower'}`);
		
		// Extrapolate to 88 symbols
		const symbols88Time = (avgTime * 88) / 1000;
		const baseline88Time = (baselineTime * 88) / 1000;
		
		console.log(`\nProjected time for 88 symbols:`);
		console.log(`  Baseline: ${baseline88Time.toFixed(1)}s`);
		console.log(`  Optimized: ${symbols88Time.toFixed(1)}s`);
		console.log(`  Savings: ${(baseline88Time - symbols88Time).toFixed(1)}s`);
		
		console.log('\n' + '=' + '='.repeat(79));
		
		// Close connection
		client.disconnect();
		console.log('\n✅ Test Complete!\n');
		
	} catch (error) {
		console.error('\n❌ Error:', error);
		process.exit(1);
	}
}

main();
