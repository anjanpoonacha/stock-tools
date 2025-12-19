// Unified Watchlist API - Fetches both MIO and TradingView watchlists with single user credentials
import { NextRequest, NextResponse } from 'next/server';
import { SessionResolver, UserCredentials } from '@/lib/SessionResolver';
import { UnifiedWatchlistResponse, UserCredentialsSchema } from '@/types/auth';
import { z } from 'zod';

/**
 * POST endpoint to fetch watchlists from both platforms using unified authentication
 * Benefits:
 * 1. Single API call for both platforms
 * 2. Consistent error handling
 * 3. Atomic success/failure for both platforms
 * 4. Simplified client-side logic
 */
export async function POST(request: NextRequest) {
	try {
		// Parse and validate request body
		const body = await request.json();
		const validatedCredentials = UserCredentialsSchema.parse(body);

		const { userEmail, userPassword } = validatedCredentials;
		const userCredentials: UserCredentials = { userEmail, userPassword };

		// Initialize response structure
		const response: UnifiedWatchlistResponse = {
			success: false,
			userEmail,
			platforms: {
				mio: {
					available: false,
					watchlists: undefined,
					error: undefined
				},
				tradingview: {
					available: false,
					watchlists: undefined,
					error: undefined
				}
			},
			message: '',
			totalWatchlists: 0
		};

		// Fetch MIO watchlists
		try {
			const hasMIOSession = await SessionResolver.hasSessionsForPlatformAndUser('marketinout', userCredentials);
			const mioSession = await SessionResolver.getLatestMIOSessionForUser(userCredentials);

			if (hasMIOSession && mioSession) {
				// Mock MIO watchlists - in real implementation, this would call MIO API
				const mioWatchlists = [
					{
						id: 1,
						name: `${userEmail}'s MIO Portfolio`,
						symbols: ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK'],
						createdAt: '2025-08-27T10:00:00Z',
						updatedAt: '2025-08-27T15:30:00Z',
						owner: userEmail
					},
					{
						id: 2,
						name: `${userEmail}'s MIO Watchlist`,
						symbols: ['NIFTY', 'BANKNIFTY', 'SENSEX', 'ADANIPORTS', 'ASIANPAINT'],
						createdAt: '2025-08-26T09:00:00Z',
						updatedAt: '2025-08-27T14:20:00Z',
						owner: userEmail
					}
				];

				response.platforms.mio = {
					available: true,
					watchlists: mioWatchlists,
					error: undefined
				};
			} else {
				response.platforms.mio = {
					available: false,
					watchlists: undefined,
					error: 'No MarketInOut session found for this user'
				};
			}
		} catch (error) {
			response.platforms.mio = {
				available: false,
				watchlists: undefined,
				error: error instanceof Error ? error.message : 'Failed to fetch MIO watchlists'
			};
		}

		// Fetch TradingView watchlists
		try {
			const hasTVSession = await SessionResolver.hasSessionsForPlatformAndUser('tradingview', userCredentials);
			const tvSession = await SessionResolver.getLatestSessionForUser('tradingview', userCredentials);

			if (hasTVSession && tvSession) {
				// Mock TradingView watchlists - in real implementation, this would call TradingView API
				const tvWatchlists = [
					{
						id: 'tv_1',
						name: `${userEmail}'s TV Favorites`,
						symbols: ['NSE:RELIANCE', 'NSE:TCS', 'NSE:INFY', 'NSE:HDFC'],
						createdAt: '2025-08-25T08:00:00Z',
						updatedAt: '2025-08-27T16:00:00Z',
						owner: userEmail
					},
					{
						id: 'tv_2',
						name: `${userEmail}'s TV Tech Stocks`,
						symbols: ['NSE:WIPRO', 'NSE:TECHM', 'NSE:HCLTECH', 'NSE:LTI'],
						createdAt: '2025-08-24T12:00:00Z',
						updatedAt: '2025-08-27T11:30:00Z',
						owner: userEmail
					}
				];

				response.platforms.tradingview = {
					available: true,
					watchlists: tvWatchlists,
					error: undefined
				};
			} else {
				response.platforms.tradingview = {
					available: false,
					watchlists: undefined,
					error: 'No TradingView session found for this user'
				};
			}
		} catch (error) {
			response.platforms.tradingview = {
				available: false,
				watchlists: undefined,
				error: error instanceof Error ? error.message : 'Failed to fetch TradingView watchlists'
			};
		}

		// Calculate totals and determine overall success
		const mioCount = response.platforms.mio.watchlists?.length || 0;
		const tvCount = response.platforms.tradingview.watchlists?.length || 0;
		response.totalWatchlists = mioCount + tvCount;

		const mioAvailable = response.platforms.mio.available;
		const tvAvailable = response.platforms.tradingview.available;

		if (mioAvailable && tvAvailable) {
			response.success = true;
			response.message = `Successfully fetched watchlists from both platforms: ${mioCount} from MIO, ${tvCount} from TradingView`;
		} else if (mioAvailable) {
			response.success = true;
			response.message = `Fetched ${mioCount} watchlists from MIO. TradingView unavailable: ${response.platforms.tradingview.error}`;
		} else if (tvAvailable) {
			response.success = true;
			response.message = `Fetched ${tvCount} watchlists from TradingView. MIO unavailable: ${response.platforms.mio.error}`;
		} else {
			response.success = false;
			response.message = 'No watchlists available from either platform. Please ensure you have valid sessions.';
		}

		return NextResponse.json(response);

	} catch (error) {

		if (error instanceof z.ZodError) {
			return NextResponse.json({
				success: false,
				error: 'Invalid request data',
				details: error.issues,
				message: 'Please provide valid userEmail and userPassword'
			}, { status: 400 });
		}

		return NextResponse.json({
			success: false,
			error: 'Internal server error',
			message: 'Failed to fetch watchlists',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}

/**
 * GET endpoint for quick status check
 * Returns available platforms for a user without full watchlist data
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const userEmail = searchParams.get('userEmail');
		const userPassword = searchParams.get('userPassword');

		if (!userEmail || !userPassword) {
			return NextResponse.json({
				error: 'Missing credentials',
				message: 'Both userEmail and userPassword are required'
			}, { status: 400 });
		}

		const userCredentials: UserCredentials = { userEmail, userPassword };

		// Check platform availability
		const hasMIOSession = await SessionResolver.hasSessionsForPlatformAndUser('marketinout', userCredentials);
		const hasTVSession = await SessionResolver.hasSessionsForPlatformAndUser('tradingview', userCredentials);

		return NextResponse.json({
			userEmail,
			platforms: {
				mio: {
					available: hasMIOSession,
					sessionCount: hasMIOSession ? 1 : 0
				},
				tradingview: {
					available: hasTVSession,
					sessionCount: hasTVSession ? 1 : 0
				}
			},
			message: `Platform availability: MIO ${hasMIOSession ? 'available' : 'unavailable'}, TradingView ${hasTVSession ? 'available' : 'unavailable'}`
		});

	} catch (error) {

		return NextResponse.json({
			error: 'Failed to check platform availability',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}
