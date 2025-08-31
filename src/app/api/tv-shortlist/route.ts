import { NextRequest, NextResponse } from 'next/server';
import { fetchWatchlistsWithAuth } from '@/lib/tradingview';
import {
	validateUserCredentials,
	createErrorResponse,
	createSuccessResponse,
	getErrorMessage,
	getErrorStatusCode
} from '@/lib/apiAuth';
import { LOG_PREFIXES } from '@/lib/constants';

export async function POST(req: NextRequest) {
	try {
		const { url, sessionid, userEmail, userPassword } = await req.json();

		// Validate required parameters
		if (!url || !sessionid) {
			return createErrorResponse('Missing url or sessionid', 400);
		}

		// Use shared authentication logic
		const sessionInfo = await validateUserCredentials(userEmail, userPassword);

		console.log(`${LOG_PREFIXES.API} [TV-SHORTLIST] Proceeding with TradingView API call for user: ${userEmail}`);

		const cookie = `sessionid=${sessionid}`;
		const watchlists = await fetchWatchlistsWithAuth(url, cookie);

		return createSuccessResponse({ watchlists }, sessionInfo.internalId);
	} catch (error) {
		const message = getErrorMessage(error);
		const statusCode = getErrorStatusCode(error);

		console.error(`${LOG_PREFIXES.API} [TV-SHORTLIST] Error:`, message);

		return createErrorResponse(message, statusCode, statusCode === 401);
	}
}
