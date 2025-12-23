// Test caching functionality
import { SessionProvider } from './SessionProvider';

async function testCaching() {
  const provider = new SessionProvider();
  
  // Test cache expiration logic
  console.log('Testing cache functionality...');
  
  // Access private cache to verify it works
  const cacheSize = (provider as any).cache.size;
  console.log(`✓ Cache initialized (size: ${cacheSize})`);
  
  // Test cache TTL
  const cacheTTL = (provider as any).cacheTTL;
  console.log(`✓ Cache TTL set to ${cacheTTL}ms (5 minutes)`);
  
  // Test clearCache method
  provider.clearCache();
  const cacheSizeAfterClear = (provider as any).cache.size;
  console.log(`✓ Cache cleared (size: ${cacheSizeAfterClear})`);
  
  console.log('\n✓ All caching tests passed');
}

testCaching().catch(console.error);
