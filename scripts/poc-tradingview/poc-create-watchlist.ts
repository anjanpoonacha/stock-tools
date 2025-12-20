/**
 * POC: Test TradingView watchlist creation
 * 
 * This script validates the TradingView watchlist creation API endpoint
 * before integrating it into the production code.
 * 
 * API: POST https://www.tradingview.com/api/v1/symbols_list/custom/
 * 
 * Usage:
 *   tsx --env-file=.env scripts/poc-tradingview/poc-create-watchlist.ts
 */

import { createWatchlist } from '@/lib/tradingview';
import { SessionResolver } from '@/lib/SessionResolver';

async function main() {
  console.log('🔍 POC: TradingView Watchlist Creation\n');

  // Get credentials from env or discover from KV
  let userEmail = process.env.USER_EMAIL;
  let userPassword = process.env.USER_PASSWORD;

  // If not provided, try to discover from available sessions
  if (!userEmail || !userPassword) {
    console.log('📝 No USER_EMAIL/USER_PASSWORD in env, discovering from KV...');
    const availableUsers = await SessionResolver.getAvailableUsers();
    
    if (availableUsers.length === 0) {
      console.error('❌ Error: No sessions found in KV. Please run the extension to capture sessions.');
      process.exit(1);
    }

    // Use the first available user
    userEmail = availableUsers[0];
    
    // Get any session to extract the password
    const anySession = await SessionResolver.getLatestSession('tradingview');
    if (!anySession?.sessionData.userPassword) {
      console.error('❌ Error: Could not extract user password from session');
      process.exit(1);
    }
    
    userPassword = anySession.sessionData.userPassword;
    console.log(`✅ Discovered user: ${userEmail}`);
  }

  console.log(`📧 Using user: ${userEmail}`);

  // Get TradingView session
  console.log('\n1️⃣ Getting TradingView session...');
  const tvSession = await SessionResolver.getLatestSessionForUser('tradingview', {
    userEmail,
    userPassword,
  });

  if (!tvSession) {
    console.error('❌ No TradingView session found for user');
    process.exit(1);
  }

  console.log(`✅ Found session: ${tvSession.internalId}`);

  // Create test watchlist
  const testName = `POC_Test_${Date.now()}`;
  console.log(`\n2️⃣ Creating watchlist: "${testName}"...`);

  try {
    const result = await createWatchlist(
      testName,
      `sessionid=${tvSession.sessionData.sessionId}`
    );

    console.log('✅ Watchlist created successfully!');
    console.log(`   ID: ${result.id}`);
    console.log(`   Name: ${result.name}`);
    
    console.log('\n🎉 POC Validation Complete!');
    console.log('✓ TradingView watchlist creation API is working');
    console.log('✓ Response structure validated');
    console.log(`\n💡 You can verify at: https://www.tradingview.com/watchlists/`);

  } catch (error) {
    console.error('❌ Failed to create watchlist:', error);
    process.exit(1);
  }
}

main().catch(console.error);
