#!/usr/bin/env tsx
/**
 * Quick CVD Test - Tests CVD config fetching from KV
 */

import { kv } from '@vercel/kv';

async function testCVD() {
  console.log('🔬 Quick CVD Config Test\n');
  
  // Test 1: Check if KV is accessible
  console.log('Test 1: KV Connection');
  try {
    const testKey = 'test:cvd:' + Date.now();
    await kv.set(testKey, 'test', { ex: 10 });
    const testVal = await kv.get(testKey);
    console.log('✅ KV connection working:', testVal === 'test');
    await kv.del(testKey);
  } catch (err) {
    console.log('❌ KV connection failed:', err);
    return;
  }
  
  // Test 2: Check if CVD config exists in KV
  console.log('\nTest 2: CVD Config in KV Cache');
  try {
    const cvdConfig = await kv.get('tradingview:cvd:config');
    if (cvdConfig) {
      console.log('✅ CVD config found in KV cache');
      console.log('  Config:', JSON.stringify(cvdConfig).substring(0, 200) + '...');
    } else {
      console.log('⚠️  No CVD config in KV cache (will be fetched on first request)');
    }
  } catch (err) {
    console.log('❌ Failed to check CVD config:', err);
  }
  
  // Test 3: List all session keys
  console.log('\nTest 3: Check TradingView Sessions in KV');
  try {
    let cursor = 0;
    let sessionCount = 0;
    const sessionKeys = [];
    
    do {
      const result = await kv.scan(cursor, { match: '*tradingview*', count: 100 });
      cursor = result[0];
      const keys = result[1];
      sessionKeys.push(...keys);
      sessionCount += keys.length;
    } while (cursor !== 0);
    
    console.log(`✅ Found ${sessionCount} TradingView-related keys in KV`);
    if (sessionKeys.length > 0) {
      console.log('  Sample keys:', sessionKeys.slice(0, 5));
    }
  } catch (err) {
    console.log('❌ Failed to scan for sessions:', err);
  }
  
  console.log('\n✅ Quick test complete!');
}

testCVD().catch(console.error);
