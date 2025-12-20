#!/usr/bin/env tsx
/**
 * Helper to get MIO session from KV storage
 */

import { SessionResolver } from '../../src/lib/SessionResolver.js';

async function main() {
  console.log('🔍 Searching for MarketInOut session...\n');

  try {
    // Try to get latest MIO session
    const sessionInfo = await SessionResolver.getLatestSession('marketinout');

    if (sessionInfo) {
      console.log('✅ Found MarketInOut session!\n');
      console.log('Internal ID:', sessionInfo.internalId);

      if (sessionInfo.sessionData.userEmail) {
        console.log('User:', sessionInfo.sessionData.userEmail);
      }

      // Find ASPSESSION cookie
      let aspSessionKey: string | undefined;
      let aspSessionValue: string | undefined;

      for (const [key, value] of Object.entries(sessionInfo.sessionData)) {
        if (key.startsWith('ASPSESSION')) {
          aspSessionKey = key;
          aspSessionValue = value as string;
          break;
        }
      }

      if (aspSessionKey && aspSessionValue) {
        console.log('\n📋 Session found:');
        console.log(`Key: ${aspSessionKey}`);
        console.log(`Value: ${aspSessionValue.substring(0, 20)}...`);
        console.log('\n✨ Ready to use for POC testing!');
      } else {
        console.log('\n⚠️  No ASPSESSION cookie found in session data');
      }
    } else {
      console.log('❌ No MarketInOut session found in KV storage.\n');
      console.log('Options:');
      console.log('1. Use browser extension to capture session from marketinout.com');
      console.log('2. Get ASPSESSION cookie from browser DevTools');
      console.log('3. Login to marketinout.com and check cookies\n');
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\n⚠️  KV storage not accessible');
    console.log('Make sure .env file is configured with KV credentials\n');
  }
}

main();
