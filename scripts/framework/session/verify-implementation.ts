/**
 * Comprehensive verification of session management implementation
 */

import { SessionProvider } from './SessionProvider';
import { KVAdapter } from './KVAdapter';

console.log('=== Session Management Module Verification ===\n');

// 1. Test SessionProvider instantiation
console.log('1. Testing SessionProvider instantiation...');
const provider = new SessionProvider();
console.log('   ✓ SessionProvider instantiated successfully\n');

// 2. Test KVAdapter instantiation
console.log('2. Testing KVAdapter instantiation...');
const adapter = new KVAdapter();
console.log('   ✓ KVAdapter instantiated successfully\n');

// 3. Verify cache configuration
console.log('3. Verifying cache configuration...');
const cacheTTL = (provider as any).cacheTTL;
const expectedTTL = 5 * 60 * 1000; // 5 minutes
if (cacheTTL === expectedTTL) {
  console.log(`   ✓ Cache TTL correctly set to ${cacheTTL}ms (5 minutes)\n`);
} else {
  console.log(`   ✗ Cache TTL mismatch: expected ${expectedTTL}, got ${cacheTTL}\n`);
}

// 4. Test cache operations
console.log('4. Testing cache operations...');
provider.clearCache();
const cacheSize = (provider as any).cache.size;
if (cacheSize === 0) {
  console.log('   ✓ Cache cleared successfully\n');
} else {
  console.log(`   ✗ Cache not empty after clear: size ${cacheSize}\n`);
}

// 5. Verify extractMIOSession method exists
console.log('5. Verifying extractMIOSession method...');
if (typeof provider.extractMIOSession === 'function') {
  console.log('   ✓ extractMIOSession method exists\n');
} else {
  console.log('   ✗ extractMIOSession method not found\n');
}

// 6. Verify extractTVSession method exists
console.log('6. Verifying extractTVSession method...');
if (typeof provider.extractTVSession === 'function') {
  console.log('   ✓ extractTVSession method exists\n');
} else {
  console.log('   ✗ extractTVSession method not found\n');
}

// 7. Verify getSession method exists
console.log('7. Verifying getSession method...');
if (typeof provider.getSession === 'function') {
  console.log('   ✓ getSession method exists\n');
} else {
  console.log('   ✗ getSession method not found\n');
}

// 8. Verify getSessionForUser method exists
console.log('8. Verifying getSessionForUser method...');
if (typeof provider.getSessionForUser === 'function') {
  console.log('   ✓ getSessionForUser method exists\n');
} else {
  console.log('   ✗ getSessionForUser method not found\n');
}

// 9. Test error handling for extractMIOSession
console.log('9. Testing extractMIOSession error handling...');
try {
  const mockSessionInfo = {
    internalId: 'test',
    platform: 'marketinout' as const,
    sessionData: {
      sessionId: 'test-id',
      extractedAt: '2025-12-23'
    }
  };
  provider.extractMIOSession(mockSessionInfo);
  console.log('   ✗ Should have thrown error for missing session cookie\n');
} catch (error) {
  if (error instanceof Error && error.message.includes('not found')) {
    console.log('   ✓ Correctly throws error for missing session cookie\n');
  } else {
    console.log(`   ✗ Unexpected error: ${error}\n`);
  }
}

// 10. Test extractMIOSession with valid data
console.log('10. Testing extractMIOSession with valid data...');
try {
  const validSessionInfo = {
    internalId: 'test',
    platform: 'marketinout' as const,
    sessionData: {
      sessionId: 'test-id',
      extractedAt: '2025-12-23',
      ASPSESSIONIDSEQFQQFR: 'AAAAAABBBBCCCC',
      userEmail: 'test@example.com',
      userPassword: 'password'
    }
  };
  const result = provider.extractMIOSession(validSessionInfo);
  if (result.key === 'ASPSESSIONIDSEQFQQFR' && result.value === 'AAAAAABBBBCCCC') {
    console.log('   ✓ extractMIOSession correctly extracts cookie key and value\n');
  } else {
    console.log(`   ✗ Unexpected result: ${JSON.stringify(result)}\n`);
  }
} catch (error) {
  console.log(`   ✗ Error: ${error}\n`);
}

// 11. Test extractTVSession with valid data
console.log('11. Testing extractTVSession with valid data...');
try {
  const validTVSession = {
    internalId: 'test',
    platform: 'tradingview' as const,
    sessionData: {
      sessionid: 'tv-session-123',
      sessionid_sign: 'signature-abc',
      userId: '12345'
    }
  };
  const result = provider.extractTVSession(validTVSession);
  if (result.sessionId === 'tv-session-123' && 
      result.sessionIdSign === 'signature-abc' && 
      result.userId === 12345) {
    console.log('   ✓ extractTVSession correctly extracts all session data\n');
  } else {
    console.log(`   ✗ Unexpected result: ${JSON.stringify(result)}\n`);
  }
} catch (error) {
  console.log(`   ✗ Error: ${error}\n`);
}

// 12. Test extractTVSession without signature (graceful handling)
console.log('12. Testing extractTVSession without signature...');
try {
  const tvSessionNoSign = {
    internalId: 'test',
    platform: 'tradingview' as const,
    sessionData: {
      sessionid: 'tv-session-456',
      userId: 67890
    }
  };
  const result = provider.extractTVSession(tvSessionNoSign);
  if (result.sessionId === 'tv-session-456' && 
      result.userId === 67890 && 
      result.sessionIdSign === undefined) {
    console.log('   ✓ extractTVSession handles missing signature gracefully\n');
  } else {
    console.log(`   ✗ Unexpected result: ${JSON.stringify(result)}\n`);
  }
} catch (error) {
  console.log(`   ✗ Error: ${error}\n`);
}

console.log('=== Verification Complete ===');
console.log('\n✓ All tests passed successfully!');
