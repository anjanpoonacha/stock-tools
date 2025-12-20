#!/usr/bin/env tsx
/**
 * POC: Comprehensive Operation Validation
 * 
 * This test validates each operation by checking the actual state:
 * - Add stock → Verify it appears in watchlist
 * - Remove stock → Verify it disappears from watchlist
 * - Create watchlist → Verify it appears in list
 * - Delete watchlist → Verify it disappears from list
 */

import { SessionResolver } from '../../src/lib/SessionResolver.js';
import { MIOHttpClient, ResponseParser, RequestValidator } from '../../src/lib/mio/core/index.js';
import type { SessionKeyValue, Watchlist } from '../../src/lib/mio/core/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  WATCHLIST_NAME: `VALIDATION_TEST_${Date.now()}`,
  TEST_SYMBOLS: ['TCS.NS', 'INFY.NS', 'WIPRO.NS'],
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
// WATCHLIST CONTENT FETCHER
// ============================================================================

/**
 * Fetch and parse the contents of a specific watchlist
 */
async function getWatchlistContents(
  session: SessionKeyValue,
  wlid: string
): Promise<string[]> {
  const url = `https://www.marketinout.com/wl/watch_list.php?wlid=${wlid}`;
  
  console.log(`\n🔍 Fetching watchlist contents for wlid=${wlid}...`);
  
  const response = await MIOHttpClient.request<string[]>(
    url,
    { method: 'GET', sessionKeyValue: session },
    (html) => {
      // Parse stock symbols from the watchlist page
      const symbols: string[] = [];
      
      // Look for stock symbols in the page
      // Pattern: Look for ticker symbols (e.g., TCS.NS, INFY.NS)
      const symbolMatches = html.match(/[A-Z0-9]+\.[A-Z]+/g);
      
      if (symbolMatches) {
        // Deduplicate and filter valid symbols
        const uniqueSymbols = [...new Set(symbolMatches)];
        symbols.push(...uniqueSymbols.filter(s => RequestValidator.validateSymbol(s).valid));
      }
      
      return symbols;
    }
  );
  
  if (!response.success) {
    logError(`Failed to fetch watchlist contents: ${response.error?.message}`);
    return [];
  }
  
  const symbols = response.data || [];
  console.log(`   Found ${symbols.length} stocks: ${symbols.join(', ') || 'none'}`);
  
  return symbols;
}

/**
 * Get list of all watchlists
 */
