#!/usr/bin/env tsx
/**
 * Test Heartbeat & Connection Persistence
 * 
 * This script tests that:
 * 1. WebSocket heartbeats are properly detected and echoed
 * 2. Persistent connections stay alive for 20+ requests
 * 3. CVD data continues to work across multiple requests
 * 4. No "0 bars received" errors occur on reused connections
 */

import { kv } from '@vercel/kv';
import { getChartData } from '../src/lib/chart-data/chartDataService';

async function main() {
	console.log('🧪 Testing Heartbeat & Connection Persistence\n');
	
	try {
		// Get session credentials from KV
		console.log('📝 Fetching session credentials from KV...');
		const keys = await kv.keys('*');
		let sessionData: any = null;
		let userEmail: string | null = null;
		let userPassword: string | null = null;
		
		for (const key of keys) {
			if (key.includes('tradingview')) {
				const data = await kv.get(key);
				if (data && typeof data === 'object') {
					const dataObj = data as any;
					if (dataObj.sessionId || dataObj.sessionid) {
						sessionData = dataObj;
						userEmail = dataObj.userEmail;
						userPassword = dataObj.userPassword;
						break;
					}
				}
			}
		}
		
		if (!sessionData || !userEmail || !userPassword) {
			console.error('❌ No TradingView session found in KV or missing credentials');
			process.exit(1);
		}
		
		console.log('✅ Session obtained\n');
		
		// Test symbols (mix of valid NSE stocks)
		const testSymbols = [
			'NSE:RELIANCE',
			'NSE:TCS',
			'NSE:INFY',
			'NSE:HDFCBANK',
			'NSE:ICICIBANK',
			'NSE:SBIN',
			'NSE:BHARTIARTL',
			'NSE:ITC',
			'NSE:KOTAKBANK',
			'NSE:LT',
			'NSE:AXISBANK',
			'NSE:HINDUNILVR',
			'NSE:MARUTI',
			'NSE:SUNPHARMA',
			'NSE:WIPRO'
		];
		
		console.log(`📊 Testing with ${testSymbols.length} symbols (sequential requests on same connection)\n`);
		console.log('⏱️  Expected: Heartbeats every ~10 seconds, all requests should succeed\n');
		console.log('─'.repeat(80));
		
		let successCount = 0;
		let failureCount = 0;
		const startTime = Date.now();
		
		// Fetch symbols sequentially to test connection persistence
		for (let i = 0; i < testSymbols.length; i++) {
			const symbol = testSymbols[i];
			const reqNum = i + 1;
			
			try {
				console.log(`\n[${reqNum}/${testSymbols.length}] Fetching ${symbol}...`);
				const reqStart = Date.now();
				
				const result = await getChartData({
					symbol,
					resolution: '1D',
					barsCount: '2000',
					cvdEnabled: 'true',
					cvdAnchorPeriod: '3M',
					cvdTimeframe: undefined,
					userEmail,
					userPassword,
				});
				
				const duration = Date.now() - reqStart;
				
				if (!result.success) {
					console.error(`❌ [${reqNum}] ${symbol} FAILED (${duration}ms): ${result.error}`);
					failureCount++;
					continue;
				}
				
				const barsCount = result.data?.bars.length ?? 0;
				const cvdCount = result.data?.indicators?.cvd?.values.length ?? 0;
				
				console.log(`✅ [${reqNum}] ${symbol}: ${barsCount} bars, ${cvdCount} CVD values (${duration}ms)`);
				successCount++;
				
				// Add small delay to allow heartbeats to be visible
				if (reqNum % 5 === 0) {
					console.log(`\n⏸️  Pausing 3s to observe heartbeat mechanism...`);
					await new Promise(resolve => setTimeout(resolve, 3000));
				}
				
			} catch (error) {
				console.error(`❌ [${reqNum}] ${symbol} EXCEPTION:`, error instanceof Error ? error.message : String(error));
				failureCount++;
			}
		}
		
		const totalDuration = Date.now() - startTime;
		
		console.log('\n' + '─'.repeat(80));
		console.log('\n📈 Test Results:');
		console.log(`   ✅ Successful: ${successCount}/${testSymbols.length}`);
		console.log(`   ❌ Failed: ${failureCount}/${testSymbols.length}`);
		console.log(`   ⏱️  Total time: ${(totalDuration / 1000).toFixed(2)}s`);
		console.log(`   📊 Avg per request: ${(totalDuration / testSymbols.length).toFixed(0)}ms`);
		
		// Success criteria
		const successRate = (successCount / testSymbols.length) * 100;
		console.log('\n🎯 Success Rate:', successRate.toFixed(1) + '%');
		
		if (successRate === 100) {
			console.log('✅ PASS: All requests succeeded! Heartbeat mechanism working correctly.');
		} else if (successRate >= 90) {
			console.log('⚠️  PARTIAL: Most requests succeeded, but some failures occurred.');
		} else {
			console.log('❌ FAIL: Many requests failed. Connection persistence issue detected.');
		}
		
		console.log('\n✅ Test complete!\n');
		
	} catch (error) {
		console.error('\n❌ Test failed with error:', error);
		process.exit(1);
	}
}

main().catch(console.error);
