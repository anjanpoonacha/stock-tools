/**
 * Session and JWT Token Cache
 * 
 * Caches session resolution and JWT tokens to avoid redundant lookups
 * during bulk chart data fetching.
 * 
 * Backend-only cache (runs in API routes, not in browser).
 */

interface CachedSession {
	sessionId: string;
	sessionIdSign: string;
	userId: number;
	timestamp: number;
}

interface CachedJWT {
	token: string;
	timestamp: number;
	expiresAt: number; // JWT expiration timestamp (seconds since epoch)
}

// In-memory cache (per-process, not shared across serverless instances)
const sessionCache = new Map<string, CachedSession>();
const jwtCache = new Map<string, CachedJWT>();

// Configuration
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const JWT_EXPIRY_BUFFER_SECONDS = 10 * 60; // 10 minutes buffer before JWT expires (in seconds)

/**
 * Get cached session for user
 */
export function getCachedSession(userEmail: string): CachedSession | null {
	const cached = sessionCache.get(userEmail);
	if (!cached) return null;

	const ageMs = Date.now() - cached.timestamp;
	if (ageMs > SESSION_TTL_MS) {
		sessionCache.delete(userEmail);
		return null;
	}

	return cached;
}

/**
 * Cache session for user
 */
export function cacheSession(
	userEmail: string,
	sessionId: string,
	sessionIdSign: string,
	userId: number
): void {
	sessionCache.set(userEmail, {
		sessionId,
		sessionIdSign,
		userId,
		timestamp: Date.now(),
	});
}

/**
 * Get cached JWT token for session
 * Checks if token will expire within buffer period (10 min)
 */
export function getCachedJWT(sessionId: string): string | null {
	const cached = jwtCache.get(sessionId);
	if (!cached) return null;

	// Calculate time until token expires
	const nowSeconds = Math.floor(Date.now() / 1000);
	const expiresInSeconds = cached.expiresAt - nowSeconds;
	
	// If token expires within buffer period, invalidate cache
	if (expiresInSeconds < JWT_EXPIRY_BUFFER_SECONDS) {
		jwtCache.delete(sessionId);
		return null;
	}

	const ageSeconds = Math.floor((Date.now() - cached.timestamp) / 1000);
	return cached.token;
}

/**
 * Cache JWT token for session
 * Dynamically extracts expiration from JWT payload and calculates TTL
 */
export function cacheJWT(sessionId: string, token: string): void {
	const nowSeconds = Math.floor(Date.now() / 1000);
	let expiresAt = nowSeconds + (15 * 60); // Default: 15 minutes
	
	try {
		// Decode JWT payload to extract expiration
		const parts = token.split('.');
		if (parts.length !== 3) {
			throw new Error('Invalid JWT format');
		}
		
		const payloadBase64 = parts[1];
		const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
		
		if (payload.exp && typeof payload.exp === 'number') {
			expiresAt = payload.exp;
			
			// Log token details
			const expiresInSeconds = expiresAt - nowSeconds;
			const cacheDuration = Math.max(0, expiresInSeconds - JWT_EXPIRY_BUFFER_SECONDS);
			
		} else {
		}
	} catch (err) {
	}

	jwtCache.set(sessionId, {
		token,
		timestamp: Date.now(),
		expiresAt,
	});
	
	const effectiveTTL = expiresAt - nowSeconds - JWT_EXPIRY_BUFFER_SECONDS;
}

/**
 * Clear all caches (for testing/debugging)
 */
export function clearCaches(): void {
	sessionCache.clear();
	jwtCache.clear();
}
