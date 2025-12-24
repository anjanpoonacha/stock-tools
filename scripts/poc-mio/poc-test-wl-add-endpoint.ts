#!/usr/bin/env tsx
/**
 * POC: Test Alternative MIO Endpoint for Fetching Watchlist Symbols
 * 
 * Compares two endpoints for extracting watchlist symbols:
 * 1. Current: /wl/watch_list.php?wlid={wlid}
 * 2. Alternative: /wl/wl_add.php?wlid={wlid}&overwrite=1&name=
 * 
 * Tests with real watchlist data to determine which endpoint provides:
 * - Cleaner HTML parsing
 * - More reliable symbol extraction
 * - Better performance
 * 
 * Uses regex pattern approach proven in poc-add-belrise.ts:
 *   const symbolMatches = html.match(/[A-Z0-9]+\.[A-Z]+/g);
 */

import { SessionResolver } from '../../src/lib/SessionResolver.js';
import { MIOHttpClient, RequestValidator } from '../../src/lib/mio/core/index.js';
import type { SessionKeyValue } from '../../src/lib/mio/types.js';

// ============================================================================
// Configuration
// ============================================================================

const TEST_WLID = '74577'; // Default test watchlist
const ENDPOINTS = {
  current: (wlid: string) => `https://www.marketinout.com/wl/watch_list.php?wlid=${wlid}`,
  alternative: (wlid: string) => `https://www.marketinout.com/wl/wl_add.php?wlid=${wlid}&overwrite=1&name=`,
} as const;

// ============================================================================
// Symbol Extraction
// ============================================================================

/**
 * Extract symbols from HTML using regex pattern matching
 * 
 * Pattern: [A-Z0-9]+\.[A-Z]+
 * - Matches: TCS.NS, INFY.BO, RELIANCE.NS
 * - Validates: Uses RequestValidator for additional validation
 */
async function extractSymbols(html: string): Promise<string[]> {
  const symbols: string[] = [];
  const symbolMatches = html.match(/[A-Z0-9]+\.[A-Z]+/g);

  if (symbolMatches) {
    const uniqueSymbols = [...new Set(symbolMatches)];
    const validSymbols = uniqueSymbols.filter(
      (s) => RequestValidator.validateSymbol(s).valid
    );
    symbols.push(...validSymbols);
  }

  return symbols;
}

/**
 * Fetch symbols from an endpoint
 */
async function fetchFromEndpoint(
  session: SessionKeyValue,
  endpointUrl: string,
  endpointName: string
): Promise<{
  symbols: string[];
  htmlLength: number;
  rawMatches: number;
  elapsed: number;
}> {
  const startTime = Date.now();

  const response = await MIOHttpClient.request<string>(
    endpointUrl,
    { method: 'GET', sessionKeyValue: session },
    (html) => html
  );

  const elapsed = Date.now() - startTime;

  if (!response.success) {
    throw new Error(
      `Failed to fetch from ${endpointName}: ${response.error?.message}`
    );
  }

  const html = response.data || '';
  const rawMatches = (html.match(/[A-Z0-9]+\.[A-Z]+/g) || []).length;
  const symbols = await extractSymbols(html);

  return {
    symbols,
    htmlLength: html.length,
    rawMatches,
    elapsed,
  };
}

// ============================================================================
// Comparison Logic
// ============================================================================

/**
 * Compare both endpoints and report findings
 */
