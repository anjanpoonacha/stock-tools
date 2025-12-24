import { getWatchlists, getWatchlistById, createWatchlist as createTVWatchlist, appendSymbolToWatchlist, removeSymbolFromWatchlist } from '../../../src/lib/tradingview.js';
import { SessionResolver } from '../../../src/lib/SessionResolver.js';
import { readFileSync } from 'fs';

async function debugTVRemove() {
  console.log('🔍 Debug: TradingView Remove Operation\n');
  
  // Load credentials from credentials.json
  const credentials = JSON.parse(readFileSync('credentials.json', 'utf-8'));
  const userEmail = credentials.tradingview.username;
  const userPassword = credentials.tradingview.password;
  
  if (!userEmail || !userPassword) {
    console.error('❌ Missing credentials in credentials.json');
    process.exit(1);
  }
  
  const tvSession = await SessionResolver.getLatestSessionForUser('tradingview', {
    userEmail,
    userPassword
  });
  
  if (!tvSession) {
    console.error('❌ No TradingView session found');
    process.exit(1);
  }
  
  const sessionId = tvSession.sessionData.sessionId;
  const sessionIdSign = tvSession.sessionData.sessionid_sign;
  const cookie = sessionIdSign 
    ? `sessionid=${sessionId}; sessionid_sign=${sessionIdSign}`
    : `sessionid=${sessionId}`;
  
  console.log('✅ Got TV session\n');
  
  // Create test watchlist
  const testName = `DEBUG_REMOVE_${Date.now()}`;
  console.log(`📝 Creating watchlist: ${testName}`);
  const watchlist = await createTVWatchlist(testName, cookie);
  console.log(`✅ Created watchlist ID: ${watchlist.id}\n`);
  
  // Add 2 symbols
  console.log('➕ Adding 2 symbols...');
  await appendSymbolToWatchlist(watchlist.id, 'NSE:RELIANCE', cookie);
  console.log('  ✅ Added NSE:RELIANCE');
  await appendSymbolToWatchlist(watchlist.id, 'NSE:TCS', cookie);
  console.log('  ✅ Added NSE:TCS\n');
  
  // Verify both exist  
  await new Promise(resolve => setTimeout(resolve, 2000));
  let current = await getWatchlistById(watchlist.id, cookie);
  console.log(`📊 Current symbols: ${current.symbols.join(', ')}`);
  console.log(`📊 Symbol count: ${current.symbols.length}\n`);
  
  // Remove one symbol
  console.log('🗑️  Removing NSE:RELIANCE...');
  await removeSymbolFromWatchlist(watchlist.id, 'NSE:RELIANCE', cookie);
  console.log('✅ Remove API call completed\n');
  
  // Check immediately
  console.log('🔍 Checking immediately after remove:');
  try {
    current = await getWatchlistById(watchlist.id, cookie);
    console.log(`✅ Watchlist still exists`);
    console.log(`📊 Symbols: ${current.symbols.join(', ')}`);
    console.log(`📊 Symbol count: ${current.symbols.length}`);
  } catch (error) {
    console.log(`❌ Watchlist NOT FOUND - Auto-deleted by TradingView!`);
    console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

debugTVRemove().catch(console.error);
