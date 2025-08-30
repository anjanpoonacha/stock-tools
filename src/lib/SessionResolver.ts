// src/lib/SessionResolver.ts

import { SESSION_CONFIG, LOG_PREFIXES } from './constants';

export interface SessionData {
	sessionId: string;
	extractedAt?: string;
	extractedFrom?: string;
	source?: string;
	[key: string]: string | undefined;
}

export interface PlatformSessions {
	[platform: string]: SessionData;
}

export interface StoredSessions {
	[internalId: string]: PlatformSessions;
}

export interface SessionInfo {
	sessionData: SessionData;
	internalId: string;
}

export interface MIOSessionInfo {
	key: string;
	value: string;
	internalId: string;
}

export interface SessionStats {
	totalSessions: number;
	platformCounts: Record<string, number>;
}

export interface UserCredentials {
	userEmail: string;
	userPassword: string;
}

interface PlatformSessionWithTimestamp extends SessionInfo {
	extractedAt: string;
}

/**
 * Service for automatically resolving and managing session data
 * Provides clean abstraction over KV storage operations without requiring frontend session management
 */
export class SessionResolver {

	/**
	 * Loads all sessions from KV storage
	 * @returns Parsed session data or empty object if no sessions exist
	 */
	private static async loadSessions(): Promise<StoredSessions> {
		try {
			// Use the sessionStore interface which handles KV automatically
			const sessionStore = await import('./sessionStore');

			// Get KV store directly since we're KV-only now
			const kvStore = await import('./sessionStore.kv');
			const allSessions = await kvStore.getAllSessions();

			console.log(`${LOG_PREFIXES.SESSION_RESOLVER} Loaded ${Object.keys(allSessions).length} sessions from KV storage`);
			return allSessions;
		} catch (error) {
			console.error(`${LOG_PREFIXES.SESSION_RESOLVER} Failed to load sessions from KV:`, error);
			return {};
		}
	}

	/**
	 * Extracts sessions for a specific platform from all stored sessions
	 * @param allSessions - All stored session data
	 * @param platform - Target platform name
	 * @param userCredentials - Optional user credentials to filter sessions
	 * @returns Array of platform sessions with timestamps
	 */
	private static extractPlatformSessions(allSessions: StoredSessions, platform: string, userCredentials?: UserCredentials): PlatformSessionWithTimestamp[] {
		const platformSessions: PlatformSessionWithTimestamp[] = [];

		for (const [internalId, sessionEntry] of Object.entries(allSessions)) {
			const platformData = sessionEntry[platform];
			if (this.isValidSessionData(platformData)) {
				// Filter by user credentials if provided
				if (userCredentials) {
					const sessionEmail = platformData.userEmail;
					const sessionPassword = platformData.userPassword;

					// Skip sessions that don't match the user credentials
					if (sessionEmail !== userCredentials.userEmail || sessionPassword !== userCredentials.userPassword) {
						continue;
					}
				}

				platformSessions.push({
					sessionData: platformData,
					internalId,
					extractedAt: platformData.extractedAt || SESSION_CONFIG.DEFAULT_EXTRACTED_AT
				});
			}
		}

		return platformSessions;
	}

	/**
	 * Validates if session data is complete and usable
	 * @param sessionData - Session data to validate
	 * @returns True if session data is valid
	 */
	private static isValidSessionData(sessionData: SessionData | undefined): sessionData is SessionData {
		return Boolean(sessionData?.sessionId);
	}

	/**
	 * Sorts sessions by extraction timestamp (most recent first)
	 * @param sessions - Sessions to sort
	 * @returns Sorted sessions array
	 */
	private static sortSessionsByTimestamp(sessions: PlatformSessionWithTimestamp[]): PlatformSessionWithTimestamp[] {
		return sessions.sort((a, b) => new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime());
	}

	/**
	 * Finds the session cookie key by excluding known metadata keys
	 * @param sessionData - Session data to search
	 * @returns Session cookie key or null if not found
	 */
	private static findSessionCookieKey(sessionData: SessionData): string | null {
		const excludedKeys = SESSION_CONFIG.EXCLUDED_SESSION_KEYS as readonly string[];
		const sessionKey = Object.keys(sessionData).find(key =>
			!excludedKeys.includes(key)
		);

		return sessionKey && sessionData[sessionKey] ? sessionKey : null;
	}

	/**
	 * Retrieves the most recent valid session for a specific platform
	 * @param platform - Platform name (e.g., 'marketinout', 'tradingview')
	 * @returns Session info or null if no valid session found
	 */
	static async getLatestSession(platform: string): Promise<SessionInfo | null> {
		try {
			const allSessions = await this.loadSessions();
			const platformSessions = this.extractPlatformSessions(allSessions, platform);

			if (platformSessions.length === 0) {
				console.log(`${LOG_PREFIXES.SESSION_RESOLVER} No ${platform} sessions found`);
				return null;
			}

			const sortedSessions = this.sortSessionsByTimestamp(platformSessions);
			const latestSession = sortedSessions[0];

			console.log(`${LOG_PREFIXES.SESSION_RESOLVER} Found ${platformSessions.length} ${platform} sessions, using most recent: ${latestSession.internalId}`);

			return {
				sessionData: latestSession.sessionData,
				internalId: latestSession.internalId
			};
		} catch (error) {
			console.error(`${LOG_PREFIXES.SESSION_RESOLVER} Error getting latest ${platform} session:`, error);
			return null;
		}
	}

