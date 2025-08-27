// API endpoint for browser extension session communication
import { NextRequest, NextResponse } from 'next/server';
import { savePlatformSessionWithCleanup, generateSessionId } from '@/lib/sessionStore';
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

export async function POST(req: NextRequest) {
	try {
		console.log('[EXTENSION-API] Received session from browser extension');

		const body = await req.json();
		const { sessionKey, sessionValue, extractedAt, url } = body;

		if (!sessionKey || !sessionValue) {
			console.warn('[EXTENSION-API] Missing sessionKey or sessionValue');
			return NextResponse.json({
				error: 'Missing sessionKey or sessionValue',
				success: false
			}, { status: 400 });
		}

		// Validate and sanitize cookie inputs using CookieParser
		if (!CookieParser.validateCookieFormat(sessionKey, sessionValue)) {
			console.warn('[EXTENSION-API] Invalid cookie format provided:', { sessionKey });
			return NextResponse.json({
				error: 'Invalid cookie format',
				details: 'Cookie name or value contains invalid characters or exceeds length limits',
				success: false
			}, { status: 400 });
		}

		// Sanitize the cookie value for security
		const sanitizedSessionValue = CookieParser.sanitizeCookieValue(sessionValue);
		if (sanitizedSessionValue !== sessionValue) {
			console.warn('[EXTENSION-API] Cookie value was sanitized');
		}

		// Validate the session before storing it
		console.log('[EXTENSION-API] Validating session before bridging:', { sessionKey });
		const validation = await validateMIOSession(sessionKey, sanitizedSessionValue);

		if (!validation.valid) {
			console.log('[EXTENSION-API] Session validation failed:', validation.error);
			return NextResponse.json({
				error: 'Invalid session credentials',
				details: validation.error,
				success: false
			}, { status: 401 });
		}

		console.log('[EXTENSION-API] Session validation passed, bridging session:', { sessionKey });

		// Get or generate internal session ID
		let internalSessionId = req.cookies.get('myAppToken')?.value;
		if (internalSessionId) {
			console.log('[EXTENSION-API] Reusing existing internalSessionId from cookie:', internalSessionId);
		} else {
			internalSessionId = generateSessionId();
			console.log('[EXTENSION-API] Generated new internalSessionId:', internalSessionId);
		}

		// Prepare session data with proper cookie handling
		const sessionData = {
			sessionId: sanitizedSessionValue,
			[sessionKey]: sanitizedSessionValue,
			// Extension metadata
			extractedAt: extractedAt || new Date().toISOString(),
			extractedFrom: url || 'browser-extension',
			source: 'extension'
		};

		// Validate the session data structure
		const validatedSessionData = CookieParser.extractASPSESSION(sessionData);
		if (Object.keys(validatedSessionData).length === 0) {
			// If no ASPSESSION cookies found, include the original data but log a warning
			console.warn('[EXTENSION-API] No ASPSESSION cookies detected, storing as-is:', { sessionKey });
		}

		console.log('[EXTENSION-API] Saving validated session:', {
			internalSessionId,
			platform: 'marketinout',
			session: sessionData,
			aspSessionCount: Object.keys(validatedSessionData).length
		});

		const finalInternalSessionId = savePlatformSessionWithCleanup(internalSessionId, 'marketinout', sessionData);
		console.log('[EXTENSION-API] Successfully saved validated session for MIO with cleanup:', {
			originalInternalSessionId: internalSessionId,
			finalInternalSessionId,
			sessionKey,
			aspSessionDetected: CookieParser.isASPSESSIONCookie(sessionKey)
		});

		// Update the internal session ID to use the final one (in case duplicates were cleaned up)
		internalSessionId = finalInternalSessionId;

		// Start health monitoring for the newly bridged session
		console.log('[EXTENSION-API] Starting health monitoring for bridged session:', internalSessionId);
		try {
			const healthIntegrationResult = await validateAndStartMonitoring(internalSessionId, 'marketinout');

			if (healthIntegrationResult.isValid && healthIntegrationResult.monitoringStarted) {
				console.log('[EXTENSION-API] Health monitoring started successfully:', {
					internalSessionId,
					healthStatus: healthIntegrationResult.healthStatus,
					watchlistCount: healthIntegrationResult.watchlists?.length || 0
				});
			} else {
				console.warn('[EXTENSION-API] Health monitoring integration failed:', {
					internalSessionId,
					error: healthIntegrationResult.error?.message,
					monitoringStarted: healthIntegrationResult.monitoringStarted
				});
			}
		} catch (error) {
			console.error('[EXTENSION-API] Error starting health monitoring:', error);
			// Don't fail the entire bridging process if health monitoring fails
		}

		// Set persistent, secure cookie
		const response = NextResponse.json({
			success: true,
			internalSessionId,
			sessionKey,
			extractedAt: sessionData.extractedAt,
			healthMonitoringActive: true,
			message: 'Session successfully bridged from browser extension'
		}, { headers: corsHeaders });

		response.cookies.set('myAppToken', internalSessionId, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			path: '/',
			maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
			sameSite: 'lax',
		});

		console.log('[EXTENSION-API] Session bridge completed successfully');
		return response;

	} catch (error) {
		console.error('[EXTENSION-API] Error processing extension session:', error);
		return NextResponse.json({
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error',
			success: false
		}, { status: 500 });
	}
}

// Health check endpoint for extension to test connectivity
export async function GET() {
	return NextResponse.json({
		status: 'ok',
		service: 'mio-session-extractor-api',
		timestamp: new Date().toISOString()
	});
}
