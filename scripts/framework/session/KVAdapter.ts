/**
 * KV Adapter
 * 
 * Wrapper around SessionResolver for consistent session retrieval
 * Provides clean abstraction over KV storage operations
 */

import { SessionResolver } from '../../../src/lib/SessionResolver.js';
import type { Platform, UserCredentials } from '../core/types';
import type { SessionInfo } from './types';

export class KVAdapter {
  /**
   * Retrieves the most recent session for a platform
   * @param platform - Platform name (marketinout or tradingview)
   * @returns Session info or null if no session found
   */
  async getLatestSession(platform: Platform): Promise<SessionInfo | null> {
    const sessionInfo = await SessionResolver.getLatestSession(platform);
    
    if (!sessionInfo) {
      return null;
    }

    return {
      internalId: sessionInfo.internalId,
      sessionData: sessionInfo.sessionData,
      platform
    };
  }

  /**
   * Retrieves the most recent session for a specific user on a platform
   * @param platform - Platform name (marketinout or tradingview)
   * @param credentials - User credentials to filter sessions
   * @returns Session info or null if no session found
   */
  async getSessionForUser(
    platform: Platform,
    credentials: UserCredentials
  ): Promise<SessionInfo | null> {
    let sessionInfo;
    
    if (platform === 'marketinout') {
      // For MarketInOut, use the specialized method
      const mioSession = await SessionResolver.getLatestMIOSessionForUser(credentials);
      
      if (!mioSession) {
        return null;
      }

      // Convert MIOSessionInfo to SessionInfo format
      sessionInfo = {
        internalId: mioSession.internalId,
        sessionData: {
          sessionId: mioSession.value,
          [mioSession.key]: mioSession.value,
          userEmail: credentials.userEmail,
          userPassword: credentials.userPassword
        }
      };
    } else if (platform === 'tradingview') {
      // For TradingView, use the standard method
      sessionInfo = await SessionResolver.getLatestSessionForUser(platform, credentials);
      
      if (!sessionInfo) {
        return null;
      }
    } else {
      return null;
    }

    return {
      internalId: sessionInfo.internalId,
      sessionData: sessionInfo.sessionData,
      platform
    };
  }
}
