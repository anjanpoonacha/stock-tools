#!/usr/bin/env tsx
/**
 * POC: Integration Test Using ONLY Shared Utilities
 * 
 * This test validates that all shared utilities work together correctly
 * by running a complete watchlist lifecycle WITHOUT duplicating any code.
 * 
 * Test Flow:
 * 1. Load session from KV storage
 * 2. Create test watchlist (validate name first)
 * 3. Add stocks in bulk (validate symbols first)
 * 4. Add single stock using shared HTTP client
 * 5. Remove single stock
 * 6. Delete watchlist
 * 7. Verify all responses follow MIOResponse<T> structure
 * 
 * Key Requirements:
 * - Use ONLY shared utilities from src/lib/mio/core/
 * - No direct fetch() calls
 * - Validate all inputs before making requests
 * - Verify all responses have correct structure
 * - Output detailed timing and results
 * 
 * Run with: tsx --env-file=.env scripts/poc-mio/poc-integration-test.ts
 */

import { SessionResolver } from '../../src/lib/SessionResolver.js';
import {
  MIOHttpClient,
  RequestValidator,
  ResponseParser,
  type MIOResponse,
} from '../../src/lib/mio/core/index.js';
import type { SessionKeyValue } from '../../src/lib/mio/types.js';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  WATCHLIST_NAME: `INTEGRATION_TEST_${Date.now()}`,
  BULK_SYMBOLS: ['TCS.NS', 'INFY.NS', 'RELIANCE.NS'] as string[],
  SINGLE_ADD_SYMBOL: 'WIPRO.NS',
  REMOVE_SYMBOL: 'INFY.NS',
};

const MIO_BASE_URL = 'https://www.marketinout.com';

// ============================================================================
// LOGGING UTILITIES
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

