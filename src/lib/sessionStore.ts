// src/lib/sessionStore.ts

import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export type PlatformSessionData = {
	sessionId: string;
	// Add more fields as needed per platform
	[key: string]: string;
};

export type SessionData = {
	[platform: string]: PlatformSessionData;
};

const SESSION_FILE = process.env.NODE_ENV === 'production' ? '/tmp/sessions.json' : 'sessions.json'; // Use a temp file for simplicity, adjust as needed

function loadSessions(): Record<string, SessionData> {
	if (!existsSync(SESSION_FILE)) return {};
	try {
		const raw = readFileSync(SESSION_FILE, 'utf-8');
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

function saveSessions(sessions: Record<string, SessionData>) {
	writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

/**
 * Save or update a session for a specific platform under an internal session ID.
 */
export function savePlatformSession(internalId: string, platform: string, data: PlatformSessionData) {
	const sessions = loadSessions();
	const existing = sessions[internalId] || {};
	sessions[internalId] = { ...existing, [platform]: data };
	saveSessions(sessions);
}

/**
 * Get session data for a specific platform under an internal session ID.
 */
export function getPlatformSession(internalId: string, platform: string): PlatformSessionData | undefined {
	const sessions = loadSessions();
	const session = sessions[internalId];
	return session ? session[platform] : undefined;
}

/**
 * @deprecated Use savePlatformSessionWithCleanup instead for automatic deduplication
 * Delete session data for a specific platform under an internal session ID.
 */
export function deletePlatformSession(internalId: string, platform: string) {
	console.warn('[SessionStore] deletePlatformSession is deprecated. Use savePlatformSessionWithCleanup for automatic cleanup.');
	const sessions = loadSessions();
	const session = sessions[internalId];
	if (session && session[platform]) {
		delete session[platform];
		sessions[internalId] = session;
		saveSessions(sessions);
	}
}

/**
 * @deprecated Use savePlatformSessionWithCleanup instead for automatic deduplication
 * Delete the entire session for an internal session ID.
 */
export function deleteSession(internalId: string) {
	console.warn('[SessionStore] deleteSession is deprecated. Use savePlatformSessionWithCleanup for automatic cleanup.');
	const sessions = loadSessions();
	delete sessions[internalId];
	saveSessions(sessions);
}

/**
 * Get all session data for an internal session ID.
 */
export function getSession(internalId: string): SessionData | undefined {
	const sessions = loadSessions();
	return sessions[internalId];
}

/**
 * Update specific session data for a platform under an internal session ID.
 * This merges new data with existing session data.
 */
export function updatePlatformSession(internalId: string, platform: string, updates: Partial<PlatformSessionData>) {
	const sessions = loadSessions();
	const existing = sessions[internalId] || {};
	const platformData = existing[platform] || { sessionId: '' };

	// Merge updates with existing data, ensuring all values are strings
	const updatedPlatformData: PlatformSessionData = {
		...platformData,
		...Object.fromEntries(
			Object.entries(updates).filter(([, value]) => value !== undefined)
		) as PlatformSessionData
	};

	sessions[internalId] = { ...existing, [platform]: updatedPlatformData };
	saveSessions(sessions);
}

/**
 * Find existing sessions for a platform that match the given session data
 * Used for deduplication to avoid storing multiple sessions with the same credentials
 */
export function findDuplicateSessions(platform: string, sessionData: PlatformSessionData): string[] {
	const sessions = loadSessions();
	const duplicateIds: string[] = [];

	for (const [internalId, sessionEntry] of Object.entries(sessions)) {
		const platformData = sessionEntry[platform];
		if (platformData && platformData.sessionId === sessionData.sessionId) {
			// Check if the main session identifier matches
			duplicateIds.push(internalId);
		}
	}

	return duplicateIds;
}

/**
 * Clean up duplicate sessions for a platform, keeping only the most recent one
 * Returns the internal session ID that was kept (most recent)
 */
export function cleanupDuplicateSessions(platform: string, sessionData: PlatformSessionData, currentInternalId?: string): string {
	const sessions = loadSessions();
	const duplicates: Array<{ id: string; extractedAt: string }> = [];

	// Find all sessions with the same session data
	for (const [internalId, sessionEntry] of Object.entries(sessions)) {
		const platformData = sessionEntry[platform];
		if (platformData && platformData.sessionId === sessionData.sessionId) {
			duplicates.push({
				id: internalId,
				extractedAt: platformData.extractedAt || '1970-01-01T00:00:00.000Z'
			});
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

	console.log(`[SessionStore] Cleaning up ${toDelete.length} duplicate ${platform} sessions, keeping: ${keepId}`);

	for (const duplicate of toDelete) {
		delete sessions[duplicate.id];
		console.log(`[SessionStore] Deleted duplicate session: ${duplicate.id}`);
	}

	// Save the cleaned sessions
	saveSessions(sessions);

	return keepId;
}

/**
 * Save or update a session for a platform with automatic deduplication
 * This replaces the old savePlatformSession with built-in cleanup
 */
export function savePlatformSessionWithCleanup(internalId: string, platform: string, data: PlatformSessionData): string {
	// First, clean up any existing duplicates and get the ID to use
	const finalInternalId = cleanupDuplicateSessions(platform, data, internalId);

	// Now save the session data
	const sessions = loadSessions();
	const existing = sessions[finalInternalId] || {};
	sessions[finalInternalId] = { ...existing, [platform]: data };
	saveSessions(sessions);

	console.log(`[SessionStore] Saved ${platform} session with cleanup: ${finalInternalId}`);
	return finalInternalId;
}

/**
 * Generate a secure random internal session ID.
 */
export function generateSessionId(): string {
	return randomBytes(32).toString('hex');
}
