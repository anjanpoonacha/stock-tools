// src/lib/sessionStore.kv.ts - Vercel KV implementation for production

import { kv } from '@vercel/kv';

export type PlatformSessionData = {
	sessionId: string;
	userEmail?: string; // User email for session scoping
	userPassword?: string; // User password for session scoping
	extractedAt?: string; // Timestamp when session was extracted
	extractedFrom?: string; // URL where session was extracted
	source?: string; // Source of extraction (e.g., 'browser-extension')
	// Add more fields as needed per platform
	[key: string]: string | undefined;
};

export type SessionData = {
	[platform: string]: PlatformSessionData;
};

/**
 * Generate a secure random internal session ID.
 */
export function generateSessionId(): string {
	return crypto.randomUUID();
}

/**
 * Save or update a session for a specific platform under an internal session ID.
 */
export async function savePlatformSession(internalId: string, platform: string, data: PlatformSessionData): Promise<void> {
	const key = `session:${internalId}:${platform}`;

	// Set with 24 hour TTL (86400 seconds)
	await kv.setex(key, 86400, JSON.stringify(data));

	console.log(`[SessionStore-KV] Saved ${platform} session: ${internalId}`);
}

/**
 * Get session data for a specific platform under an internal session ID.
 */
export async function getPlatformSession(internalId: string, platform: string): Promise<PlatformSessionData | undefined> {
	const key = `session:${internalId}:${platform}`;
	const data = await kv.get(key);

	if (!data) {
		return undefined;
	}

	try {
		return JSON.parse(data as string);
	} catch (error) {
		console.error(`[SessionStore-KV] Error parsing session data for ${key}:`, error);
		return undefined;
	}
}

/**
 * Get all session data for an internal session ID.
 */
export async function getSession(internalId: string): Promise<SessionData | undefined> {
	const pattern = `session:${internalId}:*`;
	const keys = await kv.keys(pattern);

	if (keys.length === 0) {
		return undefined;
	}

	const sessionData: SessionData = {};

	for (const key of keys) {
		const data = await kv.get(key);
		if (data) {
			try {
				const platform = key.split(':')[2]; // Extract platform from key
				sessionData[platform] = JSON.parse(data as string);
			} catch (error) {
				console.error(`[SessionStore-KV] Error parsing session data for ${key}:`, error);
			}
		}
	}

	return Object.keys(sessionData).length > 0 ? sessionData : undefined;
}

/**
 * Update specific session data for a platform under an internal session ID.
 * This merges new data with existing session data.
 */
export async function updatePlatformSession(internalId: string, platform: string, updates: Partial<PlatformSessionData>): Promise<void> {
	const existing = await getPlatformSession(internalId, platform);
	const platformData = existing || { sessionId: '' };

	// Merge updates with existing data, ensuring all values are strings
	const updatedPlatformData: PlatformSessionData = {
		...platformData,
		...Object.fromEntries(
			Object.entries(updates).filter(([, value]) => value !== undefined)
		) as PlatformSessionData
	};

	await savePlatformSession(internalId, platform, updatedPlatformData);
}

/**
 * Clean up duplicate sessions for a platform, keeping only the most recent one
 * Returns the internal session ID that was kept (most recent)
 * Now considers user email for proper scoping
 */