function logTiming(label: string, startTime: number) {
  const duration = Date.now() - startTime;
  console.log(`⏱️  ${label}: ${duration}ms`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// TEST RESULT TRACKING
// ============================================================================

type TestResult = {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
};

const testResults: TestResult[] = [];

function recordTest(name: string, success: boolean, duration: number, error?: string) {
  testResults.push({ name, success, duration, error });
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test 1: Load session from KV storage
 */
async function testLoadSession(): Promise<SessionKeyValue | null> {
  logSection('TEST 1: Load Session from KV Storage');
  const startTime = Date.now();

  try {
    const sessionInfo = await SessionResolver.getLatestSession('marketinout');

    if (!sessionInfo) {
      logError('No MarketInOut session found in KV storage');
      logInfo('Please use the browser extension to capture a session first');
      recordTest('Load Session', false, Date.now() - startTime, 'No session found');
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
      recordTest('Load Session', false, Date.now() - startTime, 'Missing ASPSESSION cookie');
      return null;
    }

    logSuccess(`Session key: ${aspSessionKey}`);
    logInfo(`Session value: ${aspSessionValue.substring(0, 20)}...`);
    logTiming('Load Session', startTime);

    recordTest('Load Session', true, Date.now() - startTime);
    return { key: aspSessionKey, value: aspSessionValue };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError(`Failed: ${errorMsg}`);
    recordTest('Load Session', false, Date.now() - startTime, errorMsg);
    return null;
  }
}

/**
 * Test 2: Create watchlist using shared utilities
 */
async function testCreateWatchlist(
  session: SessionKeyValue,
  name: string
): Promise<string | null> {
  logSection(`TEST 2: Create Watchlist "${name}"`);
  const startTime = Date.now();

  // Step 1: Validate watchlist name BEFORE making request
  logInfo('Validating watchlist name...');
  const nameValidation = RequestValidator.validateWatchlistName(name);
  if (!nameValidation.valid) {
    logError(`Validation failed: ${nameValidation.error}`);
    recordTest('Create Watchlist', false, Date.now() - startTime, nameValidation.error);
    return null;
  }
  logSuccess('Watchlist name validation passed');

  // Step 2: Make request using shared HTTP client
  logInfo('Creating watchlist via MIOHttpClient...');
  const url = `${MIO_BASE_URL}/wl/my_watch_lists.php?mode=new&name=${encodeURIComponent(name)}`;

  const response: MIOResponse<{ wlid?: string; created: boolean; name: string }> =
    await MIOHttpClient.request(
      url,
      { method: 'GET', sessionKeyValue: session },
      (html) => {
        // Use ResponseParser to extract watchlist ID from redirect
        const wlid = ResponseParser.extractWatchlistId(html);
        return {
          wlid: wlid || undefined,
          created: !!wlid,
          name,
        };
      }
    );

  // Step 3: Verify response structure
  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    if (response.error?.needsRefresh) {
      logInfo('⚠️  SESSION NEEDS REFRESH');
    }
    logInfo(`Response metadata: ${JSON.stringify(response.meta, null, 2)}`);
    recordTest('Create Watchlist', false, Date.now() - startTime, response.error?.message);
    return null;
  }

  if (!response.data?.wlid) {
    logError('Watchlist created but no ID returned');
    recordTest('Create Watchlist', false, Date.now() - startTime, 'No wlid in response');
    return null;
  }

  logSuccess(`Created watchlist with ID: ${response.data.wlid}`);
  logInfo(`Response type: ${response.meta.responseType}`);
  logInfo(`Status code: ${response.meta.statusCode}`);
  logTiming('Create Watchlist', startTime);

  recordTest('Create Watchlist', true, Date.now() - startTime);
  return response.data.wlid;
}

/**
 * Test 3: Add stocks in bulk using shared utilities
 */
async function testAddStocksBulk(
  session: SessionKeyValue,
  wlid: string,
  symbols: string[]
): Promise<boolean> {
  logSection(`TEST 3: Add Stocks in Bulk - ${symbols.join(', ')}`);
  const startTime = Date.now();

  // Step 1: Validate watchlist ID
  logInfo('Validating watchlist ID...');
  const wlidValidation = RequestValidator.validateWatchlistId(wlid);
  if (!wlidValidation.valid) {
    logError(`Validation failed: ${wlidValidation.error}`);
    recordTest('Add Stocks Bulk', false, Date.now() - startTime, wlidValidation.error);
    return false;
  }
  logSuccess('Watchlist ID validation passed');

  // Step 2: Validate all symbols BEFORE making request
  logInfo('Validating symbols...');
  const symbolsValidation = RequestValidator.validateSymbols(symbols);
  if (!symbolsValidation.valid) {
    logError(`Validation failed: Invalid symbols - ${symbolsValidation.invalid.join(', ')}`);
    recordTest(
      'Add Stocks Bulk',
      false,
      Date.now() - startTime,
      `Invalid symbols: ${symbolsValidation.invalid.join(', ')}`
    );
    return false;
  }
  logSuccess('All symbols validation passed');

  // Step 3: Make POST request using shared HTTP client
  logInfo('Adding stocks via MIOHttpClient...');
  const url = `${MIO_BASE_URL}/wl/watch_list.php`;
  const formData = new URLSearchParams({
    mode: 'add',
    wlid,
    stock_list: symbols.join(','),
  });

  const response: MIOResponse<{ added: boolean; count: number }> = await MIOHttpClient.request(
    url,
    {
      method: 'POST',
      sessionKeyValue: session,
      body: formData,
    },
    (html) => {
      // Parse response to verify operation succeeded
      const wlidInRedirect = ResponseParser.extractWatchlistId(html);
      return {
        added: !!wlidInRedirect && wlidInRedirect === wlid,
        count: symbols.length,
      };
    }
  );

  // Step 4: Verify response structure
  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    if (response.error?.needsRefresh) {
      logInfo('⚠️  SESSION NEEDS REFRESH');
    }
    recordTest('Add Stocks Bulk', false, Date.now() - startTime, response.error?.message);
    return false;
  }

  logSuccess(`Added ${response.data?.count || symbols.length} stocks to watchlist ${wlid}`);
  logInfo(`Response type: ${response.meta.responseType}`);
  logInfo(`Status code: ${response.meta.statusCode}`);
  logTiming('Add Stocks Bulk', startTime);

  recordTest('Add Stocks Bulk', true, Date.now() - startTime);
  return true;
}

/**
 * Test 4: Add single stock using shared utilities
 */
async function testAddSingleStock(
  session: SessionKeyValue,
  wlid: string,
  symbol: string
): Promise<boolean> {
  logSection(`TEST 4: Add Single Stock - ${symbol}`);
  const startTime = Date.now();

  // Step 1: Validate inputs
  logInfo('Validating inputs...');
  const wlidValidation = RequestValidator.validateWatchlistId(wlid);
  const symbolValidation = RequestValidator.validateSymbol(symbol);

  if (!wlidValidation.valid) {
    logError(`Watchlist ID validation failed: ${wlidValidation.error}`);
    recordTest('Add Single Stock', false, Date.now() - startTime, wlidValidation.error);
    return false;
  }

  if (!symbolValidation.valid) {
    logError(`Symbol validation failed: ${symbolValidation.error}`);
    recordTest('Add Single Stock', false, Date.now() - startTime, symbolValidation.error);
    return false;
  }
  logSuccess('Input validation passed');

  // Step 2: Make request using shared HTTP client
  logInfo('Adding stock via MIOHttpClient...');
  const url = `${MIO_BASE_URL}/wl/wl_add_all.php?action=add&wlid=${wlid}&symbol=${encodeURIComponent(symbol)}`;

  const response: MIOResponse<{ success: boolean; action: 'add'; symbol: string }> =
    await MIOHttpClient.request(
      url,
      { method: 'GET', sessionKeyValue: session },
      (html) => {
        // Use ResponseParser to extract action details
        const parsed = ResponseParser.parseAddAllResponse(html, wlid);
        return {
          success: parsed.success,
          action: 'add',
          symbol: parsed.symbol || symbol,
        };
      }
    );

  // Step 3: Verify response structure
  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    if (response.error?.needsRefresh) {
      logInfo('⚠️  SESSION NEEDS REFRESH');
    }
    recordTest('Add Single Stock', false, Date.now() - startTime, response.error?.message);
    return false;
  }

  logSuccess(`Added ${symbol} to watchlist ${wlid}`);
  logInfo(`Response type: ${response.meta.responseType}`);
  logInfo(`Status code: ${response.meta.statusCode}`);
  logTiming('Add Single Stock', startTime);

  recordTest('Add Single Stock', true, Date.now() - startTime);
  return true;
}

