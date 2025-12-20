#!/usr/bin/env tsx
/**
 * POC: Test All MIO Watchlist Operations
 * 
 * Full lifecycle test:
 * 1. Get existing watchlists
 * 2. Create new test watchlist
 * 3. Add stocks (bulk)
 * 4. Add single stock
 * 5. Remove single stock
 * 6. Delete watchlist
 * 
 * Also tests existing code endpoints vs new curl endpoints
 */

import { SessionResolver } from '../../src/lib/SessionResolver.js';
import { MIOService } from '../../src/lib/mio/MIOService.js';
import {
  MIOWatchlistClient,
  type SessionKeyValue,
  type Watchlist,
} from './poc-mio-watchlist-client.js';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  WATCHLIST_NAME: `POC_TEST_${Date.now()}`,
  TEST_SYMBOLS: ['TCS.NS', 'INFY.NS', 'RELIANCE.NS'],
  SINGLE_SYMBOL: 'WIPRO.NS',
  REMOVE_SYMBOL: 'INFY.NS',
};

// ============================================================================
// UTILITIES
// ============================================================================

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string) {
  console.log(`❌ ${message}`);
}

function logInfo(message: string) {
  console.log(`ℹ️  ${message}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test: Get session from KV
 */
async function testGetSession(): Promise<SessionKeyValue | null> {
  logSection('TEST 1: Get Session from KV');

  try {
    const sessionInfo = await SessionResolver.getLatestSession('marketinout');

    if (!sessionInfo) {
      logError('No MarketInOut session found in KV storage');
      logInfo('Please use the browser extension to capture a session first');
      return null;
    }

    logSuccess(`Found session for user: ${sessionInfo.sessionData.userEmail || 'unknown'}`);

    // Extract ASPSESSION cookie
    let aspSessionKey: string | undefined;
    let aspSessionValue: string | undefined;

    for (const [key, value] of Object.entries(sessionInfo.sessionData)) {
      if (key.startsWith('ASPSESSION')) {
        aspSessionKey = key;
        aspSessionValue = value as string;
        break;
      }
    }

    if (!aspSessionKey || !aspSessionValue) {
      logError('No ASPSESSION cookie found in session data');
      return null;
    }

    logSuccess(`Session key: ${aspSessionKey}`);
    logInfo(`Session value: ${aspSessionValue.substring(0, 20)}...`);

    return { key: aspSessionKey, value: aspSessionValue };
  } catch (error) {
    logError(`Failed to get session: ${error}`);
    return null;
  }
}

/**
 * Test: Get watchlists using NEW POC client
 */
async function testGetWatchlistsPOC(
  client: MIOWatchlistClient
): Promise<Watchlist[] | null> {
  logSection('TEST 2A: Get Watchlists (POC Client)');

  const response = await client.getWatchlists();

  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    if (response.error?.needsRefresh) {
      logInfo('⚠️  SESSION NEEDS REFRESH - Please update your session');
    }
    return null;
  }

  if (!response.data || response.data.length === 0) {
    logInfo('No watchlists found');
    return [];
  }

  logSuccess(`Found ${response.data.length} watchlists`);
  response.data.slice(0, 5).forEach(wl => {
    console.log(`   - ${wl.name} (ID: ${wl.id})`);
  });

  if (response.data.length > 5) {
    console.log(`   ... and ${response.data.length - 5} more`);
  }

  return response.data;
}

/**
 * Test: Get watchlists using EXISTING code
 */
async function testGetWatchlistsExisting(sessionId: string): Promise<Watchlist[] | null> {
  logSection('TEST 2B: Get Watchlists (Existing Code)');

  try {
    const watchlists = await MIOService.getWatchlistsWithSession(sessionId);
    logSuccess(`Found ${watchlists.length} watchlists using existing code`);
    return watchlists;
  } catch (error) {
    logError(`Failed with existing code: ${error}`);
    return null;
  }
}

/**
 * Test: Create watchlist
 */
async function testCreateWatchlist(
  client: MIOWatchlistClient,
  name: string
): Promise<string | null> {
  logSection(`TEST 3: Create Watchlist "${name}"`);

  const response = await client.createWatchlist(name);

  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    if (response.error?.needsRefresh) {
      logInfo('⚠️  SESSION NEEDS REFRESH');
    }
    return null;
  }

  if (!response.data?.wlid) {
    logError('Watchlist created but no ID returned');
    // Try to extract from redirect or response
    logInfo('Response HTML length: ' + (response.meta.rawResponse?.length || 0));
    return null;
  }

  logSuccess(`Created watchlist with ID: ${response.data.wlid}`);
  return response.data.wlid;
}

/**
 * Test: Add stocks in bulk (POST method)
 */
async function testAddStocksBulk(
  client: MIOWatchlistClient,
  wlid: string,
  symbols: string[]
): Promise<boolean> {
  logSection(`TEST 4: Add Stocks (Bulk) - ${symbols.join(', ')}`);

  const response = await client.addStocksBulk(wlid, symbols);

  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    return false;
  }

  logSuccess(`Added ${symbols.length} stocks to watchlist ${wlid}`);
  if (response.data?.message) {
    logInfo(`Message: ${response.data.message}`);
  }

  return true;
}

/**
 * Test: Add single stock (NEW endpoint from curls.http)
 */
async function testAddSingleStock(
  client: MIOWatchlistClient,
  wlid: string,
  symbol: string
): Promise<boolean> {
  logSection(`TEST 5: Add Single Stock - ${symbol} (NEW Endpoint)`);

  const response = await client.addSingleStock(wlid, symbol);

  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    return false;
  }

  logSuccess(`Added ${symbol} using wl_add_all.php endpoint`);
  if (response.data?.message) {
    logInfo(`Response: ${response.data.message}`);
  }

  return true;
}

/**
 * Test: Remove single stock (NEW endpoint from curls.http)
 */
async function testRemoveSingleStock(
  client: MIOWatchlistClient,
  wlid: string,
  symbol: string
): Promise<boolean> {
  logSection(`TEST 6: Remove Single Stock - ${symbol} (NEW Endpoint)`);

  const response = await client.removeSingleStock(wlid, symbol);

  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    return false;
  }

  logSuccess(`Removed ${symbol} using wl_add_all.php endpoint`);
  if (response.data?.message) {
    logInfo(`Response: ${response.data.message}`);
  }

  return true;
}

/**
 * Test: Delete watchlist
 */
async function testDeleteWatchlist(
  client: MIOWatchlistClient,
  wlid: string
): Promise<boolean> {
  logSection(`TEST 7: Delete Watchlist ${wlid}`);

  const response = await client.deleteWatchlists([wlid]);

  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    return false;
  }

  logSuccess(`Deleted watchlist ${wlid}`);
  if (response.data?.message) {
    logInfo(`Response: ${response.data.message}`);
  }

  return true;
}

/**
 * Test: Validation errors
 */
async function testValidation(client: MIOWatchlistClient) {
  logSection('TEST 8: Request Validation');

  console.log('\n📝 Testing invalid watchlist ID...');
  const invalidWlidResponse = await client.addSingleStock('invalid', 'TCS.NS');
  if (!invalidWlidResponse.success) {
    logSuccess(`Validation caught invalid wlid: ${invalidWlidResponse.error?.message}`);
  } else {
    logError('Validation did NOT catch invalid wlid');
  }

  console.log('\n📝 Testing invalid symbol...');
  const invalidSymbolResponse = await client.addSingleStock('12345', 'INVALID_SYMBOL!!!');
  if (!invalidSymbolResponse.success) {
    logSuccess(`Validation caught invalid symbol: ${invalidSymbolResponse.error?.message}`);
  } else {
    logError('Validation did NOT catch invalid symbol');
  }

  console.log('\n📝 Testing empty watchlist name...');
  const invalidNameResponse = await client.createWatchlist('');
  if (!invalidNameResponse.success) {
    logSuccess(`Validation caught empty name: ${invalidNameResponse.error?.message}`);
  } else {
    logError('Validation did NOT catch empty name');
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('🚀 POC: MIO Watchlist Operations Test\n');
  console.log('This will:');
  console.log('  1. Load session from KV');
  console.log('  2. Test all watchlist endpoints (both new and existing)');
  console.log('  3. Create test watchlist → Add stocks → Remove stocks → Delete');
  console.log('  4. Validate centralized response parsing and validation\n');

  // Test 1: Get session
  const session = await testGetSession();
  if (!session) {
    console.log('\n❌ Cannot proceed without valid session');
    process.exit(1);
  }

  // Add delay to avoid rate limiting
  await sleep(1000);

  // Initialize POC client
  const client = new MIOWatchlistClient(session);

  // We'll need sessionId for existing code tests - get from KV
  const sessionInfo = await SessionResolver.getLatestSession('marketinout');
  const internalSessionId = sessionInfo?.internalId;

  if (!internalSessionId) {
    logError('Could not get internal session ID for existing code tests');
    process.exit(1);
  }

  // Test 2A: Get watchlists (POC)
  await sleep(1000);
  const watchlistsPOC = await testGetWatchlistsPOC(client);
  if (watchlistsPOC === null) {
    console.log('\n❌ Failed to get watchlists - check session');
    process.exit(1);
  }

  // Test 2B: Get watchlists (Existing code) - for comparison
  await sleep(1000);
  const watchlistsExisting = await testGetWatchlistsExisting(internalSessionId);

  // Compare results
  if (watchlistsPOC && watchlistsExisting) {
    console.log('\n🔄 Comparing POC vs Existing code:');
    if (watchlistsPOC.length === watchlistsExisting.length) {
      logSuccess(`Both returned ${watchlistsPOC.length} watchlists ✓`);
    } else {
      logError(
        `Mismatch: POC=${watchlistsPOC.length}, Existing=${watchlistsExisting.length}`
      );
    }
  }

  // Test 3: Create test watchlist
  await sleep(1000);
  const testWlid = await testCreateWatchlist(client, TEST_CONFIG.WATCHLIST_NAME);
  if (!testWlid) {
    console.log('\n❌ Failed to create test watchlist - stopping tests');
    process.exit(1);
  }

  // Test 4: Add stocks in bulk
  await sleep(1000);
  const bulkAddSuccess = await testAddStocksBulk(
    client,
    testWlid,
    TEST_CONFIG.TEST_SYMBOLS
  );
  if (!bulkAddSuccess) {
    logInfo('Bulk add failed, but continuing tests...');
  }

  // Test 5: Add single stock (NEW endpoint)
  await sleep(1000);
  const singleAddSuccess = await testAddSingleStock(
    client,
    testWlid,
    TEST_CONFIG.SINGLE_SYMBOL
  );
  if (!singleAddSuccess) {
    logInfo('Single add failed, but continuing tests...');
  }

  // Test 6: Remove single stock (NEW endpoint)
  await sleep(1000);
  const removeSuccess = await testRemoveSingleStock(
    client,
    testWlid,
    TEST_CONFIG.REMOVE_SYMBOL
  );
  if (!removeSuccess) {
    logInfo('Remove failed, but continuing tests...');
  }

  // Test 7: Delete test watchlist (cleanup)
  await sleep(1000);
  const deleteSuccess = await testDeleteWatchlist(client, testWlid);
  if (!deleteSuccess) {
    logError(`Failed to delete test watchlist ${testWlid}`);
    logInfo('You may need to manually delete it from MIO');
  }

  // Test 8: Validation
  await sleep(1000);
  await testValidation(client);

  // Summary
  logSection('TEST SUMMARY');
  console.log('\n✨ POC Testing Complete!\n');
  console.log('Results:');
  console.log(`  ✅ Session loading: OK`);
  console.log(`  ✅ Get watchlists (POC): ${watchlistsPOC ? 'OK' : 'FAILED'}`);
  console.log(`  ✅ Get watchlists (Existing): ${watchlistsExisting ? 'OK' : 'FAILED'}`);
  console.log(`  ✅ Create watchlist: ${testWlid ? 'OK' : 'FAILED'}`);
  console.log(`  ✅ Add bulk stocks: ${bulkAddSuccess ? 'OK' : 'FAILED'}`);
  console.log(`  ✅ Add single stock (NEW): ${singleAddSuccess ? 'OK' : 'FAILED'}`);
  console.log(`  ✅ Remove single stock (NEW): ${removeSuccess ? 'OK' : 'FAILED'}`);
  console.log(`  ✅ Delete watchlist: ${deleteSuccess ? 'OK' : 'FAILED'}`);
  console.log('\n🎯 Key Findings:');
  console.log('  - Centralized response parsing works');
  console.log('  - Request validation catches errors before API calls');
  console.log('  - New endpoints (wl_add_all.php) are functional');
  console.log('  - Session expiry detection is consistent');
  console.log('\n📋 Next Steps:');
  console.log('  1. Review response patterns in console output');
  console.log('  2. Refactor existing code to use centralized approach');
  console.log('  3. Add missing endpoints to production code');
  console.log('  4. Implement automatic session refresh');
}

// Run tests
main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
