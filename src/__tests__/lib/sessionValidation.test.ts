import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	validateAndCleanupMarketinoutSession,
	validateAndMonitorAllPlatforms,
	getSessionHealthWithValidation,
	forceSessionRefreshAndValidation,
	validateAndStartMonitoring,
	getHealthAwareSessionData,
	refreshSessionWithHealthCheck,
	stopMonitoringOnInvalidSession
} from '../../lib/sessionValidation';
import { ErrorHandler, Platform } from '../../lib/sessionErrors';

// Mock all dependencies
vi.mock('../../lib/MIOService', () => ({
	MIOService: {
		getWatchlistsWithSession: vi.fn(),
		refreshSession: vi.fn()
	}
}));

vi.mock('../../lib/sessionHealthMonitor', () => ({
	sessionHealthMonitor: {
		startMonitoring: vi.fn(),
		stopMonitoring: vi.fn(),
		getSessionHealthReport: vi.fn(),
		checkSessionHealth: vi.fn(),
		getSessionHealth: vi.fn()
	}
}));

vi.mock('../../lib/sessionStore', () => ({
	getSession: vi.fn(),
	deleteSession: vi.fn()
}));

vi.mock('../../lib/tradingview', () => ({
	validateTradingViewSession: vi.fn().mockResolvedValue({
		isValid: true,
		watchlistCount: 5,
		hasValidIds: true
	})
}));

vi.mock('../../lib/sessionErrors', () => {
	const createMockSessionError = (message: string, canRecover = false) => {
		const error = new Error(message) as Error & {
			name: string;
			canAutoRecover: () => boolean;
			getRecoveryInstructions: () => string[];
		};
		error.name = 'SessionError';
		error.canAutoRecover = vi.fn().mockReturnValue(canRecover);
		error.getRecoveryInstructions = vi.fn().mockReturnValue(canRecover ? ['Re-authenticate'] : ['Recovery instruction']);
		return error;
	};

	return {
		SessionError: vi.fn().mockImplementation((type: string, userMessage: string, technicalMessage: string, context: string, severity: string, recoverySteps: string[]) => {
			const error = new Error(technicalMessage) as Error & {
				name: string;
				type: string;
				userMessage: string;
				technicalMessage: string;
				context: string;
				severity: string;
				recoverySteps: string[];
				canAutoRecover: () => boolean;
				getRecoveryInstructions: () => string[];
			};
			error.name = 'SessionError';
			error.type = type;
			error.userMessage = userMessage;
			error.technicalMessage = technicalMessage;
			error.context = context;
			error.severity = severity;
			error.recoverySteps = recoverySteps || [];
			error.canAutoRecover = vi.fn().mockReturnValue(false);
			error.getRecoveryInstructions = vi.fn().mockReturnValue(['Recovery instruction']);
			return error;
		}),
		ErrorHandler: {
			createGenericError: vi.fn().mockImplementation((platform: string, functionName: string, message: string) => {
				return createMockSessionError(message, false);
			}),
			createSessionExpiredError: vi.fn().mockImplementation((platform: string, functionName: string, sessionId?: string) => {
				// Mock implementation - parameters used to satisfy interface
				void platform; void functionName; void sessionId;
				return createMockSessionError('Session expired', true);
			}),
			parseError: vi.fn().mockImplementation((error: unknown, platform: string, functionName: string) => {
				// Mock implementation - parameters used to satisfy interface
				void error; void platform; void functionName;
				return createMockSessionError('Parsed error', false);
			})
		},
		ErrorLogger: {
			logError: vi.fn()
		},
		Platform: {
			MARKETINOUT: 'marketinout',
			TRADINGVIEW: 'tradingview',
			UNKNOWN: 'unknown'
		},
		SessionErrorType: {
			SESSION_EXPIRED: 'SESSION_EXPIRED',
			OPERATION_FAILED: 'OPERATION_FAILED'
		}
	};
});

