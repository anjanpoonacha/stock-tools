// src/app/api/watchlist/create/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { MIOService } from '@/lib/mio';
import { SessionResolver } from '@/lib/SessionResolver';
import { createWatchlist as createTVWatchlist } from '@/lib/tradingview';
import { HTTP_STATUS, ERROR_MESSAGES, SESSION_CONFIG } from '@/lib/constants';

interface CreateWatchlistRequest {
	name: string;
	userEmail?: string;
	userPassword?: string;
}

interface CreateWatchlistResponse {
	mioId?: string;
	tvId?: string;
	name: string;
	success: boolean;
	error?: string;
	needsSession?: boolean;
}

/**
 * Creates standardized error response
 */
function createErrorResponse(message: string, status: number, needsSession = false): NextResponse<CreateWatchlistResponse> {
	return NextResponse.json({
		name: '',
		success: false,
		error: message,
		...(needsSession && { needsSession: true })
	}, { status });
}

/**
 * Creates standardized success response
 */
function createSuccessResponse(data: CreateWatchlistResponse): NextResponse<CreateWatchlistResponse> {
	return NextResponse.json(data);
}

/**
 * Extracts error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * POST /api/watchlist/create
 * Creates a watchlist on both MIO and TradingView platforms in parallel
 */
export async function POST(req: NextRequest): Promise<NextResponse<CreateWatchlistResponse>> {
	try {
		const body: CreateWatchlistRequest = await req.json();
		const { name, userEmail, userPassword } = body;

		// Validate input
		if (!name || name.trim() === '') {
			return createErrorResponse(
				ERROR_MESSAGES.NAME_REQUIRED,
				HTTP_STATUS.BAD_REQUEST
			);
		}

		// Require user credentials for authentication
		if (!userEmail || !userPassword) {
			return createErrorResponse(
				'Authentication required - userEmail and userPassword must be provided',
				HTTP_STATUS.UNAUTHORIZED,
				true
			);
		}

		// Get sessions for both platforms
		const [mioSessionInfo, tvSessionInfo] = await Promise.all([
			SessionResolver.getLatestMIOSessionForUser({ userEmail, userPassword }),
			SessionResolver.getLatestSessionForUser(SESSION_CONFIG.PLATFORMS.TRADINGVIEW, { userEmail, userPassword })
		]);

		// Check if we have sessions for both platforms
		if (!mioSessionInfo) {
			return createErrorResponse(
				`No MarketInOut session found for user ${userEmail}. Please use the browser extension to capture sessions from marketinout.com`,
				HTTP_STATUS.UNAUTHORIZED,
				true
			);
		}

		if (!tvSessionInfo) {
			return createErrorResponse(
				`No TradingView session found for user ${userEmail}. Please use the browser extension to capture sessions from tradingview.com`,
				HTTP_STATUS.UNAUTHORIZED,
				true
			);
		}

		// Create watchlists on both platforms in parallel
		const [mioResult, tvResult] = await Promise.allSettled([
			MIOService.createWatchlist(mioSessionInfo.key, mioSessionInfo.value, name),
			createTVWatchlist(name, `sessionid=${tvSessionInfo.sessionData.sessionId}`)
		]);

		// Handle results
		let mioId: string | undefined;
		let tvId: string | undefined;
		let mioError: string | undefined;
		let tvError: string | undefined;

		// Process MIO result
		if (mioResult.status === 'fulfilled') {
			if (mioResult.value.success && mioResult.value.data) {
				mioId = mioResult.value.data.wlid;
			} else {
				mioError = mioResult.value.error?.message || 'Failed to create MIO watchlist';
			}
		} else {
			mioError = getErrorMessage(mioResult.reason);
		}

		// Process TradingView result
		if (tvResult.status === 'fulfilled') {
			tvId = tvResult.value.id;
		} else {
			tvError = getErrorMessage(tvResult.reason);
		}

		// Determine overall success
		const bothSucceeded = mioId && tvId;
		const bothFailed = !mioId && !tvId;

		if (bothFailed) {
			return createErrorResponse(
				`Failed to create watchlist on both platforms. MIO: ${mioError}. TradingView: ${tvError}`,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				true
			);
		}

		if (!mioId) {
			return createSuccessResponse({
				tvId,
				name,
				success: false,
				error: `TradingView watchlist created, but MIO failed: ${mioError}`
			});
		}

		if (!tvId) {
			return createSuccessResponse({
				mioId,
				name,
				success: false,
				error: `MIO watchlist created, but TradingView failed: ${tvError}`
			});
		}

		// Both succeeded
		return createSuccessResponse({
			mioId,
			tvId,
			name,
			success: true
		});

	} catch (error) {
		const message = getErrorMessage(error);
		return createErrorResponse(
			message || ERROR_MESSAGES.UNKNOWN_ERROR,
			HTTP_STATUS.INTERNAL_SERVER_ERROR
		);
	}
}
