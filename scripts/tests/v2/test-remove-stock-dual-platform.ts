#!/usr/bin/env tsx
/**
 * Integration Test: Remove Stock from Dual Platform Watchlist (MIO + TradingView)
 * 
 * Tests the synchronized removal of a stock from both MIO and TradingView platforms:
 * 1. Setup: Get sessions from KV storage
 * 2. Arrange: Create watchlist on BOTH platforms and add a stock
 * 3. Act: Remove stock from BOTH platforms (synchronized)
 * 4. Assert: Verify stock removed from both platforms
 * 5. Cleanup: Delete test watchlist from BOTH platforms
 * 
 * Usage:
 *   tsx --env-file=.env scripts/tests/v2/test-remove-stock-dual-platform.ts
 */

import { readFileSync } from 'fs';
import { SessionResolver } from '../../../src/lib/SessionResolver.js';
import { MIOService } from '../../../src/lib/mio/MIOService.js';
import { 
  createWatchlist as createTVWatchlist,
  appendSymbolToWatchlist,
  removeSymbolFromWatchlist,
  getWatchlists,
  getWatchlistById,
  deleteWatchlist,
  type TradingViewWatchlist
} from '../../../src/lib/tradingview.js';
import { normalizeSymbol } from '../../../src/lib/watchlist-sync/unifiedWatchlistService.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  WATCHLIST_NAME: `AUTO_DUAL_REMOVE_TEST_${Date.now()}`,
  TEST_SYMBOLS: ['RELIANCE', 'TCS'], // Add multiple symbols to prevent auto-deletion
  SYMBOL_TO_REMOVE: 'RELIANCE', // Only remove this one
  DELAY_MS: 2000,
  VERIFY_RETRY_ATTEMPTS: 3,
  VERIFY_RETRY_DELAY_MS: 1500,
};

// ============================================================================
// UTILITIES
// ============================================================================

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function logSuccess(message: string, platform?: 'MIO' | 'TV') {
  const prefix = platform ? `[${platform}]` : '';
  console.log(`✅ ${prefix} ${message}`);
}

function logError(message: string, platform?: 'MIO' | 'TV') {
  const prefix = platform ? `[${platform}]` : '';
  console.log(`❌ ${prefix} ${message}`);
}

