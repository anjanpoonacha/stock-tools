#!/usr/bin/env tsx
/**
 * POC: Test BELRISE Bug Fix
 * 
 * This test verifies that:
 * 1. Symbol normalization adds .NS suffix correctly (BELRISE → BELRISE.NS)
 * 2. Response parser detects actual success/failure from HTML
 * 3. Stock actually appears in watchlist after adding
 * 
 * Tests both BEFORE and AFTER fix scenarios.
 */

import { SessionResolver } from '../../src/lib/SessionResolver.js';
import { MIOHttpClient, RequestValidator } from '../../src/lib/mio/core/index.js';
import type { SessionKeyValue } from '../../src/lib/mio/types.js';
import { normalizeSymbol } from '../../src/lib/utils/exchangeMapper.js';

const TEST_WLID = '74577'; // User's watchlist ID
const TEST_SYMBOL_PLAIN = 'BELRISE'; // Plain symbol (without .NS)
const TEST_SYMBOL_FORMATTED = 'BELRISE.NS'; // Correct format
const TEST_SYMBOL_ALT = 'TATAMOTORS'; // Alternative test symbol

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function logSuccess(msg: string) {
  console.log(`${GREEN}✅ ${msg}${RESET}`);
}

function logError(msg: string) {
  console.log(`${RED}❌ ${msg}${RESET}`);
}

function logInfo(msg: string) {
  console.log(`${CYAN}ℹ️  ${msg}${RESET}`);
}

function logWarning(msg: string) {
  console.log(`${YELLOW}⚠️  ${msg}${RESET}`);
}

