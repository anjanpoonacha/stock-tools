#!/usr/bin/env tsx
/**
 * POC: Test TradingView deleteWatchlist function
 * 
 * Tests the complete delete workflow:
 * 1. Get initial watchlist count
 * 2. Create a test watchlist
 * 3. Delete the test watchlist
 * 4. Verify it's been deleted
 * 
 * Usage:
 *   tsx --env-file=.env scripts/poc-tradingview/poc-delete-watchlist.ts
 */

import { SessionResolver } from '@/lib/SessionResolver';
import { deleteWatchlist, getWatchlists, createWatchlist } from '@/lib/tradingview';

async function main() {
	console.log('🔧 POC: Testing TradingView deleteWatchlist function\n');

	// Get TV session
	console.log('1️⃣  Fetching TradingView session...');
	const sessionInfo = await SessionResolver.getLatestSession('tradingview');
	if (!sessionInfo) {
		throw new Error('❌ No TV session found. Please run the extension to capture a session first.');
	}
	
	const cookie = `sessionid=${sessionInfo.sessionData.sessionId}`;
	console.log('✅ Session found\n');
	
	// List watchlists before
	console.log('2️⃣  Getting current watchlists...');
	const before = await getWatchlists(cookie);
	console.log(`✅ Current watchlist count: ${before.length}\n`);
	
	// Create test watchlist
	console.log('3️⃣  Creating test watchlist...');
	const testName = `POC_DELETE_TEST_${Date.now()}`;
	const created = await createWatchlist(testName, cookie);
	console.log(`✅ Created test watchlist: ${created.name} (ID: ${created.id})\n`);
	
	// Delete it
	console.log('4️⃣  Deleting test watchlist...');
	await deleteWatchlist(created.id, cookie);
	console.log(`✅ Delete request completed for watchlist: ${created.id}\n`);
	
	// Verify it's gone
	console.log('5️⃣  Verifying deletion...');
	const after = await getWatchlists(cookie);
	const stillExists = after.some(w => w.id === created.id);
	
	if (stillExists) {
		console.error('❌ FAILED: Watchlist still exists after deletion');
		console.error(`   Expected: Watchlist ${created.id} to be deleted`);
		console.error(`   Actual: Watchlist still found in the list`);
		process.exit(1);
	} else {
		console.log('✅ Watchlist successfully deleted\n');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('✅ SUCCESS: Delete function works correctly');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log(`\n📊 Final watchlist count: ${after.length}`);
		console.log(`   (${before.length} before → ${after.length} after)`);
	}
}

main().catch((error) => {
	console.error('\n❌ Error during POC test:');
	console.error(error);
	process.exit(1);
});
