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
	type RecoveryStep,
} from '@/lib/sessionErrors';

describe('sessionErrors', () => {
	describe('Enums', () => {
		it('should export ErrorSeverity enum with correct values', () => {
			expect(ErrorSeverity.INFO).toBe('info');
			expect(ErrorSeverity.WARNING).toBe('warning');
			expect(ErrorSeverity.ERROR).toBe('error');
			expect(ErrorSeverity.CRITICAL).toBe('critical');
		});

		it('should export SessionErrorType enum with all error types', () => {
			expect(SessionErrorType.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
			expect(SessionErrorType.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
			expect(SessionErrorType.NETWORK_ERROR).toBe('NETWORK_ERROR');
			expect(SessionErrorType.PLATFORM_UNAVAILABLE).toBe('PLATFORM_UNAVAILABLE');
			expect(SessionErrorType.API_RATE_LIMITED).toBe('API_RATE_LIMITED');
			expect(SessionErrorType.COOKIE_INVALID).toBe('COOKIE_INVALID');
			expect(SessionErrorType.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
			expect(SessionErrorType.DATA_FORMAT_ERROR).toBe('DATA_FORMAT_ERROR');
			expect(SessionErrorType.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
		});

		it('should export Platform enum with correct values', () => {
			expect(Platform.MARKETINOUT).toBe('marketinout');
			expect(Platform.TRADINGVIEW).toBe('tradingview');
			expect(Platform.TELEGRAM).toBe('telegram');
			expect(Platform.UNKNOWN).toBe('unknown');
		});

		it('should export RecoveryAction enum with all actions', () => {
			expect(RecoveryAction.RETRY).toBe('retry');
			expect(RecoveryAction.REFRESH_SESSION).toBe('refresh_session');
			expect(RecoveryAction.RE_AUTHENTICATE).toBe('re_authenticate');
			expect(RecoveryAction.CLEAR_CACHE).toBe('clear_cache');
			expect(RecoveryAction.WAIT_AND_RETRY).toBe('wait_and_retry');
			expect(RecoveryAction.CONTACT_SUPPORT).toBe('contact_support');
			expect(RecoveryAction.CHECK_NETWORK).toBe('check_network');
			expect(RecoveryAction.UPDATE_CREDENTIALS).toBe('update_credentials');
		});
	});

	describe('SessionError class', () => {
		let mockContext: ErrorContext;
		let mockRecoverySteps: RecoveryStep[];

		beforeEach(() => {
			mockContext = {
				platform: Platform.MARKETINOUT,
				operation: 'test-operation',
				timestamp: new Date('2023-01-01T00:00:00Z'),
				sessionId: 'test-session-id',
			};

			mockRecoverySteps = [
				{
					action: RecoveryAction.RETRY,
					description: 'Try again',
					priority: 1,
					automated: true,
					estimatedTime: '30 seconds',
				},
			];
		});

		it('should create SessionError with all properties', () => {
			const error = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				mockContext,
				ErrorSeverity.WARNING,
				mockRecoverySteps
			);

			expect(error.type).toBe(SessionErrorType.SESSION_EXPIRED);
			expect(error.severity).toBe(ErrorSeverity.WARNING);
			expect(error.platform).toBe(Platform.MARKETINOUT);
			expect(error.context).toBe(mockContext);
			expect(error.recoverySteps).toBe(mockRecoverySteps);
			expect(error.userMessage).toBe('User message');
			expect(error.technicalMessage).toBe('Technical message');
			expect(error.errorCode).toBe('MARKETINOUT_SESSION_EXPIRED');
			expect(error.timestamp).toBe(mockContext.timestamp);
			expect(error.code).toBe('MARKETINOUT_SESSION_EXPIRED');
			expect(error.name).toBe('SessionError');
			expect(error.message).toBe('Technical message');
		});

		it('should create SessionError with default severity', () => {
			const error = new SessionError(
				SessionErrorType.NETWORK_ERROR,
				'User message',
				'Technical message',
				mockContext
			);

			expect(error.severity).toBe(ErrorSeverity.ERROR);
			expect(error.recoverySteps).toEqual([]);
		});

		it('should return display message', () => {
			const error = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				mockContext
			);

			expect(error.getDisplayMessage()).toBe('User message');
		});

		it('should return technical details', () => {
			const error = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				mockContext,
				ErrorSeverity.WARNING,
				mockRecoverySteps
			);

			const details = error.getTechnicalDetails();
			expect(details.errorCode).toBe('MARKETINOUT_SESSION_EXPIRED');
			expect(details.type).toBe(SessionErrorType.SESSION_EXPIRED);
			expect(details.severity).toBe(ErrorSeverity.WARNING);
			expect(details.platform).toBe(Platform.MARKETINOUT);
			expect(details.technicalMessage).toBe('Technical message');
			expect(details.context).toBe(mockContext);
			expect(details.stack).toBeDefined();
		});

		it('should return recovery instructions sorted by priority', () => {
			const steps: RecoveryStep[] = [
				{
					action: RecoveryAction.CONTACT_SUPPORT,
					description: 'Contact support',
					priority: 3,
					automated: false,
				},
				{
					action: RecoveryAction.RETRY,
					description: 'Try again',
					priority: 1,
					automated: true,
				},
				{
					action: RecoveryAction.CLEAR_CACHE,
					description: 'Clear cache',
					priority: 2,
					automated: false,
				},
			];

			const error = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				mockContext,
				ErrorSeverity.WARNING,
				steps
			);

			const instructions = error.getRecoveryInstructions();
			expect(instructions).toEqual(['Try again', 'Clear cache', 'Contact support']);
		});

		it('should check if error can auto recover', () => {
			const stepsWithAutomated: RecoveryStep[] = [
				{
					action: RecoveryAction.RETRY,
					description: 'Try again',
					priority: 1,
					automated: true,
				},
				{
					action: RecoveryAction.CONTACT_SUPPORT,
					description: 'Contact support',
					priority: 2,
					automated: false,
				},
			];

			const errorWithAutomated = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				mockContext,
				ErrorSeverity.WARNING,
				stepsWithAutomated
			);

			const errorWithoutAutomated = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				mockContext,
				ErrorSeverity.WARNING,
				[stepsWithAutomated[1]]
			);

			expect(errorWithAutomated.canAutoRecover()).toBe(true);
			expect(errorWithoutAutomated.canAutoRecover()).toBe(false);
		});

		it('should return automated recovery actions', () => {
			const steps: RecoveryStep[] = [
				{
					action: RecoveryAction.RETRY,
					description: 'Try again',
					priority: 1,
					automated: true,
				},
				{
					action: RecoveryAction.CONTACT_SUPPORT,
					description: 'Contact support',
					priority: 2,
					automated: false,
				},
				{
					action: RecoveryAction.WAIT_AND_RETRY,
					description: 'Wait and retry',
					priority: 3,
					automated: true,
				},
			];

			const error = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				mockContext,
				ErrorSeverity.WARNING,
				steps
			);

			const automatedActions = error.getAutomatedRecoveryActions();
			expect(automatedActions).toHaveLength(2);
			expect(automatedActions[0].action).toBe(RecoveryAction.RETRY);
			expect(automatedActions[1].action).toBe(RecoveryAction.WAIT_AND_RETRY);
		});
	});

	describe('ErrorHandler class', () => {
		describe('createSessionExpiredError', () => {
			it('should create session expired error for MarketInOut', () => {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.MARKETINOUT,
					'test-operation',
					'session-123'
				);

				expect(error.type).toBe(SessionErrorType.SESSION_EXPIRED);
				expect(error.severity).toBe(ErrorSeverity.WARNING);
				expect(error.platform).toBe(Platform.MARKETINOUT);
				expect(error.context.operation).toBe('test-operation');
				expect(error.context.sessionId).toBe('session-123');
				expect(error.userMessage).toContain('MarketInOut');
				expect(error.recoverySteps).toHaveLength(2);
				expect(error.recoverySteps[0].action).toBe(RecoveryAction.RE_AUTHENTICATE);
			});

			it('should create session expired error for TradingView', () => {
				const error = ErrorHandler.createSessionExpiredError(
					Platform.TRADINGVIEW,
					'test-operation'
				);

				expect(error.userMessage).toContain('TradingView');
				expect(error.platform).toBe(Platform.TRADINGVIEW);
			});
		});

		describe('createInvalidCredentialsError', () => {
			it('should create invalid credentials error', () => {
				const error = ErrorHandler.createInvalidCredentialsError(
					Platform.MARKETINOUT,
					'login',
					401
				);

				expect(error.type).toBe(SessionErrorType.INVALID_CREDENTIALS);
				expect(error.severity).toBe(ErrorSeverity.ERROR);
				expect(error.context.httpStatus).toBe(401);
				expect(error.userMessage).toContain('Authentication failed');
				expect(error.recoverySteps).toHaveLength(2);
				expect(error.recoverySteps[0].action).toBe(RecoveryAction.UPDATE_CREDENTIALS);
			});
		});

		describe('createNetworkError', () => {
			it('should create network error', () => {
				const originalError = new Error('Connection timeout');
				const error = ErrorHandler.createNetworkError(
					Platform.TRADINGVIEW,
					'fetch-data',
					originalError,
					'https://api.example.com'
				);

				expect(error.type).toBe(SessionErrorType.NETWORK_ERROR);
				expect(error.severity).toBe(ErrorSeverity.ERROR);
				expect(error.context.requestUrl).toBe('https://api.example.com');
				expect(error.context.additionalData?.originalError).toBe('Connection timeout');
				expect(error.userMessage).toContain('Connection failed');
				expect(error.recoverySteps).toHaveLength(3);
				expect(error.recoverySteps[0].action).toBe(RecoveryAction.CHECK_NETWORK);
			});
		});

		describe('createPlatformUnavailableError', () => {
			it('should create platform unavailable error', () => {
				const error = ErrorHandler.createPlatformUnavailableError(
					Platform.MARKETINOUT,
					'get-watchlists',
					503
				);

				expect(error.type).toBe(SessionErrorType.PLATFORM_UNAVAILABLE);
				expect(error.severity).toBe(ErrorSeverity.WARNING);
				expect(error.context.httpStatus).toBe(503);
				expect(error.userMessage).toContain('MarketInOut is currently unavailable');
				expect(error.recoverySteps).toHaveLength(2);
				expect(error.recoverySteps[0].action).toBe(RecoveryAction.WAIT_AND_RETRY);
			});
		});

		describe('createRateLimitError', () => {
			it('should create rate limit error with retry after', () => {
				const error = ErrorHandler.createRateLimitError(
					Platform.TRADINGVIEW,
					'api-call',
					60
				);

				expect(error.type).toBe(SessionErrorType.API_RATE_LIMITED);
				expect(error.severity).toBe(ErrorSeverity.WARNING);
				expect(error.context.additionalData?.retryAfter).toBe(60);
				expect(error.userMessage).toContain('60 seconds');
				expect(error.recoverySteps).toHaveLength(1);
				expect(error.recoverySteps[0].action).toBe(RecoveryAction.WAIT_AND_RETRY);
			});

			it('should create rate limit error without retry after', () => {
				const error = ErrorHandler.createRateLimitError(
					Platform.TRADINGVIEW,
					'api-call'
				);

				expect(error.userMessage).toContain('1-2 minutes');
			});
		});

		describe('createCookieError', () => {
			it('should create cookie error', () => {
				const error = ErrorHandler.createCookieError(
					Platform.MARKETINOUT,
					'session-check',
					'Invalid cookie format'
				);

				expect(error.type).toBe(SessionErrorType.COOKIE_INVALID);
				expect(error.severity).toBe(ErrorSeverity.ERROR);
				expect(error.context.additionalData?.cookieIssue).toBe('Invalid cookie format');
				expect(error.userMessage).toContain('Session cookies are invalid');
				expect(error.recoverySteps).toHaveLength(2);
				expect(error.recoverySteps[0].action).toBe(RecoveryAction.CLEAR_CACHE);
			});
		});

		describe('createPermissionError', () => {
			it('should create permission error with required permission', () => {
				const error = ErrorHandler.createPermissionError(
					Platform.TRADINGVIEW,
					'delete-watchlist',
					'admin'
				);

				expect(error.type).toBe(SessionErrorType.PERMISSION_DENIED);
				expect(error.severity).toBe(ErrorSeverity.ERROR);
				expect(error.context.additionalData?.requiredPermission).toBe('admin');
				expect(error.userMessage).toContain('(admin)');
				expect(error.recoverySteps).toHaveLength(2);
				expect(error.recoverySteps[0].action).toBe(RecoveryAction.RE_AUTHENTICATE);
			});

			it('should create permission error without required permission', () => {
				const error = ErrorHandler.createPermissionError(
					Platform.TRADINGVIEW,
					'delete-watchlist'
				);

				expect(error.userMessage).not.toContain('(');
			});
		});

		describe('createDataFormatError', () => {
			it('should create data format error', () => {
				const receivedData = 'Invalid JSON response';
				const error = ErrorHandler.createDataFormatError(
					Platform.MARKETINOUT,
					'parse-response',
					'JSON',
					receivedData
				);

				expect(error.type).toBe(SessionErrorType.DATA_FORMAT_ERROR);
				expect(error.severity).toBe(ErrorSeverity.ERROR);
				expect(error.context.additionalData?.expectedFormat).toBe('JSON');
				expect(error.context.additionalData?.receivedData).toBe(receivedData);
				expect(error.userMessage).toContain('Invalid data format');
				expect(error.recoverySteps).toHaveLength(2);
				expect(error.recoverySteps[0].action).toBe(RecoveryAction.RETRY);
			});

			it('should truncate long received data', () => {
				const longData = 'x'.repeat(300);
				const error = ErrorHandler.createDataFormatError(
					Platform.MARKETINOUT,
					'parse-response',
					'JSON',
					longData
				);

				expect((error.context.additionalData?.receivedData as string).length).toBe(200);
			});
		});

		describe('createGenericError', () => {
			it('should create generic error from Error object', () => {
				const originalError = new Error('Something went wrong');
				const error = ErrorHandler.createGenericError(
					Platform.TRADINGVIEW,
					'generic-operation',
					originalError,
					500
				);

				expect(error.type).toBe(SessionErrorType.OPERATION_FAILED);
				expect(error.severity).toBe(ErrorSeverity.ERROR);
				expect(error.context.httpStatus).toBe(500);
				expect(error.context.additionalData?.originalError).toBe('Something went wrong');
				expect(error.userMessage).toContain('Operation failed');
				expect(error.recoverySteps).toHaveLength(3);
			});

			it('should create generic error from string', () => {
				const error = ErrorHandler.createGenericError(
					Platform.MARKETINOUT,
					'generic-operation',
					'String error message'
				);

				expect(error.context.additionalData?.originalError).toBe('String error message');
			});
		});

		describe('parseError', () => {
			it('should parse session expired error', () => {
				const error = ErrorHandler.parseError(
					new Error('session expired'),
					Platform.MARKETINOUT,
					'test-operation',
					401
				);

				expect(error.type).toBe(SessionErrorType.SESSION_EXPIRED);
			});

			it('should parse invalid credentials error', () => {
				const error = ErrorHandler.parseError(
					'authentication failed',
					Platform.TRADINGVIEW,
					'login',
					403
				);

				expect(error.type).toBe(SessionErrorType.INVALID_CREDENTIALS);
			});

			it('should parse network error', () => {
				const error = ErrorHandler.parseError(
					new Error('network timeout'),
					Platform.MARKETINOUT,
					'fetch-data'
				);

				expect(error.type).toBe(SessionErrorType.NETWORK_ERROR);
			});

			it('should parse platform unavailable error by HTTP status', () => {
				const error = ErrorHandler.parseError(
					'Server error',
					Platform.TRADINGVIEW,
					'api-call',
					503
				);

				expect(error.type).toBe(SessionErrorType.PLATFORM_UNAVAILABLE);
			});

			it('should parse rate limit error', () => {
				const error = ErrorHandler.parseError(
					'too many requests',
					Platform.MARKETINOUT,
					'api-call',
					429
				);

				expect(error.type).toBe(SessionErrorType.API_RATE_LIMITED);
			});

			it('should parse cookie error', () => {
				const error = ErrorHandler.parseError(
					'cookie invalid',
					Platform.TRADINGVIEW,
					'session-check'
				);

				expect(error.type).toBe(SessionErrorType.COOKIE_INVALID);
			});

			it('should parse data format error', () => {
				const error = ErrorHandler.parseError(
					'json parsing failed',
					Platform.MARKETINOUT,
					'parse-response'
				);

				expect(error.type).toBe(SessionErrorType.DATA_FORMAT_ERROR);
			});

			it('should default to generic error for unknown errors', () => {
				const error = ErrorHandler.parseError(
					'unknown error message',
					Platform.TRADINGVIEW,
					'unknown-operation'
				);

				expect(error.type).toBe(SessionErrorType.OPERATION_FAILED);
			});

			it('should handle server errors (5xx) as platform unavailable', () => {
				const error = ErrorHandler.parseError(
					'Internal server error',
					Platform.MARKETINOUT,
					'api-call',
					500
				);

				expect(error.type).toBe(SessionErrorType.PLATFORM_UNAVAILABLE);
			});

			it('should handle non-Error objects', () => {
				const error = ErrorHandler.parseError(
					{ message: 'object error' },
					Platform.TRADINGVIEW,
					'test-operation'
				);

				expect(error.type).toBe(SessionErrorType.OPERATION_FAILED);
			});
		});
	});

	describe('ErrorLogger class', () => {
		let consoleSpy: ReturnType<typeof vi.spyOn>;
		let mockError: SessionError;

		beforeEach(() => {
			consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

			const mockContext: ErrorContext = {
				platform: Platform.MARKETINOUT,
				operation: 'test-operation',
				timestamp: new Date(),
			};

			mockError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'User message',
				'Technical message',
				mockContext
			);

			// Clear logs before each test
			ErrorLogger['logs'] = [];
		});

		afterEach(() => {
			consoleSpy.mockRestore();
			// Clear logs after each test
			ErrorLogger['logs'] = [];
		});

		it('should log error with context', () => {
			const additionalContext = { userId: '123' };

			ErrorLogger.logError(mockError, additionalContext);

			const logs = ErrorLogger.getRecentLogs(1);
			expect(logs).toHaveLength(1);
			expect(logs[0].error).toBe(mockError);
			expect(logs[0].context.userId).toBe('123');
		});

		it('should log to console in development', () => {
			vi.stubEnv('NODE_ENV', 'development');

			ErrorLogger.logError(mockError);

			expect(consoleSpy).toHaveBeenCalledWith(
				'[SessionError] MARKETINOUT_SESSION_EXPIRED:',
				expect.objectContaining({
					userMessage: 'User message',
					technicalMessage: 'Technical message',
					platform: Platform.MARKETINOUT,
					operation: 'test-operation',
					severity: ErrorSeverity.ERROR,
				})
			);

			vi.unstubAllEnvs();
		});

		it('should call external logger in production', () => {
			vi.stubEnv('NODE_ENV', 'production');

			const sendToExternalLoggerSpy = vi.spyOn(ErrorLogger as unknown as { sendToExternalLogger: (entry: unknown) => void }, 'sendToExternalLogger').mockImplementation(() => { });

			ErrorLogger.logError(mockError);

			expect(sendToExternalLoggerSpy).toHaveBeenCalled();

			sendToExternalLoggerSpy.mockRestore();
			vi.unstubAllEnvs();
		});

		it('should get recent logs with limit', () => {
			// Add multiple errors
			for (let i = 0; i < 5; i++) {
				ErrorLogger.logError(mockError);
			}

			const recentLogs = ErrorLogger.getRecentLogs(3);
			expect(recentLogs).toHaveLength(3);
		});

		it('should get recent logs sorted by timestamp', () => {
			const error1 = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'Message 1',
				'Technical 1',
				{
					platform: Platform.MARKETINOUT,
					operation: 'op1',
					timestamp: new Date('2023-01-01T00:00:00Z'),
				}
			);

			const error2 = new SessionError(
				SessionErrorType.NETWORK_ERROR,
				'Message 2',
				'Technical 2',
				{
					platform: Platform.TRADINGVIEW,
					operation: 'op2',
					timestamp: new Date('2023-01-02T00:00:00Z'),
				}
			);

			// Log errors with a small delay to ensure different timestamps
			ErrorLogger.logError(error1);

			// Add a small delay to ensure different log timestamps
			const firstLogTime = Date.now();
			while (Date.now() === firstLogTime) {
				// Wait for at least 1ms difference
			}

			ErrorLogger.logError(error2);

			const logs = ErrorLogger.getRecentLogs();
			// Logs are sorted by log timestamp (when logged), not error timestamp
			// The most recently logged error should be first
			expect(logs[0].error.userMessage).toBe('Message 2'); // Most recently logged
			expect(logs[1].error.userMessage).toBe('Message 1');
		});

		it('should get error statistics', () => {
			// Add different types of errors
			const networkError = new SessionError(
				SessionErrorType.NETWORK_ERROR,
				'Network message',
				'Network technical',
				{
					platform: Platform.TRADINGVIEW,
					operation: 'network-op',
					timestamp: new Date(),
				},
				ErrorSeverity.ERROR
			);

			const warningError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'Warning message',
				'Warning technical',
				{
					platform: Platform.MARKETINOUT,
					operation: 'warning-op',
					timestamp: new Date(),
				},
				ErrorSeverity.WARNING
			);

			ErrorLogger.logError(mockError);
			ErrorLogger.logError(networkError);
			ErrorLogger.logError(warningError);

			const stats = ErrorLogger.getErrorStats();

			expect(stats.totalErrors).toBe(3);
			expect(stats.errorsByType[SessionErrorType.SESSION_EXPIRED]).toBe(2);
			expect(stats.errorsByType[SessionErrorType.NETWORK_ERROR]).toBe(1);
			expect(stats.errorsByPlatform[Platform.MARKETINOUT]).toBe(2);
			expect(stats.errorsByPlatform[Platform.TRADINGVIEW]).toBe(1);
			expect(stats.errorsBySeverity[ErrorSeverity.ERROR]).toBe(2);
			expect(stats.errorsBySeverity[ErrorSeverity.WARNING]).toBe(1);
			expect(stats.recentErrorRate).toBe(3); // All errors are recent
		});

		it('should clear old logs', () => {
			// Create an old log entry by manually manipulating the timestamp
			const oldLogEntry = {
				error: new SessionError(
					SessionErrorType.SESSION_EXPIRED,
					'Old message',
					'Old technical',
					{
						platform: Platform.MARKETINOUT,
						operation: 'old-op',
						timestamp: new Date(),
					}
				),
				timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
				context: {}
			};

			// Manually add the old log entry to simulate an old log
			(ErrorLogger as unknown as { logs: unknown[] }).logs.push(oldLogEntry);
			ErrorLogger.logError(mockError); // Recent error

			expect(ErrorLogger.getRecentLogs()).toHaveLength(2);

			ErrorLogger.clearOldLogs(24 * 60 * 60 * 1000); // 24 hours

			const remainingLogs = ErrorLogger.getRecentLogs();
			expect(remainingLogs).toHaveLength(1);
			expect(remainingLogs[0].error.userMessage).toBe('User message');
		});

		it('should send to external logger', () => {
			const logEntry = {
				error: mockError,
				timestamp: new Date(),
				context: { test: 'data' },
			};

			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

			// Call private method
			(ErrorLogger as unknown as { sendToExternalLogger: (entry: unknown) => void }).sendToExternalLogger(logEntry);

			expect(consoleSpy).toHaveBeenCalledWith(
				'[ErrorLogger] Would send to external service:',
				logEntry
			);

			consoleSpy.mockRestore();
		});
	});
});