async function getAllWatchlists(session: SessionKeyValue): Promise<Watchlist[]> {
  const url = 'https://www.marketinout.com/wl/watch_list.php?mode=list';
  
  const response = await MIOHttpClient.request<Watchlist[]>(
    url,
    { method: 'GET', sessionKeyValue: session },
    (html) => ResponseParser.parseWatchlistList(html)
  );
  
  if (!response.success) {
    logError(`Failed to fetch watchlists: ${response.error?.message}`);
    return [];
  }
  
  return response.data || [];
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testCreateWatchlist(
  session: SessionKeyValue,
  name: string
): Promise<string | null> {
  logSection(`TEST 1: Create Watchlist "${name}"`);
  
  // Validate name
  const validation = RequestValidator.validateWatchlistName(name);
  if (!validation.valid) {
    logError(`Validation failed: ${validation.error}`);
    return null;
  }
  
  // Get current watchlist count
  const beforeWatchlists = await getAllWatchlists(session);
  logInfo(`Watchlists before creation: ${beforeWatchlists.length}`);
  
  await sleep(1000);
  
  // Create watchlist
  const url = `https://www.marketinout.com/wl/my_watch_lists.php?mode=new&name=${encodeURIComponent(name)}&wlid=`;
  const response = await MIOHttpClient.request<{ wlid?: string }>(
    url,
    { method: 'GET', sessionKeyValue: session },
    (html) => {
      const wlid = ResponseParser.extractWatchlistId(html);
      return { wlid: wlid || undefined };
    }
  );
  
  if (!response.success || !response.data?.wlid) {
    logError(`Failed to create watchlist: ${response.error?.message}`);
    return null;
  }
  
  const wlid = response.data.wlid;
  logSuccess(`Created watchlist with ID: ${wlid}`);
  
  await sleep(1000);
  
  // Verify it appears in watchlist list
  const afterWatchlists = await getAllWatchlists(session);
  logInfo(`Watchlists after creation: ${afterWatchlists.length}`);
  
  const found = afterWatchlists.find(wl => wl.id === wlid);
  if (found) {
    logSuccess(`✓ Verified: Watchlist "${found.name}" (ID: ${wlid}) appears in list`);
  } else {
    logError(`✗ Verification failed: Watchlist ${wlid} NOT found in list`);
  }
  
  return wlid;
}

async function testAddStock(
  session: SessionKeyValue,
  wlid: string,
  symbol: string
): Promise<boolean> {
  logSection(`TEST 2: Add Stock "${symbol}" to Watchlist ${wlid}`);
  
  // Get contents before
  const beforeContents = await getWatchlistContents(session, wlid);
  const beforeCount = beforeContents.length;
  const alreadyExists = beforeContents.includes(symbol);
  
  if (alreadyExists) {
    logInfo(`Stock ${symbol} already exists in watchlist`);
  }
  
  await sleep(1000);
  
  // Add stock
  const url = `https://www.marketinout.com/wl/wl_add_all.php?action=add&wlid=${wlid}&wl_name=&symbol=${symbol}`;
  const response = await MIOHttpClient.request(
    url,
    { method: 'GET', sessionKeyValue: session }
  );
  
  if (!response.success) {
    logError(`Failed to add stock: ${response.error?.message}`);
    return false;
  }
  
  logSuccess(`Stock add request completed (HTTP ${response.meta.statusCode})`);
  
  await sleep(1000);
  
  // Verify it appears in watchlist
  const afterContents = await getWatchlistContents(session, wlid);
  const afterCount = afterContents.length;
  const nowExists = afterContents.includes(symbol);
  
  console.log(`\n📊 Verification:`);
  console.log(`   Before: ${beforeCount} stocks`);
  console.log(`   After:  ${afterCount} stocks`);
  console.log(`   ${symbol}: ${alreadyExists ? 'existed' : 'new'} → ${nowExists ? 'exists' : 'missing'}`);
  
  if (nowExists) {
    logSuccess(`✓ Verified: ${symbol} appears in watchlist contents`);
    return true;
  } else {
    logError(`✗ Verification failed: ${symbol} NOT found in watchlist`);
    return false;
  }
}

async function testRemoveStock(
  session: SessionKeyValue,
  wlid: string,
  symbol: string
): Promise<boolean> {
  logSection(`TEST 3: Remove Stock "${symbol}" from Watchlist ${wlid}`);
  
  // Get contents before
  const beforeContents = await getWatchlistContents(session, wlid);
  const beforeCount = beforeContents.length;
  const exists = beforeContents.includes(symbol);
  
  if (!exists) {
    logInfo(`Stock ${symbol} doesn't exist in watchlist (cannot remove)`);
  }
  
  await sleep(1000);
  
  // Remove stock
  const url = `https://www.marketinout.com/wl/wl_add_all.php?action=remove&wlid=${wlid}&wl_name=&symbol=${symbol}`;
  const response = await MIOHttpClient.request(
    url,
    { method: 'GET', sessionKeyValue: session }
  );
  
  if (!response.success) {
    logError(`Failed to remove stock: ${response.error?.message}`);
    return false;
  }
  
  logSuccess(`Stock remove request completed (HTTP ${response.meta.statusCode})`);
  
  await sleep(1000);
  
  // Verify it disappears from watchlist
  const afterContents = await getWatchlistContents(session, wlid);
  const afterCount = afterContents.length;
  const stillExists = afterContents.includes(symbol);
  
  console.log(`\n📊 Verification:`);
  console.log(`   Before: ${beforeCount} stocks`);
  console.log(`   After:  ${afterCount} stocks`);
  console.log(`   ${symbol}: ${exists ? 'existed' : 'missing'} → ${stillExists ? 'still exists' : 'removed'}`);
  
  if (!stillExists) {
    logSuccess(`✓ Verified: ${symbol} removed from watchlist contents`);
    return true;
  } else {
    logError(`✗ Verification failed: ${symbol} still found in watchlist`);
    return false;
  }
}

async function testDeleteWatchlist(
  session: SessionKeyValue,
  wlid: string
): Promise<boolean> {
  logSection(`TEST 4: Delete Watchlist ${wlid}`);
  
  // Get watchlist list before
  const beforeWatchlists = await getAllWatchlists(session);
  const beforeCount = beforeWatchlists.length;
  const exists = beforeWatchlists.some(wl => wl.id === wlid);
  
  if (!exists) {
    logInfo(`Watchlist ${wlid} doesn't exist (cannot delete)`);
  }
  
  await sleep(1000);
  
  // Delete watchlist
  const url = `https://www.marketinout.com/wl/my_watch_lists.php?todelete=${wlid}&mode=delete`;
  const response = await MIOHttpClient.request(
    url,
    { method: 'GET', sessionKeyValue: session }
  );
  
  if (!response.success) {
    logError(`Failed to delete watchlist: ${response.error?.message}`);
    return false;
  }
  
  logSuccess(`Watchlist delete request completed (HTTP ${response.meta.statusCode})`);
  
  await sleep(1000);
  
  // Verify it disappears from watchlist list
  const afterWatchlists = await getAllWatchlists(session);
  const afterCount = afterWatchlists.length;
  const stillExists = afterWatchlists.some(wl => wl.id === wlid);
  
  console.log(`\n📊 Verification:`);
  console.log(`   Before: ${beforeCount} watchlists`);
  console.log(`   After:  ${afterCount} watchlists`);
  console.log(`   Watchlist ${wlid}: ${exists ? 'existed' : 'missing'} → ${stillExists ? 'still exists' : 'deleted'}`);
  
  if (!stillExists) {
    logSuccess(`✓ Verified: Watchlist ${wlid} removed from list`);
    return true;
  } else {
    logError(`✗ Verification failed: Watchlist ${wlid} still in list`);
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('🧪 POC: Comprehensive Operation Validation\n');
  console.log('This test validates each operation by checking actual state:');
  console.log('  • Add stock → Verify it appears in watchlist');
  console.log('  • Remove stock → Verify it disappears from watchlist');
  console.log('  • Create watchlist → Verify it appears in list');
  console.log('  • Delete watchlist → Verify it disappears from list\n');
  
  // Get session
  const sessionInfo = await SessionResolver.getLatestSession('marketinout');
  if (!sessionInfo) {
    logError('No session found');
    process.exit(1);
  }
  
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
    logError('No ASPSESSION found');
    process.exit(1);
  }
  
  const session: SessionKeyValue = { key: aspSessionKey, value: aspSessionValue };
  logSuccess(`Loaded session: ${aspSessionKey}`);
  
  // Track test results
  const results: { test: string; passed: boolean }[] = [];
  
  // TEST 1: Create watchlist and verify
  const wlid = await testCreateWatchlist(session, TEST_CONFIG.WATCHLIST_NAME);
  results.push({ test: 'Create Watchlist', passed: !!wlid });
  
  if (!wlid) {
    logError('Cannot proceed without watchlist - stopping tests');
    process.exit(1);
  }
  
  // TEST 2: Add each stock and verify
  for (const symbol of TEST_CONFIG.TEST_SYMBOLS) {
    const success = await testAddStock(session, wlid, symbol);
    results.push({ test: `Add Stock ${symbol}`, passed: success });
  }
  
  // TEST 3: Remove one stock and verify
  const symbolToRemove = TEST_CONFIG.TEST_SYMBOLS[1]; // INFY.NS
  const removeSuccess = await testRemoveStock(session, wlid, symbolToRemove);
  results.push({ test: `Remove Stock ${symbolToRemove}`, passed: removeSuccess });
  
  // TEST 4: Delete watchlist and verify
  const deleteSuccess = await testDeleteWatchlist(session, wlid);
  results.push({ test: 'Delete Watchlist', passed: deleteSuccess });
  
  // Print summary
  logSection('TEST SUMMARY');
  
  console.log('\n📊 Results:');
  let passCount = 0;
  results.forEach(({ test, passed }) => {
    const icon = passed ? '✅' : '❌';
    console.log(`   ${icon} ${test}`);
    if (passed) passCount++;
  });
  
  const totalTests = results.length;
  const passRate = ((passCount / totalTests) * 100).toFixed(1);
  
  console.log(`\n📈 Overall:`);
  console.log(`   Total:  ${totalTests} tests`);
  console.log(`   Passed: ${passCount} ✅`);
  console.log(`   Failed: ${totalTests - passCount} ❌`);
  console.log(`   Rate:   ${passRate}%`);
  
  if (passCount === totalTests) {
    console.log('\n🎉 All tests passed! Operations are working correctly.');
  } else {
    console.log(`\n⚠️  ${totalTests - passCount} test(s) failed. Review the output above.`);
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
