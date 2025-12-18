/**
 * POC: Test Connection Pool with Real Data
 * 
 * Tests the connection pooling implementation with a real session
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
	
	// Extract JWT token from HTML: window.initData = {..., "auth_token": "eyJhbGci..."}
	const match = html.match(/auth_token":"([^"]+)"/);
	
	if (!match || !match[1]) {
		throw new Error('Failed to extract JWT token from chart page. Session may be invalid.');
	}
	
	const jwtToken = match[1];
	
	if (!jwtToken.startsWith('eyJ')) {
		throw new Error('Invalid JWT token format');
	}
	
	return jwtToken;
}

async function main() {
	console.log('🚀 Testing Connection Pool with Real Data\n');
	
	const sessionId = process.argv[2];
	const sessionIdSign = process.argv[3]; // Optional
	
	if (!sessionId) {
		console.error('❌ Usage: tsx poc-test-connection-pool.ts <session-id> [session-id-sign]');
		process.exit(1);
	}
	
	console.log(`📊 Session ID: ${sessionId.substring(0, 20)}...`);
	if (sessionIdSign) {
		console.log(`🔑 Session ID Sign: ${sessionIdSign.substring(0, 20)}...`);
	}
	console.log('');
	
	try {
		// Get JWT token
		console.log('🔐 Fetching JWT token...');
		const jwtToken = await getJWTToken(sessionId, sessionIdSign);
		const payloadBase64 = jwtToken.split('.')[1];
		const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
		const expiresIn = Math.round((payload.exp * 1000 - Date.now()) / 60000);
		console.log(`✅ JWT obtained (expires in ${expiresIn} minutes)\n`);
		
		// Test symbols
		const testSymbols = [
			{ symbol: 'NSE:INFY', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:TCS', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:RELIANCE', resolution: '1D', barsCount: 50 },
			{ symbol: 'NSE:HDFCBANK', resolution: '1D', barsCount: 50 }
		];
		
		console.log('=' + '='.repeat(70));
		console.log(`📋 Testing ${testSymbols.length} symbols with connection pool`);
		console.log('=' + '='.repeat(70) + '\n');
		
		const pool = getConnectionPool();
		const results: any[] = [];
		
		const startTime = Date.now();
		
		// Test each symbol
		for (let i = 0; i < testSymbols.length; i++) {
			const test = testSymbols[i];
			console.log(`\n${'─'.repeat(70)}`);
			console.log(`🔄 Request ${i + 1}/${testSymbols.length}: ${test.symbol}`);
			console.log('─'.repeat(70));
			
			const reqStart = Date.now();
			
			try {
				const result = await pool.fetchChartData(
					jwtToken,
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
		
		const totalDuration = Date.now() - startTime;
		
		// Summary
		console.log('\n' + '=' + '='.repeat(70));
		console.log('📊 Summary');
		console.log('=' + '='.repeat(70) + '\n');
		
		const successful = results.filter(r => r.success).length;
		const failed = results.filter(r => !r.success).length;
		
		console.log(`Total Requests: ${results.length}`);
		console.log(`Successful: ${successful} ✅`);
		console.log(`Failed: ${failed} ❌`);
		console.log(`Total Time: ${totalDuration}ms`);
		console.log(`Average Time: ${Math.round(totalDuration / results.length)}ms\n`);
		
		if (successful > 0) {
			const successfulResults = results.filter(r => r.success);
			const avgSuccessful = Math.round(
				successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length
			);
			console.log(`Average Time (successful): ${avgSuccessful}ms`);
			
			// Check if connection reuse worked
			const firstDuration = successfulResults[0]?.duration || 0;
			const subsequentDurations = successfulResults.slice(1).map(r => r.duration);
			
			if (subsequentDurations.length > 0) {
				const avgSubsequent = Math.round(
					subsequentDurations.reduce((sum, d) => sum + d, 0) / subsequentDurations.length
				);
				
				console.log(`\nFirst Request: ${firstDuration}ms`);
				console.log(`Subsequent Requests (avg): ${avgSubsequent}ms`);
				
				if (avgSubsequent < firstDuration * 0.8) {
					console.log(`\n🎉 Connection reuse working! ${Math.round((1 - avgSubsequent/firstDuration) * 100)}% faster`);
				} else {
					console.log(`\n⚠️  Connection reuse may not be working properly`);
				}
			}
		}
		
		console.log('\n' + '=' + '='.repeat(70));
		
		// Close pool
		await pool.closeAll();
		console.log('\n✅ Test Complete!\n');
		
	} catch (error) {
		console.error('\n❌ Error:', error);
		process.exit(1);
	}
}

main();