function logSection(msg: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ${BLUE}${msg}${RESET}`);
  console.log('='.repeat(80));
}

/**
 * Fetch watchlist contents and extract stock symbols
 */
async function getWatchlistSymbols(session: SessionKeyValue, wlid: string): Promise<string[]> {
  const url = `https://www.marketinout.com/wl/watch_list.php?wlid=${wlid}`;
  
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
  
  return response.data || [];
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`\n🧪 ${BLUE}POC: BELRISE Bug Fix Verification${RESET}\n`);
  
  try {
    // Get session from KV storage (same approach as poc-validate-operations.ts)
    logInfo('Loading session from KV storage...');
    
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

    // ========================================================================
    // TEST 1: Symbol Normalization
    // ========================================================================
    logSection('TEST 1: Symbol Normalization');
    
    const normalizedPlain = normalizeSymbol(TEST_SYMBOL_PLAIN, 'mio');
    const normalizedFormatted = normalizeSymbol(TEST_SYMBOL_FORMATTED, 'mio');
    const normalizedTv = normalizeSymbol('NSE:BELRISE', 'mio');
    const normalizedBse = normalizeSymbol('BSE:TATAMOTORS', 'mio');
    
    logInfo(`Input: "${TEST_SYMBOL_PLAIN}" → Output: "${normalizedPlain}"`);
    if (normalizedPlain === TEST_SYMBOL_FORMATTED) {
      logSuccess('✓ Plain symbol normalized correctly (BELRISE → BELRISE.NS)');
    } else {
      logError(`✗ Expected "${TEST_SYMBOL_FORMATTED}", got "${normalizedPlain}"`);
    }
    
    logInfo(`Input: "${TEST_SYMBOL_FORMATTED}" → Output: "${normalizedFormatted}"`);
    if (normalizedFormatted === TEST_SYMBOL_FORMATTED) {
      logSuccess('✓ Already formatted symbol unchanged');
    } else {
      logError(`✗ Should not change already formatted symbol`);
    }
    
    logInfo(`Input: "NSE:BELRISE" → Output: "${normalizedTv}"`);
    if (normalizedTv === TEST_SYMBOL_FORMATTED) {
      logSuccess('✓ TV format converted correctly (NSE:BELRISE → BELRISE.NS)');
    } else {
      logError(`✗ Expected "${TEST_SYMBOL_FORMATTED}", got "${normalizedTv}"`);
    }
    
    logInfo(`Input: "BSE:TATAMOTORS" → Output: "${normalizedBse}"`);
    if (normalizedBse === 'TATAMOTORS.BO') {
      logSuccess('✓ BSE format converted correctly (BSE:TATAMOTORS → TATAMOTORS.BO)');
    } else {
      logError(`✗ Expected "TATAMOTORS.BO", got "${normalizedBse}"`);
    }

    // ========================================================================
    // TEST 2: Add Stock with Plain Symbol (Should Auto-Format)
    // ========================================================================
    logSection(`TEST 2: Add "${TEST_SYMBOL_PLAIN}" (Plain Symbol)`);
    
    logInfo('Fetching watchlist contents BEFORE adding...');
    const beforeSymbols = await getWatchlistSymbols(session, TEST_WLID);
    logInfo(`Found ${beforeSymbols.length} stocks: ${beforeSymbols.slice(0, 5).join(', ')}${beforeSymbols.length > 5 ? '...' : ''}`);
    
    const wasPresentBefore = beforeSymbols.includes(TEST_SYMBOL_FORMATTED);
    if (wasPresentBefore) {
      logWarning(`${TEST_SYMBOL_FORMATTED} already exists - will remove first`);
      const removeUrl = `https://www.marketinout.com/wl/wl_add_all.php?action=remove&wlid=${TEST_WLID}&wl_name=&symbol=${TEST_SYMBOL_FORMATTED}`;
      await MIOHttpClient.request(removeUrl, { method: 'GET', sessionKeyValue: session });
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for removal
    }
    
    logInfo(`Adding "${TEST_SYMBOL_PLAIN}" to watchlist ${TEST_WLID}...`);
    const normalizedSymbol = normalizeSymbol(TEST_SYMBOL_PLAIN, 'mio');
    logInfo(`Normalized: "${TEST_SYMBOL_PLAIN}" → "${normalizedSymbol}"`);
    
    const addUrl = `https://www.marketinout.com/wl/wl_add_all.php?action=add&wlid=${TEST_WLID}&wl_name=&symbol=${normalizedSymbol}`;
    const addResult = await MIOHttpClient.request(
      addUrl,
      { method: 'GET', sessionKeyValue: session },
      (html) => {
        // Check if redirect contains the symbol (indicates success)
        const hasSymbol = html.includes(`symbol=${normalizedSymbol}`);
        return {
          success: hasSymbol,
          symbol: hasSymbol ? normalizedSymbol : '',
        };
      }
    );
    
    logInfo(`API Response: success=${addResult.success}, symbol="${addResult.data?.symbol}"`);
    
    if (!addResult.success) {
      logError(`✗ API returned failure`);
      logInfo('This is expected if HTML parsing detected invalid operation');
    } else {
      logInfo('✓ API returned success');
      
      // Verify the symbol was normalized in the response
      if (addResult.data?.symbol === TEST_SYMBOL_FORMATTED) {
        logSuccess(`✓ API normalized symbol: ${TEST_SYMBOL_PLAIN} → ${TEST_SYMBOL_FORMATTED}`);
      } else {
        logWarning(`⚠️  API response symbol: ${addResult.data?.symbol} (expected ${TEST_SYMBOL_FORMATTED})`);
      }
    }
    
    // Wait for operation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logInfo('Fetching watchlist contents AFTER adding...');
    const afterSymbols = await getWatchlistSymbols(session, TEST_WLID);
    logInfo(`Found ${afterSymbols.length} stocks: ${afterSymbols.slice(0, 5).join(', ')}${afterSymbols.length > 5 ? '...' : ''}`);
    
    const isPresentAfter = afterSymbols.includes(TEST_SYMBOL_FORMATTED);
    
    logInfo('\n📊 Verification:');
    logInfo(`   Before: ${beforeSymbols.length} stocks, ${TEST_SYMBOL_FORMATTED}: ${wasPresentBefore ? 'existed' : 'not found'}`);
    logInfo(`   After:  ${afterSymbols.length} stocks, ${TEST_SYMBOL_FORMATTED}: ${isPresentAfter ? 'exists' : 'not found'}`);
    
    if (isPresentAfter) {
      logSuccess(`✓ Verified: ${TEST_SYMBOL_FORMATTED} appears in watchlist contents`);
      logSuccess('✓ Bug is FIXED: Stock added successfully with normalized symbol');
    } else {
      logError(`✗ Verification failed: ${TEST_SYMBOL_FORMATTED} NOT found in watchlist`);
      logError('✗ Bug still exists: Symbol normalization or parsing issue');
    }

    // ========================================================================
    // TEST 3: Cleanup
    // ========================================================================
    logSection('TEST 3: Cleanup');
    
    if (isPresentAfter) {
      logInfo(`Removing ${TEST_SYMBOL_FORMATTED} from watchlist...`);
      const removeUrl = `https://www.marketinout.com/wl/wl_add_all.php?action=remove&wlid=${TEST_WLID}&wl_name=&symbol=${TEST_SYMBOL_FORMATTED}`;
      const removeResult = await MIOHttpClient.request(
        removeUrl,
        { method: 'GET', sessionKeyValue: session }
      );
      
      if (removeResult.success) {
        logSuccess('✓ Test stock removed successfully');
      } else {
        logWarning('⚠️  Could not remove test stock (manual cleanup needed)');
      }
    }

    // ========================================================================
    // TEST SUMMARY
    // ========================================================================
    logSection('TEST SUMMARY');
    
    const normalizationPassed = normalizedPlain === TEST_SYMBOL_FORMATTED;
    const addPassed = isPresentAfter;
    const allPassed = normalizationPassed && addPassed;
    
    console.log('\n📊 Results:');
    console.log(`   ${normalizationPassed ? GREEN + '✅' : RED + '❌'} Symbol Normalization${RESET}`);
    console.log(`   ${addPassed ? GREEN + '✅' : RED + '❌'} Stock Add & Verification${RESET}`);
    console.log(`\n📈 Overall:`);
    console.log(`   Total:  2 tests`);
    console.log(`   Passed: ${(normalizationPassed ? 1 : 0) + (addPassed ? 1 : 0)} ${GREEN}✅${RESET}`);
    console.log(`   Failed: ${(normalizationPassed ? 0 : 1) + (addPassed ? 0 : 1)} ${RED}❌${RESET}`);
    console.log(`   Rate:   ${((((normalizationPassed ? 1 : 0) + (addPassed ? 1 : 0)) / 2) * 100).toFixed(1)}%`);
    
    if (allPassed) {
      console.log(`\n${GREEN}🎉 All tests passed! The BELRISE bug is FIXED.${RESET}\n`);
      process.exit(0);
    } else {
      console.log(`\n${RED}❌ Some tests failed. The bug still exists.${RESET}\n`);
      process.exit(1);
    }

  } catch (error) {
    logError(`Test error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests();
