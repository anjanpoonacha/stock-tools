// Protected MIO Watchlists API - Requires user authentication
import { NextRequest, NextResponse } from 'next/server';
import { SessionResolver, UserCredentials } from '@/lib/SessionResolver';

/**
 * GET endpoint to fetch MIO watchlists - requires user authentication
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const userEmail = searchParams.get('userEmail');
		const userPassword = searchParams.get('userPassword');

		// Require user credentials for watchlist access
		if (!userEmail || !userPassword) {
			return NextResponse.json({
				error: 'Authentication required',
				message: 'Both userEmail and userPassword are required to access watchlists',
				success: false
			}, { status: 401 });
		}

		const userCredentials: UserCredentials = { userEmail, userPassword };

		// Check if user has valid MIO session
		const hasMIOSession = await SessionResolver.hasSessionsForPlatformAndUser('marketinout', userCredentials);
		const mioSession = await SessionResolver.getLatestMIOSessionForUser(userCredentials);

		if (!hasMIOSession || !mioSession) {
			return NextResponse.json({
				error: 'No valid session found',
				message: `No MarketInOut session found for user ${userEmail}. Please ensure you're logged into MarketInOut and the extension has captured your session.`,
				success: false,
				userEmail,
				hasSession: false
			}, { status: 403 });
		}

		// Mock watchlist data - in real implementation, this would fetch from MIO API
		const mockWatchlists = [
			{
				id: 1,
				name: `${userEmail}'s Portfolio`,
				symbols: ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK'],
				createdAt: '2025-08-27T10:00:00Z',
				updatedAt: '2025-08-27T15:30:00Z'
			},
			{
				id: 2,
				name: `${userEmail}'s Watchlist`,
				symbols: ['NIFTY', 'BANKNIFTY', 'SENSEX', 'ADANIPORTS', 'ASIANPAINT'],
				createdAt: '2025-08-26T09:00:00Z',
				updatedAt: '2025-08-27T14:20:00Z'
			}
		];

		return NextResponse.json({
			success: true,
			message: `Watchlists retrieved successfully for user ${userEmail}`,
			userEmail,
			sessionId: mioSession.internalId,
			watchlists: mockWatchlists,
			totalWatchlists: mockWatchlists.length
		});

	} catch (error) {

		return NextResponse.json({
			error: 'Internal server error',
			message: 'Failed to retrieve watchlists',
			success: false,
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}

/**
 * POST endpoint to create/update watchlists - requires user authentication
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, watchlistName, symbols } = body;

		// Require user credentials
		if (!userEmail || !userPassword) {
			return NextResponse.json({
				error: 'Authentication required',
				message: 'Both userEmail and userPassword are required',
				success: false
			}, { status: 401 });
		}

		// Validate watchlist data
		if (!watchlistName || !symbols || !Array.isArray(symbols)) {
			return NextResponse.json({
				error: 'Invalid watchlist data',
				message: 'watchlistName and symbols array are required',
				success: false
			}, { status: 400 });
		}

		const userCredentials: UserCredentials = { userEmail, userPassword };

		// Check if user has valid MIO session
		const hasMIOSession = await SessionResolver.hasSessionsForPlatformAndUser('marketinout', userCredentials);
		const mioSession = await SessionResolver.getLatestMIOSessionForUser(userCredentials);

		if (!hasMIOSession || !mioSession) {
			return NextResponse.json({
				error: 'No valid session found',
				message: `No MarketInOut session found for user ${userEmail}`,
				success: false,
				userEmail,
				hasSession: false
			}, { status: 403 });
		}

		// Mock watchlist creation - in real implementation, this would call MIO API
		const newWatchlist = {
			id: Date.now(),
			name: watchlistName,
			symbols: symbols,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			owner: userEmail
		};

		return NextResponse.json({
			success: true,
			message: `Watchlist '${watchlistName}' created successfully for user ${userEmail}`,
			userEmail,
			sessionId: mioSession.internalId,
			watchlist: newWatchlist
		});

	} catch (error) {

		return NextResponse.json({
			error: 'Internal server error',
			message: 'Failed to create watchlist',
			success: false,
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}
