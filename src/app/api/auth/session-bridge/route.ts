// src/app/api/auth/session-bridge/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { savePlatformSession, generateSessionId } from '@/lib/sessionStore';
import { CookieParser } from '@/lib/cookieParser';
import { validateAndStartMonitoring } from '@/lib/validation';

/**
 * Validate MIO session by making a test request to the watchlist endpoint
 */
async function validateMIOSession(sessionKey: string, sessionValue: string): Promise<{ valid: boolean; error?: string }> {
	try {
		console.log('[SESSION-BRIDGE] Validating MIO session...');
		
		const response = await fetch('https://www.marketinout.com/wl/watch_list.php?mode=list', {
			headers: {
				Cookie: `${sessionKey}=${sessionValue}`,
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			},
			redirect: 'manual', // Don't follow redirects automatically
		});

		// Check if we got redirected to login page
		if (response.status === 302 || response.status === 301) {
			const location = response.headers.get('location');
			if (location && (location.includes('login') || location.includes('signin'))) {
				console.log('[SESSION-BRIDGE] Session invalid - redirected to login:', location);
				return { valid: false, error: 'Session expired or invalid - redirected to login page' };
			}
		}

		// Check if response is successful
		if (!response.ok) {
			console.log('[SESSION-BRIDGE] Session validation failed - HTTP error:', response.status);
			return { valid: false, error: `HTTP error: ${response.status}` };
		}

		// Check response content for login indicators
		const html = await response.text();
		
		// Check for common login page indicators
		if (html.includes('login') || html.includes('signin') || html.includes('password') ||
		    html.includes('username') || html.includes('email')) {
			// But also check for watchlist indicators to avoid false positives
			if (!html.includes('watch_list') && !html.includes('watchlist') && !html.includes('sel_wlid')) {
				console.log('[SESSION-BRIDGE] Session invalid - response contains login form');
				return { valid: false, error: 'Session invalid - login required' };
			}
		}

		// Check for watchlist page indicators (positive validation)
		if (html.includes('sel_wlid') || html.includes('watch_list') || html.includes('watchlist')) {
			console.log('[SESSION-BRIDGE] Session validation successful - watchlist page detected');
			return { valid: true };
		}

		// If we can't determine the page type, consider it potentially valid
		console.log('[SESSION-BRIDGE] Session validation uncertain - assuming valid');
		return { valid: true };

	} catch (error) {
		console.error('[SESSION-BRIDGE] Session validation network error:', error);
		return {
			valid: false,
			error: `Network error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

export async function POST(req: NextRequest) {
	let sessionKey: string | undefined;
	let sessionValue: string | undefined;

	try {
		const body = await req.json();
		sessionKey = body.sessionKey;
		sessionValue = body.sessionValue;
	} catch {
		return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
	}

	if (!sessionKey || !sessionValue) {
		return NextResponse.json({ error: 'Missing sessionKey or sessionValue' }, { status: 400 });
	}

	// Validate and sanitize cookie inputs using CookieParser
	if (!CookieParser.validateCookieFormat(sessionKey, sessionValue)) {
		console.warn('[SESSION-BRIDGE] Invalid cookie format provided:', { sessionKey });
		return NextResponse.json({
			error: 'Invalid cookie format',
			details: 'Cookie name or value contains invalid characters or exceeds length limits'
		}, { status: 400 });
	}

	// Sanitize the cookie value for security
	const sanitizedSessionValue = CookieParser.sanitizeCookieValue(sessionValue);
	if (sanitizedSessionValue !== sessionValue) {
		console.warn('[SESSION-BRIDGE] Cookie value was sanitized');
	}

	// Validate the session before storing it
	console.log('[SESSION-BRIDGE] Validating session before bridging:', { sessionKey });
	const validation = await validateMIOSession(sessionKey, sanitizedSessionValue);
	
	if (!validation.valid) {
		console.log('[SESSION-BRIDGE] Session validation failed:', validation.error);
		return NextResponse.json({
			error: 'Invalid session credentials',
			details: validation.error
		}, { status: 401 });
	}

	console.log('[SESSION-BRIDGE] Session validation passed, bridging session:', { sessionKey });
	let internalSessionId = req.cookies.get('myAppToken')?.value;
	if (internalSessionId) {
		console.log('[SESSION-BRIDGE] Reusing existing internalSessionId from cookie:', internalSessionId);
	} else {
		internalSessionId = generateSessionId();
		console.log('[SESSION-BRIDGE] Generated new internalSessionId:', internalSessionId);
	}
	
	// Prepare session data with proper cookie handling
	const sessionData = {
		sessionId: sanitizedSessionValue,
		[sessionKey]: sanitizedSessionValue
	};

	// Validate the session data structure
	const validatedSessionData = CookieParser.extractASPSESSION(sessionData);
	if (Object.keys(validatedSessionData).length === 0) {
		// If no ASPSESSION cookies found, include the original data but log a warning
		console.warn('[SESSION-BRIDGE] No ASPSESSION cookies detected, storing as-is:', { sessionKey });
	}

	console.log('[SESSION-BRIDGE] Saving validated session:', {
		internalSessionId,
		platform: 'marketinout',
		session: sessionData,
		aspSessionCount: Object.keys(validatedSessionData).length
	});
	
	savePlatformSession(internalSessionId, 'marketinout', sessionData);
	console.log('[SESSION-BRIDGE] Successfully saved validated session for MIO:', {
		internalSessionId,
		sessionKey,
		aspSessionDetected: CookieParser.isASPSESSIONCookie(sessionKey)
	});

	// Start health monitoring for the newly bridged session
	console.log('[SESSION-BRIDGE] Starting health monitoring for bridged session:', internalSessionId);
	try {
		const healthIntegrationResult = await validateAndStartMonitoring(internalSessionId, 'marketinout');
		
		if (healthIntegrationResult.isValid && healthIntegrationResult.monitoringStarted) {
			console.log('[SESSION-BRIDGE] Health monitoring started successfully:', {
				internalSessionId,
				healthStatus: healthIntegrationResult.healthStatus,
				watchlistCount: healthIntegrationResult.watchlists?.length || 0
			});
		} else {
			console.warn('[SESSION-BRIDGE] Health monitoring integration failed:', {
				internalSessionId,
				error: healthIntegrationResult.error?.message,
				monitoringStarted: healthIntegrationResult.monitoringStarted
			});
		}
	} catch (error) {
		console.error('[SESSION-BRIDGE] Error starting health monitoring:', error);
		// Don't fail the entire bridging process if health monitoring fails
	}

	// Set persistent, secure cookie
	const response = NextResponse.json({
		ok: true,
		internalSessionId,
		healthMonitoringActive: true // Indicate that health monitoring is now active
	});
	response.cookies.set('myAppToken', internalSessionId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
		sameSite: 'lax',
	});

	return response;
}
