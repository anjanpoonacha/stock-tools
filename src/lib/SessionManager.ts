// src/lib/SessionManager.ts
// Simplified, consolidated session management interface

import { SessionResolver, type SessionInfo, type MIOSessionInfo, type UserCredentials, type SessionStats } from './SessionResolver';
import * as sessionStore from './sessionStore';
import { SESSION_CONFIG, LOG_PREFIXES } from './constants';

export type { SessionInfo, MIOSessionInfo, UserCredentials, SessionStats };

export type PlatformSessionData = {
	sessionId: string;
	userEmail?: string;
	userPassword?: string;
	extractedAt?: string;
	extractedFrom?: string;
	source?: string;
	[key: string]: string | undefined;
};

export type SessionData = {
	[platform: string]: PlatformSessionData;
};

/**
 * Unified Session Manager - Simplified interface for all session operations
 * Combines storage, resolution, and management into a single clean API
 */
export class SessionManager {
	
	// ===== SESSION RETRIEVAL =====
	
	/**
	 * Get the most recent session for any platform
	 * @param platform - Platform name (e.g., 'marketinout', 'tradingview')
	 * @param userCredentials - Optional user credentials to filter sessions
	 * @returns Session info or null if not found
	 */
	static async getLatestSession(platform: string, userCredentials?: UserCredentials): Promise<SessionInfo | null> {
		return userCredentials 
			? SessionResolver.getLatestSessionForUser(platform, userCredentials)
			: SessionResolver.getLatestSession(platform);
	}

	/**
	 * Get the most recent MarketInOut session with cookie data
	 * @param userCredentials - Optional user credentials to filter sessions
	 * @returns MIO session info with key-value pair for cookies, or null if not found
	 */
	static async getLatestMIOSession(userCredentials?: UserCredentials): Promise<MIOSessionInfo | null> {
		return userCredentials
			? SessionResolver.getLatestMIOSessionForUser(userCredentials)
			: SessionResolver.getLatestMIOSession();
	}

	/**
	 * Get all sessions for a platform (for fallback scenarios)
	 * @param platform - Platform name
	 * @returns Array of all sessions for the platform, sorted by recency
	 */
	static async getAllSessions(platform: string): Promise<SessionInfo[]> {
		return SessionResolver.getAllSessions(platform);
	}

	/**
	 * Check if any sessions exist for a platform
	 * @param platform - Platform name to check
	 * @param userCredentials - Optional user credentials to filter sessions
	 * @returns True if sessions exist
	 */
	static async hasSessionsForPlatform(platform: string, userCredentials?: UserCredentials): Promise<boolean> {
		return userCredentials
			? SessionResolver.hasSessionsForPlatformAndUser(platform, userCredentials)
			: SessionResolver.hasSessionsForPlatform(platform);
	}

	// ===== SESSION STORAGE =====

	/**
	 * Save a new session for a platform
	 * Uses deterministic session IDs when user credentials are available
	 * @param platform - Platform name
	 * @param sessionData - Session data to save
	 * @param internalId - Optional internal ID (auto-generated if not provided)
	 * @returns Final internal session ID used
	 */
	static async saveSession(platform: string, sessionData: PlatformSessionData, internalId?: string): Promise<string> {
		const finalInternalId = internalId || this.generateSessionId();
		return sessionStore.savePlatformSessionWithCleanup(finalInternalId, platform, sessionData);
	}

	/**
	 * Update existing session data for a platform
	 * @param internalId - Internal session ID
	 * @param platform - Platform name
	 * @param updates - Partial session data to merge
	 */
	static async updateSession(internalId: string, platform: string, updates: Partial<PlatformSessionData>): Promise<void> {
		return sessionStore.updatePlatformSession(internalId, platform, updates);
	}

	/**
	 * Get specific session data by internal ID and platform
	 * @param internalId - Internal session ID
	 * @param platform - Platform name
	 * @returns Session data or undefined if not found
	 */
	static async getSessionById(internalId: string, platform: string): Promise<PlatformSessionData | undefined> {
		return sessionStore.getPlatformSession(internalId, platform);
	}

	/**
	 * Get all session data for an internal ID
	 * @param internalId - Internal session ID
	 * @returns All platform sessions for the ID or undefined if not found
	 */
	static async getAllSessionsById(internalId: string): Promise<SessionData | undefined> {
		return sessionStore.getSession(internalId);
	}

	// ===== SESSION DELETION =====