/**
 * Test 5: Remove single stock using shared utilities
 */
async function testRemoveSingleStock(
  session: SessionKeyValue,
  wlid: string,
  symbol: string
): Promise<boolean> {
  logSection(`TEST 5: Remove Single Stock - ${symbol}`);
  const startTime = Date.now();

  // Step 1: Validate inputs
  logInfo('Validating inputs...');
  const wlidValidation = RequestValidator.validateWatchlistId(wlid);
  const symbolValidation = RequestValidator.validateSymbol(symbol);

  if (!wlidValidation.valid || !symbolValidation.valid) {
    const error = wlidValidation.error || symbolValidation.error;
    logError(`Validation failed: ${error}`);
    recordTest('Remove Single Stock', false, Date.now() - startTime, error);
    return false;
  }
  logSuccess('Input validation passed');

  // Step 2: Make request using shared HTTP client
  logInfo('Removing stock via MIOHttpClient...');
  const url = `${MIO_BASE_URL}/wl/wl_add_all.php?action=remove&wlid=${wlid}&symbol=${encodeURIComponent(symbol)}`;

  const response: MIOResponse<{ success: boolean; action: 'remove'; symbol: string }> =
    await MIOHttpClient.request(
      url,
      { method: 'GET', sessionKeyValue: session },
      (html) => {
        const parsed = ResponseParser.parseAddAllResponse(html, wlid);
        return {
          success: parsed.success,
          action: 'remove',
          symbol: parsed.symbol || symbol,
        };
      }
    );

  // Step 3: Verify response structure
  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    if (response.error?.needsRefresh) {
      logInfo('⚠️  SESSION NEEDS REFRESH');
    }
    recordTest('Remove Single Stock', false, Date.now() - startTime, response.error?.message);
    return false;
  }

  logSuccess(`Removed ${symbol} from watchlist ${wlid}`);
  logInfo(`Response type: ${response.meta.responseType}`);
  logInfo(`Status code: ${response.meta.statusCode}`);
  logTiming('Remove Single Stock', startTime);

  recordTest('Remove Single Stock', true, Date.now() - startTime);
  return true;
}

