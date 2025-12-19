// src/app/api/mio-action/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { MIOService } from '@/lib/mio';
import { SessionResolver, MIOSessionInfo } from '@/lib/SessionResolver';
import { HTTP_STATUS, ERROR_MESSAGES, LOG_PREFIXES } from '@/lib/constants';


interface MIOActionRequest {
	mioWlid?: string;
	symbols?: string[];
}

interface CreateWatchlistRequest {
	name: string;
}

interface DeleteWatchlistRequest {
	deleteIds: string[];
}

interface APIResponse<T = unknown> {
	result?: T;
	watchlists?: T;
	sessionUsed?: string;
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
 * Creates standardized success response
 */
function createSuccessResponse<T>(data: T, sessionId?: string): NextResponse<APIResponse<T>> {
	return NextResponse.json({
		...data,
		...(sessionId && { sessionUsed: sessionId })
	});
}

/**
 * Extracts error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Handles MIO watchlist retrieval
 */
async function handleGetWatchlists(sessionInfo: MIOSessionInfo): Promise<NextResponse<APIResponse>> {
	try {
		const watchlists = await MIOService.getWatchlistsWithSession(sessionInfo.internalId);

		return createSuccessResponse({ watchlists }, sessionInfo.internalId);
	} catch (error) {
		const message = getErrorMessage(error);

		return createErrorResponse(
			message || ERROR_MESSAGES.WATCHLIST_LOAD_FAILED,
			HTTP_STATUS.UNAUTHORIZED,
			true
		);
	}
}

/**
 * Handles adding symbols to MIO watchlist
 */
async function handleAddToWatchlist(
	sessionInfo: MIOSessionInfo,
	mioWlid: string,
	symbols: string[]
): Promise<NextResponse<APIResponse>> {
	try {
		// Convert symbols array to comma-separated string as expected by MIOService
		const symbolsString = Array.isArray(symbols) ? symbols.join(',') : symbols;

		const result = await MIOService.addWatchlist({
			sessionKey: sessionInfo.key,
			sessionValue: sessionInfo.value,
			mioWlid,
			symbols: symbolsString,
		});

		return createSuccessResponse({ result }, sessionInfo.internalId);
	} catch (error) {
		const message = getErrorMessage(error);

		return createErrorResponse(
			message || ERROR_MESSAGES.WATCHLIST_ADD_FAILED,
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
			true
		);
	}
}

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse>> {
	try {
		const body: MIOActionRequest & { userEmail?: string; userPassword?: string } = await req.json();
		const { mioWlid, symbols, userEmail, userPassword } = body;

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

		// If no specific action requested, treat as "get watchlists"
		if (!mioWlid && !symbols) {
			return handleGetWatchlists(sessionInfo);
		}

		// Otherwise, treat as "add to watchlist"
		return handleAddToWatchlist(sessionInfo, mioWlid!, symbols!);
	} catch (error) {
		const message = getErrorMessage(error);

		return createErrorResponse(message || ERROR_MESSAGES.UNKNOWN_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
	}
}

export async function PUT(req: NextRequest): Promise<NextResponse<APIResponse>> {
	try {
		const body: CreateWatchlistRequest & { userEmail?: string; userPassword?: string } = await req.json();
		const { name, userEmail, userPassword } = body;

		if (!name) {
			return createErrorResponse(ERROR_MESSAGES.NAME_REQUIRED, HTTP_STATUS.BAD_REQUEST);
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


		try {
			const result = await MIOService.createWatchlist(sessionInfo.key, sessionInfo.value, name);
			return createSuccessResponse({ result }, sessionInfo.internalId);
		} catch (error) {
			const message = getErrorMessage(error);

			return createErrorResponse(
				message || ERROR_MESSAGES.WATCHLIST_CREATE_FAILED,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				true
			);
		}
	} catch (error) {
		const message = getErrorMessage(error);

		return createErrorResponse(message || ERROR_MESSAGES.UNKNOWN_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
	}
}

export async function DELETE(req: NextRequest): Promise<NextResponse<APIResponse>> {
	try {
		const body: DeleteWatchlistRequest & { userEmail?: string; userPassword?: string } = await req.json();
		const { deleteIds, userEmail, userPassword } = body;

		if (!Array.isArray(deleteIds)) {
			return createErrorResponse(ERROR_MESSAGES.DELETE_IDS_REQUIRED, HTTP_STATUS.BAD_REQUEST);
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


		try {
			const result = await MIOService.deleteWatchlists(sessionInfo.key, sessionInfo.value, deleteIds);
			return createSuccessResponse({ result }, sessionInfo.internalId);
		} catch (error) {
			const message = getErrorMessage(error);

			return createErrorResponse(
				message || ERROR_MESSAGES.WATCHLIST_DELETE_FAILED,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				true
			);
		}
	} catch (error) {
		const message = getErrorMessage(error);

		return createErrorResponse(message || ERROR_MESSAGES.UNKNOWN_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
	}
}
