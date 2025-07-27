// src/app/api/auth/session-bridge/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { savePlatformSession, generateSessionId } from '@/lib/sessionStore';
/* Removed import of MioSessionValidator: use validateAndCleanupMarketinoutSession if session validation is needed */

export async function POST(req: NextRequest) {
	let sessionKey: string | undefined;
	let sessionValue: string | undefined;

	try {
		const body = await req.json();
		sessionKey = body.sessionKey;
		sessionValue = body.sessionValue;
	} catch {
		// ignore
	}

	if (!sessionKey || !sessionValue) {
		return NextResponse.json({ error: 'Missing sessionKey or sessionValue' }, { status: 401 });
	}

	/* No session validation: MIO does not provide a real validation endpoint. */

	console.log('[SESSION-BRIDGE] Bridging session:', { sessionKey, sessionValue });
	let internalSessionId = req.cookies.get('myAppToken')?.value;
	if (internalSessionId) {
		console.log('[SESSION-BRIDGE] Reusing existing internalSessionId from cookie:', internalSessionId);
	} else {
		internalSessionId = generateSessionId();
		console.log('[SESSION-BRIDGE] Generated new internalSessionId:', internalSessionId);
	}
	console.log('[SESSION-BRIDGE] Saving session:', {
		internalSessionId,
		platform: 'marketinout',
		session: { [sessionKey]: sessionValue },
	});
	savePlatformSession(internalSessionId, 'marketinout', { sessionId: sessionValue, [sessionKey]: sessionValue });
	console.log('[SESSION-BRIDGE] Saved session for MIO:', { internalSessionId, sessionKey, sessionValue });

	// Set persistent, secure cookie
	const response = NextResponse.json({ ok: true, internalSessionId });
	response.cookies.set('myAppToken', internalSessionId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
		sameSite: 'lax',
	});

	return response;
}
