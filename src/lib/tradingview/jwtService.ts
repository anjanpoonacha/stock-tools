/**
 * TradingView JWT Token Service
 * 
 * Extracts data access JWT token from TradingView chart page HTML
 * Caches tokens to avoid repeated scraping
 */

import { kv } from '@vercel/kv';

const CHART_URL = 'https://www.tradingview.com/chart/S09yY40x/';
const TOKEN_CACHE_TTL = 840; // 14 minutes (1 min buffer before 15-min expiry)
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

interface TokenCacheEntry {
	token: string;
	expiresAt: number;
	userId: number;
}

/**
 * Get data access JWT token for TradingView WebSocket
 * 
 * @param sessionId TradingView sessionid cookie
 * @param sessionIdSign TradingView sessionid_sign cookie (REQUIRED)
 * @param userId TradingView user ID
 * @returns JWT token with NSE data access permission
 */
export async function getDataAccessToken(
	sessionId: string,
	sessionIdSign: string,
	userId: number
): Promise<string> {
	// Check cache first
	const cacheKey = `tv:jwt:${userId}`;
	
	try {
		const cached = await kv.get<TokenCacheEntry>(cacheKey);
		if (cached && cached.expiresAt > Date.now() / 1000) {
			return cached.token;
		}
	} catch (error) {
	}
	
	
	// Build cookie header with BOTH cookies (critical!)
	const cookies = `sessionid=${sessionId}; sessionid_sign=${sessionIdSign}`;
	
	// Fetch chart page HTML
	const response = await fetch(CHART_URL, {
		headers: {
			'Cookie': cookies,
			'User-Agent': USER_AGENT,
			'Accept': 'text/html,application/xhtml+xml',
		},
	});
	
	if (!response.ok) {
		throw new Error(`Failed to fetch chart page: ${response.status} ${response.statusText}`);
	}
	
	const html = await response.text();
	
	// Extract JWT token from HTML
	// Token is embedded as: window.initData = {..., "auth_token": "eyJhbGci..."}
	const match = html.match(/auth_token":"([^"]+)"/);
	
	if (!match || !match[1]) {
		throw new Error('Failed to extract JWT token from chart page. Session may be invalid.');
	}
	
	const token = match[1];
	
	// Validate token format
	if (!token.startsWith('eyJ')) {
		throw new Error('Invalid JWT token format');
	}
	
	// Decode and validate payload
	try {
		const payloadBase64 = token.split('.')[1];
		const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
		
		// Validate has NSE permission (required for NSE stocks)
		if (!payload.perm || !payload.perm.includes('nse')) {
			throw new Error('Token does not have NSE data access permission. Upgrade to Pro account or check permissions.');
		}
		
		// Validate not expired
		if (payload.exp && payload.exp < Date.now() / 1000) {
			throw new Error('Token is already expired');
		}
		
		
		// Cache the token
		try {
			await kv.set<TokenCacheEntry>(cacheKey, {
				token,
				expiresAt: payload.exp,
				userId: payload.user_id
			}, { ex: TOKEN_CACHE_TTL });
		} catch (error) {
		}
		
		return token;
		
	} catch (error) {
		if (error instanceof Error && error.message.includes('permission')) {
			throw error;
		}
		throw new Error('Failed to decode JWT token: ' + (error instanceof Error ? error.message : String(error)));
	}
}

/**
 * Invalidate cached JWT token for a user
 * 
 * @param userId TradingView user ID
 */
export async function invalidateToken(userId: number): Promise<void> {
	const cacheKey = `tv:jwt:${userId}`;
	try {
		await kv.del(cacheKey);
	} catch (error) {
	}
}