	/**
	 * Delete a specific platform session
	 * @param internalId - Internal session ID
	 * @param platform - Platform name
	 */
	static async deleteSession(internalId: string, platform: string): Promise<void> {
		return sessionStore.deletePlatformSession(internalId, platform);
	}

	/**
	 * Delete all sessions for an internal ID
	 * @param internalId - Internal session ID
	 */
	static async deleteAllSessions(internalId: string): Promise<void> {
		return sessionStore.deleteSession(internalId);
	}

	// ===== SESSION ID GENERATION =====

	/**
	 * Generate a random session ID
	 * @returns Random UUID
	 */
	static generateSessionId(): string {
		return sessionStore.generateSessionId();
	}

	/**
	 * Generate a deterministic session ID based on user credentials
	 * Ensures one session per user per platform
	 * @param userEmail - User email
	 * @param userPassword - User password
	 * @param platform - Platform name
	 * @returns Deterministic session ID
	 */
	static async generateDeterministicSessionId(userEmail: string, userPassword: string, platform: string): Promise<string> {
		return sessionStore.generateDeterministicSessionId(userEmail, userPassword, platform);
	}

	// ===== UTILITY METHODS =====

	/**
	 * Get session statistics for monitoring
	 * @returns Object containing total session count and per-platform counts
	 */
	static async getSessionStats(): Promise<SessionStats> {
		return SessionResolver.getSessionStats();
	}

	/**
	 * Get all available user emails from stored sessions
	 * @returns Array of unique user emails
	 */
	static async getAvailableUsers(): Promise<string[]> {
		return SessionResolver.getAvailableUsers();
	}

	/**
	 * Clear the session cache (call when sessions are modified externally)
	 */
	static clearCache(): void {
		SessionResolver.invalidateCache();
		console.log(`${LOG_PREFIXES.SESSION_MANAGER} Session cache cleared`);
	}

	// ===== CONVENIENCE METHODS =====

	/**
	 * Save a MarketInOut session with user credentials
	 * @param sessionData - MIO session data
	 * @param userCredentials - User credentials for deterministic ID
	 * @returns Final internal session ID used
	 */
	static async saveMIOSession(sessionData: PlatformSessionData, userCredentials: UserCredentials): Promise<string> {
		const sessionWithCredentials = {
			...sessionData,
			userEmail: userCredentials.userEmail,
			userPassword: userCredentials.userPassword,
			extractedAt: sessionData.extractedAt || new Date().toISOString(),
			source: sessionData.source || 'browser-extension'
		};

		return this.saveSession(SESSION_CONFIG.PLATFORMS.MARKETINOUT, sessionWithCredentials);
	}

	/**
	 * Save a TradingView session with user credentials
	 * @param sessionData - TradingView session data
	 * @param userCredentials - User credentials for deterministic ID
	 * @returns Final internal session ID used
	 */
	static async saveTradingViewSession(sessionData: PlatformSessionData, userCredentials: UserCredentials): Promise<string> {
		const sessionWithCredentials = {
			...sessionData,
			userEmail: userCredentials.userEmail,
			userPassword: userCredentials.userPassword,
			extractedAt: sessionData.extractedAt || new Date().toISOString(),
			source: sessionData.source || 'browser-extension'
		};

		return this.saveSession(SESSION_CONFIG.PLATFORMS.TRADINGVIEW, sessionWithCredentials);
	}

	/**
	 * Quick check if a user has any sessions across all platforms
	 * @param userCredentials - User credentials to check
	 * @returns True if user has any sessions
	 */
	static async userHasAnySessions(userCredentials: UserCredentials): Promise<boolean> {
		const platforms = Object.values(SESSION_CONFIG.PLATFORMS);
		
		for (const platform of platforms) {
			const hasSession = await this.hasSessionsForPlatform(platform, userCredentials);
			if (hasSession) {
				return true;
			}
		}
		
		return false;
	}

	/**
	 * Get user's latest session across all platforms
	 * @param userCredentials - User credentials
	 * @returns Map of platform to latest session info
	 */
	static async getUserLatestSessions(userCredentials: UserCredentials): Promise<Map<string, SessionInfo>> {
		const platforms = Object.values(SESSION_CONFIG.PLATFORMS);
		const userSessions = new Map<string, SessionInfo>();

		await Promise.all(
			platforms.map(async (platform) => {
				const session = await this.getLatestSession(platform, userCredentials);
				if (session) {
					userSessions.set(platform, session);
				}
			})
		);

		return userSessions;
	}
}

// Export constants for convenience
export { SESSION_CONFIG } from './constants';

// Default export for easy importing
export default SessionManager;