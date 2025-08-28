// API endpoint for session information - supports both MarketInOut and TradingView
import { NextRequest, NextResponse } from 'next/server';
import { SessionResolver, UserCredentials } from '@/lib/SessionResolver';

/**
 * GET endpoint to check session availability and get basic session info
 * Supports platform parameter to get specific platform sessions
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const platform = searchParams.get('platform');

		// Get session statistics for debugging
		const stats = SessionResolver.getSessionStats();

		if (platform) {
			// Get specific platform session
			const hasSession = SessionResolver.hasSessionsForPlatform(platform);
			const latestSession = SessionResolver.getLatestSession(platform);

			if (platform === 'marketinout') {
				const latestMIOSession = SessionResolver.getLatestMIOSession();
				return NextResponse.json({
					platform,
					hasSession,
					sessionAvailable: !!latestMIOSession,
					sessionStats: stats,
					currentSessionId: latestMIOSession?.internalId || null,
					sessionData: latestSession?.sessionData || null,
					message: hasSession
						? `${platform} session available - all operations should work automatically`
						: `No ${platform} session found - please use browser extension to capture session`
				});
			} else {
				// For TradingView and other platforms
				return NextResponse.json({
					platform,
					hasSession,
					sessionAvailable: !!latestSession,
					sessionStats: stats,
					currentSessionId: latestSession?.internalId || null,
					sessionData: latestSession?.sessionData || null,
					sessionId: latestSession?.sessionData?.sessionId || null,
					message: hasSession
						? `${platform} session available - all operations should work automatically`
						: `No ${platform} session found - please use browser extension to capture session`
				});
			}
		} else {
			// Get all platform sessions (legacy behavior)
			const hasMIOSession = SessionResolver.hasSessionsForPlatform('marketinout');
			const hasTVSession = SessionResolver.hasSessionsForPlatform('tradingview');
			const latestMIOSession = SessionResolver.getLatestMIOSession();
			const latestTVSession = SessionResolver.getLatestSession('tradingview');

			return NextResponse.json({
				hasSession: hasMIOSession || hasTVSession,
				sessionAvailable: !!latestMIOSession || !!latestTVSession,
				sessionStats: stats,
				platforms: {
					marketinout: {
						hasSession: hasMIOSession,
						sessionAvailable: !!latestMIOSession,
						currentSessionId: latestMIOSession?.internalId || null,
					},
					tradingview: {
						hasSession: hasTVSession,
						sessionAvailable: !!latestTVSession,
						currentSessionId: latestTVSession?.internalId || null,
						sessionId: latestTVSession?.sessionData?.sessionId || null,
					}
				},
				message: (hasMIOSession || hasTVSession)
					? 'Sessions available - all operations should work automatically'
					: 'No sessions found - please use browser extension to capture sessions'
			});
		}

	} catch (error) {
		console.error('[SESSION-API] Error retrieving session info:', error);
		return NextResponse.json({
			hasSession: false,
			sessionAvailable: false,
			error: 'Failed to retrieve session information',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}

/**
 * POST endpoint to check session availability for specific user credentials
 * Supports user-scoped session filtering
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, platform } = body;

		if (!userEmail || !userPassword) {
			return NextResponse.json({
				error: 'Missing user credentials',
				details: 'Both userEmail and userPassword are required',
				success: false
			}, { status: 400 });
		}

		const userCredentials: UserCredentials = { userEmail, userPassword };

		// Get session statistics for debugging
		const stats = SessionResolver.getSessionStats();
		const availableUsers = SessionResolver.getAvailableUsers();

		if (platform) {
			// Get specific platform session for user
			const hasSession = SessionResolver.hasSessionsForPlatformAndUser(platform, userCredentials);
			const latestSession = SessionResolver.getLatestSessionForUser(platform, userCredentials);

			if (platform === 'marketinout') {
				const latestMIOSession = SessionResolver.getLatestMIOSessionForUser(userCredentials);
				return NextResponse.json({
					platform,
					hasSession,
					sessionAvailable: !!latestMIOSession,
					sessionStats: stats,
					availableUsers,
					currentUser: userEmail,
					currentSessionId: latestMIOSession?.internalId || null,
					sessionData: latestSession?.sessionData || null,
					message: hasSession
						? `${platform} session available for user ${userEmail} - all operations should work automatically`
						: `No ${platform} session found for user ${userEmail} - please use browser extension to capture session`
				});
			} else {
				// For TradingView and other platforms
				return NextResponse.json({
					platform,
					hasSession,
					sessionAvailable: !!latestSession,
					sessionStats: stats,
					availableUsers,
					currentUser: userEmail,
					currentSessionId: latestSession?.internalId || null,
					sessionData: latestSession?.sessionData || null,
					sessionId: latestSession?.sessionData?.sessionId || null,
					message: hasSession
						? `${platform} session available for user ${userEmail} - all operations should work automatically`
						: `No ${platform} session found for user ${userEmail} - please use browser extension to capture session`
				});
			}
		} else {
			// Get all platform sessions for user
			const hasMIOSession = SessionResolver.hasSessionsForPlatformAndUser('marketinout', userCredentials);
			const hasTVSession = SessionResolver.hasSessionsForPlatformAndUser('tradingview', userCredentials);
			const latestMIOSession = SessionResolver.getLatestMIOSessionForUser(userCredentials);
			const latestTVSession = SessionResolver.getLatestSessionForUser('tradingview', userCredentials);

			return NextResponse.json({
				hasSession: hasMIOSession || hasTVSession,
				sessionAvailable: !!latestMIOSession || !!latestTVSession,
				sessionStats: stats,
				availableUsers,
				currentUser: userEmail,
				platforms: {
					marketinout: {
						hasSession: hasMIOSession,
						sessionAvailable: !!latestMIOSession,
						currentSessionId: latestMIOSession?.internalId || null,
					},
					tradingview: {
						hasSession: hasTVSession,
						sessionAvailable: !!latestTVSession,
						currentSessionId: latestTVSession?.internalId || null,
						sessionId: latestTVSession?.sessionData?.sessionId || null,
					}
				},
				message: (hasMIOSession || hasTVSession)
					? `Sessions available for user ${userEmail} - all operations should work automatically`
					: `No sessions found for user ${userEmail} - please use browser extension to capture sessions`
			});
		}

	} catch (error) {
		console.error('[SESSION-API] Error retrieving user session info:', error);
		return NextResponse.json({
			hasSession: false,
			sessionAvailable: false,
			error: 'Failed to retrieve user session information',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}
