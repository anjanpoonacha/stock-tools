/**
 * Session Provider
 * 
 * Main session manager with in-memory caching
 * Provides high-level session management with automatic caching and session extraction
 */

import { KVAdapter } from './KVAdapter';
import type { Platform, UserCredentials } from '../core/types';
import type { SessionInfo, SessionCache, MIOSessionCookie, TVSessionData } from './types';

export class SessionProvider {
  private adapter: KVAdapter;
  private cache = new Map<string, SessionCache>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.adapter = new KVAdapter();
  }

  /**
   * Get session with caching
   * @param platform - Platform name (marketinout or tradingview)
   * @returns Session info
   * @throws Error if no session found
   */
  async getSession(platform: Platform): Promise<SessionInfo> {
    const cacheKey = platform;
    
    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from KV
    const sessionInfo = await this.adapter.getLatestSession(platform);
    
    if (!sessionInfo) {
      throw new Error(`No ${platform} session found`);
    }

    // Cache the result
    this.cache.set(cacheKey, {
      data: sessionInfo,
      timestamp: Date.now(),
      ttl: this.cacheTTL
    });

    return sessionInfo;
  }

  /**
   * Get session for specific user with caching
   * @param platform - Platform name (marketinout or tradingview)
   * @param credentials - User credentials
   * @returns Session info
   * @throws Error if no session found
   */
  async getSessionForUser(
    platform: Platform,
    credentials: UserCredentials
  ): Promise<SessionInfo> {
    const cacheKey = `${platform}:${credentials.userEmail}`;
    
    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from KV
    const sessionInfo = await this.adapter.getSessionForUser(platform, credentials);
    
    if (!sessionInfo) {
      throw new Error(`No ${platform} session found for user ${credentials.userEmail}`);
    }

    // Cache the result
    this.cache.set(cacheKey, {
      data: sessionInfo,
      timestamp: Date.now(),
      ttl: this.cacheTTL
    });

    return sessionInfo;
  }

  /**
   * Extract MIO ASPSESSION cookie
   * @param sessionInfo - Session info containing MIO session data
   * @returns Cookie key and value
   * @throws Error if session cookie not found
   */
  extractMIOSession(sessionInfo: SessionInfo): MIOSessionCookie {
    const { sessionData } = sessionInfo;
    
    // Excluded metadata keys
    const excludedKeys = [
      'sessionId',
      'extractedAt',
      'extractedFrom',
      'source',
      'userEmail',
      'userPassword'
    ];

    // Find the ASPSESSION cookie key dynamically
    const sessionKey = Object.keys(sessionData).find(
      key => !excludedKeys.includes(key) && sessionData[key]
    );

    if (!sessionKey || !sessionData[sessionKey]) {
      throw new Error('MIO session cookie not found in session data');
    }

    return {
      key: sessionKey,
      value: sessionData[sessionKey]
    };
  }

  /**
   * Extract TradingView session data
   * @param sessionInfo - Session info containing TV session data
   * @returns Session ID, optional signature, and user ID
   * @throws Error if required session data not found
   */
  extractTVSession(sessionInfo: SessionInfo): TVSessionData {
    const { sessionData } = sessionInfo;

    const sessionId = sessionData.sessionid || sessionData.sessionId;
    const sessionIdSign = sessionData.sessionid_sign;
    const userId = sessionData.userId || sessionData.userid;

    if (!sessionId) {
      throw new Error('TradingView sessionId not found in session data');
    }

    // userId might not be in session data (can be fetched dynamically)
    // Allow 0 as default and let caller fetch it via TVHttpClient.getUserId() if needed
    let userIdNum = 0;
    
    if (userId) {
      userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      if (isNaN(userIdNum)) {
        throw new Error('TradingView userId is not a valid number');
      }
    }

    return {
      sessionId,
      sessionIdSign, // May be undefined, which is handled gracefully
      userId: userIdNum
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get session statistics
   * @returns Cache statistics
   */
  getStats() {
    return {
      cachedSessions: this.cache.size,
      cacheTTL: this.cacheTTL
    };
  }

  /**
   * Get from cache with TTL check
   * @param key - Cache key
   * @returns Cached session info or null if not found or expired
   */
  private getCached(key: string): SessionInfo | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    const now = Date.now();
    const age = now - cached.timestamp;

    // Check if cache entry is still valid
    if (age > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }
}
