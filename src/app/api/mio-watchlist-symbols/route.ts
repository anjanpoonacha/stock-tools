import { NextRequest, NextResponse } from 'next/server';
import { MIOService } from '@/lib/mio';
import { SessionResolver } from '@/lib/SessionResolver';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

interface MIOWatchlistSymbolsRequest {
	wlid: string;
	userEmail?: string;
	userPassword?: string;
}

interface APIResponse {
	symbols?: string[];
	watchlistId?: string;
	watchlistName?: string;
	error?: string;
	needsSession?: boolean;
}

/**
 * Creates standardized error response
 */
function createErrorResponse(message: string, status: number, needsSession = false): NextResponse<APIResponse> {
	return NextResponse.json({
		error: message,
		...(needsSession && { needsSession: true })
	}, { status });
}

/**
 * POST /api/mio-watchlist-symbols
 * Fetch symbols for a specific MIO watchlist
 */
export async function POST(req: NextRequest): Promise<NextResponse<APIResponse>> {
	try {
		const body: MIOWatchlistSymbolsRequest = await req.json();
		const { wlid, userEmail, userPassword } = body;

		// Validate required parameters
		if (!wlid) {
			return createErrorResponse('Missing required parameter: wlid', HTTP_STATUS.BAD_REQUEST);
		}

		// Require user credentials for authentication
		if (!userEmail || !userPassword) {
			return createErrorResponse(
				'Authentication required - userEmail and userPassword must be provided',
				HTTP_STATUS.UNAUTHORIZED,
				true
			);
		}

		// Try credential-based authentication for the specific user
		const sessionInfo = await SessionResolver.getLatestMIOSessionForUser({ userEmail, userPassword });

		if (!sessionInfo) {
			return createErrorResponse(
				`No MarketInOut session found for user ${userEmail}. Please use the browser extension to capture sessions from marketinout.com`,
				HTTP_STATUS.UNAUTHORIZED,
				true
			);
		}

		// Fetch watchlist symbols using MIOService
		const result = await MIOService.getWatchlistSymbolsWithSession(sessionInfo.internalId, wlid);

		// Check if MIO operation succeeded
		if (!result.success) {
			const status = result.error?.code === 'SESSION_EXPIRED' 
				? HTTP_STATUS.UNAUTHORIZED 
				: HTTP_STATUS.INTERNAL_SERVER_ERROR;

			return createErrorResponse(
				result.error?.message || 'Failed to fetch watchlist symbols',
				status,
				result.error?.needsRefresh ?? false
			);
		}

		// Also fetch the watchlist name
		const watchlistsResult = await MIOService.getWatchlistsWithSession(sessionInfo.internalId);
		const watchlist = watchlistsResult.data?.find(wl => String(wl.id) === String(wlid));

		return NextResponse.json({
			symbols: result.data || [],
			watchlistId: wlid,
			watchlistName: watchlist?.name || `Watchlist ${wlid}`,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'An unknown error occurred';
		console.error('[MIO Watchlist Symbols API] Error:', error);

		return createErrorResponse(
			message || ERROR_MESSAGES.UNKNOWN_ERROR,
			HTTP_STATUS.INTERNAL_SERVER_ERROR
		);
	}
}
