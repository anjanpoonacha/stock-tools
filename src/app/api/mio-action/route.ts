// src/app/api/mio-action/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { MIOService } from '@/lib/MIOService';
import { validateAndStartMonitoring, getHealthAwareSessionData } from '@/lib/sessionValidation';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { internalSessionId, mioWlid, symbols } = body;

		console.log('[API] /api/mio-action POST body:', body);

		if (!internalSessionId) {
			console.log('[API] Missing internalSessionId');
			return NextResponse.json({ error: 'internalSessionId is required.' }, { status: 400 });
		}

		// Use health-aware session validation
		const healthStatus = getHealthAwareSessionData(internalSessionId);
		console.log('[API] Health-aware session check for', internalSessionId, '=>', {
			sessionExists: healthStatus.sessionExists,
			overallStatus: healthStatus.overallStatus,
			platforms: healthStatus.platforms
		});

		if (!healthStatus.sessionExists || !healthStatus.platforms.includes('marketinout')) {
			return NextResponse.json({
				error: 'No MIO session found.',
				healthStatus: healthStatus.overallStatus,
				recommendations: healthStatus.recommendations
			}, { status: 401 });
		}

		const sessionKeyValue = MIOService.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			return NextResponse.json({ error: 'No MIO session found.' }, { status: 401 });
		}

		// If only sessionId is provided, treat as "get watchlists"
		if (!mioWlid && !symbols) {
			try {
				// Use health-integrated validation that automatically starts monitoring
				const validationResult = await validateAndStartMonitoring(internalSessionId, 'marketinout');
				
				if (validationResult.isValid && validationResult.watchlists) {
					console.log('[API] Session validated and monitoring started:', {
						healthStatus: validationResult.healthStatus,
						monitoringStarted: validationResult.monitoringStarted,
						watchlistCount: validationResult.watchlists.length
					});
					
					return NextResponse.json({
						watchlists: validationResult.watchlists,
						healthStatus: validationResult.healthStatus,
						monitoringActive: validationResult.monitoringStarted
					});
				} else {
					console.log('[API] Session validation failed:', validationResult.error?.message);
					return NextResponse.json({
						error: validationResult.error?.message || 'Session expired. Please re-authenticate.',
						canAutoRecover: validationResult.error?.canAutoRecover() || false,
						recoveryInstructions: validationResult.error?.getRecoveryInstructions() || []
					}, { status: 401 });
				}
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				return NextResponse.json({ error: message || 'Session expired. Please re-authenticate.' }, { status: 401 });
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
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return NextResponse.json({ error: message || 'Unknown error' }, { status: 500 });
	}
}

export async function PUT(req: NextRequest) {
	try {
		const body = await req.json();
		const { internalSessionId, name } = body;

		if (!internalSessionId || !name) {
			return NextResponse.json({ error: 'internalSessionId and name are required.' }, { status: 400 });
		}

		// Use health-aware session validation
		const healthStatus = getHealthAwareSessionData(internalSessionId);
		if (!healthStatus.sessionExists || !healthStatus.platforms.includes('marketinout')) {
			return NextResponse.json({
				error: 'No MIO session found.',
				healthStatus: healthStatus.overallStatus,
				recommendations: healthStatus.recommendations
			}, { status: 401 });
		}

		const sessionKeyValue = MIOService.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) {
			return NextResponse.json({ error: 'No MIO session found.' }, { status: 401 });
		}
		const result = await MIOService.createWatchlist(sessionKeyValue.key, sessionKeyValue.value, name);
		return NextResponse.json({ result });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return NextResponse.json({ error: message || 'Unknown error' }, { status: 500 });
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
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return NextResponse.json({ error: message || 'Unknown error' }, { status: 500 });
	}
}