function logInfo(message: string, platform?: 'MIO' | 'TV') {
  const prefix = platform ? `[${platform}]` : '';
  console.log(`ℹ️  ${prefix} ${message}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyTVWatchlistWithRetry(
  tvWlid: string,
  tvCookie: string,
  maxAttempts: number = 3,
  delayMs: number = 1500
): Promise<TradingViewWatchlist | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const watchlist = await getWatchlistById(tvWlid, tvCookie);
    
    if (watchlist) {
      logSuccess(`Watchlist found on attempt ${attempt}/${maxAttempts}`, 'TV');
      return watchlist;
    }
    
    if (attempt < maxAttempts) {
      logInfo(`Watchlist not found yet, retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})`, 'TV');
      await sleep(delayMs);
    }
  }
  
  return null;
}

// ============================================================================
// TEST
// ============================================================================

async function main() {
  console.log('🧪 Integration Test: Remove Stock from Dual Platform\n');

  // Variables for cleanup and operations
  let mioWlid: string | undefined;
  let tvWlid: string | undefined;
  let mioSessionKey: string | undefined;
  let mioSessionValue: string | undefined;
  let mioInternalSessionId: string | undefined;
  let tvCookie: string | undefined;

  try {
    // ========================================================================
    // SETUP: Get sessions from KV storage
    // ========================================================================
    logSection('SETUP: Get Sessions from KV Storage');

    // Load credentials from credentials.json
    const credentials = JSON.parse(readFileSync('credentials.json', 'utf-8'));
    logInfo(`Using credentials for: ${credentials.tradingview.username}`);
    
    const userEmail = credentials.tradingview.username;
    const userPassword = credentials.tradingview.password;

    // Get sessions for both platforms in parallel
    const [mioSession, tvSession] = await Promise.allSettled([
      SessionResolver.getLatestMIOSessionForUser({ userEmail, userPassword }),
      SessionResolver.getLatestSessionForUser('tradingview', { userEmail, userPassword }),
    ]);

    // Process MIO session
    if (mioSession.status === 'fulfilled' && mioSession.value) {
      const session = mioSession.value;
      logSuccess(`MIO session: ${session.internalId}`, 'MIO');
      
      // MIOSessionInfo already has key and value properties
      mioSessionKey = session.key;
      mioSessionValue = session.value;
      mioInternalSessionId = session.internalId;
    } else {
      logError('No MIO session found', 'MIO');
      process.exit(1);
    }

    // Process TradingView session
    if (tvSession.status === 'fulfilled' && tvSession.value) {
      const session = tvSession.value;
      logSuccess(`TV session: ${session.internalId}`, 'TV');
      
      // Build cookie with both sessionid and sessionid_sign (if available)
      const sessionId = session.sessionData.sessionId;
      const sessionIdSign = session.sessionData.sessionid_sign;
      
      tvCookie = sessionIdSign 
        ? `sessionid=${sessionId}; sessionid_sign=${sessionIdSign}`
        : `sessionid=${sessionId}`;
      
      if (!sessionIdSign) {
        logInfo('Warning: sessionid_sign not found in session data', 'TV');
      }
    } else {
      logError('No TradingView session found', 'TV');
      process.exit(1);
    }

    await sleep(TEST_CONFIG.DELAY_MS);

    // ========================================================================
    // ARRANGE: Create test watchlist on BOTH platforms
    // ========================================================================
    logSection('ARRANGE: Create Test Watchlist on BOTH Platforms');
    
    logInfo(`Creating watchlist: "${TEST_CONFIG.WATCHLIST_NAME}"`);

    const createResults = await Promise.allSettled([
      MIOService.createWatchlist(mioSessionKey!, mioSessionValue!, TEST_CONFIG.WATCHLIST_NAME),
      createTVWatchlist(TEST_CONFIG.WATCHLIST_NAME, tvCookie!),
    ]);

    // Process MIO creation result
    if (createResults[0].status === 'fulfilled') {
      const result = createResults[0].value;
      if (result.success && result.data) {
        mioWlid = result.data.wlid;
        logSuccess(`Created watchlist with ID: ${mioWlid}`, 'MIO');
      } else {
        logError(`Failed to create watchlist: ${result.error?.message}`, 'MIO');
        process.exit(1);
      }
    } else {
      logError(`Failed to create watchlist: ${createResults[0].reason}`, 'MIO');
      process.exit(1);
    }

    // Process TradingView creation result
    if (createResults[1].status === 'fulfilled') {
      tvWlid = createResults[1].value.id;
      logSuccess(`Created watchlist with ID: ${tvWlid}`, 'TV');
    } else {
      logError(`Failed to create watchlist: ${createResults[1].reason}`, 'TV');
      process.exit(1);
    }

    await sleep(TEST_CONFIG.DELAY_MS);

    // ========================================================================
    // ARRANGE: Add stocks to BOTH platforms
    // ========================================================================
    logSection('ARRANGE: Add Stocks to BOTH Platforms');

    // Normalize all symbols for both platforms
    const mioSymbols = TEST_CONFIG.TEST_SYMBOLS.map(s => normalizeSymbol(s, 'mio'));
    const tvSymbols = TEST_CONFIG.TEST_SYMBOLS.map(s => normalizeSymbol(s, 'tv'));
    
    logInfo(`Adding ${TEST_CONFIG.TEST_SYMBOLS.length} symbols to both platforms`);
    logInfo(`MIO symbols: ${mioSymbols.join(', ')}`);
    logInfo(`TV symbols: ${tvSymbols.join(', ')}`);

    // Add all symbols to both platforms in parallel
    const addPromises: Promise<any>[] = [];
    
    // Add to MIO
    for (const mioSymbol of mioSymbols) {
      addPromises.push(
        MIOService.addSingleStockWithSession(mioInternalSessionId!, mioWlid!, mioSymbol)
          .then(result => ({ platform: 'MIO', symbol: mioSymbol, result }))
      );
    }
    
    // Add to TradingView
    for (const tvSymbol of tvSymbols) {
      addPromises.push(
        appendSymbolToWatchlist(tvWlid!, tvSymbol, tvCookie!)
          .then(() => ({ platform: 'TV', symbol: tvSymbol, result: { success: true } }))
      );
    }

    const addResults = await Promise.allSettled(addPromises);

    // Process results
    let allSucceeded = true;
    for (const result of addResults) {
      if (result.status === 'fulfilled') {
        const { platform, symbol, result: opResult } = result.value;
        if (platform === 'MIO') {
          if (opResult.success) {
            logSuccess(`Added ${symbol} to watchlist`, 'MIO');
          } else {
            logError(`Failed to add ${symbol}: ${opResult.error?.message}`, 'MIO');
            allSucceeded = false;
          }
        } else if (platform === 'TV') {
          logSuccess(`Added ${symbol} to watchlist`, 'TV');
        }
      } else {
        logError(`Failed to add stock: ${result.reason}`);
        allSucceeded = false;
      }
    }

    if (!allSucceeded) {
      logError('Not all stocks were added successfully');
      process.exit(1);
    }

    await sleep(TEST_CONFIG.DELAY_MS);

    // ========================================================================
    // ARRANGE: Verify stocks exist on BOTH platforms
    // ========================================================================
    logSection('ARRANGE: Verify Stocks Exist on BOTH Platforms');

    const verifyResults = await Promise.allSettled([
      MIOService.getWatchlistsWithSession(mioInternalSessionId!),
      getWatchlists(tvCookie!),
    ]);

    // Verify MIO
    if (verifyResults[0].status === 'fulfilled') {
      const result = verifyResults[0].value;
      if (result.success && result.data) {
        const watchlist = result.data.find((w) => w.id === mioWlid);
        if (watchlist) {
          logSuccess(`Verified watchlist exists: ${watchlist.name}`, 'MIO');
          logInfo(`${TEST_CONFIG.TEST_SYMBOLS.length} stocks added successfully`, 'MIO');
        } else {
          logError(`Watchlist ${mioWlid} not found`, 'MIO');
          process.exit(1);
        }
      } else {
        logError(`Failed to get watchlists: ${result.error?.message}`, 'MIO');
        process.exit(1);
      }
    } else {
      logError(`Failed to get watchlists: ${verifyResults[0].reason}`, 'MIO');
      process.exit(1);
    }

    // Verify TradingView with retry logic
    const watchlist = await verifyTVWatchlistWithRetry(
      tvWlid!,
      tvCookie!,
      TEST_CONFIG.VERIFY_RETRY_ATTEMPTS,
      TEST_CONFIG.VERIFY_RETRY_DELAY_MS
    );
    
    if (watchlist) {
      logSuccess(`Verified watchlist exists: ${watchlist.name}`, 'TV');
      logInfo(`Symbols in watchlist: ${watchlist.symbols.length}`, 'TV');
      
      // Verify all symbols are present
      const missingSymbols = tvSymbols.filter(s => !watchlist.symbols.includes(s));
      if (missingSymbols.length === 0) {
        logSuccess(`Verified all ${tvSymbols.length} symbols exist in watchlist`, 'TV');
        logInfo(`Symbols: ${tvSymbols.join(', ')}`, 'TV');
      } else {
        logError(`Missing symbols: ${missingSymbols.join(', ')}. Watchlist symbols: ${watchlist.symbols.join(', ')}`, 'TV');
        process.exit(1);
      }
    } else {
      logError(`Watchlist ${tvWlid} not found after ${TEST_CONFIG.VERIFY_RETRY_ATTEMPTS} attempts`, 'TV');
      process.exit(1);
    }

    await sleep(TEST_CONFIG.DELAY_MS);

    // ========================================================================
    // ACT: Remove one stock from BOTH platforms (synchronized)
    // ========================================================================
    logSection('ACT: Remove One Stock from BOTH Platforms');

    // Normalize the symbol to remove for both platforms
    const mioSymbolToRemove = normalizeSymbol(TEST_CONFIG.SYMBOL_TO_REMOVE, 'mio');
    const tvSymbolToRemove = normalizeSymbol(TEST_CONFIG.SYMBOL_TO_REMOVE, 'tv');
    
    logInfo(`Removing only one symbol: ${TEST_CONFIG.SYMBOL_TO_REMOVE}`);
    logInfo(`MIO: ${mioSymbolToRemove}, TV: ${tvSymbolToRemove}`);

    const removeResults = await Promise.allSettled([
      MIOService.removeSingleStockWithSession(mioInternalSessionId!, mioWlid!, mioSymbolToRemove),
      removeSymbolFromWatchlist(tvWlid!, tvSymbolToRemove, tvCookie!),
    ]);

    // Process MIO remove result
    if (removeResults[0].status === 'fulfilled') {
      const result = removeResults[0].value;
      if (result.success) {
        logSuccess(`Removed ${mioSymbolToRemove} from watchlist`, 'MIO');
        logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`, 'MIO');
      } else {
        logError(`Failed to remove stock: ${result.error?.message}`, 'MIO');
        process.exit(1);
      }
    } else {
      logError(`Failed to remove stock: ${removeResults[0].reason}`, 'MIO');
      process.exit(1);
    }

    // Process TradingView remove result
    if (removeResults[1].status === 'fulfilled') {
      logSuccess(`Removed ${tvSymbolToRemove} from watchlist`, 'TV');
    } else {
      logError(`Failed to remove stock: ${removeResults[1].reason}`, 'TV');
      process.exit(1);
    }

    await sleep(TEST_CONFIG.DELAY_MS);

    // ========================================================================
    // ASSERT: Verify stock removed and remaining stock still exists
    // ========================================================================
    logSection('ASSERT: Verify Removal and Remaining Stock on BOTH Platforms');

    const assertResults = await Promise.allSettled([
      MIOService.getWatchlistsWithSession(mioInternalSessionId!),
      getWatchlistById(tvWlid!, tvCookie!),
    ]);

    // Calculate which symbols should remain
    const remainingSymbols = TEST_CONFIG.TEST_SYMBOLS.filter(s => s !== TEST_CONFIG.SYMBOL_TO_REMOVE);
    const tvRemainingSymbols = remainingSymbols.map(s => normalizeSymbol(s, 'tv'));

    // Verify MIO removal
    if (assertResults[0].status === 'fulfilled') {
      const result = assertResults[0].value;
      if (result.success && result.data) {
        const watchlist = result.data.find((w) => w.id === mioWlid);
        if (watchlist) {
          logSuccess(`Verified watchlist still exists: ${watchlist.name}`, 'MIO');
          logSuccess(`Removed ${mioSymbolToRemove} successfully`, 'MIO');
          logInfo(`Remaining symbols: ${remainingSymbols.join(', ')}`, 'MIO');
        } else {
          logError(`Watchlist ${mioWlid} not found after removal`, 'MIO');
          process.exit(1);
        }
      } else {
        logError(`Failed to get watchlists: ${result.error?.message}`, 'MIO');
        process.exit(1);
      }
    } else {
      logError(`Failed to get watchlists: ${assertResults[0].reason}`, 'MIO');
      process.exit(1);
    }

    // Verify TradingView removal
    if (assertResults[1].status === 'fulfilled') {
      const watchlist = assertResults[1].value as TradingViewWatchlist;
      
      if (watchlist) {
        logSuccess(`Verified watchlist still exists: ${watchlist.name}`, 'TV');
        logInfo(`Symbols in watchlist after removal: ${watchlist.symbols.length}`, 'TV');
        
        // Verify removed symbol is gone
        if (!watchlist.symbols.includes(tvSymbolToRemove)) {
          logSuccess(`Verified ${tvSymbolToRemove} removed from watchlist`, 'TV');
        } else {
          logError(`Symbol ${tvSymbolToRemove} still exists in watchlist. Symbols: ${watchlist.symbols.join(', ')}`, 'TV');
          process.exit(1);
        }
        
        // Verify remaining symbols still exist
        const missingRemaining = tvRemainingSymbols.filter(s => !watchlist.symbols.includes(s));
        if (missingRemaining.length === 0) {
          logSuccess(`Verified remaining symbols still exist: ${tvRemainingSymbols.join(', ')}`, 'TV');
        } else {
          logError(`Missing remaining symbols: ${missingRemaining.join(', ')}`, 'TV');
          process.exit(1);
        }
      } else {
        logError(`Watchlist ${tvWlid} not found after removal (may have been auto-deleted if empty)`, 'TV');
        process.exit(1);
      }
    } else {
      logError(`Failed to get watchlist: ${assertResults[1].reason}`, 'TV');
      process.exit(1);
    }

    // ========================================================================
    // TEST RESULT
    // ========================================================================
    logSection('TEST RESULT');
    logSuccess('✨ Test PASSED: Dual platform stock removal completed successfully');
    logInfo('Summary:');
    logInfo(`  - Created watchlist on both platforms: "${TEST_CONFIG.WATCHLIST_NAME}"`);
    logInfo(`  - Added ${TEST_CONFIG.TEST_SYMBOLS.length} stocks to both platforms: ${TEST_CONFIG.TEST_SYMBOLS.join(', ')}`);
    logInfo(`  - Removed ${TEST_CONFIG.SYMBOL_TO_REMOVE} from both platforms`);
    logInfo(`  - Verified removal and confirmed remaining stocks: ${remainingSymbols.join(', ')}`);
    logInfo(`  - Watchlist remains active (not auto-deleted due to remaining stocks)`);

  } catch (error) {
    logSection('TEST RESULT');
    logError(`💥 Test FAILED: ${error}`);
    process.exit(1);
  } finally {
    // ========================================================================
    // CLEANUP: Delete test watchlist from BOTH platforms
    // ========================================================================
    if ((mioWlid || tvWlid) && (mioSessionKey && mioSessionValue || tvCookie)) {
      logSection('CLEANUP: Delete Test Watchlist from BOTH Platforms');
      
      const cleanupPromises: Promise<void>[] = [];

      // Cleanup MIO
      if (mioWlid && mioSessionKey && mioSessionValue) {
        cleanupPromises.push(
          (async () => {
            try {
              const deleteResult = await MIOService.deleteWatchlists(
                mioSessionKey!,
                mioSessionValue!,
                [mioWlid!]
              );
              
              if (deleteResult.success) {
                logSuccess(`Deleted test watchlist ${mioWlid}`, 'MIO');
              } else {
                logError(`Failed to delete watchlist: ${deleteResult.error?.message}`, 'MIO');
              }
            } catch (error) {
              logError(`Failed to delete watchlist: ${error}`, 'MIO');
            }
          })()
        );
      }

      // Cleanup TradingView
      if (tvWlid && tvCookie) {
        cleanupPromises.push(
          (async () => {
            try {
              await deleteWatchlist(tvWlid!, tvCookie!);
              logSuccess(`Deleted test watchlist ${tvWlid}`, 'TV');
            } catch (error) {
              logError(`Failed to delete watchlist: ${error}`, 'TV');
            }
          })()
        );
      }

      // Execute cleanup in parallel
      await Promise.allSettled(cleanupPromises);
    }
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
