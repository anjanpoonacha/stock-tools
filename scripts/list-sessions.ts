// scripts/list-sessions.ts
// List available sessions in KV store

import { kv } from '@vercel/kv';

async function listSessions() {
  try {
    console.log('Scanning KV store for sessions...\n');

    // Try to scan for session keys
    const keys: string[] = [];
    let cursor: string | number = 0;

    do {
      const result: [string | number, string[]] = await kv.scan(cursor, { match: 'session:*', count: 100 });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0 && cursor !== '0');

    console.log(`Found ${keys.length} session(s):\n`);

    for (const key of keys.slice(0, 10)) {
      console.log(`- ${key}`);

      // Extract session ID from key (format: session:marketinout:<id>)
      const parts = key.split(':');
      if (parts.length >= 3) {
        const platform = parts[1];
        const sessionId = parts[2];
        console.log(`  Platform: ${platform}`);
        console.log(`  Session ID: ${sessionId}`);

        // Get session data
        const sessionData = await kv.hgetall(key);
        if (sessionData) {
          console.log(`  Keys: ${Object.keys(sessionData).join(', ')}`);
        }
        console.log('');
      }
    }

    if (keys.length === 0) {
      console.log('No sessions found in KV store.');
      console.log('\nYou can either:');
      console.log('1. Log in via the browser extension to save a session');
      console.log('2. Or provide session credentials via environment variables:');
      console.log('   MIO_SESSION_KEY=PHPSESSID');
      console.log('   MIO_SESSION_VALUE=<your-session-value>');
    } else {
      console.log(`\nTo use a session, run:`);
      const firstKey = keys[0];
      const sessionId = firstKey.split(':')[2];
      console.log(`  pnpm run analyze-mio ${sessionId}`);
    }

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error accessing KV store:', err.message);
    console.error('\nMake sure your .env file has the correct KV credentials.');
  }
}

listSessions();
