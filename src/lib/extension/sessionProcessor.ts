// Session validation, processing, and storage logic for browser extension
import { savePlatformSessionWithCleanup, generateSessionId, PlatformSessionData } from '@/lib/sessionStore';
import { CookieParser } from '@/lib/cookies';
import { validateAndStartMonitoring } from '@/lib/validation';

// Platform detection constants
export const PLATFORMS = {
	MARKETINOUT: 'marketinout',
	TRADINGVIEW: 'tradingview',
	UNKNOWN: 'unknown'
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

/**
 * Get current timestamp in India timezone
 */
export function getIndiaTimestamp(): string {
	return new Date().toLocaleString('en-IN', {
		timeZone: 'Asia/Kolkata',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});
}

/**
 * Detect platform from URL or session key
 */
export function detectPlatform(url?: string, sessionKey?: string): Platform {
	if (url) {
		if (url.includes('marketinout.com')) return PLATFORMS.MARKETINOUT;
		if (url.includes('tradingview.com')) return PLATFORMS.TRADINGVIEW;
	}

	if (sessionKey) {
		if (sessionKey.startsWith('ASPSESSION') || sessionKey.includes('ASP')) return PLATFORMS.MARKETINOUT;
		if (sessionKey === 'sessionid' || sessionKey.includes('tv')) return PLATFORMS.TRADINGVIEW;
	}

	return PLATFORMS.UNKNOWN;
}

/**
 * Validate MIO session by making a test request to the watchlist endpoint
 */
async function validateMIOSession(sessionKey: string, sessionValue: string): Promise<{ valid: boolean; error?: string }> {
	try {

		const response = await fetch('https://www.marketinout.com/wl/watch_list.php?mode=list', {
			headers: {
				Cookie: `${sessionKey}=${sessionValue}`,
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			},
			redirect: 'manual',
		});

		// Check if we got redirected to login page
		if (response.status === 302 || response.status === 301) {
			const location = response.headers.get('location');
			if (location && (location.includes('login') || location.includes('signin'))) {
				return { valid: false, error: 'Session expired or invalid - redirected to login page' };
			}
		}

		// Check if response is successful
		if (!response.ok) {
			return { valid: false, error: `HTTP error: ${response.status}` };
		}

		// Check response content for login indicators
		const html = await response.text();

		// Check for common login page indicators
		if (html.includes('login') || html.includes('signin') || html.includes('password') ||
			html.includes('username') || html.includes('email')) {
			// But also check for watchlist indicators to avoid false positives
			if (!html.includes('watch_list') && !html.includes('watchlist') && !html.includes('sel_wlid')) {
				return { valid: false, error: 'Session invalid - login required' };
			}
		}

		// Check for watchlist page indicators (positive validation)
		if (html.includes('sel_wlid') || html.includes('watch_list') || html.includes('watchlist')) {
			return { valid: true };
		}

		// If we can't determine the page type, consider it potentially valid
		return { valid: true };

	} catch (error) {
		return {
			valid: false,
			error: `Network error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Validate TradingView session by making a test request to a protected endpoint
 */
async function validateTradingViewSession(sessionKey: string, sessionValue: string): Promise<{ valid: boolean; error?: string }> {
	try {

		// TradingView uses different validation approach - check user profile or watchlist
		const response = await fetch('https://www.tradingview.com/api/v1/user/', {
			headers: {
				Cookie: `${sessionKey}=${sessionValue}`,
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
				'Accept': 'application/json',
			},
			redirect: 'manual',
		});

		// Check if we got redirected to login page
		if (response.status === 302 || response.status === 301) {
			const location = response.headers.get('location');
			if (location && (location.includes('login') || location.includes('signin'))) {
				return { valid: false, error: 'Session expired or invalid - redirected to login page' };
			}
		}

		// Check if response is successful
		if (!response.ok) {
			// For TradingView, we'll be more lenient as their API might be restrictive
			if (response.status === 403 || response.status === 401) {
				return { valid: false, error: 'Session invalid - authentication required' };
			}
			// Other errors might be temporary, so we'll assume valid
			return { valid: true };
		}

		try {
			const data = await response.json();
			// Check if we got user data (indicates valid session)
			if (data && (data.id || data.username || data.user)) {
				return { valid: true };
			}
		} catch {
			// If JSON parsing fails, check response text
			const text = await response.text();
			if (text.includes('login') || text.includes('signin')) {
				return { valid: false, error: 'Session invalid - login required' };
			}
		}

		// If we can't determine the session validity, assume it's valid
		return { valid: true };

	} catch (error) {
		return {
			valid: false,
			error: `Network error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Validate session based on platform
 */
export async function validateSession(platform: Platform, sessionKey: string, sessionValue: string): Promise<{ valid: boolean; error?: string }> {
	switch (platform) {
		case PLATFORMS.MARKETINOUT:
			return validateMIOSession(sessionKey, sessionValue);
		case PLATFORMS.TRADINGVIEW:
			return validateTradingViewSession(sessionKey, sessionValue);
		default:
			return { valid: true }; // Allow unknown platforms for now
	}
}

/**
 * Process and store session data
 */
export interface SessionProcessRequest {
	sessionKey: string;
	sessionValue: string;
	extractedAt?: string;
	url?: string;
	platform?: string;
	userEmail: string;
	userPassword: string;
	existingSessionId?: string;
	// TradingView-specific: sessionid_sign cookie (required for JWT token)
	sessionid_sign?: string;
}

export interface SessionProcessResult {
	success: boolean;
	internalSessionId?: string;
	sessionKey?: string;
	platform?: Platform;
	extractedAt?: string;
	healthMonitoringActive?: boolean;
	error?: string;
	details?: string;
	status: number;
}

export async function processAndStoreSession(request: SessionProcessRequest): Promise<SessionProcessResult> {
	const { sessionKey, sessionValue, extractedAt, url, platform: providedPlatform, userEmail, userPassword, existingSessionId, sessionid_sign } = request;

	// Validate required fields
	if (!userEmail || !userPassword) {
		return {
			success: false,
			error: 'Authentication required',
			details: 'User email and password required to submit session data',
			status: 401
		};
	}


	if (!sessionKey || !sessionValue) {
		return {
			success: false,
			error: 'Missing sessionKey or sessionValue',
			status: 400
		};
	}

	// Detect platform from URL and session key
	const detectedPlatform = detectPlatform(url, sessionKey);
	const platform = (providedPlatform as Platform) || detectedPlatform;


	// Validate and sanitize cookie inputs using CookieParser
	if (!CookieParser.validateCookieFormat(sessionKey, sessionValue)) {
		return {
			success: false,
			error: 'Invalid cookie format',
			details: 'Cookie name or value contains invalid characters or exceeds length limits',
			status: 400
		};
	}

	// Sanitize the cookie value for security
	const sanitizedSessionValue = CookieParser.sanitizeCookieValue(sessionValue);
	if (sanitizedSessionValue !== sessionValue) {
	}

	// Validate the session before storing it using platform-specific validation
	const validation = await validateSession(platform, sessionKey, sanitizedSessionValue);

	if (!validation.valid) {
		return {
			success: false,
			error: 'Invalid session credentials',
			details: validation.error,
			platform,
			status: 401
		};
	}


	// Get or generate internal session ID
	let internalSessionId = existingSessionId;
	if (internalSessionId) {
	} else {
		internalSessionId = generateSessionId();
	}

	// Prepare session data with proper cookie handling
	const sessionData: PlatformSessionData = {
		sessionId: sanitizedSessionValue,
		[sessionKey]: sanitizedSessionValue,
		// Extension metadata
		extractedAt: extractedAt || new Date().toISOString(),
		extractedFrom: url || 'browser-extension',
		source: 'extension',
		platform: platform as string,
		// User credentials for identification
		userEmail: userEmail,
		userPassword: userPassword,
		// TradingView-specific: sessionid_sign cookie (required for JWT data access token)
		...(sessionid_sign && platform === PLATFORMS.TRADINGVIEW ? { sessionid_sign } : {})
	};

	// Platform-specific session data validation
	let validatedSessionData = {};
	if (platform === PLATFORMS.MARKETINOUT) {
		// Convert PlatformSessionData to the format expected by CookieParser
		const cookieData: { [key: string]: string } = {};
		for (const [key, value] of Object.entries(sessionData)) {
			if (value !== undefined && typeof value === 'string') {
				cookieData[key] = value;
			}
		}
		validatedSessionData = CookieParser.extractASPSESSION(cookieData);
		if (Object.keys(validatedSessionData).length === 0) {
		}
	} else if (platform === PLATFORMS.TRADINGVIEW) {
		// TradingView uses different session structure, store as-is
		validatedSessionData = sessionData;
	}


	const finalInternalSessionId = await savePlatformSessionWithCleanup(internalSessionId, platform as string, sessionData);

	// Update the internal session ID to use the final one (in case duplicates were cleaned up)
	internalSessionId = finalInternalSessionId;

	// Start health monitoring for the newly bridged session (currently only for MarketInOut)
	let healthMonitoringActive = false;
	if (platform === PLATFORMS.MARKETINOUT) {
		try {
			const healthIntegrationResult = await validateAndStartMonitoring(internalSessionId, platform as string);

			if (healthIntegrationResult.isValid && healthIntegrationResult.monitoringStarted) {
				healthMonitoringActive = true;
			} else {
			}
		} catch (error) {
			// Don't fail the entire bridging process if health monitoring fails
		}
	} else {
	}


	return {
		success: true,
		internalSessionId,
		sessionKey,
		platform,
		extractedAt: sessionData.extractedAt,
		healthMonitoringActive,
		status: 200
	};
}
