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
	const key = `session:${internalId}:${platform}`;

	// Debug: Log the incoming data
	console.log(`[SessionStore-KV] DEBUG: Incoming data for ${key}:`, JSON.stringify(data, null, 2));

	// Ensure all values are strings or undefined (sanitize the data)
	const sanitizedData: PlatformSessionData = {
		sessionId: data.sessionId
	};

	// Convert all other properties to strings
	for (const [propKey, value] of Object.entries(data)) {
		if (propKey !== 'sessionId' && value !== undefined) {
			// Ensure we convert objects to strings properly
			if (typeof value === 'object' && value !== null) {
				sanitizedData[propKey] = JSON.stringify(value);
			} else {
				sanitizedData[propKey] = typeof value === 'string' ? value : String(value);
			}
		}
	}

	// Debug: Log the sanitized data
	console.log(`[SessionStore-KV] DEBUG: Sanitized data for ${key}:`, JSON.stringify(sanitizedData, null, 2));

	const jsonString = JSON.stringify(sanitizedData);
	console.log(`[SessionStore-KV] DEBUG: Final JSON string for ${key}:`, jsonString);

	// Set without TTL - sessions persist until manually deleted
	await kv.set(key, jsonString);

	// Invalidate SessionResolver cache since session data changed
	SessionResolver.invalidateCache();

	console.log(`[SessionStore-KV] Successfully saved ${platform} session: ${internalId}`);
}

/**
 * Get session data for a specific platform under an internal session ID.
 */
export async function getPlatformSession(internalId: string, platform: string): Promise<PlatformSessionData | undefined> {
	const key = `session:${internalId}:${platform}`;
	const data = await kv.get(key);

	if (!data) {
		console.log(`[SessionStore-KV] DEBUG: No data found for key: ${key}`);
		return undefined;
	}

	console.log(`[SessionStore-KV] DEBUG: Raw data retrieved for ${key}:`, typeof data, data);

	try {
		// Handle both cases: string (needs parsing) or already parsed object
		let parsed: PlatformSessionData;
		if (typeof data === 'string') {
			parsed = JSON.parse(data);
			console.log(`[SessionStore-KV] DEBUG: Parsed JSON string for ${key}:`, parsed);
		} else if (typeof data === 'object' && data !== null) {
			parsed = data as PlatformSessionData;
			console.log(`[SessionStore-KV] DEBUG: Using already-parsed object for ${key}:`, parsed);
		} else {
			throw new Error(`Unexpected data type: ${typeof data}`);
		}

		return parsed;
	} catch (error) {
		console.error(`[SessionStore-KV] Error processing session data for ${key}:`, error);
		console.error(`[SessionStore-KV] Raw data that failed to process:`, data);
		return undefined;
	}
}

/**
 * Get all session data for an internal session ID.
 */
export async function getSession(internalId: string): Promise<SessionData | undefined> {
	const pattern = `session:${internalId}:*`;
	const keys = await kv.keys(pattern);

	console.log(`[SessionStore-KV] DEBUG: getSession called for ${internalId}, found ${keys.length} keys:`, keys);

	if (keys.length === 0) {
		return undefined;
	}

	const sessionData: SessionData = {};

	for (const key of keys) {
		const data = await kv.get(key);
		console.log(`[SessionStore-KV] DEBUG: Raw data from KV for ${key}:`, typeof data, data);

		if (data) {
			try {
				const platform = key.split(':')[2]; // Extract platform from key

				// Handle both cases: string (needs parsing) or already parsed object
				let parsedData: PlatformSessionData;
				if (typeof data === 'string') {
					parsedData = JSON.parse(data);
					console.log(`[SessionStore-KV] DEBUG: Parsed JSON string for ${key}:`, parsedData);
				} else if (typeof data === 'object' && data !== null) {
					parsedData = data as PlatformSessionData;
					console.log(`[SessionStore-KV] DEBUG: Using already-parsed object for ${key}:`, parsedData);
				} else {
					throw new Error(`Unexpected data type: ${typeof data}`);
				}

				sessionData[platform] = parsedData;
			} catch (error) {
				console.error(`[SessionStore-KV] Error processing session data for ${key}:`, error);
				console.error(`[SessionStore-KV] Raw data that failed to process:`, data);
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
		if (data) {
			try {
				const [, internalId, platform] = key.split(':');
				if (!sessions[internalId]) {
					sessions[internalId] = {};
				}

				// Handle both cases: string (needs parsing) or already parsed object
				let parsedData: PlatformSessionData;
				if (typeof data === 'string') {
					parsedData = JSON.parse(data);
				} else if (typeof data === 'object' && data !== null) {
					parsedData = data as PlatformSessionData;
				} else {
					throw new Error(`Unexpected data type: ${typeof data}`);
				}

				sessions[internalId][platform] = parsedData;
			} catch (error) {
				console.error(`[SessionStore-KV] Error processing session data for ${key}:`, error);
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

	// Invalidate SessionResolver cache since session data changed
	SessionResolver.invalidateCache();

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

		// Invalidate SessionResolver cache since session data changed
		SessionResolver.invalidateCache();

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
