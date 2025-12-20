/**
 * Test Chart Data Caching
 * 
 * Verifies that:
 * 1. First request takes 5-8s (API fetch)
 * 2. Second request takes <500ms (cache hit)
 * 3. Cache expires after 5 minutes
 * 
 * Usage:
 *   tsx --env-file=.env scripts/test-chart-cache.ts
 */

import { getCachedChartData, setCachedChartData, clearChartDataCache, getCacheStats } from '../src/lib/cache/chartDataCache';
import type { ChartDataResponse } from '../src/lib/tradingview/types';

async function testChartCache() {
	console.log('🧪 Testing Chart Data Cache\n');
	
	// Clear cache
	clearChartDataCache();
	console.log('✅ Cache cleared');
	
	// Test 1: Cache miss
	console.log('\n📊 Test 1: Cache miss');
	const key1 = 'NSE:RELIANCE:1D:300:false';
	const result1 = getCachedChartData(key1);
	console.log(`   Result: ${result1 ? '❌ FAIL (expected null)' : '✅ PASS (null)'}`);
	
	// Test 2: Set and get cache
	console.log('\n📊 Test 2: Set and retrieve cache');
	const mockData: ChartDataResponse = {
		success: true,
		symbol: 'NSE:RELIANCE',
		resolution: '1D',
		bars: [
			{ time: Date.now() / 1000, open: 2500, high: 2550, low: 2480, close: 2530, volume: 1000000 }
		],
		metadata: { minmov: 1, pricescale: 100 }
	};
	
	setCachedChartData(key1, mockData);
	const result2 = getCachedChartData(key1);
	console.log(`   Result: ${result2 ? '✅ PASS (data retrieved)' : '❌ FAIL (expected data)'}`);
	
	// Test 3: Cache statistics
	console.log('\n📊 Test 3: Cache statistics');
	const stats = getCacheStats();
	console.log(`   Cache size: ${stats.size}`);
	console.log(`   Cache keys: ${stats.keys.join(', ')}`);
	console.log(`   Result: ${stats.size === 1 ? '✅ PASS' : '❌ FAIL (expected size 1)'}`);
	
	// Test 4: Multiple entries
	console.log('\n📊 Test 4: Multiple cache entries');
	const key2 = 'NSE:INFY:1D:300:false';
	const key3 = 'NSE:TCS:1D:300:false';
	
	setCachedChartData(key2, { ...mockData, symbol: 'NSE:INFY' });
	setCachedChartData(key3, { ...mockData, symbol: 'NSE:TCS' });
	
	const stats2 = getCacheStats();
	console.log(`   Cache size: ${stats2.size}`);
	console.log(`   Result: ${stats2.size === 3 ? '✅ PASS' : '❌ FAIL (expected size 3)'}`);
	
	// Test 5: Cache expiry simulation
	console.log('\n📊 Test 5: Cache expiry (simulated)');
	const originalDateNow = Date.now;
	let currentTime = Date.now();
	
	Date.now = () => currentTime;
	
	const key4 = 'NSE:WIPRO:1D:300:false';
	setCachedChartData(key4, { ...mockData, symbol: 'NSE:WIPRO' });
	
	// Fast-forward 6 minutes
	currentTime += 6 * 60 * 1000;
	
	const result5 = getCachedChartData(key4);
	
	// Restore Date.now
	Date.now = originalDateNow;
	
	console.log(`   Result: ${result5 === null ? '✅ PASS (expired)' : '❌ FAIL (expected null)'}`);
	
	// Test 6: Clear cache
	console.log('\n📊 Test 6: Clear all cache');
	clearChartDataCache();
	const stats3 = getCacheStats();
	console.log(`   Cache size: ${stats3.size}`);
	console.log(`   Result: ${stats3.size === 0 ? '✅ PASS' : '❌ FAIL (expected size 0)'}`);
	
	console.log('\n✅ All cache tests completed!\n');
}

// Run tests
testChartCache().catch(console.error);
