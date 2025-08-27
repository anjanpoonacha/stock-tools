// API endpoint for session information - now simplified for server-side only architecture
import { NextResponse } from 'next/server';
import { SessionResolver } from '@/lib/SessionResolver';

/**
 * GET endpoint to check session availability and get basic session info
 * This is now primarily for debugging/monitoring purposes
 */
export async function GET() {
	try {
		// Get session statistics for debugging
		const stats = SessionResolver.getSessionStats();
		const hasMIOSession = SessionResolver.hasSessionsForPlatform('marketinout');
		const latestMIOSession = SessionResolver.getLatestMIOSession();

		return NextResponse.json({
			hasSession: hasMIOSession,
			sessionAvailable: !!latestMIOSession,
			sessionStats: stats,
			currentSessionId: latestMIOSession?.internalId || null,
			message: hasMIOSession
				? 'MIO session available - all operations should work automatically'
				: 'No MIO session found - please use browser extension to capture session'
		});

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