async function compareEndpoints(
  session: SessionKeyValue,
  wlid: string
): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Comparing Watchlist Endpoints for WLID: ${wlid}`);
  console.log(`${'='.repeat(80)}\n`);

  // Validate watchlist ID
  const validation = RequestValidator.validateWatchlistId(wlid);
  if (!validation.valid) {
    console.error(`❌ Invalid watchlist ID: ${validation.error}`);
    process.exit(1);
  }

  // Fetch from current endpoint
  console.log('🔄 Testing CURRENT endpoint: watch_list.php...');
  const currentResult = await fetchFromEndpoint(
    session,
    ENDPOINTS.current(wlid),
    'current'
  );

  console.log(`   ✅ Fetched in ${currentResult.elapsed}ms`);
  console.log(`   📄 HTML length: ${currentResult.htmlLength.toLocaleString()} chars`);
  console.log(`   🔍 Raw regex matches: ${currentResult.rawMatches}`);
  console.log(`   ✓  Valid symbols: ${currentResult.symbols.length}`);

  // Fetch from alternative endpoint
  console.log('\n🔄 Testing ALTERNATIVE endpoint: wl_add.php...');
  const altResult = await fetchFromEndpoint(
    session,
    ENDPOINTS.alternative(wlid),
    'alternative'
  );

  console.log(`   ✅ Fetched in ${altResult.elapsed}ms`);
  console.log(`   📄 HTML length: ${altResult.htmlLength.toLocaleString()} chars`);
  console.log(`   🔍 Raw regex matches: ${altResult.rawMatches}`);
  console.log(`   ✓  Valid symbols: ${altResult.symbols.length}`);

  // Compare results
  console.log(`\n${'='.repeat(80)}`);
  console.log('📈 COMPARISON RESULTS');
  console.log(`${'='.repeat(80)}\n`);

  // Performance comparison
  console.log('⚡ Performance:');
  const fasterEndpoint = currentResult.elapsed < altResult.elapsed ? 'current' : 'alternative';
  const timeDiff = Math.abs(currentResult.elapsed - altResult.elapsed);
  console.log(`   ${fasterEndpoint === 'current' ? '🏆' : '  '} Current: ${currentResult.elapsed}ms`);
  console.log(`   ${fasterEndpoint === 'alternative' ? '🏆' : '  '} Alternative: ${altResult.elapsed}ms`);
  console.log(`   Δ Difference: ${timeDiff}ms\n`);

  // HTML size comparison
  console.log('📦 HTML Size:');
  const smallerHtml = currentResult.htmlLength < altResult.htmlLength ? 'current' : 'alternative';
  const sizeDiff = Math.abs(currentResult.htmlLength - altResult.htmlLength);
  console.log(`   ${smallerHtml === 'current' ? '🏆' : '  '} Current: ${currentResult.htmlLength.toLocaleString()} chars`);
  console.log(`   ${smallerHtml === 'alternative' ? '🏆' : '  '} Alternative: ${altResult.htmlLength.toLocaleString()} chars`);
  console.log(`   Δ Difference: ${sizeDiff.toLocaleString()} chars\n`);

  // Symbol count comparison
  console.log('🔢 Symbol Extraction:');
  const moreSymbols = currentResult.symbols.length > altResult.symbols.length ? 'current' : 
                      altResult.symbols.length > currentResult.symbols.length ? 'alternative' : 'same';
  console.log(`   ${moreSymbols === 'current' ? '🏆' : '  '} Current: ${currentResult.symbols.length} symbols`);
  console.log(`   ${moreSymbols === 'alternative' ? '🏆' : '  '} Alternative: ${altResult.symbols.length} symbols`);
  
  if (currentResult.symbols.length === altResult.symbols.length) {
    console.log(`   ✓  Both endpoints returned the same count`);
  } else {
    console.log(`   Δ Difference: ${Math.abs(currentResult.symbols.length - altResult.symbols.length)} symbols`);
  }

  // Symbol difference analysis
  const currentSet = new Set(currentResult.symbols);
  const altSet = new Set(altResult.symbols);

  const onlyInCurrent = currentResult.symbols.filter((s) => !altSet.has(s));
  const onlyInAlt = altResult.symbols.filter((s) => !currentSet.has(s));
  const common = currentResult.symbols.filter((s) => altSet.has(s));

  console.log(`\n📊 Symbol Set Analysis:`);
  console.log(`   ∩ Common symbols: ${common.length}`);
  if (onlyInCurrent.length > 0) {
    console.log(`   ⊕ Only in current: ${onlyInCurrent.length}`);
    console.log(`      ${onlyInCurrent.slice(0, 5).join(', ')}${onlyInCurrent.length > 5 ? '...' : ''}`);
  }
  if (onlyInAlt.length > 0) {
    console.log(`   ⊕ Only in alternative: ${onlyInAlt.length}`);
    console.log(`      ${onlyInAlt.slice(0, 5).join(', ')}${onlyInAlt.length > 5 ? '...' : ''}`);
  }

  // Final recommendation
  console.log(`\n${'='.repeat(80)}`);
  console.log('💡 RECOMMENDATION');
  console.log(`${'='.repeat(80)}\n`);

  // Score each endpoint (lower is better)
  let currentScore = 0;
  let altScore = 0;

  // Performance matters (weight: 1)
  if (fasterEndpoint === 'current') currentScore += 0;
  else altScore += 0;

  // HTML size matters - smaller is cleaner (weight: 2)
  if (smallerHtml === 'current') currentScore += 0;
  else altScore += 0;

  // Symbol completeness matters most (weight: 3)
  if (moreSymbols === 'current') currentScore -= 3;
  else if (moreSymbols === 'alternative') altScore -= 3;

  // Raw match noise (fewer is better - cleaner HTML)
  const currentNoise = currentResult.rawMatches - currentResult.symbols.length;
  const altNoise = altResult.rawMatches - altResult.symbols.length;
  console.log(`📉 Symbol Extraction Noise:`);
  console.log(`   Current: ${currentNoise} invalid matches filtered out`);
  console.log(`   Alternative: ${altNoise} invalid matches filtered out`);

  if (currentNoise < altNoise) currentScore -= 1;
  else if (altNoise < currentNoise) altScore -= 1;

  // Determine winner
  console.log(`\n🏆 Winner: `);
  if (currentResult.symbols.length === altResult.symbols.length && 
      onlyInCurrent.length === 0 && onlyInAlt.length === 0) {
    console.log(`   ✅ BOTH ENDPOINTS ARE EQUIVALENT`);
    console.log(`   → Use CURRENT endpoint (watch_list.php) - already in production`);
    console.log(`   → No migration needed`);
  } else if (currentScore < altScore) {
    console.log(`   ✅ CURRENT endpoint (watch_list.php) is BETTER`);
    console.log(`   → Keep using current implementation`);
  } else if (altScore < currentScore) {
    console.log(`   ✅ ALTERNATIVE endpoint (wl_add.php) is BETTER`);
    console.log(`   → Consider migrating to wl_add.php`);
    console.log(`   → Benefits: ${altResult.symbols.length > currentResult.symbols.length ? 'More complete symbol list' : 'Cleaner HTML parsing'}`);
  } else {
    console.log(`   ⚖️  Both endpoints perform similarly`);
    console.log(`   → Stick with CURRENT endpoint (watch_list.php)`);
    console.log(`   → No clear advantage to switching`);
  }

  // Print sample symbols
  console.log(`\n📋 Sample Symbols (first 10):`);
  console.log(`   Current: ${currentResult.symbols.slice(0, 10).join(', ')}`);
  console.log(`   Alternative: ${altResult.symbols.slice(0, 10).join(', ')}`);

  console.log(`\n${'='.repeat(80)}\n`);
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log('🚀 Starting Watchlist Endpoint Comparison POC...\n');

  // Get command line argument for WLID
  const wlid = process.argv[2] || TEST_WLID;

  // Get session
  console.log('🔐 Loading MIO session...');
  const sessionInfo = await SessionResolver.getLatestSession('marketinout');
  if (!sessionInfo) {
    console.error('❌ No MIO session found');
    console.error('   → Extract session using the browser extension');
    process.exit(1);
  }

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
    console.error('❌ No ASPSESSION cookie found in session');
    process.exit(1);
  }

  const session: SessionKeyValue = { key: aspSessionKey, value: aspSessionValue };
  console.log(`   ✅ Loaded session: ${aspSessionKey.substring(0, 20)}...\n`);

  // Run comparison
  try {
    await compareEndpoints(session, wlid);
    console.log('✅ Comparison complete!\n');
  } catch (error) {
    console.error('\n❌ Error during comparison:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// ============================================================================
// Execute
// ============================================================================

main();
