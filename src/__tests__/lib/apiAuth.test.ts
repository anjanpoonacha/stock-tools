import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';
import {
	validateUserCredentials,
	createErrorResponse,
	createSuccessResponse,
	getErrorMessage,
	isAuthenticationError,
	getErrorStatusCode,
	AuthenticatedRequest,
	APIResponse
} from '../../lib/apiAuth';
import { SessionResolver, MIOSessionInfo } from '../../lib/SessionResolver';
import { HTTP_STATUS, LOG_PREFIXES } from '../../lib/constants';

// Mock dependencies
vi.mock('../../lib/SessionResolver');
vi.mock('next/server');

describe('apiAuth', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
		vi.clearAllMocks();
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	describe('validateUserCredentials', () => {
		const mockSessionInfo: MIOSessionInfo = {
			key: 'ASPSESSIONIDABC123',
			value: 'xyz789',
			internalId: 'test-session-123'
		};

		it('should successfully validate user credentials with valid session', async () => {
			vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(mockSessionInfo);

			const result = await validateUserCredentials('test@example.com', 'password123');

			expect(result).toEqual(mockSessionInfo);
			expect(SessionResolver.getLatestMIOSessionForUser).toHaveBeenCalledWith({
				userEmail: 'test@example.com',
				userPassword: 'password123'
			});
			expect(consoleSpy).toHaveBeenCalledWith(
				`${LOG_PREFIXES.API} Validating credentials for user: test@example.com`
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				`${LOG_PREFIXES.API} Successfully authenticated user: test@example.com with session: test-session-123`
			);
		});

		it('should throw error when userEmail is missing', async () => {
			await expect(validateUserCredentials('', 'password123')).rejects.toThrow(
				'Authentication required - userEmail and userPassword must be provided'
			);

			expect(SessionResolver.getLatestMIOSessionForUser).not.toHaveBeenCalled();
		});

		it('should throw error when userPassword is missing', async () => {
			await expect(validateUserCredentials('test@example.com', '')).rejects.toThrow(
				'Authentication required - userEmail and userPassword must be provided'
			);

			expect(SessionResolver.getLatestMIOSessionForUser).not.toHaveBeenCalled();
		});

		it('should throw error when both userEmail and userPassword are missing', async () => {
			await expect(validateUserCredentials('', '')).rejects.toThrow(
				'Authentication required - userEmail and userPassword must be provided'
			);

			expect(SessionResolver.getLatestMIOSessionForUser).not.toHaveBeenCalled();
		});

		it('should throw error when no MIO session is found', async () => {
			vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(null);

			await expect(validateUserCredentials('test@example.com', 'password123')).rejects.toThrow(
				'Authentication failed for user test@example.com. Please log in to MarketInOut first.'
			);

			expect(SessionResolver.getLatestMIOSessionForUser).toHaveBeenCalledWith({
				userEmail: 'test@example.com',
				userPassword: 'password123'
			});
			expect(consoleSpy).toHaveBeenCalledWith(
				`${LOG_PREFIXES.API} Validating credentials for user: test@example.com`
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				`${LOG_PREFIXES.API} No MIO session found for user: test@example.com`
			);
		});

		it('should handle SessionResolver errors', async () => {
			const mockError = new Error('SessionResolver failed');
			vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockRejectedValue(mockError);

			await expect(validateUserCredentials('test@example.com', 'password123')).rejects.toThrow(
				'SessionResolver failed'
			);

			expect(SessionResolver.getLatestMIOSessionForUser).toHaveBeenCalledWith({
				userEmail: 'test@example.com',
				userPassword: 'password123'
			});
		});

		it('should handle undefined session info', async () => {
			vi.mocked(SessionResolver.getLatestMIOSessionForUser).mockResolvedValue(null);

			await expect(validateUserCredentials('test@example.com', 'password123')).rejects.toThrow(
				'Authentication failed for user test@example.com. Please log in to MarketInOut first.'
			);
		});
	});

	describe('createErrorResponse', () => {
		const mockNextResponse = {
			json: vi.fn()
		};

		beforeEach(() => {
			vi.mocked(NextResponse.json).mockReturnValue(mockNextResponse as unknown as NextResponse);
		});

		it('should create error response without needsSession flag', () => {
			const result = createErrorResponse('Test error message', HTTP_STATUS.BAD_REQUEST);

			expect(NextResponse.json).toHaveBeenCalledWith(
				{
					error: 'Test error message'
				},
				{ status: HTTP_STATUS.BAD_REQUEST }
			);
			expect(result).toBe(mockNextResponse);
		});

		it('should create error response with needsSession flag', () => {
			const result = createErrorResponse('Authentication required', HTTP_STATUS.UNAUTHORIZED, true);

			expect(NextResponse.json).toHaveBeenCalledWith(
				{
					error: 'Authentication required',
					needsSession: true
				},
				{ status: HTTP_STATUS.UNAUTHORIZED }
			);
			expect(result).toBe(mockNextResponse);
		});

		it('should create error response with custom status code', () => {
			createErrorResponse('Server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);

			expect(NextResponse.json).toHaveBeenCalledWith(
				{
					error: 'Server error'
				},
				{ status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
			);
		});

		it('should create error response with needsSession false explicitly', () => {
			createErrorResponse('Bad request', HTTP_STATUS.BAD_REQUEST, false);

			expect(NextResponse.json).toHaveBeenCalledWith(
				{
					error: 'Bad request'
				},
				{ status: HTTP_STATUS.BAD_REQUEST }
			);
		});
	});

	describe('createSuccessResponse', () => {
		const mockNextResponse = {
			json: vi.fn()
		};

		beforeEach(() => {
			vi.mocked(NextResponse.json).mockReturnValue(mockNextResponse as unknown as NextResponse);
		});

		it('should create success response without session ID', () => {
			const testData = { result: 'success', data: [1, 2, 3] };
			const result = createSuccessResponse(testData);

			expect(NextResponse.json).toHaveBeenCalledWith(testData);
			expect(result).toBe(mockNextResponse);
		});

		it('should create success response with session ID', () => {
			const testData = { result: 'success', data: [1, 2, 3] };
			const sessionId = 'session-123';
			const result = createSuccessResponse(testData, sessionId);

			expect(NextResponse.json).toHaveBeenCalledWith({
				...testData,
				sessionUsed: sessionId
			});
			expect(result).toBe(mockNextResponse);
		});

		it('should create success response with complex data structure', () => {
			const complexData = {
				watchlists: [
					{ id: '1', name: 'Watchlist 1' },
					{ id: '2', name: 'Watchlist 2' }
				],
				metadata: {
					count: 2,
					lastUpdated: '2023-01-01T00:00:00Z'
				}
			};
			createSuccessResponse(complexData, 'session-456');

			expect(NextResponse.json).toHaveBeenCalledWith({
				...complexData,
				sessionUsed: 'session-456'
			});
		});

		it('should create success response with string data', () => {
			const stringData = 'Operation completed successfully';
			createSuccessResponse(stringData);

			// When spreading a string, it becomes an object with numeric keys
			const expectedSpreadString = Object.assign({}, stringData);
			expect(NextResponse.json).toHaveBeenCalledWith(expectedSpreadString);
		});

		it('should create success response with null data', () => {
			createSuccessResponse(null, 'session-789');

			expect(NextResponse.json).toHaveBeenCalledWith({
				sessionUsed: 'session-789'
			});
		});
	});

	describe('getErrorMessage', () => {
		it('should extract message from Error instance', () => {
			const error = new Error('Test error message');
			const result = getErrorMessage(error);

			expect(result).toBe('Test error message');
		});

		it('should return fallback message for non-Error objects', () => {
			const result = getErrorMessage('string error');

			expect(result).toBe('An unknown error occurred');
		});

		it('should return fallback message for null', () => {
			const result = getErrorMessage(null);

			expect(result).toBe('An unknown error occurred');
		});

		it('should return fallback message for undefined', () => {
			const result = getErrorMessage(undefined);

			expect(result).toBe('An unknown error occurred');
		});

		it('should return custom fallback message', () => {
			const customFallback = 'Custom error occurred';
			const result = getErrorMessage(123, customFallback);

			expect(result).toBe(customFallback);
		});

		it('should handle Error with empty message', () => {
			const error = new Error('');
			const result = getErrorMessage(error);

			expect(result).toBe('');
		});

		it('should handle complex object errors', () => {
			const complexError = { message: 'Not an Error instance', code: 500 };
			const result = getErrorMessage(complexError);

			expect(result).toBe('An unknown error occurred');
		});

		it('should handle Error subclasses', () => {
			const typeError = new TypeError('Type error message');
			const result = getErrorMessage(typeError);

			expect(result).toBe('Type error message');
		});
	});

	describe('isAuthenticationError', () => {
		it('should return true for authentication-related error messages', () => {
			const authErrors = [
				new Error('Authentication failed'),
				new Error('Invalid credentials provided'),
				new Error('Please log in to continue'),
				new Error('Session expired'),
				new Error('AUTHENTICATION required'),
				new Error('Bad CREDENTIALS'),
				new Error('You need to LOG IN first'),
				new Error('Invalid SESSION token')
			];

			authErrors.forEach(error => {
				expect(isAuthenticationError(error)).toBe(true);
			});
		});

		it('should return false for non-authentication error messages', () => {
			const nonAuthErrors = [
				new Error('Network connection failed'),
				new Error('Database error occurred'),
				new Error('Invalid input format'),
				new Error('Server timeout'),
				new Error('File not found'),
				new Error('Permission denied')
			];

			nonAuthErrors.forEach(error => {
				expect(isAuthenticationError(error)).toBe(false);
			});
		});

		it('should return false for non-Error objects', () => {
			const nonErrors = [
				'authentication failed',
				{ message: 'authentication failed' },
				null,
				undefined,
				123,
				true
			];

			nonErrors.forEach(nonError => {
				expect(isAuthenticationError(nonError)).toBe(false);
			});
		});

		it('should handle case-insensitive matching', () => {
			const mixedCaseErrors = [
				new Error('Authentication Failed'),
				new Error('CREDENTIALS invalid'),
				new Error('Log In required'),
				new Error('SESSION timeout')
			];

			mixedCaseErrors.forEach(error => {
				expect(isAuthenticationError(error)).toBe(true);
			});
		});

		it('should handle partial word matches', () => {
			const partialMatches = [
				new Error('User authentication is required'),
				new Error('Invalid user credentials detected'),
				new Error('Please log in to your account'),
				new Error('Session management error')
			];

			partialMatches.forEach(error => {
				expect(isAuthenticationError(error)).toBe(true);
			});
		});

		it('should return false for empty error message', () => {
			const emptyError = new Error('');
			expect(isAuthenticationError(emptyError)).toBe(false);
		});
	});

	describe('getErrorStatusCode', () => {
		it('should return UNAUTHORIZED for authentication errors', () => {
			const authErrors = [
				new Error('Authentication failed'),
				new Error('Invalid credentials'),
				new Error('Please log in'),
				new Error('Session expired')
			];

			authErrors.forEach(error => {
				expect(getErrorStatusCode(error)).toBe(HTTP_STATUS.UNAUTHORIZED);
			});
		});

		it('should return INTERNAL_SERVER_ERROR for non-authentication errors', () => {
			const nonAuthErrors = [
				new Error('Database connection failed'),
				new Error('Network timeout'),
				new Error('File processing error'),
				new Error('Unknown server error')
			];

			nonAuthErrors.forEach(error => {
				expect(getErrorStatusCode(error)).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
			});
		});

		it('should return INTERNAL_SERVER_ERROR for non-Error objects', () => {
			const nonErrors = [
				'string error',
				{ message: 'object error' },
				null,
				undefined,
				123
			];

			nonErrors.forEach(nonError => {
				expect(getErrorStatusCode(nonError)).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
			});
		});

		it('should handle mixed case authentication errors', () => {
			const mixedCaseAuthErrors = [
				new Error('AUTHENTICATION Required'),
				new Error('Invalid CREDENTIALS'),
				new Error('LOG IN needed'),
				new Error('SESSION invalid')
			];

			mixedCaseAuthErrors.forEach(error => {
				expect(getErrorStatusCode(error)).toBe(HTTP_STATUS.UNAUTHORIZED);
			});
		});

		it('should return INTERNAL_SERVER_ERROR for empty error message', () => {
			const emptyError = new Error('');
			expect(getErrorStatusCode(emptyError)).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
		});
	});

	describe('Type definitions', () => {
		it('should have correct AuthenticatedRequest interface', () => {
			const request: AuthenticatedRequest = {
				userEmail: 'test@example.com',
				userPassword: 'password123'
			};

			expect(request.userEmail).toBe('test@example.com');
			expect(request.userPassword).toBe('password123');
		});

		it('should have correct APIResponse interface with all optional properties', () => {
			const response1: APIResponse = {};
			const response2: APIResponse<string> = {
				result: 'success',
				watchlists: 'data',
				sessionUsed: 'session-123',
				error: 'error message',
				needsSession: true
			};

			expect(response1).toEqual({});
			expect(response2.result).toBe('success');
			expect(response2.watchlists).toBe('data');
			expect(response2.sessionUsed).toBe('session-123');
			expect(response2.error).toBe('error message');
			expect(response2.needsSession).toBe(true);
		});

		it('should handle APIResponse with different generic types', () => {
			const stringResponse: APIResponse<string> = { result: 'test' };
			const numberResponse: APIResponse<number> = { result: 123 };
			const objectResponse: APIResponse<{ id: string }> = { result: { id: 'test' } };
			const arrayResponse: APIResponse<string[]> = { result: ['a', 'b', 'c'] };

			expect(stringResponse.result).toBe('test');
			expect(numberResponse.result).toBe(123);
			expect(objectResponse.result).toEqual({ id: 'test' });
			expect(arrayResponse.result).toEqual(['a', 'b', 'c']);
		});
	});
});
