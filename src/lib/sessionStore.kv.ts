// src/lib/sessionStore.kv.ts - Vercel KV implementation for production
// Fixed: Handle both string and object data types from KV

import { kv } from '@vercel/kv';
import { SessionResolver } from './SessionResolver';

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
 * Generate session key for KV storage
 */
function generateSessionKey(internalId: string, platform: string): string {
	return `session:${internalId}:${platform}`;
}

/**
 * Parse KV data handling both string and object formats
 */
function parseKVData(data: unknown, key: string): PlatformSessionData | undefined {
	if (!data) return undefined;

	try {
		if (typeof data === 'string') {
			return JSON.parse(data);
		} else if (typeof data === 'object' && data !== null) {
			return data as PlatformSessionData;
		} else {
			throw new Error(`Unexpected data type: ${typeof data}`);
		}
	} catch (error) {
		console.error(`[SessionStore-KV] Error processing session data for ${key}:`, error);
		return undefined;
	}
}

/**
 * Sanitize session data ensuring all values are strings
 */
function sanitizeSessionData(data: PlatformSessionData): PlatformSessionData {
	const sanitized: PlatformSessionData = { sessionId: data.sessionId };

	for (const [propKey, value] of Object.entries(data)) {
		if (propKey !== 'sessionId' && value !== undefined) {
			if (typeof value === 'object' && value !== null) {
				sanitized[propKey] = JSON.stringify(value);
			} else {
				sanitized[propKey] = typeof value === 'string' ? value : String(value);
			}
		}
	}

	return sanitized;
}

/**
 * Execute operation with cache invalidation
 */
async function withCacheInvalidation<T>(operation: () => Promise<T>): Promise<T> {
	const result = await operation();
	SessionResolver.invalidateCache();
	return result;
}

/**
 * Generate a deterministic session ID based on user credentials and platform.
 * This ensures one session per user per platform - new sessions will overwrite existing ones.
 */
export async function generateDeterministicSessionId(userEmail: string, userPassword: string, platform: string): Promise<string> {
	// Create a consistent input string
	const input = `${userEmail.toLowerCase().trim()}:${userPassword}:${platform}`;

	// Use Web Crypto API to generate a secure hash
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);

	// Convert to hex string
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

	// Return a shorter, more manageable ID (first 32 characters of hash)
	return `det_${hashHex.substring(0, 32)}`;
}

/**
 * Save or update a session for a specific platform under an internal session ID.
 */
export async function savePlatformSession(internalId: string, platform: string, data: PlatformSessionData): Promise<void> {
	const key = generateSessionKey(internalId, platform);
	const sanitizedData = sanitizeSessionData(data);

	await withCacheInvalidation(async () => {
		await kv.set(key, JSON.stringify(sanitizedData));
		console.log(`[SessionStore-KV] Successfully saved ${platform} session: ${internalId}`);
	});
}

/**
 * Get session data for a specific platform under an internal session ID.
 */
export async function getPlatformSession(internalId: string, platform: string): Promise<PlatformSessionData | undefined> {
	const key = generateSessionKey(internalId, platform);
	const data = await kv.get(key);
	return parseKVData(data, key);
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
		const parsedData = parseKVData(data, key);
		
		if (parsedData) {
			const platform = key.split(':')[2]; // Extract platform from key
			sessionData[platform] = parsedData;
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
 * Save or update a session for a platform
 * Uses deterministic session IDs when user credentials are available to ensure one session per user per platform
 */
export async function savePlatformSessionWithCleanup(internalId: string, platform: string, data: PlatformSessionData): Promise<string> {
	let finalInternalId = internalId;

	// If user credentials are available, use deterministic session ID to ensure one session per user per platform
	if (data.userEmail && data.userPassword) {
		finalInternalId = await generateDeterministicSessionId(data.userEmail, data.userPassword, platform);
		console.log(`[SessionStore-KV] Using deterministic session ID for user ${data.userEmail} on ${platform}: ${finalInternalId}`);
	} else {
		console.log(`[SessionStore-KV] No user credentials provided, using provided session ID for ${platform}: ${finalInternalId}`);
	}

	// Save the session data (deterministic IDs will automatically overwrite existing sessions)
	await savePlatformSession(finalInternalId, platform, data);
	console.log(`[SessionStore-KV] Saved ${platform} session: ${finalInternalId}`);
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
		const parsedData = parseKVData(data, key);
		
		if (parsedData) {
			const [, internalId, platform] = key.split(':');
			if (!sessions[internalId]) {
				sessions[internalId] = {};
			}
			sessions[internalId][platform] = parsedData;
		}
	}

	return sessions;
}

/**
 * Delete session data for a specific platform under an internal session ID.
 */
export async function deletePlatformSession(internalId: string, platform: string): Promise<void> {
	const key = generateSessionKey(internalId, platform);
	
	await withCacheInvalidation(async () => {
		await kv.del(key);
		console.log(`[SessionStore-KV] Deleted ${platform} session: ${internalId}`);
	});
}

/**
 * Delete the entire session for an internal session ID.
 */
export async function deleteSession(internalId: string): Promise<void> {
	const pattern = `session:${internalId}:*`;
	const keys = await kv.keys(pattern);

	if (keys.length > 0) {
		await withCacheInvalidation(async () => {
			await Promise.all(keys.map(key => kv.del(key)));
			console.log(`[SessionStore-KV] Deleted all sessions for: ${internalId}`);
		});
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
