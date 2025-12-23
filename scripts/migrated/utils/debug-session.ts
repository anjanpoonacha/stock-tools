#!/usr/bin/env tsx
/**
 * Debug Session Utility (Framework-based)
 * 
 * Debugs session data structure for TradingView sessions.
 * 
 * Usage:
 *   tsx scripts/migrated/utils/debug-session.ts
 */

import { SessionProvider, OutputManager } from '../../framework/index.js';

async function main() {
  const output = new OutputManager({
    directory: './output',
    saveToFile: false,
    prettyPrint: true,
  });
  
  const logger = output.getLogger();
  
  try {
    logger.section('Debug Session');
    
    // Fetch latest TradingView session
    const provider = new SessionProvider();
    const sessionInfo = await provider.getSession('tradingview');
    
    if (!sessionInfo) {
      logger.error('No session found');
      process.exit(1);
    }
    
    logger.success('Session found');
    logger.subsection('Full Session Data');
    logger.raw(JSON.stringify(sessionInfo.sessionData, null, 2));
    logger.newline();
    
    // Extract and display TradingView session details
    try {
      const tvSession = provider.extractTVSession(sessionInfo);
      logger.subsection('Extracted TradingView Session');
      logger.detail('Session ID', tvSession.sessionId);
      logger.detail('Session ID Sign', tvSession.sessionIdSign || '(not present)');
      logger.detail('User ID', tvSession.userId || '(not set)');
    } catch (error) {
      logger.warning(`Could not extract TV session: ${error instanceof Error ? error.message : String(error)}`);
    }
    
  } catch (error) {
    logger.error(`Failed to debug session: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
