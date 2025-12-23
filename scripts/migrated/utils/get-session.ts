#!/usr/bin/env tsx
/**
 * Get Session Utility (Framework-based)
 * 
 * Fetches a session from KV and outputs export commands for shell usage.
 * 
 * Usage:
 *   tsx scripts/migrated/utils/get-session.ts <session-id>
 * 
 * Example:
 *   tsx scripts/migrated/utils/get-session.ts user@example.com
 */

import { SessionProvider, OutputManager, ArgParser } from '../../framework/index.js';

async function main() {
  const parser = new ArgParser();
  const output = new OutputManager({
    directory: './output',
    saveToFile: false,
    prettyPrint: false,
  });
  
  const logger = output.getLogger();
  
  // Parse CLI args (optional - if not provided, gets latest)
  const sessionId = parser.get(0);
  
  try {
    logger.section('Get Session');
    if (sessionId) {
      logger.detail('Session ID', sessionId);
    } else {
      logger.info('Fetching latest session');
    }
    
    // Fetch session
    const provider = new SessionProvider();
    let sessionInfo;
    
    if (sessionId) {
      // Fetch specific session by email
      sessionInfo = await provider.getSessionForUser('marketinout', {
        userEmail: sessionId,
        userPassword: '', // Not needed for fetching
      });
    } else {
      // Fetch latest session
      sessionInfo = await provider.getSession('marketinout');
    }
    
    if (!sessionInfo) {
      logger.error('Session not found');
      process.exit(1);
    }
    
    // Extract session cookie using framework method
    const sessionCookie = provider.extractMIOSession(sessionInfo);
    
    logger.success('Session found');
    logger.detail('Session Key', sessionCookie.key);
    
    // Output export commands (without logger prefix)
    console.log(`export MIO_SESSION_KEY="${sessionCookie.key}"`);
    console.log(`export MIO_SESSION_VALUE="${sessionCookie.value}"`)
  } catch (error) {
    logger.error(`Failed to get session: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
