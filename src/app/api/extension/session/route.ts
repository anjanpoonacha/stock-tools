// API endpoint for multi-platform browser extension session communication
import { NextRequest, NextResponse } from 'next/server';
import { savePlatformSessionWithCleanup, generateSessionId, PlatformSessionData } from '@/lib/sessionStore';
import { CookieParser } from '@/lib/cookieParser';
import { validateAndStartMonitoring } from '@/lib/sessionValidation';

// CORS headers for extension requests
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400',
};

// Handle CORS preflight requests
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 200,
		headers: corsHeaders
	});
}

// Platform detection constants
const PLATFORMS = {
	MARKETINOUT: 'marketinout',
	TRADINGVIEW: 'tradingview',
	UNKNOWN: 'unknown'
} as const;

type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

/**
 * Detect platform from URL or session key
 */
function detectPlatform(url?: string, sessionKey?: string): Platform {
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
		console.log('[EXTENSION-API] Validating MIO session from extension...');

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
				console.log('[EXTENSION-API] Session invalid - redirected to login:', location);
				return { valid: false, error: 'Session expired or invalid - redirected to login page' };
			}
		}

		// Check if response is successful
		if (!response.ok) {
			console.log('[EXTENSION-API] Session validation failed - HTTP error:', response.status);
			return { valid: false, error: `HTTP error: ${response.status}` };
		}

		// Check response content for login indicators
		const html = await response.text();

		// Check for common login page indicators
		if (html.includes('login') || html.includes('signin') || html.includes('password') ||
			html.includes('username') || html.includes('email')) {
			// But also check for watchlist indicators to avoid false positives
			if (!html.includes('watch_list') && !html.includes('watchlist') && !html.includes('sel_wlid')) {
				console.log('[EXTENSION-API] Session invalid - response contains login form');
				return { valid: false, error: 'Session invalid - login required' };
			}
		}

		// Check for watchlist page indicators (positive validation)
		if (html.includes('sel_wlid') || html.includes('watch_list') || html.includes('watchlist')) {
			console.log('[EXTENSION-API] Session validation successful - watchlist page detected');
			return { valid: true };
		}

		// If we can't determine the page type, consider it potentially valid
		console.log('[EXTENSION-API] Session validation uncertain - assuming valid');
		return { valid: true };

	} catch (error) {
		console.error('[EXTENSION-API] Session validation network error:', error);
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
		console.log('[EXTENSION-API] Validating TradingView session from extension...');

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
				console.log('[EXTENSION-API] TradingView session invalid - redirected to login:', location);
				return { valid: false, error: 'Session expired or invalid - redirected to login page' };
			}
		}

		// Check if response is successful
		if (!response.ok) {
			console.log('[EXTENSION-API] TradingView session validation failed - HTTP error:', response.status);
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
				console.log('[EXTENSION-API] TradingView session validation successful - user data received');
				return { valid: true };
			}
		} catch {
			// If JSON parsing fails, check response text
			const text = await response.text();
			if (text.includes('login') || text.includes('signin')) {
				console.log('[EXTENSION-API] TradingView session invalid - login page detected');
				return { valid: false, error: 'Session invalid - login required' };
			}
		}

		// If we can't determine the session validity, assume it's valid
		console.log('[EXTENSION-API] TradingView session validation uncertain - assuming valid');
		return { valid: true };

	} catch (error) {
		console.error('[EXTENSION-API] TradingView session validation network error:', error);
		return {
			valid: false,
			error: `Network error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Validate session based on platform
 */
async function validateSession(platform: Platform, sessionKey: string, sessionValue: string): Promise<{ valid: boolean; error?: string }> {
	switch (platform) {
		case PLATFORMS.MARKETINOUT:
			return validateMIOSession(sessionKey, sessionValue);
		case PLATFORMS.TRADINGVIEW:
			return validateTradingViewSession(sessionKey, sessionValue);
		default:
			console.warn('[EXTENSION-API] Unknown platform, skipping validation:', platform);
			return { valid: true }; // Allow unknown platforms for now
	}
}

export async function POST(req: NextRequest) {
	try {
		console.log('[EXTENSION-API] Received session from multi-platform browser extension');

		const body = await req.json();
		const { sessionKey, sessionValue, extractedAt, url, platform: providedPlatform, userEmail, userPassword } = body;

		// SECURITY: Require user credentials for session submission
		if (!userEmail || !userPassword) {
			console.warn('[EXTENSION-API] Missing user credentials');
			return NextResponse.json({
				error: 'Authentication required',
				details: 'User email and password required to submit session data',
				success: false
			}, { status: 401, headers: corsHeaders });
		}

		console.log('[EXTENSION-API] User submitting session:', {
			userEmail,
			platform: providedPlatform
		});

		if (!sessionKey || !sessionValue) {
			console.warn('[EXTENSION-API] Missing sessionKey or sessionValue');
			return NextResponse.json({
				error: 'Missing sessionKey or sessionValue',
				success: false
			}, { status: 400, headers: corsHeaders });
		}

		// Detect platform from URL and session key
		const detectedPlatform = detectPlatform(url, sessionKey);
		const platform = providedPlatform || detectedPlatform;

		console.log('[EXTENSION-API] Platform detection:', {
			provided: providedPlatform,
			detected: detectedPlatform,
			final: platform,
			url,
			sessionKey
		});

		// Validate and sanitize cookie inputs using CookieParser
		if (!CookieParser.validateCookieFormat(sessionKey, sessionValue)) {
			console.warn('[EXTENSION-API] Invalid cookie format provided:', { sessionKey, platform });
			return NextResponse.json({
				error: 'Invalid cookie format',
				details: 'Cookie name or value contains invalid characters or exceeds length limits',
				success: false
			}, { status: 400, headers: corsHeaders });
		}

		// Sanitize the cookie value for security
		const sanitizedSessionValue = CookieParser.sanitizeCookieValue(sessionValue);
		if (sanitizedSessionValue !== sessionValue) {
			console.warn('[EXTENSION-API] Cookie value was sanitized for platform:', platform);
		}

		// Validate the session before storing it using platform-specific validation
		console.log('[EXTENSION-API] Validating session before bridging:', { sessionKey, platform });
		const validation = await validateSession(platform, sessionKey, sanitizedSessionValue);

		if (!validation.valid) {
			console.log('[EXTENSION-API] Session validation failed for platform:', platform, validation.error);
			return NextResponse.json({
				error: 'Invalid session credentials',
				details: validation.error,
				platform,
				success: false
			}, { status: 401, headers: corsHeaders });
		}

		console.log('[EXTENSION-API] Session validation passed, bridging session:', { sessionKey, platform });

		// Get or generate internal session ID
		let internalSessionId = req.cookies.get('myAppToken')?.value;
		if (internalSessionId) {
			console.log('[EXTENSION-API] Reusing existing internalSessionId from cookie:', internalSessionId);
		} else {
			internalSessionId = generateSessionId();
			console.log('[EXTENSION-API] Generated new internalSessionId:', internalSessionId);
		}

		// Prepare session data with proper cookie handling
		const sessionData: PlatformSessionData = {
			sessionId: sanitizedSessionValue,
			[sessionKey]: sanitizedSessionValue,
			// Extension metadata
			extractedAt: extractedAt || new Date().toISOString(),
			extractedFrom: url || 'browser-extension',
			source: 'extension',
			platform,
			// User credentials for identification
			userEmail: userEmail,
			userPassword: userPassword
		};

		// Platform-specific session data validation
		let validatedSessionData = {};
		if (platform === PLATFORMS.MARKETINOUT) {
			// Convert PlatformSessionData to the format expected by CookieParser
			const cookieData: { [key: string]: string } = {};
			for (const [key, value] of Object.entries(sessionData)) {
				if (value !== undefined) {
					cookieData[key] = value;
				}
			}
			validatedSessionData = CookieParser.extractASPSESSION(cookieData);
			if (Object.keys(validatedSessionData).length === 0) {
				console.warn('[EXTENSION-API] No ASPSESSION cookies detected for MarketInOut, storing as-is:', { sessionKey });
			}
		} else if (platform === PLATFORMS.TRADINGVIEW) {
			// TradingView uses different session structure, store as-is
			validatedSessionData = sessionData;
			console.log('[EXTENSION-API] TradingView session data prepared:', { sessionKey });
		}

		console.log('[EXTENSION-API] Saving validated session:', {
			internalSessionId,
			platform,
			userEmail,
			session: sessionData,
			validationCount: Object.keys(validatedSessionData).length
		});

		const finalInternalSessionId = savePlatformSessionWithCleanup(internalSessionId, platform, sessionData);
		console.log('[EXTENSION-API] Successfully saved validated session with cleanup:', {
			originalInternalSessionId: internalSessionId,
			finalInternalSessionId,
			sessionKey,
			platform,
			sessionDetected: platform === PLATFORMS.MARKETINOUT ? CookieParser.isASPSESSIONCookie(sessionKey) : true
		});

		// Update the internal session ID to use the final one (in case duplicates were cleaned up)
		internalSessionId = finalInternalSessionId;

		// Start health monitoring for the newly bridged session (currently only for MarketInOut)
		let healthMonitoringActive = false;
		if (platform === PLATFORMS.MARKETINOUT) {
			console.log('[EXTENSION-API] Starting health monitoring for MarketInOut session:', internalSessionId);
			try {
				const healthIntegrationResult = await validateAndStartMonitoring(internalSessionId, platform);

				if (healthIntegrationResult.isValid && healthIntegrationResult.monitoringStarted) {
					console.log('[EXTENSION-API] Health monitoring started successfully:', {
						internalSessionId,
						platform,
						healthStatus: healthIntegrationResult.healthStatus,
						watchlistCount: healthIntegrationResult.watchlists?.length || 0
					});
					healthMonitoringActive = true;
				} else {
					console.warn('[EXTENSION-API] Health monitoring integration failed:', {
						internalSessionId,
						platform,
						error: healthIntegrationResult.error?.message,
						monitoringStarted: healthIntegrationResult.monitoringStarted
					});
				}
			} catch (error) {
				console.error('[EXTENSION-API] Error starting health monitoring:', error);
				// Don't fail the entire bridging process if health monitoring fails
			}
		} else {
			console.log('[EXTENSION-API] Health monitoring not available for platform:', platform);
		}

		// Set persistent, secure cookie
		const response = NextResponse.json({
			success: true,
			internalSessionId,
			sessionKey,
			platform,
			extractedAt: sessionData.extractedAt,
			healthMonitoringActive,
			message: `Session successfully bridged from ${platform} browser extension`
		}, { headers: corsHeaders });

		response.cookies.set('myAppToken', internalSessionId, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			path: '/',
			maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
			sameSite: 'lax',
		});

		console.log('[EXTENSION-API] Multi-platform session bridge completed successfully:', { platform });
		return response;

	} catch (error) {
		console.error('[EXTENSION-API] Error processing multi-platform extension session:', error);
		return NextResponse.json({
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error',
			success: false
		}, { status: 500, headers: corsHeaders });
	}
}

// Health check endpoint for extension to test connectivity
export async function GET() {
	return NextResponse.json({
		status: 'ok',
		service: 'multi-platform-session-extractor-api',
		supportedPlatforms: Object.values(PLATFORMS).filter(p => p !== PLATFORMS.UNKNOWN),
		timestamp: new Date().toISOString()
	}, { headers: corsHeaders });
}
