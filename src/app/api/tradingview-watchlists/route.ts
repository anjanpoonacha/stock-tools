import { NextRequest, NextResponse } from 'next/server';
import { fetchWatchlistsWithAuth } from '@/lib/tradingview';
import { validateAndStartMonitoring, getHealthAwareSessionData } from '@/lib/validation';
import { getSession } from '@/lib/sessionStore';

export async function POST(req: NextRequest) {
	try {
		const { sessionid, internalSessionId } = await req.json();

		// Support both direct sessionid and internalSessionId approaches
		if (!sessionid && !internalSessionId) {
			return NextResponse.json({ error: 'Missing sessionid or internalSessionId' }, { status: 400 });
		}

		let actualSessionId = sessionid;
		let healthStatus = null;
		let monitoringStarted = false;

		// If internalSessionId is provided, use health-integrated validation
		if (internalSessionId) {
			console.log('[API] Using health-integrated validation for internalSessionId:', internalSessionId);

			// Check health status first
			const healthData = await getHealthAwareSessionData(internalSessionId);
			console.log('[API] Health-aware session check:', {
				sessionExists: healthData.sessionExists,
				overallStatus: healthData.overallStatus,
				platforms: healthData.platforms
			});

			if (!healthData.sessionExists || !healthData.platforms.includes('tradingview')) {
				return NextResponse.json({
					error: 'No TradingView session found.',
					healthStatus: healthData.overallStatus,
					recommendations: healthData.recommendations
				}, { status: 401 });
			}

			// Use health-integrated validation that automatically starts monitoring
			const validationResult = await validateAndStartMonitoring(internalSessionId, 'tradingview');

			if (!validationResult.isValid) {
				console.log('[API] TradingView session validation failed:', validationResult.error?.message);
				return NextResponse.json({
					error: validationResult.error?.message || 'TradingView session expired. Please re-authenticate.',
					canAutoRecover: validationResult.error?.canAutoRecover() || false,
					recoveryInstructions: validationResult.error?.getRecoveryInstructions() || []
				}, { status: 401 });
			}

			// Get the actual sessionid from session data
			const sessionData = await getSession(internalSessionId);
			if (sessionData?.tradingview?.sessionId) {
				actualSessionId = sessionData.tradingview.sessionId;
				healthStatus = validationResult.healthStatus;
				monitoringStarted = validationResult.monitoringStarted;

				console.log('[API] Session validated and monitoring started:', {
					healthStatus,
					monitoringStarted
				});
			} else {
				return NextResponse.json({ error: 'TradingView sessionid not found in session data' }, { status: 401 });
			}
		}

		const url = 'https://www.tradingview.com/api/v1/symbols_list/all/';
		const cookie = `sessionid=${actualSessionId}`;
		const watchlists = await fetchWatchlistsWithAuth(url, cookie);

		const response = { watchlists };

		// Include health monitoring information if available
		if (healthStatus !== null) {
			Object.assign(response, {
				healthStatus,
				monitoringActive: monitoringStarted
			});
		}

		return NextResponse.json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'An unknown error occurred';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
