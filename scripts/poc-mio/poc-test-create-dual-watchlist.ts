/**
 * POC: Test dual watchlist creation (MIO + TradingView)
 * 
 * This script validates the dual platform watchlist creation
 * before using it in production.
 * 
 * Usage:
 *   tsx --env-file=.env scripts/poc-mio/poc-test-create-dual-watchlist.ts
 */

import { MIOService } from '@/lib/mio';
import { createWatchlist as createTVWatchlist } from '@/lib/tradingview';
import { SessionResolver } from '@/lib/SessionResolver';

async function main() {
  console.log('🔍 POC: Dual Platform Watchlist Creation (MIO + TradingView)\n');

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
    const anySession = await SessionResolver.getLatestSession('marketinout');
    if (!anySession?.sessionData.userPassword) {
      console.error('❌ Error: Could not extract user password from session');
      process.exit(1);
    }
    
    userPassword = anySession.sessionData.userPassword;
    console.log(`✅ Discovered user: ${userEmail}`);
  }

  console.log(`📧 Using user: ${userEmail}`);

  // Get sessions for both platforms
  console.log('\n1️⃣ Getting sessions...');
  const [mioSession, tvSession] = await Promise.all([
    SessionResolver.getLatestMIOSessionForUser({ userEmail, userPassword }),
    SessionResolver.getLatestSessionForUser('tradingview', { userEmail, userPassword }),
  ]);

  if (!mioSession) {
    console.error('❌ No MIO session found');
    process.exit(1);
  }

  if (!tvSession) {
    console.error('❌ No TradingView session found');
    process.exit(1);
  }

  console.log(`✅ MIO session: ${mioSession.internalId}`);
  console.log(`✅ TV session: ${tvSession.internalId}`);

  // Create test watchlist on both platforms
  const testName = `AUTO_POC_Test_${Date.now()}`;
  console.log(`\n2️⃣ Creating watchlist: "${testName}" on both platforms...`);

  const [mioResult, tvResult] = await Promise.allSettled([
    MIOService.createWatchlist(mioSession.key, mioSession.value, testName),
    createTVWatchlist(testName, `sessionid=${tvSession.sessionData.sessionId}`),
  ]);

  // Process results
  console.log('\n3️⃣ Results:');
  
  let mioId: string | undefined;
  let tvId: string | undefined;

  // MIO result
  if (mioResult.status === 'fulfilled') {
    if (mioResult.value.success && mioResult.value.data) {
      mioId = mioResult.value.data.wlid;
      console.log(`✅ MIO: Created with ID ${mioId}`);
    } else {
      console.log(`❌ MIO: ${mioResult.value.error?.message}`);
    }
  } else {
    console.log(`❌ MIO: ${mioResult.reason}`);
  }

  // TradingView result
  if (tvResult.status === 'fulfilled') {
    tvId = tvResult.value.id;
    console.log(`✅ TradingView: Created with ID ${tvId}`);
  } else {
    console.log(`❌ TradingView: ${tvResult.reason}`);
  }

  console.log('\n🎉 POC Validation Complete!');
  console.log(`✓ MIO ID: ${mioId || 'N/A'}`);
  console.log(`✓ TV ID: ${tvId || 'N/A'}`);
  
  if (mioId && tvId) {
    console.log('\n✅ Both platforms succeeded!');
    console.log('💡 You can verify at:');
    console.log('   - MIO: https://www.marketinout.com/wl/watch_list.php');
    console.log('   - TV: https://www.tradingview.com/watchlists/');
  } else {
    console.log('\n⚠️  One or both platforms failed');
  }
}

main().catch(console.error);
