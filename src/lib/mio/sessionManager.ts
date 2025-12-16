// src/lib/mio/sessionManager.ts

import { getPlatformSession } from '../sessionStore';
import { CookieParser } from '../cookies';
import {
	ErrorHandler,
	Platform,
	ErrorLogger
} from '../errors';
import { SessionHealthMonitor } from '../health';
import { getHealthAwareSessionData } from '../validation';
import type { SessionKeyValue, SessionData } from './types';
import { MIO_URLS as URLS, LOGIN_INDICATORS as LOGIN_CHECKS } from './types';

/**
 * Session Manager - Handles session extraction, cookie parsing, and validation
 */
export class SessionManager {
	/**
	 * Retrieve the session key and value for MIO from the session store.
	 * Uses robust ASPSESSION detection from CookieParser and health-aware session data.
	 */
	static async getSessionKeyValue(internalSessionId: string): Promise<SessionKeyValue | undefined> {
		try {
			// Use health-aware session data retrieval
			const healthAwareResult = await getHealthAwareSessionData(internalSessionId);

			if (!healthAwareResult.sessionExists) {
				return undefined;
			}

			// Get the actual session data from session store
			const session = await getPlatformSession(internalSessionId, 'marketinout');
			if (!session) {
				return undefined;
			}

			// Use CookieParser to extract ASPSESSION cookies
			const aspSessions = session.session ? CookieParser.extractASPSESSION(session.session) : {};
			const primaryASPSession = CookieParser.getPrimaryASPSESSION(aspSessions);

			if (primaryASPSession) {
				return primaryASPSession;
			}

			// Fallback to any key that is not 'sessionId'
			const key = Object.keys(session).find((k) => k !== 'sessionId');
			if (key && session[key]) {
				return { key, value: session[key] };
			}

			return undefined;
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'getSessionKeyValue',
				undefined,
				undefined
			);
			ErrorLogger.logError(sessionError);
			return undefined;
		}
	}

	/**
	 * Extract session cookies from response Set-Cookie headers.
	 * Uses robust cookie parsing with comprehensive ASPSESSION detection.
	 */
	static extractSessionFromResponse(response: Response): SessionData | null {
		try {
			const setCookieHeaders = response.headers.get('set-cookie');
			if (!setCookieHeaders) {
				return null;
			}

			// Use CookieParser for robust parsing
			const parseResult = CookieParser.parseSetCookieHeader(setCookieHeaders);

			// Extract all ASPSESSION cookies
			const aspSessionCookies = CookieParser.extractASPSESSION(parseResult.aspSessionCookies);

			if (Object.keys(aspSessionCookies).length > 0) {
				return aspSessionCookies;
			}

			// Also check for other session-related cookies in the full cookie list
			const allCookies: SessionData = {};
			for (const cookie of parseResult.cookies) {
				// Include ASPSESSION and other potentially relevant cookies
				if (CookieParser.isASPSESSIONCookie(cookie.name) ||
					cookie.name.toLowerCase().includes('session') ||
					cookie.name.toLowerCase().includes('auth')) {
					allCookies[cookie.name] = cookie.value;
				}
			}

			const hasSessionData = Object.keys(allCookies).length > 0;
			return hasSessionData ? allCookies : null;
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'extractSessionFromResponse',
				undefined,
				response.url
			);
			ErrorLogger.logError(sessionError);
			console.error('[SessionManager] Failed to extract session from response:', error);
			return null;
		}
	}

	/**
	 * Validate if a session is still healthy by making a lightweight test request.
	 * Uses the watchlist page as it's a simple authenticated endpoint.
	 */
	static async validateSessionHealth(internalSessionId: string): Promise<boolean> {
		try {
			const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'validateSessionHealth',
					internalSessionId
				);
				ErrorLogger.logError(error);
				return false;
			}

			const res = await fetch(URLS.WATCHLIST_PAGE, {
				method: 'HEAD', // Use HEAD for lightweight check
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			// Check if we get a successful response or redirect (both indicate valid session)
			const isHealthy = res.ok || res.status === 302;

			if (!isHealthy) {
				const error = ErrorHandler.parseError(
					`Session health check failed with status ${res.status}`,
					Platform.MARKETINOUT,
					'validateSessionHealth',
					res.status,
					res.url
				);
				ErrorLogger.logError(error);
			}

			return isHealthy;
		} catch (error) {
			const sessionError = ErrorHandler.createNetworkError(
				Platform.MARKETINOUT,
				'validateSessionHealth',
				error instanceof Error ? error : new Error(String(error)),
				URLS.WATCHLIST_PAGE
			);
			ErrorLogger.logError(sessionError);
			console.error('[SessionManager] Session health check failed:', error);
			return false;
		}
	}

	/**
	 * Refresh session by making a test request and updating session cookies if they change.
	 * Now uses health-integrated refresh with automatic health monitoring updates.
	 * Returns true if session was refreshed successfully, false if session is invalid.
	 */
	static async refreshSession(internalSessionId: string): Promise<boolean> {
		try {
			const sessionKeyValue = await SessionManager.getSessionKeyValue(internalSessionId);
			if (!sessionKeyValue) {
				return false;
			}

			// Directly perform the refresh logic without circular dependency
			const res = await fetch(URLS.WATCHLIST_PAGE, {
				method: 'HEAD',
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			const isRefreshed = res.ok || res.status === 302;
			return isRefreshed;
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'refreshSession',
				undefined,
				undefined
			);
			ErrorLogger.logError(sessionError);
			return false;
		}
	}

	/**
	 * Check if HTML content indicates a login page (session expired)
	 */
	static isLoginPage(html: string): boolean {
		return LOGIN_CHECKS.some(indicator => html.includes(indicator));
	}

	/**
	 * Update health monitor after a successful operation
	 */
	static async updateHealthMonitor(internalSessionId: string): Promise<void> {
		const monitor = SessionHealthMonitor.getInstance();
		try {
			await monitor.checkSessionHealth(internalSessionId, 'marketinout');
		} catch (error) {
			// Silently handle health monitor update failures
		}
	}
}
