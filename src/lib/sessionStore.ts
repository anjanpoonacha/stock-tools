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

// Import KV functions dynamically with caching
let kvStore: typeof import('./sessionStore.kv') | null = null;

async function withKVStore<T>(operation: (kv: typeof import('./sessionStore.kv')) => Promise<T>): Promise<T> {
	if (!kvStore && USE_VERCEL_KV) {
		try {
			kvStore = await import('./sessionStore.kv');
		} catch (error) {
			throw new Error('KV store is required but failed to load. Check your KV configuration.');
		}
	}
	if (!kvStore) {
		throw new Error('KV store is not available. Check your KV configuration in .env file.');
	}
	return operation(kvStore);
}

// Session data operations
export const savePlatformSession = (internalId: string, platform: string, data: PlatformSessionData) =>
	withKVStore(kv => kv.savePlatformSession(internalId, platform, data));

export const getPlatformSession = (internalId: string, platform: string): Promise<PlatformSessionData | undefined> =>
	withKVStore(kv => kv.getPlatformSession(internalId, platform));

export const getSession = (internalId: string): Promise<SessionData | undefined> =>
	withKVStore(kv => kv.getSession(internalId));

export const updatePlatformSession = (internalId: string, platform: string, updates: Partial<PlatformSessionData>) =>
	withKVStore(kv => kv.updatePlatformSession(internalId, platform, updates));

export const savePlatformSessionWithCleanup = (internalId: string, platform: string, data: PlatformSessionData): Promise<string> =>
	withKVStore(kv => kv.savePlatformSessionWithCleanup(internalId, platform, data));

// Session ID generation
/**
 * Generate a secure random internal session ID.
 * @deprecated Use generateDeterministicSessionId for user-scoped sessions
 */
export function generateSessionId(): string {
	return crypto.randomUUID();
}

export const generateDeterministicSessionId = (userEmail: string, userPassword: string, platform: string): Promise<string> =>
	withKVStore(kv => kv.generateDeterministicSessionId(userEmail, userPassword, platform));

// Session deletion operations
export const deletePlatformSession = (internalId: string, platform: string): Promise<void> =>
	withKVStore(kv => kv.deletePlatformSession(internalId, platform));

export const deleteSession = (internalId: string): Promise<void> =>
	withKVStore(kv => kv.deleteSession(internalId));
