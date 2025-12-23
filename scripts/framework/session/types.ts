/**
 * Session Management Types
 * 
 * Type definitions for session management layer
 */

import type { Platform } from '../core/types';

export interface SessionInfo {
  internalId: string;
  sessionData: Record<string, any>;
  platform: Platform;
}

export interface SessionCache {
  data: SessionInfo;
  timestamp: number;
  ttl: number;
}

export interface MIOSessionCookie {
  key: string;    // e.g., "ASPSESSIONIDQSTRTDCA"
  value: string;  // Cookie value
}

export interface TVSessionData {
  sessionId: string;
  sessionIdSign?: string;
  userId: number;
}
