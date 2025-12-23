#!/usr/bin/env tsx
/**
 * List Sessions Utility (Framework-based)
 * 
 * Lists all available sessions in KV store.
 * 
 * Usage:
 *   tsx scripts/migrated/utils/list-sessions.ts
 */

import { kv } from '@vercel/kv';
import { OutputManager } from '../../framework/index.js';

async function listSessions() {
  const output = new OutputManager({
    directory: './output',
    saveToFile: false,
    prettyPrint: true,
  });
  
  const logger = output.getLogger();
  
  try {
    logger.section('KV Sessions');
    logger.info('Scanning KV store...');
    
    // Scan for session keys
    const keys: string[] = [];
    let cursor: string | number = 0;
    
    do {
      const result: [string | number, string[]] = await kv.scan(cursor, { 
        match: 'session:*', 
        count: 100 
      });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0 && cursor !== '0');
    
    logger.success(`Found ${keys.length} session(s)`);
    logger.newline();
    
    if (keys.length === 0) {
      logger.warning('No sessions found in KV store');
      logger.newline();
      logger.info('You can either:');
      logger.info('1. Log in via the browser extension to save a session');
      logger.info('2. Or provide session credentials via environment variables:');
      logger.info('   MIO_SESSION_KEY=PHPSESSID');
      logger.info('   MIO_SESSION_VALUE=<your-session-value>');
      return;
    }
    
    // Display sessions (limit to first 10 for readability)
    const sessionsToShow = keys.slice(0, 10);
    
    for (const key of sessionsToShow) {
      logger.subsection(key);
      
      // Extract session ID from key (format: session:marketinout:<id>)
      const parts = key.split(':');
      if (parts.length >= 3) {
        const platform = parts[1];
        const sessionId = parts[2];
        
        logger.detail('Platform', platform);
        logger.detail('Session ID', sessionId);
        
        // Get session data
        const sessionData = await kv.hgetall(key);
        if (sessionData) {
          const sessionKeys = Object.keys(sessionData);
          logger.detail('Keys', sessionKeys.join(', '));
        }
        logger.newline();
      }
    }
    
    if (keys.length > 10) {
      logger.warning(`Showing 10 of ${keys.length} sessions`);
      logger.newline();
    }
    
    // Usage instructions
    logger.info('To use a session, run:');
    const firstKey = keys[0];
    const sessionId = firstKey.split(':')[2];
    logger.raw(`  pnpm run analyze-mio ${sessionId}`);
    logger.newline();
    
  } catch (error) {
    logger.error(`Failed to access KV store: ${error instanceof Error ? error.message : String(error)}`);
    logger.newline();
    logger.info('Make sure your .env file has the correct KV credentials.');
    process.exit(1);
  }
}

listSessions();