	/**
	 * Retrieves the most recent MarketInOut session with cookie data
	 * @returns MIO session info with key-value pair for cookies, or null if not found
	 */
	static async getLatestMIOSession(): Promise<MIOSessionInfo | null> {
		const sessionInfo = await this.getLatestSession(SESSION_CONFIG.PLATFORMS.MARKETINOUT);
		if (!sessionInfo) {
			return null;
		}

		const { sessionData, internalId } = sessionInfo;
		const sessionKey = this.findSessionCookieKey(sessionData);

		if (!sessionKey) {
			console.warn(`${LOG_PREFIXES.SESSION_RESOLVER} No valid session cookie found in MIO session data`);
			return null;
		}

		return {
			key: sessionKey,
			value: sessionData[sessionKey]!,
			internalId
		};
	}

	/**
	 * Retrieves all available sessions for a platform (for fallback scenarios)
	 * @param platform - Platform name
	 * @returns Array of all sessions for the platform, sorted by recency
	 */
	static async getAllSessions(platform: string): Promise<SessionInfo[]> {
		try {
			const allSessions = await this.loadSessions();
			const platformSessions = this.extractPlatformSessions(allSessions, platform);
			const sortedSessions = this.sortSessionsByTimestamp(platformSessions);

			return sortedSessions.map(({ sessionData, internalId }) => ({ sessionData, internalId }));
		} catch (error) {
			console.error(`${LOG_PREFIXES.SESSION_RESOLVER} Error getting all ${platform} sessions:`, error);
			return [];
		}
	}

	/**
	 * Checks if any sessions exist for a platform
	 * @param platform - Platform name to check
	 * @returns True if sessions exist for the platform
	 */
	static async hasSessionsForPlatform(platform: string): Promise<boolean> {
		const session = await this.getLatestSession(platform);
		return session !== null;
	}

	/**
	 * Retrieves session statistics for debugging and monitoring
	 * @returns Object containing total session count and per-platform counts
	 */
	static async getSessionStats(): Promise<SessionStats> {
		try {
			const allSessions = await this.loadSessions();
			const platformCounts: Record<string, number> = {};
			let totalSessions = 0;

			for (const sessionEntry of Object.values(allSessions)) {
				totalSessions++;
				for (const platform of Object.keys(sessionEntry)) {
					platformCounts[platform] = (platformCounts[platform] || 0) + 1;
				}
			}

			return { totalSessions, platformCounts };
		} catch (error) {
			console.error(`${LOG_PREFIXES.SESSION_RESOLVER} Error getting session stats:`, error);
			return { totalSessions: 0, platformCounts: {} };
		}
	}

	/**
	 * Retrieves the most recent valid session for a specific platform and user
	 * @param platform - Platform name (e.g., 'marketinout', 'tradingview')
	 * @param userCredentials - User credentials to filter sessions
	 * @returns Session info or null if no valid session found
	 */
	static async getLatestSessionForUser(platform: string, userCredentials: UserCredentials): Promise<SessionInfo | null> {
		try {
			const allSessions = await this.loadSessions();
			const platformSessions = this.extractPlatformSessions(allSessions, platform, userCredentials);

			if (platformSessions.length === 0) {
				console.log(`${LOG_PREFIXES.SESSION_RESOLVER} No ${platform} sessions found for user: ${userCredentials.userEmail}`);
				return null;
			}

			const sortedSessions = this.sortSessionsByTimestamp(platformSessions);
			const latestSession = sortedSessions[0];

			console.log(`${LOG_PREFIXES.SESSION_RESOLVER} Found ${platformSessions.length} ${platform} sessions for user ${userCredentials.userEmail}, using most recent: ${latestSession.internalId}`);

			return {
				sessionData: latestSession.sessionData,
				internalId: latestSession.internalId
			};
		} catch (error) {
			console.error(`${LOG_PREFIXES.SESSION_RESOLVER} Error getting latest ${platform} session for user:`, error);
			return null;
		}
	}

	/**
	 * Retrieves the most recent MarketInOut session for a specific user
	 * @param userCredentials - User credentials to filter sessions
	 * @returns MIO session info with key-value pair for cookies, or null if not found
	 */
	static async getLatestMIOSessionForUser(userCredentials: UserCredentials): Promise<MIOSessionInfo | null> {
		const sessionInfo = await this.getLatestSessionForUser(SESSION_CONFIG.PLATFORMS.MARKETINOUT, userCredentials);
		if (!sessionInfo) {
			return null;
		}

		const { sessionData, internalId } = sessionInfo;
		const sessionKey = this.findSessionCookieKey(sessionData);

		if (!sessionKey) {
			console.warn(`${LOG_PREFIXES.SESSION_RESOLVER} No valid session cookie found in MIO session data for user: ${userCredentials.userEmail}`);
			return null;
		}

		return {
			key: sessionKey,
			value: sessionData[sessionKey]!,
			internalId
		};
	}

	/**
	 * Checks if any sessions exist for a platform and user
	 * @param platform - Platform name to check
	 * @param userCredentials - User credentials to filter sessions
	 * @returns True if sessions exist for the platform and user
	 */
	static async hasSessionsForPlatformAndUser(platform: string, userCredentials: UserCredentials): Promise<boolean> {
		const session = await this.getLatestSessionForUser(platform, userCredentials);
		return session !== null;
	}

	/**
	 * Gets all available user emails from stored sessions
	 * @returns Array of unique user emails found in sessions
	 */
	static async getAvailableUsers(): Promise<string[]> {
		try {
			const allSessions = await this.loadSessions();
			const userEmails = new Set<string>();

			for (const sessionEntry of Object.values(allSessions)) {
				for (const platformData of Object.values(sessionEntry)) {
					if (platformData.userEmail) {
						userEmails.add(platformData.userEmail);
					}
				}
			}

			return Array.from(userEmails).sort();
		} catch (error) {
			console.error(`${LOG_PREFIXES.SESSION_RESOLVER} Error getting available users:`, error);
			return [];
		}
	}

}
