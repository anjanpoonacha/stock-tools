// src/lib/apiAuth.ts

import { NextResponse } from 'next/server';
import { SessionResolver, MIOSessionInfo } from './SessionResolver';
import { HTTP_STATUS, LOG_PREFIXES } from './constants';

export interface AuthenticatedRequest {
	userEmail: string;
	userPassword: string;
}

export interface APIResponse<T = unknown> {
	result?: T;
	watchlists?: T;
	sessionUsed?: string;
	error?: string;
	needsSession?: boolean;
}

/**
 * Validates user credentials by checking if they have a valid MIO session
 * This ensures only authenticated users can access protected endpoints
 * 
 * @param userEmail - User's email address
 * @param userPassword - User's password
 * @returns MIO session info if authentication succeeds
 * @throws Error if authentication fails
 */
export async function validateUserCredentials(
	userEmail: string,
	userPassword: string
): Promise<MIOSessionInfo> {
	if (!userEmail || !userPassword) {
		throw new Error('Authentication required - userEmail and userPassword must be provided');
	}

	console.log(`${LOG_PREFIXES.API} Validating credentials for user: ${userEmail}`);

	const sessionInfo = await SessionResolver.getLatestMIOSessionForUser({ userEmail, userPassword });

	if (!sessionInfo) {
		console.log(`${LOG_PREFIXES.API} No MIO session found for user: ${userEmail}`);
		throw new Error(`Authentication failed for user ${userEmail}. Please log in to MarketInOut first.`);
	}

	console.log(`${LOG_PREFIXES.API} Successfully authenticated user: ${userEmail} with session: ${sessionInfo.internalId}`);
	return sessionInfo;
}

/**
 * Creates a standardized error response
 * 
 * @param message - Error message to return
 * @param status - HTTP status code
 * @param needsSession - Whether the error indicates a session is needed
 * @returns NextResponse with error
 */
export function createErrorResponse(
	message: string,
	status: number,
	needsSession = false
): NextResponse<APIResponse> {
	return NextResponse.json({
		error: message,
		...(needsSession && { needsSession: true })
	}, { status });
}

/**
 * Creates a standardized success response
 * 
 * @param data - Response data
 * @param sessionId - Optional session ID to include in response
 * @returns NextResponse with success data
 */
export function createSuccessResponse<T>(
	data: T,
	sessionId?: string
): NextResponse<APIResponse<T>> {
	return NextResponse.json({
		...data,
		...(sessionId && { sessionUsed: sessionId })
	});
}

/**
 * Extracts error message from unknown error type
 * 
 * @param error - Unknown error object
 * @param fallback - Fallback message if error cannot be extracted
 * @returns Error message string
 */
export function getErrorMessage(error: unknown, fallback = 'An unknown error occurred'): string {
	return error instanceof Error ? error.message : fallback;
}

/**
 * Determines if an error is authentication-related
 * 
 * @param error - Error to check
 * @returns True if error is authentication-related
 */
export function isAuthenticationError(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return message.includes('authentication') ||
			message.includes('credentials') ||
			message.includes('log in') ||
			message.includes('session');
	}
	return false;
}

/**
 * Gets appropriate HTTP status code for an error
 * 
 * @param error - Error to analyze
 * @returns Appropriate HTTP status code
 */
export function getErrorStatusCode(error: unknown): number {
	if (isAuthenticationError(error)) {
		return HTTP_STATUS.UNAUTHORIZED;
	}
	return HTTP_STATUS.INTERNAL_SERVER_ERROR;
}
