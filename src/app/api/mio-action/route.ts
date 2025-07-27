// src/app/api/mio-action/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { MIOService } from '@/lib/MIOService';
import { getPlatformSession } from '@/lib/sessionStore';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { internalSessionId, mioWlid, symbols } = body;

		console.log('[API] /api/mio-action POST body:', body);

		if (!internalSessionId) {
			console.log('[API] Missing internalSessionId');
			return NextResponse.json({ error: 'internalSessionId is required.' }, { status: 400 });
		}
		const sessionKeyValue = MIOService.getSessionKeyValue(internalSessionId);
		console.log('[API] Lookup sessionKeyValue for', internalSessionId, '=>', sessionKeyValue);
		if (!sessionKeyValue) {
			return NextResponse.json({ error: 'No MIO session found.' }, { status: 401 });
		}

		// If only sessionId is provided, treat as "get watchlists"
		if (!mioWlid && !symbols) {
			try {
				const { validateAndCleanupMarketinoutSession } = await import('@/lib/sessionValidation');
				const watchlists = await validateAndCleanupMarketinoutSession(internalSessionId);
				return NextResponse.json({ watchlists });
			} catch (err: any) {
				return NextResponse.json({ error: err.message || 'Session expired. Please re-authenticate.' }, { status: 401 });
			}
		}

		// Otherwise, treat as "add to watchlist"
		const result = await MIOService.addWatchlist({
			sessionKey: sessionKeyValue.key,
			sessionValue: sessionKeyValue.value,
			mioWlid,
			symbols,
		});
		return NextResponse.json({ result });
	} catch (e: any) {
		return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
	}
}

export async function PUT(req: NextRequest) {
	try {
		const body = await req.json();
		const { internalSessionId, name } = body;

		if (!internalSessionId || !name) {
			return NextResponse.json({ error: 'internalSessionId and name are required.' }, { status: 400 });
		}
		const sessionKeyValue = MIOService.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			return NextResponse.json({ error: 'No MIO session found.' }, { status: 401 });
		}
		const result = await MIOService.createWatchlist(sessionKeyValue.key, sessionKeyValue.value, name);
		return NextResponse.json({ result });
	} catch (e: any) {
		return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
	}
}

export async function DELETE(req: NextRequest) {
	try {
		const body = await req.json();
		const { internalSessionId, deleteIds } = body;

		if (!internalSessionId || !Array.isArray(deleteIds)) {
			return NextResponse.json({ error: 'internalSessionId and deleteIds are required.' }, { status: 400 });
		}
		const sessionKeyValue = MIOService.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			return NextResponse.json({ error: 'No MIO session found.' }, { status: 401 });
		}
		const result = await MIOService.deleteWatchlists(sessionKeyValue.key, sessionKeyValue.value, deleteIds);
		return NextResponse.json({ result });
	} catch (e: any) {
		return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
	}
}
