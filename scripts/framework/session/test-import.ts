// Simple import test
import { SessionProvider, KVAdapter } from './index';
import type { SessionInfo, SessionCache } from './index';

// Test that classes can be instantiated
const provider = new SessionProvider();
const adapter = new KVAdapter();

console.log('✓ SessionProvider instantiated');
console.log('✓ KVAdapter instantiated');
console.log('✓ All imports work correctly');
