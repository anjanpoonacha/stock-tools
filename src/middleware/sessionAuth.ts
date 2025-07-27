// src/middleware/sessionAuth.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/sessionStore';

export async function sessionAuth(req: NextRequest) {
	const cookies = req.cookies;
	const internalSessionId = cookies.get('myAppToken')?.value;

	if (!internalSessionId) {
		return NextResponse.json({ error: 'Unauthorized: No session token' }, { status: 401 });
	}

	const session = getSession(internalSessionId);

	if (!session) {
		return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
	}

	type NextRequestWithSession = NextRequest & { session?: unknown };
	// Attach session data to request (for downstream handlers)
	(req as NextRequestWithSession).session = session;

	return null; // Indicates authentication passed
}
