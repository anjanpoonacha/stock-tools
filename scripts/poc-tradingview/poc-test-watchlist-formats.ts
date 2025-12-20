/**
 * POC: Test TradingView Watchlist API Formats
 * 
 * Purpose: Determine which Content-Type and body format TradingView expects
 * when adding symbols to watchlists.
 * 
 * Tests:
 * 1. JSON format with array: Content-Type: application/json, Body: ["NSE:RELIANCE"]
 * 2. Form-encoded format: Content-Type: application/x-www-form-urlencoded, Body: symbol=NSE%3ARELIANCE
 * 
 * Usage:
 * 1. Copy poc-config.example.ts to poc-config.ts
 * 2. Fill in your TradingView sessionId
 * 3. Run: npx tsx scripts/poc-tradingview/poc-test-watchlist-formats.ts
 */

import { config } from './poc-config';

// Test configuration
const TEST_SYMBOL = 'NSE:RELIANCE';

interface TestResult {
  format: string;
  statusCode: number;
  success: boolean;
  responseBody: string;
  error?: string;
}

/**
 * Test Format 1: JSON with array (original tradingview.ts format)
 */
async function testJsonArrayFormat(watchlistId: string, symbol: string, sessionId: string): Promise<TestResult> {
  const url = `https://www.tradingview.com/api/v1/symbols_list/custom/${watchlistId}/append/`;
  
  console.log('\n🧪 Testing Format 1: JSON Array');
  console.log('Content-Type: application/json');
  console.log('Body:', JSON.stringify([symbol]));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sessionid=${sessionId}`,
        'Origin': 'https://www.tradingview.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      body: JSON.stringify([symbol]),
    });
    
    const responseText = await response.text();
    
    return {
      format: 'JSON Array',
      statusCode: response.status,
      success: response.ok,
      responseBody: responseText,
    };
  } catch (error) {
    return {
      format: 'JSON Array',
      statusCode: 0,
      success: false,
      responseBody: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test Format 2: Form-encoded (unifiedWatchlistService.ts format)
 */
async function testFormEncodedFormat(watchlistId: string, symbol: string, sessionId: string): Promise<TestResult> {
  const url = `https://www.tradingview.com/api/v1/symbols_list/custom/${watchlistId}/append/`;
  const body = `symbol=${encodeURIComponent(symbol)}`;
  
  console.log('\n🧪 Testing Format 2: Form-Encoded');
  console.log('Content-Type: application/x-www-form-urlencoded');
  console.log('Body:', body);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `sessionid=${sessionId}`,
        'Origin': 'https://www.tradingview.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      body,
    });
    
    const responseText = await response.text();
    
    return {
      format: 'Form-Encoded',
      statusCode: response.status,
      success: response.ok,
      responseBody: responseText,
    };
  } catch (error) {
    return {
      format: 'Form-Encoded',
      statusCode: 0,
      success: false,
      responseBody: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch watchlists to get a valid watchlist ID for testing
 */
async function fetchWatchlists(sessionId: string): Promise<Array<{ id: string; name: string }>> {
  const url = 'https://www.tradingview.com/api/v1/symbols_list/all/';
  
  const response = await fetch(url, {
    headers: {
      'Cookie': `sessionid=${sessionId}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch watchlists: ${response.status}`);
  }
  
  const data = await response.json();
  return data.map((w: any) => ({ id: w.id, name: w.name }));
}

/**
 * Print test results in a formatted table
 */
function printResults(results: TestResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.format}`);
    console.log(`   Status: ${result.statusCode} ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log(`   Response: ${result.responseBody.substring(0, 200)}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 RECOMMENDATION');
  console.log('='.repeat(80));
  
  const successfulFormat = results.find(r => r.success);
  if (successfulFormat) {
    console.log(`✅ Use ${successfulFormat.format} format in production code`);
  } else {
    console.log('❌ Both formats failed. Check session validity and watchlist ID.');
  }
  
  console.log('\n');
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 TradingView Watchlist API Format Test');
  console.log('='.repeat(80));
  
  // Validate configuration
  if (!config.tradingViewSession?.sessionId) {
    console.error('❌ Error: TradingView sessionId not configured');
    console.error('Please set config.tradingViewSession.sessionId in poc-config.ts');
    process.exit(1);
  }
  
  const sessionId = config.tradingViewSession.sessionId;
  
  // Step 1: Fetch watchlists to get a valid ID
  console.log('\n📋 Fetching your watchlists...');
  try {
    const watchlists = await fetchWatchlists(sessionId);
    
    if (watchlists.length === 0) {
      console.error('❌ No watchlists found. Please create a watchlist on TradingView first.');
      process.exit(1);
    }
    
    console.log(`✅ Found ${watchlists.length} watchlists:`);
    watchlists.forEach((w, i) => {
      console.log(`   ${i + 1}. ${w.name} (ID: ${w.id})`);
    });
    
    // Use the first watchlist for testing
    const testWatchlistId = watchlists[0].id;
    const testWatchlistName = watchlists[0].name;
    
    console.log(`\n🎯 Using watchlist "${testWatchlistName}" (${testWatchlistId}) for testing`);
    console.log(`⚠️  Note: This will add ${TEST_SYMBOL} to this watchlist`);
    
    // Step 2: Run tests
    const results: TestResult[] = [];
    
    // Test 1: JSON Array format
    results.push(await testJsonArrayFormat(testWatchlistId, TEST_SYMBOL, sessionId));
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Form-Encoded format (only if first test failed)
    if (!results[0].success) {
      results.push(await testFormEncodedFormat(testWatchlistId, TEST_SYMBOL, sessionId));
    } else {
      console.log('\n✅ First format succeeded, skipping second test to avoid duplicates');
    }
    
    // Step 3: Print results
    printResults(results);
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the test
main();
