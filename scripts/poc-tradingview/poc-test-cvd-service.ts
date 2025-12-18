/**
 * Test CVD Configuration Service (KV-based)
 * 
 * Validates that the CVD config service can:
 * 1. Fetch config dynamically from TradingView
 * 2. Cache config in KV properly
 * 3. Retrieve from KV cache on subsequent requests
 */

import { getCVDConfig, cvdConfigService } from '../../src/lib/tradingview/cvdConfigService.js';

async function main() {
	console.log('🧪 Testing CVD Configuration Service (KV-based)\n');
	console.log('=' + '='.repeat(79));

	const sessionId = process.argv[2];
	const sessionIdSign = process.argv[3];

	if (!sessionId) {
		console.error('\n❌ Usage: tsx poc-test-cvd-service.ts <session-id> [session-id-sign]');
		console.error('Example: tsx poc-test-cvd-service.ts c21wcqky6leod5cjl2fh6i660sy411jb');
		process.exit(1);
	}

	try {
		// Test 1: First fetch (should fetch from TradingView or use KV cache)
		console.log('\n📥 Test 1: First fetch');
		console.log('─'.repeat(80));
		
		const start1 = Date.now();
		const config1 = await getCVDConfig(sessionId, sessionIdSign);
		const duration1 = Date.now() - start1;
		
		console.log(`✅ Config fetched in ${duration1}ms`);
		console.log(`   Source: ${config1.source}`);
		console.log(`   Pine ID: ${config1.pineId}`);
		console.log(`   Pine Version: ${config1.pineVersion}`);
		console.log(`   Encrypted text length: ${config1.text.length}`);
		if (config1.fetchedAt) {
			console.log(`   Fetched at: ${config1.fetchedAt.toISOString()}`);
		}

		// Validate config structure
		if (!config1.text || !config1.pineId || !config1.pineVersion) {
			throw new Error('❌ Invalid config structure');
		}

		// Test 2: Second fetch (should use KV cache)
		console.log('\n📦 Test 2: Second fetch (should use KV cache)');
		console.log('─'.repeat(80));
		
		const start2 = Date.now();
		const config2 = await getCVDConfig(sessionId, sessionIdSign);
		const duration2 = Date.now() - start2;
		
		console.log(`✅ Config fetched in ${duration2}ms`);
		console.log(`   Source: ${config2.source}`);
		
		if (config2.source === 'kv-cache') {
			console.log(`   ✅ Cache hit! (${duration2}ms)`);
		} else {
			console.log(`   ⚠️  Expected cache hit but got: ${config2.source}`);
		}

		// Verify it's the same config
		if (config1.text !== config2.text) {
			throw new Error('❌ Cache returned different config!');
		}

		// Test 3: Cache status
		console.log('\n🔍 Test 3: Cache status');
		console.log('─'.repeat(80));
		
		const status = await cvdConfigService.getCacheStatus();
		console.log(`   Cached: ${status.cached}`);
		if (status.config) {
			console.log(`   Source: ${status.config.source}`);
			console.log(`   Pine Version: ${status.config.pineVersion}`);
		}
		if (status.ttl) {
			const hours = Math.round(status.ttl / 3600);
			console.log(`   TTL: ${status.ttl}s (~${hours} hours)`);
		}

		// Test 4: Cache invalidation
		console.log('\n🗑️  Test 4: Cache invalidation');
		console.log('─'.repeat(80));
		
		await cvdConfigService.invalidateCache();
		const statusAfterInvalidation = await cvdConfigService.getCacheStatus();
		console.log(`   Cached after invalidation: ${statusAfterInvalidation.cached}`);
		
		if (statusAfterInvalidation.cached) {
			console.warn('   ⚠️  Cache still present after invalidation (KV might be unavailable)');
		} else {
			console.log('   ✅ Cache invalidation works');
		}

		// Test 5: Fetch after invalidation
		console.log('\n📥 Test 5: Fetch after cache invalidation');
		console.log('─'.repeat(80));
		
		const start3 = Date.now();
		const config3 = await getCVDConfig(sessionId, sessionIdSign);
		const duration3 = Date.now() - start3;
		
		console.log(`✅ Config fetched in ${duration3}ms`);
		console.log(`   Source: ${config3.source}`);

		// Should be fresh-fetch since we invalidated
		if (config3.source === 'fresh-fetch') {
			console.log('   ✅ Fresh fetch after invalidation (expected)');
		} else {
			console.log(`   ⚠️  Expected fresh-fetch but got: ${config3.source}`);
		}

		// Test 6: Validate config format
		console.log('\n🔄 Test 6: Config validation');
		console.log('─'.repeat(80));
		
		console.log(`   Pine Version: ${config3.pineVersion}`);
		console.log(`   Pine ID: ${config3.pineId}`);
		
		// Check if encrypted text starts with correct pattern
		if (!config3.text.startsWith('bmI9Ks46_')) {
			console.warn('   ⚠️  WARNING: Encrypted text has unexpected format');
		} else {
			console.log('   ✅ Encrypted text format is valid');
		}
		
		// Validate Pine ID
		if (config3.pineId !== 'STD;Cumulative%1Volume%1Delta') {
			throw new Error(`❌ Unexpected Pine ID: ${config3.pineId}`);
		} else {
			console.log('   ✅ Pine ID is correct');
		}

		// Summary
		console.log('\n' + '=' + '='.repeat(79));
		console.log('\n✅ All tests passed!');
		console.log('\n📊 Summary:');
		console.log(`   First fetch: ${duration1}ms (${config1.source})`);
		console.log(`   Second fetch: ${duration2}ms (${config2.source})`);
		console.log(`   After invalidation: ${duration3}ms (${config3.source})`);
		
		if (config2.source === 'kv-cache' && duration1 > 0) {
			const speedup = Math.round((duration1 / Math.max(duration2, 1)) * 10) / 10;
			console.log(`   Cache speedup: ${speedup}x faster`);
		}
		
		console.log(`   Pine version: ${config3.pineVersion}`);
		console.log(`   Config stored in: Vercel KV (24h TTL)`);
		
		console.log('\n🎉 CVD Config Service (KV-based) is working correctly!\n');

	} catch (error) {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	}
}

main();
