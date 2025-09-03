import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	ErrorSeverity,
	SessionErrorType,
	Platform,
	RecoveryAction,
	SessionError,
	ErrorHandler,
	ErrorLogger,
	type ErrorContext,
} from '@/lib/sessionErrors';

describe('sessionErrors - Additional Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Clear ErrorLogger logs before each test
		(ErrorLogger as unknown as { logs: unknown[] }).logs = [];
	});

	afterEach(() => {
		vi.clearAllMocks();
		// Clear ErrorLogger logs after each test
		(ErrorLogger as unknown as { logs: unknown[] }).logs = [];
	});

	describe('SessionError - Edge Cases', () => {
		it('should handle Error.captureStackTrace when available', () => {
			const originalCaptureStackTrace = Error.captureStackTrace;
			const mockCaptureStackTrace = vi.fn();
			Error.captureStackTrace = mockCaptureStackTrace;

			const context: ErrorContext = {
				platform: Platform.MARKETINOUT,
				operation: 'test-operation',
				timestamp: new Date(),
			};

			const error = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				context
			);

			expect(mockCaptureStackTrace).toHaveBeenCalledWith(error, SessionError);
			expect(error.name).toBe('SessionError');

			Error.captureStackTrace = originalCaptureStackTrace;
		});

		it('should handle missing Error.captureStackTrace gracefully', () => {
			const originalCaptureStackTrace = Error.captureStackTrace;
			// @ts-expect-error - Testing undefined captureStackTrace
			Error.captureStackTrace = undefined;

			const context: ErrorContext = {
				platform: Platform.MARKETINOUT,
				operation: 'test-operation',
				timestamp: new Date(),
			};

			expect(() => {
				new SessionError(
					SessionErrorType.SESSION_EXPIRED,
					'User message',
					'Technical message',
					context
				);
			}).not.toThrow();

			Error.captureStackTrace = originalCaptureStackTrace;
		});

		it('should handle empty recovery steps array', () => {
			const context: ErrorContext = {
				platform: Platform.MARKETINOUT,
				operation: 'test-operation',
				timestamp: new Date(),
			};

			const error = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				context,
				ErrorSeverity.ERROR,
				[]
			);

			expect(error.getRecoveryInstructions()).toEqual([]);
			expect(error.canAutoRecover()).toBe(false);
			expect(error.getAutomatedRecoveryActions()).toEqual([]);
		});
	});

	describe('ErrorHandler - Private Method Coverage', () => {
		it('should handle getPlatformName for all platforms', () => {
			// Test through createSessionExpiredError which uses getPlatformName
			const marketInOutError = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(marketInOutError.userMessage).toContain('MarketInOut');

			const tradingViewError = ErrorHandler.createSessionExpiredError(
				Platform.TRADINGVIEW,
				'test-operation'
			);
			expect(tradingViewError.userMessage).toContain('TradingView');

			// Test other platforms through createPlatformUnavailableError
			const telegramError = ErrorHandler.createPlatformUnavailableError(
				Platform.TELEGRAM,
				'test-operation'
			);
			expect(telegramError.userMessage).toContain('TradingView'); // Falls back to TradingView

			const unknownError = ErrorHandler.createPlatformUnavailableError(
				Platform.UNKNOWN,
				'test-operation'
			);
			expect(unknownError.userMessage).toContain('TradingView'); // Falls back to TradingView
		});

		it('should handle createRecoverySteps with various actions', () => {
			// Test through createNetworkError which uses createRecoverySteps
			const error = ErrorHandler.createNetworkError(
				Platform.MARKETINOUT,
				'test-operation',
				new Error('Network failed')
			);

			expect(error.recoverySteps).toHaveLength(3);
			expect(error.recoverySteps[0].estimatedTime).toBe('1 minute');
			expect(error.recoverySteps[1].estimatedTime).toBe('30 seconds');
			expect(error.recoverySteps[2].estimatedTime).toBe('30 seconds');
		});

		it('should handle getEstimatedTime for all recovery actions', () => {
			// Test through various error creation methods that use different actions
			const sessionExpiredError = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(sessionExpiredError.recoverySteps[0].estimatedTime).toBe('2-3 minutes');
			expect(sessionExpiredError.recoverySteps[1].estimatedTime).toBe('1 minute'); // CLEAR_CACHE is '1 minute'

			const credentialsError = ErrorHandler.createInvalidCredentialsError(
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(credentialsError.recoverySteps[0].estimatedTime).toBe('1 minute');
			expect(credentialsError.recoverySteps[1].estimatedTime).toBe('2-3 minutes');

			const rateLimitError = ErrorHandler.createRateLimitError(
				Platform.MARKETINOUT,
				'test-operation',
				30
			);
			expect(rateLimitError.recoverySteps[0].estimatedTime).toBe('30 seconds');
		});

		it('should handle createErrorContext with additional data', () => {
			// Test through createGenericError which uses createErrorContext
			const error = ErrorHandler.createGenericError(
				Platform.MARKETINOUT,
				'test-operation',
				'Test error'
			);

			expect(error.context.platform).toBe(Platform.MARKETINOUT);
			expect(error.context.operation).toBe('test-operation');
			expect(error.context.timestamp).toBeInstanceOf(Date);
			expect(error.context.additionalData?.originalError).toBe('Test error');
		});

		it('should handle getErrorSeverity for all error types', () => {
			// Test through various error creation methods
			const sessionExpiredError = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(sessionExpiredError.severity).toBe(ErrorSeverity.WARNING);

			const credentialsError = ErrorHandler.createInvalidCredentialsError(
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(credentialsError.severity).toBe(ErrorSeverity.ERROR);

			const platformError = ErrorHandler.createPlatformUnavailableError(
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(platformError.severity).toBe(ErrorSeverity.WARNING);

			const rateLimitError = ErrorHandler.createRateLimitError(
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(rateLimitError.severity).toBe(ErrorSeverity.WARNING);
		});
	});

	describe('ErrorHandler - parseError Edge Cases', () => {
		it('should handle extractErrorMessage with various input types', () => {
			// Test string input
			const stringError = ErrorHandler.parseError(
				'string error message',
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(stringError.context.additionalData?.originalError).toBe('string error message');

			// Test Error object
			const errorObject = new Error('error object message');
			const errorFromObject = ErrorHandler.parseError(
				errorObject,
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(errorFromObject.context.additionalData?.originalError).toBe('error object message');

			// Test unknown type
			const unknownError = ErrorHandler.parseError(
				{ custom: 'object' },
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(unknownError.context.additionalData?.originalError).toBe('[object Object]');

			// Test null/undefined
			const nullError = ErrorHandler.parseError(
				null,
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(nullError.context.additionalData?.originalError).toBe('null');

			const undefinedError = ErrorHandler.parseError(
				undefined,
				Platform.MARKETINOUT,
				'test-operation'
			);
			expect(undefinedError.context.additionalData?.originalError).toBe('undefined');
		});

		it('should handle categorizeError with all error patterns', () => {
			// Test all SessionErrorType patterns through parseError
			const sessionExpiredTests = [
				'session expired',
				'login required',
				'signin needed'
			];

			for (const message of sessionExpiredTests) {
				const error = ErrorHandler.parseError(
					message,
					Platform.MARKETINOUT,
					'test-operation'
				);
				expect(error.type).toBe(SessionErrorType.SESSION_EXPIRED);
			}

			const credentialsTests = [
				'credentials invalid',
				'authentication failed',
				'unauthorized access'
			];

			for (const message of credentialsTests) {
				const error = ErrorHandler.parseError(
					message,
					Platform.MARKETINOUT,
					'test-operation'
				);
				expect(error.type).toBe(SessionErrorType.INVALID_CREDENTIALS);
			}

			const networkTests = [
				'network error',
				'connection failed',
				'timeout occurred',
				'fetch failed'
			];

			for (const message of networkTests) {
				const error = ErrorHandler.parseError(
					message,
					Platform.MARKETINOUT,
					'test-operation'
				);
				expect(error.type).toBe(SessionErrorType.NETWORK_ERROR);
			}

			const platformTests = [
				'unavailable service',
				'maintenance mode'
			];

			for (const message of platformTests) {
				const error = ErrorHandler.parseError(
					message,
					Platform.MARKETINOUT,
					'test-operation'
				);
				expect(error.type).toBe(SessionErrorType.PLATFORM_UNAVAILABLE);
			}

			const rateLimitTests = [
				'rate limit exceeded',
				'too many requests'
			];

			for (const message of rateLimitTests) {
				const error = ErrorHandler.parseError(
					message,
					Platform.MARKETINOUT,
					'test-operation'
				);
				expect(error.type).toBe(SessionErrorType.API_RATE_LIMITED);
			}

			const cookieTests = [
				'cookie invalid',
				'session storage error'
			];

			for (const message of cookieTests) {
				const error = ErrorHandler.parseError(
					message,
					Platform.MARKETINOUT,
					'test-operation'
				);
				expect(error.type).toBe(SessionErrorType.COOKIE_INVALID);
			}

			const formatTests = [
				'format error',
				'parsing failed',
				'json invalid',
				'unexpected response'
			];

			for (const message of formatTests) {
				const error = ErrorHandler.parseError(
					message,
					Platform.MARKETINOUT,
					'test-operation'
				);
				expect(error.type).toBe(SessionErrorType.DATA_FORMAT_ERROR);
			}
		});

		it('should handle HTTP status code categorization', () => {
			// Test all HTTP status patterns
			const httpStatusTests = [
				{ status: 401, expectedType: SessionErrorType.SESSION_EXPIRED },
				{ status: 403, expectedType: SessionErrorType.INVALID_CREDENTIALS },
				{ status: 429, expectedType: SessionErrorType.API_RATE_LIMITED },
				{ status: 500, expectedType: SessionErrorType.PLATFORM_UNAVAILABLE },
				{ status: 501, expectedType: SessionErrorType.PLATFORM_UNAVAILABLE },
				{ status: 502, expectedType: SessionErrorType.PLATFORM_UNAVAILABLE },
				{ status: 503, expectedType: SessionErrorType.PLATFORM_UNAVAILABLE },
				{ status: 504, expectedType: SessionErrorType.PLATFORM_UNAVAILABLE },
				{ status: 505, expectedType: SessionErrorType.PLATFORM_UNAVAILABLE },
				{ status: 550, expectedType: SessionErrorType.PLATFORM_UNAVAILABLE }, // Any 5xx
				{ status: 599, expectedType: SessionErrorType.PLATFORM_UNAVAILABLE }, // Any 5xx
			];

			for (const test of httpStatusTests) {
				const error = ErrorHandler.parseError(
					'generic error',
					Platform.MARKETINOUT,
					'test-operation',
					test.status
				);
				expect(error.type).toBe(test.expectedType);
			}
		});

		it('should handle unknown error with low confidence', () => {
			const error = ErrorHandler.parseError(
				'completely unknown error message',
				Platform.MARKETINOUT,
				'test-operation'
			);

			expect(error.type).toBe(SessionErrorType.OPERATION_FAILED);
		});
	});

	describe('ErrorLogger - Additional Coverage', () => {
		it('should handle logError without additional context', () => {
			const mockError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'test-operation',
					timestamp: new Date(),
				}
			);

			ErrorLogger.logError(mockError);

			const logs = ErrorLogger.getRecentLogs(1);
			expect(logs).toHaveLength(1);
			expect(logs[0].error).toBe(mockError);
		});

		it('should handle getErrorStats with empty logs', () => {
			const stats = ErrorLogger.getErrorStats();

			expect(stats.totalErrors).toBe(0);
			expect(stats.errorsByType).toEqual({});
			expect(stats.errorsByPlatform).toEqual({});
			expect(stats.errorsBySeverity).toEqual({});
			expect(stats.recentErrorRate).toBe(0);
		});

		it('should handle getRecentLogs with default limit', () => {
			// Add more than 50 errors to test default limit
			const mockError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'test-operation',
					timestamp: new Date(),
				}
			);

			for (let i = 0; i < 60; i++) {
				ErrorLogger.logError(mockError);
			}

			const logs = ErrorLogger.getRecentLogs(); // Default limit is 50
			expect(logs).toHaveLength(50);
		});

		it('should handle clearOldLogs with default maxAge', () => {
			const mockError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'test-operation',
					timestamp: new Date(),
				}
			);

			ErrorLogger.logError(mockError);

			// Clear with default maxAge (24 hours)
			ErrorLogger.clearOldLogs();

			// Recent error should still be there
			const logs = ErrorLogger.getRecentLogs();
			expect(logs).toHaveLength(1);
		});

		it('should handle NODE_ENV not set', () => {
			vi.stubEnv('NODE_ENV', undefined);

			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

			const mockError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'test-operation',
					timestamp: new Date(),
				}
			);

			ErrorLogger.logError(mockError);

			// Should not log to console when NODE_ENV is not set
			expect(consoleSpy).not.toHaveBeenCalled();
			expect(consoleLogSpy).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
			consoleLogSpy.mockRestore();
			vi.unstubAllEnvs();
		});

		it('should handle recent error rate calculation correctly', () => {
			const now = Date.now();

			// Create errors with different timestamps
			const oldError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'Old message',
				'Old technical',
				{
					platform: Platform.MARKETINOUT,
					operation: 'old-op',
					timestamp: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
				}
			);

			const recentError = new SessionError(
				SessionErrorType.NETWORK_ERROR,
				'Recent message',
				'Recent technical',
				{
					platform: Platform.TRADINGVIEW,
					operation: 'recent-op',
					timestamp: new Date(now - 30 * 60 * 1000), // 30 minutes ago
				}
			);

			// Manually add old log entry
			const oldLogEntry = {
				error: oldError,
				timestamp: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
				context: {}
			};

			(ErrorLogger as unknown as { logs: unknown[] }).logs.push(oldLogEntry);
			ErrorLogger.logError(recentError); // This will have current timestamp

			const stats = ErrorLogger.getErrorStats();
			expect(stats.totalErrors).toBe(2);
			expect(stats.recentErrorRate).toBe(1); // Only the recent error
		});
	});

	describe('Enum Coverage', () => {
		it('should cover all enum values', () => {
			// Test all ErrorSeverity values
			expect(Object.values(ErrorSeverity)).toEqual(['info', 'warning', 'error', 'critical']);

			// Test all Platform values
			expect(Object.values(Platform)).toEqual(['marketinout', 'tradingview', 'telegram', 'unknown']);

			// Test all RecoveryAction values
			expect(Object.values(RecoveryAction)).toEqual([
				'retry',
				'refresh_session',
				're_authenticate',
				'clear_cache',
				'wait_and_retry',
				'contact_support',
				'check_network',
				'update_credentials'
			]);

			// Test all SessionErrorType values
			const expectedErrorTypes = [
				'SESSION_EXPIRED',
				'INVALID_CREDENTIALS',
				'AUTHENTICATION_FAILED',
				'NETWORK_ERROR',
				'CONNECTION_TIMEOUT',
				'DNS_RESOLUTION_FAILED',
				'PLATFORM_UNAVAILABLE',
				'PLATFORM_MAINTENANCE',
				'API_RATE_LIMITED',
				'COOKIE_INVALID',
				'COOKIE_EXPIRED',
				'SESSION_STORAGE_ERROR',
				'PERMISSION_DENIED',
				'INSUFFICIENT_PRIVILEGES',
				'DATA_FORMAT_ERROR',
				'INVALID_RESPONSE',
				'PARSING_ERROR',
				'UNKNOWN_ERROR',
				'OPERATION_FAILED'
			];

			expect(Object.values(SessionErrorType)).toEqual(expectedErrorTypes);
		});
	});
});
