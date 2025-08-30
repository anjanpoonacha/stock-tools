// src/lib/sessionStore.ts

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

// Always use Vercel KV - check for KV credentials or force local KV usage
const USE_VERCEL_KV = process.env.KV_REST_API_URL || process.env.FORCE_KV_LOCALLY === 'true';

// Import KV functions dynamically
let kvStore: typeof import('./sessionStore.kv') | null = null;
async function getKVStore() {
	if (!kvStore && USE_VERCEL_KV) {
		try {
			kvStore = await import('./sessionStore.kv');
		} catch (error) {
			console.error('[SessionStore] Failed to load KV store:', error);
			throw new Error('KV store is required but failed to load. Check your KV configuration.');
		}
	}
	if (!kvStore) {
		throw new Error('KV store is not available. Check your KV configuration in .env file.');
	}
	return kvStore;
}

/**
 * Save or update a session for a specific platform under an internal session ID.
 */
export async function savePlatformSession(internalId: string, platform: string, data: PlatformSessionData) {
	const kv = await getKVStore();
	return await kv.savePlatformSession(internalId, platform, data);
}

/**
 * Get session data for a specific platform under an internal session ID.
 */
export async function getPlatformSession(internalId: string, platform: string): Promise<PlatformSessionData | undefined> {
	const kv = await getKVStore();
	return await kv.getPlatformSession(internalId, platform);
}

/**
 * @deprecated Use savePlatformSessionWithCleanup instead for automatic deduplication
 * Delete session data for a specific platform under an internal session ID.
 */
export async function deletePlatformSession(internalId: string, platform: string) {
	console.warn('[SessionStore] deletePlatformSession is deprecated. Use savePlatformSessionWithCleanup for automatic cleanup.');
	const kv = await getKVStore();
	return await kv.deletePlatformSession(internalId, platform);
}

/**
 * @deprecated Use savePlatformSessionWithCleanup instead for automatic deduplication
 * Delete the entire session for an internal session ID.
 */
export async function deleteSession(internalId: string) {
	console.warn('[SessionStore] deleteSession is deprecated. Use savePlatformSessionWithCleanup for automatic cleanup.');
	const kv = await getKVStore();
	return await kv.deleteSession(internalId);
}

/**
 * Get all session data for an internal session ID.
 */
export async function getSession(internalId: string): Promise<SessionData | undefined> {
	const kv = await getKVStore();
	return await kv.getSession(internalId);
}

/**
 * Update specific session data for a platform under an internal session ID.
 * This merges new data with existing session data.
 */
export async function updatePlatformSession(internalId: string, platform: string, updates: Partial<PlatformSessionData>) {
	const kv = await getKVStore();
	return await kv.updatePlatformSession(internalId, platform, updates);
}

/**
 * Clean up duplicate sessions for a platform, keeping only the most recent one
 * Returns the internal session ID that was kept (most recent)
 * Now considers user email for proper scoping
 */
export async function cleanupDuplicateSessions(platform: string, sessionData: PlatformSessionData, currentInternalId?: string): Promise<string> {
	const kv = await getKVStore();
	return await kv.cleanupDuplicateSessions(platform, sessionData, currentInternalId);
}

/**
 * Save or update a session for a platform with automatic deduplication
 * This replaces the old savePlatformSession with built-in cleanup
 */
export async function savePlatformSessionWithCleanup(internalId: string, platform: string, data: PlatformSessionData): Promise<string> {
	const kv = await getKVStore();
	return await kv.savePlatformSessionWithCleanup(internalId, platform, data);
}

/**
 * Generate a secure random internal session ID.
 */
export function generateSessionId(): string {
	// Always use crypto.randomUUID() since we're using KV exclusively
	return crypto.randomUUID();
}
