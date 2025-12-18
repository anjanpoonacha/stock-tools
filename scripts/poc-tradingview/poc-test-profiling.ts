/**
 * POC: Test Profiling Client
 * 
 * Runs the profiling client to measure actual TradingView response times
 */

import { ProfilingTestClient } from './poc-profiling-client';

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
	console.log('🚀 Profiling TradingView WebSocket Performance\n');
	
	const sessionId = process.argv[2];
	const sessionIdSign = process.argv[3];
	
	if (!sessionId) {
		console.error('❌ Usage: tsx poc-test-profiling.ts <session-id> [session-id-sign]');
		process.exit(1);
	}
	
	try {
		// Get JWT token
		console.log('🔐 Fetching JWT token...');
		const jwtToken = await getJWTToken(sessionId, sessionIdSign);
		console.log('✅ JWT obtained\n');
		
		// Test multiple symbols to get average
		const testSymbols = [
			{ symbol: 'NSE:INFY', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:TCS', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:RELIANCE', resolution: '1D', barsCount: 50 }
		];
		
		console.log('=' + '='.repeat(79));
		console.log(`📊 Testing ${testSymbols.length} symbols to measure response times`);
		console.log('=' + '='.repeat(79) + '\n');
		
		const allTimings: any[] = [];
		
		for (let i = 0; i < testSymbols.length; i++) {
			const test = testSymbols[i];
			console.log(`\n${'─'.repeat(80)}`);
			console.log(`🔄 Test ${i + 1}/${testSymbols.length}: ${test.symbol}`);
			console.log('─'.repeat(80) + '\n');
			
			const client = new ProfilingTestClient(
				jwtToken,
				test.symbol,
				test.resolution,
				test.barsCount
			);
			
			const startTime = Date.now();
			
			try {
				const result = await client.fetchData();
				const duration = Date.now() - startTime;
				
				console.log(`\n✅ ${test.symbol}: ${result.bars.length} bars in ${duration}ms`);
				
				// Get timing report
				console.log(client.getTimingReport());
				
				allTimings.push({
					symbol: test.symbol,
					duration,
					bars: result.bars.length
				});
				
				client.disconnect();
			} catch (error) {
				console.error(`❌ ${test.symbol}:`, error);
			}
		}
		
		// Aggregate analysis
		console.log('\n' + '='.repeat(80));
		console.log('📊 AGGREGATE ANALYSIS');
		console.log('='.repeat(80) + '\n');
		
		const avgDuration = allTimings.reduce((sum, t) => sum + t.duration, 0) / allTimings.length;
		console.log(`Average Duration: ${Math.round(avgDuration)}ms per symbol`);
		console.log(`Total Symbols: ${allTimings.length}`);
		console.log(`Success Rate: ${allTimings.length}/${testSymbols.length}\n`);
		
		// Get optimization recommendations from last client
		if (allTimings.length > 0) {
			const lastClient = new ProfilingTestClient(
				jwtToken,
				testSymbols[testSymbols.length - 1].symbol,
				testSymbols[testSymbols.length - 1].resolution,
				testSymbols[testSymbols.length - 1].barsCount
			);
			
			console.log(lastClient.getOptimizationRecommendations());
		}
		
		console.log('✅ Profiling Complete!\n');
		
	} catch (error) {
		console.error('\n❌ Error:', error);
		process.exit(1);
	}
}

main();
