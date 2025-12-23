/**
 * Integration test demonstrating SessionProvider working with SessionResolver
 * Shows caching behavior and integration with existing KV storage
 */

import { SessionProvider } from './SessionProvider';

console.log('=== SessionProvider Integration Test ===\n');

const provider = new SessionProvider();

async function testIntegration() {
  try {
    // Test 1: Try to fetch MarketInOut session
    console.log('1. Fetching MarketInOut session from KV...');
    try {
      const mioSession = await provider.getSession('marketinout');
      console.log(`   ✓ Found session (ID: ${mioSession.internalId})`);
      
      // Extract MIO cookie
      const cookie = provider.extractMIOSession(mioSession);
      console.log(`   ✓ Extracted cookie: ${cookie.key} = ${cookie.value.substring(0, 10)}...`);
    } catch (error) {
      if (error instanceof Error) {
        console.log(`   ⚠ ${error.message}`);
      }
    }
    console.log('');

    // Test 2: Try to fetch TradingView session
    console.log('2. Fetching TradingView session from KV...');
    try {
      const tvSession = await provider.getSession('tradingview');
      console.log(`   ✓ Found session (ID: ${tvSession.internalId})`);
      
      // Extract TV session data
      const sessionData = provider.extractTVSession(tvSession);
      console.log(`   ✓ Extracted session ID: ${sessionData.sessionId.substring(0, 10)}...`);
      console.log(`   ✓ User ID: ${sessionData.userId}`);
    } catch (error) {
      if (error instanceof Error) {
        console.log(`   ⚠ ${error.message}`);
      }
    }
    console.log('');

    // Test 3: Demonstrate caching behavior
    console.log('3. Testing cache behavior...');
    const stats1 = provider.getStats();
    console.log(`   Cache before: ${stats1.cachedSessions} sessions, TTL: ${stats1.cacheTTL}ms`);
    
    // Fetch same session again (should use cache)
    console.log('   Fetching MarketInOut session again...');
    try {
      const startTime = Date.now();
      await provider.getSession('marketinout');
      const duration = Date.now() - startTime;
      console.log(`   ✓ Second fetch completed in ${duration}ms (likely from cache)`);
    } catch (error) {
      console.log('   ⚠ No MIO session available for cache test');
    }
    
    const stats2 = provider.getStats();
    console.log(`   Cache after: ${stats2.cachedSessions} sessions`);
    console.log('');

    // Test 4: Cache clearing
    console.log('4. Testing cache clearing...');
    provider.clearCache();
    const stats3 = provider.getStats();
    console.log(`   ✓ Cache cleared: ${stats3.cachedSessions} sessions remaining`);
    console.log('');

    // Test 5: User-specific session (if credentials available)
    console.log('5. Testing user-specific session retrieval...');
    const userEmail = process.env.USER_EMAIL;
    const userPassword = process.env.USER_PASSWORD;
    
    if (userEmail && userPassword) {
      try {
        const userSession = await provider.getSessionForUser('marketinout', {
          userEmail,
          userPassword
        });
        console.log(`   ✓ Found user session (ID: ${userSession.internalId})`);
        console.log(`   ✓ Session belongs to: ${userSession.sessionData.userEmail}`);
      } catch (error) {
        if (error instanceof Error) {
          console.log(`   ⚠ ${error.message}`);
        }
      }
    } else {
      console.log('   ⚠ Skipping user-specific test (no credentials in env)');
    }

  } catch (error) {
    console.error('Error during integration test:', error);
  }
}

testIntegration().then(() => {
  console.log('\n=== Integration Test Complete ===');
});
