// API endpoint for multi-platform browser extension session communication
import { NextRequest, NextResponse } from 'next/server';
import {
	processAndStoreSession,
	PLATFORMS,
	type SessionProcessRequest
} from '@/lib/extension/sessionProcessor';

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

export async function POST(req: NextRequest) {
	try {
		console.log('[EXTENSION-API] Received session from multi-platform browser extension');

		const body = await req.json();
		const { sessionKey, sessionValue, extractedAt, url, platform, userEmail, userPassword } = body;

		// Get existing session ID from cookie
		const existingSessionId = req.cookies.get('myAppToken')?.value;

		// Process and store session using the processor
		const result = await processAndStoreSession({
			sessionKey,
			sessionValue,
			extractedAt,
			url,
			platform,
			userEmail,
			userPassword,
			existingSessionId
		} as SessionProcessRequest);

		// Handle error responses
		if (!result.success) {
			return NextResponse.json({
				error: result.error,
				details: result.details,
				platform: result.platform,
				success: false
			}, { status: result.status, headers: corsHeaders });
		}

		// Set persistent, secure cookie
		const response = NextResponse.json({
			success: true,
			internalSessionId: result.internalSessionId,
			sessionKey: result.sessionKey,
			platform: result.platform,
			extractedAt: result.extractedAt,
			healthMonitoringActive: result.healthMonitoringActive,
			message: `Session successfully bridged from ${result.platform} browser extension`
		}, { headers: corsHeaders });

		response.cookies.set('myAppToken', result.internalSessionId!, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			path: '/',
			maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
			sameSite: 'lax',
		});

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