// Import mocked modules
import { MIOService } from '../../lib/MIOService';
import { sessionHealthMonitor } from '../../lib/sessionHealthMonitor';
import { getSession, deleteSession } from '../../lib/sessionStore';
import { validateTradingViewSession } from '../../lib/tradingview';

describe('sessionValidation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset console methods
		vi.spyOn(console, 'log').mockImplementation(() => { });
		vi.spyOn(console, 'warn').mockImplementation(() => { });
		vi.spyOn(console, 'error').mockImplementation(() => { });

		// Reset ErrorHandler mocks to ensure they return proper SessionError objects
		vi.mocked(ErrorHandler.createSessionExpiredError).mockImplementation((platform: string, functionName: string, sessionId?: string) => {
			const error = new Error('Session expired') as Error & {
				name: string;
				type: string;
				severity: string;
				platform: string;
				context: Record<string, unknown>;
				recoverySteps: Array<{ action: string; description: string; priority: number; automated: boolean }>;
				userMessage: string;
				technicalMessage: string;
				errorCode: string;
				timestamp: Date;
				code: string;
				canAutoRecover: () => boolean;
				getRecoveryInstructions: () => string[];
				getDisplayMessage: () => string;
				getTechnicalDetails: () => Record<string, unknown>;
				getAutomatedRecoveryActions: () => Array<{ action: string; description: string; priority: number; automated: boolean }>;
			};
			error.name = 'SessionError';
			error.type = 'SESSION_EXPIRED';
			error.severity = 'warning';
			error.platform = platform;
			error.context = { platform: platform, operation: functionName, timestamp: new Date(), sessionId: sessionId };
			error.recoverySteps = [];
			error.userMessage = 'Session expired';
			error.technicalMessage = 'Session expired';
			error.errorCode = `${platform.toUpperCase()}_SESSION_EXPIRED`;
			error.timestamp = new Date();
			error.code = error.errorCode;
			error.canAutoRecover = vi.fn().mockReturnValue(true);
			error.getRecoveryInstructions = vi.fn().mockReturnValue(['Re-authenticate']);
			error.getDisplayMessage = vi.fn().mockReturnValue('Session expired');
			error.getTechnicalDetails = vi.fn().mockReturnValue({});
			error.getAutomatedRecoveryActions = vi.fn().mockReturnValue([]);
			return error as unknown as Error;
		});

		vi.mocked(ErrorHandler.parseError).mockImplementation((error: unknown, platform: string, functionName: string) => {
			const parsedError = new Error('Parsed error') as Error & {
				name: string;
				type: string;
				severity: string;
				platform: string;
				context: Record<string, unknown>;
				recoverySteps: Array<{ action: string; description: string; priority: number; automated: boolean }>;
				userMessage: string;
				technicalMessage: string;
				errorCode: string;
				timestamp: Date;
				code: string;
				canAutoRecover: () => boolean;
				getRecoveryInstructions: () => string[];
				getDisplayMessage: () => string;
				getTechnicalDetails: () => Record<string, unknown>;
				getAutomatedRecoveryActions: () => Array<{ action: string; description: string; priority: number; automated: boolean }>;
			};
			// Mock implementation - parameters used to satisfy interface
			void error;
			parsedError.name = 'SessionError';
			parsedError.type = 'OPERATION_FAILED';
			parsedError.severity = 'error';
			parsedError.platform = platform;
			parsedError.context = { platform: platform, operation: functionName, timestamp: new Date() };
			parsedError.recoverySteps = [];
			parsedError.userMessage = 'Parsed error';
			parsedError.technicalMessage = 'Parsed error';
			parsedError.errorCode = `${platform.toUpperCase()}_OPERATION_FAILED`;
			parsedError.timestamp = new Date();
			parsedError.code = parsedError.errorCode;
			parsedError.canAutoRecover = vi.fn().mockReturnValue(false);
			parsedError.getRecoveryInstructions = vi.fn().mockReturnValue(['Recovery instruction']);
			parsedError.getDisplayMessage = vi.fn().mockReturnValue('Parsed error');
			parsedError.getTechnicalDetails = vi.fn().mockReturnValue({});
			parsedError.getAutomatedRecoveryActions = vi.fn().mockReturnValue([]);
			return parsedError as unknown as Error;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('validateAndCleanupMarketinoutSession', () => {
		it('should validate session and return watchlists when session is valid', async () => {
			const sessionId = 'test-session-id';
			const mockWatchlists = [
				{ id: '1', name: 'Watchlist 1' },
				{ id: '2', name: 'Watchlist 2' }
			];

			vi.mocked(MIOService.getWatchlistsWithSession).mockResolvedValue(mockWatchlists);

			const result = await validateAndCleanupMarketinoutSession(sessionId);

			expect(result).toEqual(mockWatchlists);
			expect(MIOService.getWatchlistsWithSession).toHaveBeenCalledWith(sessionId);
			expect(sessionHealthMonitor.startMonitoring).toHaveBeenCalledWith(sessionId, 'marketinout');
			expect(console.log).toHaveBeenCalledWith(`[SessionValidation] Validating MIO session: ${sessionId}`);
			expect(console.log).toHaveBeenCalledWith(`[SessionValidation] Session validation successful for: ${sessionId}`);
		});

		it('should throw error when sessionId is empty', async () => {
			await expect(validateAndCleanupMarketinoutSession('')).rejects.toThrow();
			expect(ErrorHandler.createGenericError).toHaveBeenCalledWith(
				Platform.MARKETINOUT,
				'validateAndCleanupMarketinoutSession',
				'Missing required parameter: internalSessionId'
			);
		});

		it('should cleanup session and throw error when no watchlists found', async () => {
			const sessionId = 'test-session-id';
			vi.mocked(MIOService.getWatchlistsWithSession).mockResolvedValue([]);

			await expect(validateAndCleanupMarketinoutSession(sessionId)).rejects.toThrow();

			expect(deleteSession).toHaveBeenCalledWith(sessionId);
			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, 'marketinout');
			expect(ErrorHandler.createSessionExpiredError).toHaveBeenCalledWith(
				Platform.MARKETINOUT,
				'validateAndCleanupMarketinoutSession',
				sessionId
			);
			expect(console.warn).toHaveBeenCalledWith(`[SessionValidation] No watchlists found for session: ${sessionId}`);
		});

		it('should cleanup session and throw error when watchlists is null', async () => {
			const sessionId = 'test-session-id';
			vi.mocked(MIOService.getWatchlistsWithSession).mockResolvedValue(null as unknown as never[]);

			await expect(validateAndCleanupMarketinoutSession(sessionId)).rejects.toThrow();

			expect(deleteSession).toHaveBeenCalledWith(sessionId);
			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, 'marketinout');
		});

		it('should handle and parse unknown errors', async () => {
			const sessionId = 'test-session-id';
			const unknownError = new Error('Unknown error');
			vi.mocked(MIOService.getWatchlistsWithSession).mockRejectedValue(unknownError);

			await expect(validateAndCleanupMarketinoutSession(sessionId)).rejects.toThrow();

			expect(deleteSession).toHaveBeenCalledWith(sessionId);
			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, 'marketinout');
			expect(ErrorHandler.parseError).toHaveBeenCalledWith(
				unknownError,
				Platform.MARKETINOUT,
				'validateAndCleanupMarketinoutSession',
				undefined,
				undefined
			);
		});
	});

	describe('validateAndMonitorAllPlatforms', () => {
		it('should throw error when sessionId is empty', async () => {
			await expect(validateAndMonitorAllPlatforms('')).rejects.toThrow();
			expect(ErrorHandler.createGenericError).toHaveBeenCalledWith(
				Platform.UNKNOWN,
				'validateAndMonitorAllPlatforms',
				'Missing required parameter: internalSessionId'
			);
		});

		it('should throw error when session does not exist', async () => {
			const sessionId = 'test-session-id';
			vi.mocked(getSession).mockResolvedValue(undefined);

			await expect(validateAndMonitorAllPlatforms(sessionId)).rejects.toThrow();
			expect(ErrorHandler.createSessionExpiredError).toHaveBeenCalledWith(
				Platform.UNKNOWN,
				'validateAndMonitorAllPlatforms',
				sessionId
			);
		});

		it('should validate multiple platforms successfully', async () => {
			const sessionId = 'test-session-id';
			const mockSession = {
				marketinout: { sessionId: 'mio-session' },
				tradingview: { sessionId: 'tv-session' }
			};
			const mockWatchlists = [{ id: '1', name: 'Test' }];

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(MIOService.getWatchlistsWithSession).mockResolvedValue(mockWatchlists);
			vi.mocked(validateTradingViewSession).mockResolvedValue({
				isValid: true,
				watchlistCount: 5,
				hasValidIds: true
			});

			const result = await validateAndMonitorAllPlatforms(sessionId);

			expect(result.validPlatforms).toContain('marketinout');
			expect(result.validPlatforms).toContain('tradingview');
			expect(result.summary.validCount).toBe(2);
			expect(result.summary.invalidCount).toBe(0);
		});

		it('should handle mixed valid and invalid platforms', async () => {
			const sessionId = 'test-session-id';
			const mockSession = {
				marketinout: { sessionId: 'mio-session' },
				tradingview: { sessionId: 'tv-session' },
				unknown: { sessionId: 'unknown-session' }
			};
			const mockWatchlists = [{ id: '1', name: 'Test' }];

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(MIOService.getWatchlistsWithSession).mockResolvedValue(mockWatchlists);
			vi.mocked(validateTradingViewSession).mockResolvedValue({
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: 'Invalid session'
			});

			const result = await validateAndMonitorAllPlatforms(sessionId);

			expect(result.validPlatforms).toContain('marketinout');
			expect(result.invalidPlatforms).toContain('tradingview');
			expect(result.invalidPlatforms).toContain('unknown');
			expect(result.summary.validCount).toBe(1);
			expect(result.summary.invalidCount).toBe(2);
		});

		it('should handle validation errors with auto-recovery', async () => {
			const sessionId = 'test-session-id';
			const mockSession = { marketinout: { sessionId: 'mio-session' } };
			const recoverableError = new Error('Recoverable error') as Error & {
				name: string;
				canAutoRecover: () => boolean;
				getRecoveryInstructions: () => string[];
			};
			recoverableError.name = 'SessionError';
			recoverableError.canAutoRecover = vi.fn().mockReturnValue(true);
			recoverableError.getRecoveryInstructions = vi.fn().mockReturnValue(['Re-authenticate', 'Refresh session']);

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(MIOService.getWatchlistsWithSession).mockRejectedValue(recoverableError);

			const result = await validateAndMonitorAllPlatforms(sessionId);

			expect(result.summary.canAutoRecover).toBe(false); // The parsed error mock returns false
			expect(result.invalidPlatforms).toContain('marketinout');
		});

		it('should handle unknown errors and parse them', async () => {
			const sessionId = 'test-session-id';
			const mockSession = { marketinout: { sessionId: 'mio-session' } };
			const unknownError = new Error('Unknown error');

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(MIOService.getWatchlistsWithSession).mockRejectedValue(unknownError);

			const result = await validateAndMonitorAllPlatforms(sessionId);

			expect(result.invalidPlatforms).toContain('marketinout');
			// ErrorHandler.parseError is called twice - once in validateAndCleanupMarketinoutSession and once in validateAndMonitorAllPlatforms
			expect(ErrorHandler.parseError).toHaveBeenCalledWith(
				unknownError,
				Platform.MARKETINOUT,
				'validateAndCleanupMarketinoutSession',
				undefined,
				undefined
			);
		});

		it('should handle unexpected errors in main function', async () => {
			const sessionId = 'test-session-id';
			const unexpectedError = new Error('Unexpected error');
			vi.mocked(getSession).mockRejectedValue(unexpectedError);

			await expect(validateAndMonitorAllPlatforms(sessionId)).rejects.toThrow();
			expect(ErrorHandler.parseError).toHaveBeenCalledWith(
				unexpectedError,
				Platform.UNKNOWN,
				'validateAndMonitorAllPlatforms',
				undefined,
				undefined
			);
		});
	});

	describe('getSessionHealthWithValidation', () => {
		it('should return health report when session exists and is monitored', async () => {
			const sessionId = 'test-session-id';
			const mockSession = { marketinout: { sessionId: 'mio-session', sessionKey: 'test-key' } };
			const mockHealthReport = {
				sessionId,
				platforms: {},
				overallStatus: 'healthy' as const,
				lastUpdated: new Date(),
				criticalErrors: [],
				recommendedActions: [],
				autoRecoveryAvailable: false
			};

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(mockHealthReport);

			const result = await getSessionHealthWithValidation(sessionId);

			expect(result.healthReport).toEqual(mockHealthReport);
			expect(result.sessionExists).toBe(true);
			expect(result.platforms).toEqual(['marketinout']);
			expect(result.isBeingMonitored).toBe(true);
		});

		it('should provide recommendations when not being monitored', async () => {
			const sessionId = 'test-session-id';
			const mockSession = { marketinout: { sessionId: 'mio-session', sessionKey: 'test-key' } };

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(null);

			const result = await getSessionHealthWithValidation(sessionId);

			expect(result.isBeingMonitored).toBe(false);
			expect(result.recommendations).toContain('Consider starting health monitoring for this session');
		});

		it('should provide recommendations for critical health status', async () => {
			const sessionId = 'test-session-id';
			const mockSession = { marketinout: { sessionId: 'mio-session', sessionKey: 'test-key' } };
			const mockHealthReport = {
				sessionId,
				platforms: {},
				overallStatus: 'critical' as const,
				lastUpdated: new Date(),
				criticalErrors: [],
				recommendedActions: [],
				autoRecoveryAvailable: false
			};

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(mockHealthReport);

			const result = await getSessionHealthWithValidation(sessionId);

			expect(result.recommendations).toContain('Session appears unhealthy - consider refreshing or re-authenticating');
		});

		it('should handle empty sessionId', async () => {
			const result = await getSessionHealthWithValidation('');

			expect(result.sessionExists).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.recommendations).toContain('Recovery instruction');
		});

		it('should handle session not found', async () => {
			const sessionId = 'test-session-id';
			vi.mocked(getSession).mockResolvedValue(undefined);

			const result = await getSessionHealthWithValidation(sessionId);

			expect(result.sessionExists).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.recommendations).toContain('Re-authenticate');
		});

		it('should handle unknown errors', async () => {
			const sessionId = 'test-session-id';
			const unknownError = new Error('Unknown error');
			vi.mocked(getSession).mockRejectedValue(unknownError);

			const result = await getSessionHealthWithValidation(sessionId);

			expect(result.sessionExists).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(ErrorHandler.parseError).toHaveBeenCalledWith(
				unknownError,
				Platform.UNKNOWN,
				'getSessionHealthWithValidation',
				undefined,
				undefined
			);
		});
	});

	describe('forceSessionRefreshAndValidation', () => {
		it('should refresh marketinout session successfully', async () => {
			const sessionId = 'test-session-id';
			const platform = 'marketinout';
			vi.mocked(MIOService.refreshSession).mockResolvedValue(true);
			vi.mocked(sessionHealthMonitor.checkSessionHealth).mockResolvedValue('healthy');

			const result = await forceSessionRefreshAndValidation(sessionId, platform);

			expect(result.success).toBe(true);
			expect(result.newStatus).toBe('healthy');
			expect(MIOService.refreshSession).toHaveBeenCalledWith(sessionId);
		});

		it('should handle tradingview platform', async () => {
			const sessionId = 'test-session-id';
			const platform = 'tradingview';
			vi.mocked(sessionHealthMonitor.checkSessionHealth).mockResolvedValue('healthy');

			const result = await forceSessionRefreshAndValidation(sessionId, platform);

			expect(result.success).toBe(true);
			expect(result.newStatus).toBe('healthy');
		});

		it('should handle empty sessionId', async () => {
			const result = await forceSessionRefreshAndValidation('', 'marketinout');

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should handle empty platform', async () => {
			const result = await forceSessionRefreshAndValidation('test-session-id', '');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Missing required parameter');
		});

		it('should handle unknown platform', async () => {
			const result = await forceSessionRefreshAndValidation('test-session-id', 'unknown');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Unknown platform');
		});

		it('should handle refresh failure', async () => {
			const sessionId = 'test-session-id';
			const platform = 'marketinout';
			vi.mocked(MIOService.refreshSession).mockResolvedValue(false);

			const result = await forceSessionRefreshAndValidation(sessionId, platform);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Session refresh failed');
		});
	});

	describe('validateAndStartMonitoring', () => {
		it('should validate and start monitoring for marketinout', async () => {
			const sessionId = 'test-session-id';
			const platform = 'marketinout';
			const mockWatchlists = [{ id: '1', name: 'Test' }];
			vi.mocked(MIOService.getWatchlistsWithSession).mockResolvedValue(mockWatchlists);
			vi.mocked(sessionHealthMonitor.checkSessionHealth).mockResolvedValue('healthy');

			const result = await validateAndStartMonitoring(sessionId, platform);

			expect(result.isValid).toBe(true);
			expect(result.watchlists).toEqual(mockWatchlists);
			expect(result.healthStatus).toBe('healthy');
			expect(result.monitoringStarted).toBe(true);
			expect(sessionHealthMonitor.startMonitoring).toHaveBeenCalledWith(sessionId, platform);
		});

		it('should validate and start monitoring for tradingview', async () => {
			const sessionId = 'test-session-id';
			const platform = 'tradingview';
			const mockSession = { tradingview: { sessionId: 'tv-session-id' } };

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(validateTradingViewSession).mockResolvedValue({
				isValid: true,
				watchlistCount: 5,
				hasValidIds: true
			});
			vi.mocked(sessionHealthMonitor.checkSessionHealth).mockResolvedValue('healthy');

			const result = await validateAndStartMonitoring(sessionId, platform);

			expect(result.isValid).toBe(true);
			expect(result.healthStatus).toBe('healthy');
			expect(result.monitoringStarted).toBe(true);
		});

		it('should handle tradingview validation failure', async () => {
			const sessionId = 'test-session-id';
			const platform = 'tradingview';
			const mockSession = { tradingview: { sessionId: 'tv-session-id' } };

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(validateTradingViewSession).mockResolvedValue({
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: 'Invalid session'
			});

			const result = await validateAndStartMonitoring(sessionId, platform);

			expect(result.isValid).toBe(false);
			expect(result.monitoringStarted).toBe(false);
			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, platform);
		});

		it('should handle tradingview session without sessionId', async () => {
			const sessionId = 'test-session-id';
			const platform = 'tradingview';
			const mockSession = { tradingview: { sessionId: '' } }; // Empty sessionId

			vi.mocked(getSession).mockResolvedValue(mockSession);

			const result = await validateAndStartMonitoring(sessionId, platform);

			expect(result.isValid).toBe(false);
			expect(result.monitoringStarted).toBe(false);
			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, platform);
		});

		it('should handle tradingview validation error', async () => {
			const sessionId = 'test-session-id';
			const platform = 'tradingview';
			const mockSession = { tradingview: { sessionId: 'tv-session-id' } };
			const validationError = new Error('Validation error');

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(validateTradingViewSession).mockRejectedValue(validationError);

			const result = await validateAndStartMonitoring(sessionId, platform);

			expect(result.isValid).toBe(false);
			expect(result.monitoringStarted).toBe(false);
			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, platform);
		});

		it('should handle missing parameters', async () => {
			const result = await validateAndStartMonitoring('', '');

			expect(result.isValid).toBe(false);
			expect(result.monitoringStarted).toBe(false);
			// The function handles missing parameters and returns appropriate result
		});

		it('should handle unknown platform', async () => {
			const result = await validateAndStartMonitoring('test-session-id', 'unknown');

			expect(result.isValid).toBe(false);
			expect(result.monitoringStarted).toBe(false);
			// The function handles unknown platform and returns appropriate result
		});

		it('should handle validation failure', async () => {
			const sessionId = 'test-session-id';
			const platform = 'marketinout';
			const validationError = new Error('Validation failed');
			vi.mocked(MIOService.getWatchlistsWithSession).mockRejectedValue(validationError);

			const result = await validateAndStartMonitoring(sessionId, platform);

			expect(result.isValid).toBe(false);
			expect(result.monitoringStarted).toBe(false);
			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, platform);
		});

		it('should handle unexpected errors', async () => {
			const sessionId = 'test-session-id';
			const platform = 'marketinout';
			const unexpectedError = new Error('Unexpected error');
			vi.mocked(MIOService.getWatchlistsWithSession).mockRejectedValue(unexpectedError);

			const result = await validateAndStartMonitoring(sessionId, platform);

			expect(result.isValid).toBe(false);
			expect(result.monitoringStarted).toBe(false);
			// ErrorHandler.parseError gets called twice due to nested function calls
			expect(ErrorHandler.parseError).toHaveBeenCalledTimes(2);
			expect(ErrorHandler.parseError).toHaveBeenNthCalledWith(1,
				unexpectedError,
				Platform.MARKETINOUT,
				'validateAndCleanupMarketinoutSession',
				undefined,
				undefined
			);
			expect(ErrorHandler.parseError).toHaveBeenNthCalledWith(2,
				expect.any(Object), // The parsed SessionError from the first call
				Platform.MARKETINOUT,
				'validateAndStartMonitoring',
				undefined,
				undefined
			);
		});
	});

	describe('getHealthAwareSessionData', () => {
		it('should return session data with health report', async () => {
			const sessionId = 'test-session-id';
			const mockSession = { marketinout: { sessionId: 'mio-session' } };
			const mockHealthReport = {
				sessionId,
				platforms: {},
				overallStatus: 'healthy' as const,
				lastUpdated: new Date(),
				criticalErrors: [],
				recommendedActions: ['Test action'],
				autoRecoveryAvailable: false
			};

			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(mockHealthReport);

			const result = await getHealthAwareSessionData(sessionId);

			expect(result.sessionExists).toBe(true);
			expect(result.platforms).toEqual(['marketinout']);
			expect(result.overallStatus).toBe('healthy');
			expect(result.canAutoRecover).toBe(false);
			expect(result.recommendations).toContain('Test action');
		});

		it('should handle session not found', async () => {
			const sessionId = 'test-session-id';
			vi.mocked(getSession).mockResolvedValue(undefined);

			const result = await getHealthAwareSessionData(sessionId);

			expect(result.sessionExists).toBe(false);
			expect(result.overallStatus).toBe('expired');
			expect(result.recommendations).toContain('Session not found - please re-authenticate');
		});

		it('should handle no health monitoring', async () => {
			const sessionId = 'test-session-id';
			const mockSession = { marketinout: { sessionId: 'mio-session' } };
			vi.mocked(getSession).mockResolvedValue(mockSession);
			vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(null);

			const result = await getHealthAwareSessionData(sessionId);

			expect(result.overallStatus).toBe('unknown');
			expect(result.recommendations).toContain('Health monitoring not active - consider starting monitoring');
		});

		it('should handle empty sessionId', async () => {
			const result = await getHealthAwareSessionData('');

			expect(result.sessionExists).toBe(false);
			expect(result.overallStatus).toBe('unknown');
			expect(result.recommendations).toContain('Error retrieving session data');
		});
	});

	describe('refreshSessionWithHealthCheck', () => {
		it('should refresh marketinout session with health check', async () => {
			const sessionId = 'test-session-id';
			const platform = 'marketinout';
			vi.mocked(MIOService.refreshSession).mockResolvedValue(true);
			vi.mocked(sessionHealthMonitor.checkSessionHealth).mockResolvedValue('healthy');
			vi.mocked(sessionHealthMonitor.getSessionHealth).mockReturnValue({ isMonitoring: true } as { isMonitoring: boolean });

			const result = await refreshSessionWithHealthCheck(sessionId, platform);

			expect(result.refreshSuccess).toBe(true);
			expect(result.healthStatus).toBe('healthy');
			expect(result.monitoringActive).toBe(true);
		});

		it('should handle tradingview platform', async () => {
			const sessionId = 'test-session-id';
			const platform = 'tradingview';
			vi.mocked(sessionHealthMonitor.checkSessionHealth).mockResolvedValue('healthy');

			const result = await refreshSessionWithHealthCheck(sessionId, platform);

			expect(result.refreshSuccess).toBe(true);
			expect(result.healthStatus).toBe('healthy');
		});

		it('should handle empty sessionId', async () => {
			const result = await refreshSessionWithHealthCheck('', 'marketinout');

			expect(result.refreshSuccess).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.monitoringActive).toBe(false);
		});

		it('should handle empty platform', async () => {
			const result = await refreshSessionWithHealthCheck('test-session-id', '');

			expect(result.refreshSuccess).toBe(false);
			// The function handles missing platform and returns appropriate result
		});

		it('should handle unknown platform', async () => {
			const result = await refreshSessionWithHealthCheck('test-session-id', 'unknown');

			expect(result.refreshSuccess).toBe(false);
			// The function handles unknown platform and returns appropriate result
		});

		it('should handle refresh failure', async () => {
			const sessionId = 'test-session-id';
			const platform = 'marketinout';
			vi.mocked(MIOService.refreshSession).mockResolvedValue(false);

			const result = await refreshSessionWithHealthCheck(sessionId, platform);

			expect(result.refreshSuccess).toBe(false);
			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, platform);
		});
	});

	describe('stopMonitoringOnInvalidSession', () => {
		it('should stop monitoring for specific platform', () => {
			const sessionId = 'test-session-id';
			const platform = 'marketinout';

			stopMonitoringOnInvalidSession(sessionId, platform);

			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, platform);
		});

		it('should stop monitoring for all platforms', () => {
			const sessionId = 'test-session-id';
			const mockHealthReport = {
				platforms: {
					marketinout: {},
					tradingview: {}
				}
			};
			vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(mockHealthReport as unknown as ReturnType<typeof sessionHealthMonitor.getSessionHealthReport>);

			stopMonitoringOnInvalidSession(sessionId);

			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, 'marketinout');
			expect(sessionHealthMonitor.stopMonitoring).toHaveBeenCalledWith(sessionId, 'tradingview');
		});

		it('should handle empty sessionId', () => {
			expect(() => stopMonitoringOnInvalidSession('')).not.toThrow();
		});

		it('should handle no health report', () => {
			const sessionId = 'test-session-id';
			vi.mocked(sessionHealthMonitor.getSessionHealthReport).mockReturnValue(null);

			expect(() => stopMonitoringOnInvalidSession(sessionId)).not.toThrow();
		});
	});
});
