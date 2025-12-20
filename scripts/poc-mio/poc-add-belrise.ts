#!/usr/bin/env tsx
/**
 * Add BELRISE.NS to watchlist 74577 and keep it there
 */

import { SessionResolver } from '../../src/lib/SessionResolver.js';
import { MIOHttpClient, RequestValidator } from '../../src/lib/mio/core/index.js';
import type { SessionKeyValue } from '../../src/lib/mio/types.js';
import { normalizeSymbol } from '../../src/lib/utils/exchangeMapper.js';

const WLID = '74577';
const SYMBOL = 'BELRISE';

async function getWatchlistContents(session: SessionKeyValue, wlid: string): Promise<string[]> {
  const url = `https://www.marketinout.com/wl/watch_list.php?wlid=${wlid}`;
  
  const response = await MIOHttpClient.request<string[]>(
    url,
    { method: 'GET', sessionKeyValue: session },
    (html) => {
      const symbols: string[] = [];
      const symbolMatches = html.match(/[A-Z0-9]+\.[A-Z]+/g);
      
      if (symbolMatches) {
        const uniqueSymbols = [...new Set(symbolMatches)];
        symbols.push(...uniqueSymbols.filter(s => RequestValidator.validateSymbol(s).valid));
      }
      
      return symbols;
    }
  );
  
  return response.data || [];
}

async function main() {
  console.log('📊 Adding BELRISE.NS to watchlist 74577...\n');
  
  // Get session
  const sessionInfo = await SessionResolver.getLatestSession('marketinout');
  if (!sessionInfo) {
    console.error('❌ No session found');
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
    console.error('❌ No ASPSESSION found');
    process.exit(1);
  }
  
  const session: SessionKeyValue = { key: aspSessionKey, value: aspSessionValue };
  console.log(`✅ Loaded session: ${aspSessionKey}\n`);
  
  // Check current contents
  console.log('🔍 Checking current watchlist contents...');
  const beforeSymbols = await getWatchlistContents(session, WLID);
  console.log(`   Found ${beforeSymbols.length} stocks: ${beforeSymbols.join(', ')}`);
  
  const normalizedSymbol = normalizeSymbol(SYMBOL, 'mio');
  console.log(`\n📝 Normalized symbol: ${SYMBOL} → ${normalizedSymbol}`);
  
  if (beforeSymbols.includes(normalizedSymbol)) {
    console.log(`✅ ${normalizedSymbol} already exists in watchlist!`);
    process.exit(0);
  }
  
  // Add stock
  console.log(`\n➕ Adding ${normalizedSymbol} to watchlist ${WLID}...`);
  const addUrl = `https://www.marketinout.com/wl/wl_add_all.php?action=add&wlid=${WLID}&wl_name=&symbol=${normalizedSymbol}`;
  const addResult = await MIOHttpClient.request(
    addUrl,
    { method: 'GET', sessionKeyValue: session },
    (html) => {
      const hasSymbol = html.includes(`symbol=${normalizedSymbol}`);
      return {
        success: hasSymbol,
        symbol: hasSymbol ? normalizedSymbol : '',
      };
    }
  );
  
  if (!addResult.success) {
    console.error(`❌ Failed to add stock`);
    process.exit(1);
  }
  
  console.log(`✅ API returned success\n`);
  
  // Wait for operation
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Verify
  console.log('🔍 Verifying stock was added...');
  const afterSymbols = await getWatchlistContents(session, WLID);
  console.log(`   Found ${afterSymbols.length} stocks: ${afterSymbols.join(', ')}`);
  
  if (afterSymbols.includes(normalizedSymbol)) {
    console.log(`\n✅ SUCCESS! ${normalizedSymbol} is now in watchlist ${WLID}`);
    console.log(`\n🌐 Verify at: https://www.marketinout.com/wl/watch_list.php?wlid=${WLID}`);
  } else {
    console.error(`\n❌ FAILED! ${normalizedSymbol} not found in watchlist`);
    process.exit(1);
  }
}

main();