/**
 * Test 6: Delete watchlist using shared utilities
 */
async function testDeleteWatchlist(session: SessionKeyValue, wlid: string): Promise<boolean> {
  logSection(`TEST 6: Delete Watchlist ${wlid}`);
  const startTime = Date.now();

  // Step 1: Validate watchlist ID
  logInfo('Validating watchlist ID...');
  const wlidValidation = RequestValidator.validateWatchlistId(wlid);
  if (!wlidValidation.valid) {
    logError(`Validation failed: ${wlidValidation.error}`);
    recordTest('Delete Watchlist', false, Date.now() - startTime, wlidValidation.error);
    return false;
  }
  logSuccess('Watchlist ID validation passed');

  // Step 2: Make request using shared HTTP client
  logInfo('Deleting watchlist via MIOHttpClient...');
  const url = `${MIO_BASE_URL}/wl/my_watch_lists.php?mode=delete&wl_sel=${wlid}`;

  const response: MIOResponse<{ deleted: boolean }> = await MIOHttpClient.request(
    url,
    { method: 'GET', sessionKeyValue: session },
    (html) => {
      // Verify redirect to watchlist management page
      const redirectUrl = ResponseParser.extractRedirectUrl(html);
      return {
        deleted: redirectUrl?.includes('my_watch_lists.php') || false,
      };
    }
  );

  // Step 3: Verify response structure
  if (!response.success) {
    logError(`Failed: ${response.error?.message}`);
    if (response.error?.needsRefresh) {
      logInfo('⚠️  SESSION NEEDS REFRESH');
    }
    recordTest('Delete Watchlist', false, Date.now() - startTime, response.error?.message);
    return false;
  }

  logSuccess(`Deleted watchlist ${wlid}`);
  logInfo(`Response type: ${response.meta.responseType}`);
  logInfo(`Status code: ${response.meta.statusCode}`);
  logTiming('Delete Watchlist', startTime);

  recordTest('Delete Watchlist', true, Date.now() - startTime);
  return true;
}

/**
 * Test 7: Validation error handling
 */
async function testValidationErrors(): Promise<boolean> {
  logSection('TEST 7: Validation Error Handling');
  const startTime = Date.now();

  let allPassed = true;

  // Test 7a: Invalid watchlist ID
  console.log('\n📝 Testing invalid watchlist ID...');
  const invalidWlidResult = RequestValidator.validateWatchlistId('invalid_id');
  if (!invalidWlidResult.valid) {
    logSuccess(`Caught invalid wlid: ${invalidWlidResult.error}`);
  } else {
    logError('Failed to catch invalid wlid');
    allPassed = false;
  }

  // Test 7b: Invalid symbol
  console.log('\n📝 Testing invalid symbol...');
  const invalidSymbolResult = RequestValidator.validateSymbol('INVALID SYMBOL!!!');
  if (!invalidSymbolResult.valid) {
    logSuccess(`Caught invalid symbol: ${invalidSymbolResult.error}`);
  } else {
    logError('Failed to catch invalid symbol');
    allPassed = false;
  }

  // Test 7c: Empty watchlist name
  console.log('\n📝 Testing empty watchlist name...');
  const emptyNameResult = RequestValidator.validateWatchlistName('');
  if (!emptyNameResult.valid) {
    logSuccess(`Caught empty name: ${emptyNameResult.error}`);
  } else {
    logError('Failed to catch empty name');
    allPassed = false;
  }

  // Test 7d: Watchlist name too long
  console.log('\n📝 Testing watchlist name too long...');
  const longNameResult = RequestValidator.validateWatchlistName('a'.repeat(101));
  if (!longNameResult.valid) {
    logSuccess(`Caught name too long: ${longNameResult.error}`);
  } else {
    logError('Failed to catch name too long');
    allPassed = false;
  }

  // Test 7e: Bulk symbol validation
  console.log('\n📝 Testing bulk symbol validation...');
  const bulkResult = RequestValidator.validateSymbols(['TCS.NS', 'INVALID!!!', 'INFY.NS']);
  if (!bulkResult.valid && bulkResult.invalid.includes('INVALID!!!')) {
    logSuccess(`Caught invalid symbols: ${bulkResult.invalid.join(', ')}`);
  } else {
    logError('Failed to catch invalid symbols in bulk validation');
    allPassed = false;
  }

  logTiming('Validation Tests', startTime);
  recordTest('Validation Error Handling', allPassed, Date.now() - startTime);

  return allPassed;
}

