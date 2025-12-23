/**
 * Demonstration of SessionProvider caching mechanism
 * Shows how caching reduces KV calls and improves performance
 */

import { SessionProvider } from './SessionProvider';

console.log('=== SessionProvider Caching Demonstration ===\n');

const provider = new SessionProvider();

async function demonstrateCaching() {
  console.log('SCENARIO: Multiple POC scripts accessing MIO session\n');
  
  // Simulate 3 different POC scripts running in sequence
  console.log('POC Script 1: Fetching MIO session...');
  const start1 = Date.now();
  try {
    const session1 = await provider.getSession('marketinout');
    const duration1 = Date.now() - start1;
    console.log(`  ✓ Retrieved session (${duration1}ms) - KV CALL MADE`);
    console.log(`  Session ID: ${session1.internalId}`);
  } catch (error) {
    console.log(`  ⚠ No session available`);
  }
  
  const stats1 = provider.getStats();
  console.log(`  Cache status: ${stats1.cachedSessions} sessions cached\n`);
  
  // Simulate 100ms delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('POC Script 2: Fetching MIO session again...');
  const start2 = Date.now();
  try {
    const session2 = await provider.getSession('marketinout');
    const duration2 = Date.now() - start2;
    console.log(`  ✓ Retrieved session (${duration2}ms) - FROM CACHE`);
    console.log(`  Session ID: ${session2.internalId}`);
  } catch (error) {
    console.log(`  ⚠ No session available`);
  }
  
  const stats2 = provider.getStats();
  console.log(`  Cache status: ${stats2.cachedSessions} sessions cached\n`);
  
  // Simulate another 100ms delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('POC Script 3: Fetching MIO session once more...');
  const start3 = Date.now();
  try {
    const session3 = await provider.getSession('marketinout');
    const duration3 = Date.now() - start3;
    console.log(`  ✓ Retrieved session (${duration3}ms) - FROM CACHE`);
    console.log(`  Session ID: ${session3.internalId}`);
  } catch (error) {
    console.log(`  ⚠ No session available`);
  }
  
  const stats3 = provider.getStats();
  console.log(`  Cache status: ${stats3.cachedSessions} sessions cached\n`);
  
  console.log('BENEFITS:');
  console.log('  • Only 1 KV call made despite 3 session requests');
  console.log('  • Subsequent calls are nearly instant (< 5ms)');
  console.log(`  • Cache TTL: ${stats3.cacheTTL / 1000 / 60} minutes`);
  console.log('  • Automatic cache invalidation after TTL expires\n');
  
  console.log('SCENARIO: User-specific sessions with different users\n');
  
  const user1 = { userEmail: 'user1@example.com', userPassword: 'pass1' };
  const user2 = { userEmail: 'user2@example.com', userPassword: 'pass2' };
  
  console.log(`User 1 (${user1.userEmail}): Fetching session...`);
  try {
    await provider.getSessionForUser('marketinout', user1);
    console.log('  ✓ Session retrieved and cached');
  } catch (error) {
    console.log('  ⚠ No session available');
  }
  
  console.log(`User 2 (${user2.userEmail}): Fetching session...`);
  try {
    await provider.getSessionForUser('marketinout', user2);
    console.log('  ✓ Session retrieved and cached');
  } catch (error) {
    console.log('  ⚠ No session available');
  }
  
  const statsMultiUser = provider.getStats();
  console.log(`\nCache now contains: ${statsMultiUser.cachedSessions} sessions`);
  console.log('  • Each user gets their own cached session');
  console.log('  • Cache key includes user email for isolation');
  console.log('  • Platform-level and user-level caches coexist\n');
  
  console.log('CACHE MANAGEMENT:\n');
  console.log('Clearing cache...');
  provider.clearCache();
  const statsFinal = provider.getStats();
  console.log(`Cache after clear: ${statsFinal.cachedSessions} sessions`);
  console.log('  • Manual cache clearing for testing or debugging');
  console.log('  • Automatic TTL expiration handles normal operations\n');
}

demonstrateCaching().then(() => {
  console.log('=== Demonstration Complete ===');
});
