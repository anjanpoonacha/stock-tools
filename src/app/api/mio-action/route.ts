// src/app/api/mio-action/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { MIOService } from '@/lib/MIOService';
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
		console.log(`${LOG_PREFIXES.API} Retrieved ${watchlists.length} watchlists`);

		return createSuccessResponse({ watchlists }, sessionInfo.internalId);
	} catch (error) {
		const message = getErrorMessage(error);
		console.error(`${LOG_PREFIXES.API} Failed to get watchlists:`, message);
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
		console.error(`${LOG_PREFIXES.API} Failed to add to watchlist:`, message);
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

		console.log(`${LOG_PREFIXES.API} POST ${req.url} body:`, { mioWlid, symbols, userEmail: userEmail ? '[PROVIDED]' : '[MISSING]' });

		let sessionInfo: MIOSessionInfo | null = null;

		// Try credential-based authentication first (if credentials provided)
		if (userEmail && userPassword) {
			sessionInfo = await SessionResolver.getLatestMIOSessionForUser({ userEmail, userPassword });
			if (sessionInfo) {
				console.log(`${LOG_PREFIXES.API} Using credential-based authentication for user: ${userEmail}`);
			}
		}

		// If no credentials provided or credential auth failed, try session-based authentication
		if (!sessionInfo) {
			// Try to get the latest available MIO session (fallback)
			sessionInfo = await SessionResolver.getLatestMIOSession();
			if (sessionInfo) {
				console.log(`${LOG_PREFIXES.API} Using session-based authentication with session: ${sessionInfo.internalId}`);
			}
		}

		// If still no session found, return error
		if (!sessionInfo) {
			return createErrorResponse(
				'Authentication required - either provide userEmail and userPassword, or ensure a valid session exists',
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
		console.error(`${LOG_PREFIXES.API} Unexpected error:`, message);
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

		let sessionInfo: MIOSessionInfo | null = null;

		// Try credential-based authentication first (if credentials provided)
		if (userEmail && userPassword) {
			sessionInfo = await SessionResolver.getLatestMIOSessionForUser({ userEmail, userPassword });
			if (sessionInfo) {
				console.log(`${LOG_PREFIXES.API} Using credential-based authentication for user: ${userEmail}`);
			}
		}

		// If no credentials provided or credential auth failed, try session-based authentication
		if (!sessionInfo) {
			// Try to get the latest available MIO session (fallback)
			sessionInfo = await SessionResolver.getLatestMIOSession();
			if (sessionInfo) {
				console.log(`${LOG_PREFIXES.API} Using session-based authentication with session: ${sessionInfo.internalId}`);
			}
		}

		// If still no session found, return error
		if (!sessionInfo) {
			return createErrorResponse(
				'Authentication required - either provide userEmail and userPassword, or ensure a valid session exists',
				HTTP_STATUS.UNAUTHORIZED,
				true
			);
		}

		console.log(`${LOG_PREFIXES.API} Creating watchlist with session: ${sessionInfo.internalId}`);

		try {
			const result = await MIOService.createWatchlist(sessionInfo.key, sessionInfo.value, name);
			return createSuccessResponse({ result }, sessionInfo.internalId);
		} catch (error) {
			const message = getErrorMessage(error);
			console.error(`${LOG_PREFIXES.API} Failed to create watchlist:`, message);
			return createErrorResponse(
				message || ERROR_MESSAGES.WATCHLIST_CREATE_FAILED,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				true
			);
		}
	} catch (error) {
		const message = getErrorMessage(error);
		console.error(`${LOG_PREFIXES.API} Unexpected error:`, message);
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

		let sessionInfo: MIOSessionInfo | null = null;

		// Try credential-based authentication first (if credentials provided)
		if (userEmail && userPassword) {
			sessionInfo = await SessionResolver.getLatestMIOSessionForUser({ userEmail, userPassword });
			if (sessionInfo) {
				console.log(`${LOG_PREFIXES.API} Using credential-based authentication for user: ${userEmail}`);
			}
		}

		// If no credentials provided or credential auth failed, try session-based authentication
		if (!sessionInfo) {
			// Try to get the latest available MIO session (fallback)
			sessionInfo = await SessionResolver.getLatestMIOSession();
			if (sessionInfo) {
				console.log(`${LOG_PREFIXES.API} Using session-based authentication with session: ${sessionInfo.internalId}`);
			}
		}

		// If still no session found, return error
		if (!sessionInfo) {
			return createErrorResponse(
				'Authentication required - either provide userEmail and userPassword, or ensure a valid session exists',
				HTTP_STATUS.UNAUTHORIZED,
				true
			);
		}

		console.log(`${LOG_PREFIXES.API} Deleting watchlists with session: ${sessionInfo.internalId}`);

		try {
			const result = await MIOService.deleteWatchlists(sessionInfo.key, sessionInfo.value, deleteIds);
			return createSuccessResponse({ result }, sessionInfo.internalId);
		} catch (error) {
			const message = getErrorMessage(error);
			console.error(`${LOG_PREFIXES.API} Failed to delete watchlists:`, message);
			return createErrorResponse(
				message || ERROR_MESSAGES.WATCHLIST_DELETE_FAILED,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				true
			);
		}
	} catch (error) {
		const message = getErrorMessage(error);
		console.error(`${LOG_PREFIXES.API} Unexpected error:`, message);
		return createErrorResponse(message || ERROR_MESSAGES.UNKNOWN_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
	}
}
