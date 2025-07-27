// src/app/api/auth/session-bridge/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { savePlatformSession, generateSessionId } from '@/lib/sessionStore';
/* Removed import of MioSessionValidator: use validateAndCleanupMarketinoutSession if session validation is needed */

export async function POST(req: NextRequest) {
	let externalSessionId = req.cookies.get('externalSessionId')?.value;

	if (!externalSessionId) {
		try {
			const body = await req.json();
			externalSessionId = body.externalSessionId;
		} catch {
			// ignore
		}
	}

	if (!externalSessionId) {
		return NextResponse.json({ error: 'Missing externalSessionId' }, { status: 401 });
	}

	/* No session validation: MIO does not provide a real validation endpoint. */

	console.log('[SESSION-BRIDGE] Bridging session:', { externalSessionId });
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
		sessionId: externalSessionId,
	});
	savePlatformSession(internalSessionId, 'marketinout', { sessionId: externalSessionId });
	console.log('[SESSION-BRIDGE] Saved session for MIO:', { internalSessionId, externalSessionId });

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