export async function cleanupDuplicateSessions(platform: string, sessionData: PlatformSessionData, currentInternalId?: string): Promise<string> {
	const pattern = `session:*:${platform}`;
	const keys = await kv.keys(pattern);

	const duplicates: Array<{ id: string; extractedAt: string; key: string }> = [];

	// Find all sessions with the same session data and user email
	for (const key of keys) {
		const data = await kv.get(key);
		if (data) {
			try {
				const platformData = JSON.parse(data as string) as PlatformSessionData;
				if (platformData.sessionId === sessionData.sessionId) {
					// Check if user email matches (both must be defined or both undefined for a match)
					const emailsMatch = platformData.userEmail === sessionData.userEmail;
					if (emailsMatch) {
						const internalId = key.split(':')[1]; // Extract internal ID from key
						duplicates.push({
							id: internalId,
							extractedAt: platformData.extractedAt || '1970-01-01T00:00:00.000Z',
							key
						});
					}
				}
			} catch (error) {
				console.error(`[SessionStore-KV] Error parsing session data for cleanup:`, error);
			}
		}
	}

	if (duplicates.length <= 1) {
		// No duplicates found, return current or first ID
		return currentInternalId || duplicates[0]?.id || generateSessionId();
	}

	// Sort by extractedAt timestamp (most recent first)
	duplicates.sort((a, b) => new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime());

	// Keep the most recent session (first in sorted array)
	const keepId = currentInternalId || duplicates[0].id;

	// Delete all other duplicate sessions
	const toDelete = duplicates.filter(d => d.id !== keepId);

	const userEmailInfo = sessionData.userEmail ? ` for user ${sessionData.userEmail}` : ' (no user email)';
	console.log(`[SessionStore-KV] Cleaning up ${toDelete.length} duplicate ${platform} sessions${userEmailInfo}, keeping: ${keepId}`);

	// Delete duplicates from KV
	const deletePromises = toDelete.map(async (duplicate) => {
		await kv.del(duplicate.key);
		console.log(`[SessionStore-KV] Deleted duplicate session: ${duplicate.id}`);
	});

	await Promise.all(deletePromises);

	return keepId;
}

/**
 * Save or update a session for a platform with automatic deduplication
 * This replaces the old savePlatformSession with built-in cleanup
 */
export async function savePlatformSessionWithCleanup(internalId: string, platform: string, data: PlatformSessionData): Promise<string> {
	// First, clean up any existing duplicates and get the ID to use
	const finalInternalId = await cleanupDuplicateSessions(platform, data, internalId);

	// Now save the session data
	await savePlatformSession(finalInternalId, platform, data);

	console.log(`[SessionStore-KV] Saved ${platform} session with cleanup: ${finalInternalId}`);
	return finalInternalId;
}

/**
 * Get all sessions from KV store (for debugging and migration)
 */
export async function getAllSessions(): Promise<Record<string, SessionData>> {
	const keys = await kv.keys('session:*');
	const sessions: Record<string, SessionData> = {};

	for (const key of keys) {
		const data = await kv.get(key);
		if (data) {
			try {
				const [, internalId, platform] = key.split(':');
				if (!sessions[internalId]) {
					sessions[internalId] = {};
				}
				sessions[internalId][platform] = JSON.parse(data as string);
			} catch (error) {
				console.error(`[SessionStore-KV] Error parsing session data for ${key}:`, error);
			}
		}
	}

	return sessions;
}

/**
 * Delete session data for a specific platform under an internal session ID.
 */
export async function deletePlatformSession(internalId: string, platform: string): Promise<void> {
	const key = `session:${internalId}:${platform}`;
	await kv.del(key);
	console.log(`[SessionStore-KV] Deleted ${platform} session: ${internalId}`);
}

/**
 * Delete the entire session for an internal session ID.
 */
export async function deleteSession(internalId: string): Promise<void> {
	const pattern = `session:${internalId}:*`;
	const keys = await kv.keys(pattern);

	if (keys.length > 0) {
		await Promise.all(keys.map(key => kv.del(key)));
		console.log(`[SessionStore-KV] Deleted all sessions for: ${internalId}`);
	}
}

/**
 * Get session statistics for debugging and monitoring
 */
export async function getSessionStats(): Promise<{ totalSessions: number; platformCounts: Record<string, number> }> {
	const keys = await kv.keys('session:*');
	const platformCounts: Record<string, number> = {};

	for (const key of keys) {
		const platform = key.split(':')[2];
		if (platform) {
			platformCounts[platform] = (platformCounts[platform] || 0) + 1;
		}
	}

	return {
		totalSessions: keys.length,
		platformCounts
	};
}