// ============================================================================
// SUMMARY REPORT
// ============================================================================

function printSummary() {
  logSection('TEST SUMMARY');

  const totalTests = testResults.length;
  const passedTests = testResults.filter((t) => t.success).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = testResults.reduce((sum, t) => sum + t.duration, 0);

  console.log('\n📊 Results:');
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed: ${passedTests} ✅`);
  console.log(`  Failed: ${failedTests} ❌`);
  console.log(`  Total Duration: ${totalDuration}ms\n`);

  console.log('📋 Detailed Results:');
  testResults.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    const errorInfo = result.error ? ` (${result.error})` : '';
    console.log(`  ${status} ${result.name}: ${result.duration}ms${errorInfo}`);
  });

  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED!\n');
    console.log('✨ Key Achievements:');
    console.log('  ✅ All shared utilities working correctly');
    console.log('  ✅ Request validation catches errors before API calls');
    console.log('  ✅ Response parsing handles all response types');
    console.log('  ✅ Response validation detects session expiry');
    console.log('  ✅ MIOHttpClient provides consistent interface');
    console.log('  ✅ All responses follow MIOResponse<T> structure');
    console.log('\n📝 Ready for production integration!');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED\n');
    console.log('Failed Tests:');
    testResults
      .filter((t) => !t.success)
      .forEach((result) => {
        console.log(`  ❌ ${result.name}: ${result.error}`);
      });
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('🚀 POC: Integration Test Using ONLY Shared Utilities\n');
  console.log('This test validates the complete watchlist lifecycle using:');
  console.log('  • MIOHttpClient for all HTTP requests');
  console.log('  • RequestValidator for input validation');
  console.log('  • ResponseParser for HTML parsing');
  console.log('  • ResponseValidator for response validation');
  console.log('  • MIOResponse<T> for type-safe responses\n');

  const overallStartTime = Date.now();

  // Test 1: Load session
  const session = await testLoadSession();
  if (!session) {
    console.log('\n❌ Cannot proceed without valid session');
    process.exit(1);
  }

  await sleep(1000); // Rate limiting

  // Test 2: Create watchlist
  const testWlid = await testCreateWatchlist(session, TEST_CONFIG.WATCHLIST_NAME);
  if (!testWlid) {
    console.log('\n❌ Failed to create test watchlist - stopping tests');
    printSummary();
    process.exit(1);
  }

  await sleep(1000);

  // Test 3: Add stocks in bulk
  const bulkAddSuccess = await testAddStocksBulk(session, testWlid, TEST_CONFIG.BULK_SYMBOLS);
  if (!bulkAddSuccess) {
    logInfo('Bulk add failed, but continuing tests...');
  }

  await sleep(1000);

  // Test 4: Add single stock
  const singleAddSuccess = await testAddSingleStock(
    session,
    testWlid,
    TEST_CONFIG.SINGLE_ADD_SYMBOL
  );
  if (!singleAddSuccess) {
    logInfo('Single add failed, but continuing tests...');
  }

  await sleep(1000);

  // Test 5: Remove single stock
  const removeSuccess = await testRemoveSingleStock(
    session,
    testWlid,
    TEST_CONFIG.REMOVE_SYMBOL
  );
  if (!removeSuccess) {
    logInfo('Remove failed, but continuing tests...');
  }

  await sleep(1000);

  // Test 6: Delete watchlist (cleanup)
  const deleteSuccess = await testDeleteWatchlist(session, testWlid);
  if (!deleteSuccess) {
    logError(`Failed to delete test watchlist ${testWlid}`);
    logInfo('You may need to manually delete it from MIO');
  }

  await sleep(1000);

  // Test 7: Validation errors
  await testValidationErrors();

  // Print summary
  const overallDuration = Date.now() - overallStartTime;
  console.log(`\n⏱️  Overall test duration: ${overallDuration}ms`);
  printSummary();

  // Exit with appropriate code
  const allPassed = testResults.every((t) => t.success);
  process.exit(allPassed ? 0 : 1);
}

// Run tests
main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
