#!/usr/bin/env tsx
/**
 * Helper to get session from KV or prompt user
 */

import { SessionResolver } from '../../src/lib/SessionResolver.js';

async function main() {
  console.log('🔍 Searching for TradingView session...\n');
  
  try {
    // Try to get latest TradingView session
    const sessionInfo = await SessionResolver.getLatestSession('tradingview');
    
    if (sessionInfo) {
      console.log('✅ Found TradingView session!\n');
      console.log('Session ID:', sessionInfo.sessionData.sessionId);
      console.log('Internal ID:', sessionInfo.internalId);
      
      if (sessionInfo.sessionData.userEmail) {
        console.log('User:', sessionInfo.sessionData.userEmail);
      }
      
      console.log('\n📋 Copy this to poc-config.ts:');
      console.log(`\nsessionId: '${sessionInfo.sessionData.sessionId}',\n`);
    } else {
      console.log('❌ No TradingView session found in KV storage.\n');
      console.log('Options:');
      console.log('1. Use browser extension to capture session');
      console.log('2. Get sessionid cookie from browser DevTools');
      console.log('3. Login to TradingView.com and check cookies\n');
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\n⚠️  KV storage not accessible');
    console.log('\nManual setup:');
    console.log('1. Open TradingView.com in browser');
    console.log('2. Open DevTools (F12) → Application → Cookies');
    console.log('3. Find "sessionid" cookie');
    console.log('4. Copy value to poc-config.ts\n');
  }
}

main();
