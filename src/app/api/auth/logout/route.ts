// src/app/api/auth/logout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/sessionStore';

export async function POST(req: NextRequest) {
	const cookies = req.cookies;
	const internalSessionId = cookies.get('myAppToken')?.value;

	if (internalSessionId) {
		deleteSession(internalSessionId);
	}

	// Clear the cookie
	const response = NextResponse.json({ ok: true });
	response.cookies.set('myAppToken', '', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: 0,
		sameSite: 'lax',
	});

	return response;
}
