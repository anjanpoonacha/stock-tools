import { NextRequest, NextResponse } from 'next/server';
import { deleteWatchlist as deleteTVWatchlist } from '@/lib/tradingview';
import { SessionResolver } from '@/lib/SessionResolver';
import { SESSION_CONFIG } from '@/lib/constants';

interface DeleteWatchlistRequest {
	watchlistId: string;
	userEmail: string;
	userPassword: string;
}

interface DeleteWatchlistResponse {
	success: boolean;
	message?: string;
	error?: string;
}

/**
 * DELETE /api/watchlist/delete
 * Deletes a watchlist from TradingView
 */
export async function DELETE(req: NextRequest): Promise<NextResponse<DeleteWatchlistResponse>> {
	try {
		const body: DeleteWatchlistRequest = await req.json();
		const { watchlistId, userEmail, userPassword } = body;

		// Validate input
		if (!watchlistId || !userEmail || !userPassword) {
			return NextResponse.json(
				{ success: false, error: 'watchlistId, userEmail, and userPassword are required' },
				{ status: 400 }
			);
		}

		// Get TradingView session
		const tvSessionInfo = await SessionResolver.getLatestSessionForUser(
			SESSION_CONFIG.PLATFORMS.TRADINGVIEW,
			{ userEmail, userPassword }
		);

		if (!tvSessionInfo) {
			return NextResponse.json(
				{ 
					success: false, 
					error: `No TradingView session found for user ${userEmail}. Please use the browser extension to capture sessions from tradingview.com` 
				},
				{ status: 401 }
			);
		}

		// Delete watchlist
		const cookie = `sessionid=${tvSessionInfo.sessionData.sessionId}`;
		await deleteTVWatchlist(watchlistId, cookie);

		return NextResponse.json({
			success: true,
			message: `Watchlist deleted successfully`
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
