import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionHealthMonitor } from '../../lib/sessionHealthMonitor';
import { MIOService } from '../../lib/MIOService';

// Mock dependencies
vi.mock('../../lib/MIOService', () => ({
	MIOService: {
		validateSessionHealth: vi.fn()
	}
}));

vi.mock('../../lib/sessionStore', () => ({
	deleteSession: vi.fn()
}));

vi.mock('../../lib/sessionErrors', () => ({
	SessionError: vi.fn().mockImplementation((type, message, code, platform, context, timestamp) => {
		const error = new Error(message);
		error.name = 'SessionError';
		return Object.assign(error, { type, code, platform, context, timestamp });
	}),
	ErrorHandler: {
		createGenericError: vi.fn().mockImplementation((platform, context, message) => {
			const error = new Error(message);
			error.name = 'SessionError';
			return Object.assign(error, { platform, context, timestamp: new Date().toISOString() });
		}),
		parseError: vi.fn().mockImplementation((error, platform, context) => {
			const sessionError = new Error('Parsed error');
			sessionError.name = 'SessionError';
			return Object.assign(sessionError, { platform, context, timestamp: new Date().toISOString() });
		})
	},
	ErrorLogger: {
		logError: vi.fn()
	},
	Platform: {
		MARKETINOUT: 'marketinout',
		TRADINGVIEW: 'tradingview'
	}
}));

describe('SessionHealthMonitor - Additional Coverage', () => {
	let monitor: SessionHealthMonitor;
	let mockConsoleLog: ReturnType<typeof vi.spyOn>;
	let mockConsoleError: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		// Setup console mocks fresh for each test
		mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => { });
		mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

		// Get fresh instance for each test
		monitor = SessionHealthMonitor.getInstance();

		// Comprehensive cleanup: stop all existing monitoring sessions
		const allReports = monitor.getAllHealthReports();
		allReports.forEach(report => {
			Object.keys(report.platforms).forEach(platform => {
				monitor.stopMonitoring(report.sessionId, platform);
			});
		});

		// Additional cleanup for any remaining sessions that might not be in reports
		const stats = monitor.getMonitoringStats();
		if (stats.totalSessions > 0) {
			// Force clear by trying common test session patterns
			const commonSessionIds = ['test-session', 'test-session-1', 'test-session-2', 'test-session-3'];
			const commonPlatforms = ['marketinout', 'tradingview', 'unknown-platform'];

			commonSessionIds.forEach(sessionId => {
				commonPlatforms.forEach(platform => {
					monitor.stopMonitoring(sessionId, platform);
				});
			});
		}
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe('recordHealthCheckError Method Coverage', () => {
		it('should record health check errors with proper error tracking and logging', async () => {
			const mockValidateSessionHealth = vi.mocked(MIOService.validateSessionHealth);

			// Create a SessionError with all required properties
			const testError = new Error('Test validation error');
			testError.name = 'SessionError';
			Object.assign(testError, {
				type: 'AUTHENTICATION_ERROR',
				code: 'AUTH_001',
				platform: 'marketinout',
				context: 'healthCheck',
				timestamp: new Date().toISOString()
			});

			mockValidateSessionHealth.mockRejectedValueOnce(testError);

			monitor.startMonitoring('test-session-1', 'marketinout');
			await monitor.checkSessionHealth('test-session-1', 'marketinout');

			// The recordHealthCheckError method is private and gets called internally
			// We can verify its effects through the health metrics
			const health = monitor.getSessionHealth('test-session-1', 'marketinout');
			expect(health!.status).toBe('critical');
			expect(health!.totalFailures).toBe(1);

			// Verify that the error was handled properly by checking console output
			// The actual console.error call includes both the message and the error object
			expect(mockConsoleError).toHaveBeenCalledWith(
				'[SessionHealthMonitor] Health check failed for marketinout:test-session-1:',
				expect.objectContaining({
					message: 'Test validation error',
					name: 'SessionError'
				})
			);
		});

		it('should handle error history management in recordHealthCheckError', async () => {
			const mockValidateSessionHealth = vi.mocked(MIOService.validateSessionHealth);

			monitor.startMonitoring('test-session-1', 'marketinout');

			// Create multiple errors to test error history management
			for (let i = 0; i < 3; i++) {
				const testError = new Error(`Test error ${i}`);
				testError.name = 'SessionError';
				Object.assign(testError, {
					type: 'NETWORK_ERROR',
					code: `NET_00${i}`,
					platform: 'marketinout',
					context: 'healthCheck',
					timestamp: new Date().toISOString()
				});

				mockValidateSessionHealth.mockRejectedValueOnce(testError);
				await monitor.checkSessionHealth('test-session-1', 'marketinout');
			}

			// Verify that console.error was called for each error
			// Note: The console.error calls are from the main checkSessionHealth method, not recordHealthCheckError
			expect(mockConsoleError).toHaveBeenCalledTimes(3);

			const health = monitor.getSessionHealth('test-session-1', 'marketinout');
			expect(health!.status).toBe('critical');
			expect(health!.totalFailures).toBe(3);
		});
	});
	describe('TradingView Health Check Coverage', () => {
		it('should cover TradingView health check with empty sessionId', async () => {
			// This test covers the error handling in checkTradingViewHealth
			monitor.startMonitoring('', 'tradingview');
			const status = await monitor.checkSessionHealth('', 'tradingview');

			expect(status).toBe('critical');

			// Verify that the error handling was triggered
			const health = monitor.getSessionHealth('', 'tradingview');
			expect(health!.status).toBe('critical');
		});

		it('should cover TradingView health check success path', async () => {
			monitor.startMonitoring('valid-session', 'tradingview');
			const status = await monitor.checkSessionHealth('valid-session', 'tradingview');

			expect(status).toBe('healthy');

			// Verify console.log was called for the unimplemented message
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'[SessionHealthMonitor] TradingView health check not yet implemented for valid-session'
			);
		});
	});


	describe('Session Cleanup Coverage', () => {
		it('should handle basic session cleanup', async () => {
			const mockValidateSessionHealth = vi.mocked(MIOService.validateSessionHealth);

			monitor.startMonitoring('cleanup-test', 'marketinout');

			// Make the session expire
			mockValidateSessionHealth.mockResolvedValue(false);
			await monitor.checkSessionHealth('cleanup-test', 'marketinout');
			await monitor.checkSessionHealth('cleanup-test', 'marketinout');
			await monitor.checkSessionHealth('cleanup-test', 'marketinout');

			const health = monitor.getSessionHealth('cleanup-test', 'marketinout');
			expect(health!.status).toBe('expired');
			expect(health!.isMonitoring).toBe(false);

			// Verify that the session was marked as expired
			expect(mockConsoleError).toHaveBeenCalledWith(
				'[SessionHealthMonitor] Session cleanup-test for marketinout marked as expired'
			);
		});

		it('should handle mixed platform status scenarios', async () => {
			const mockValidateSessionHealth = vi.mocked(MIOService.validateSessionHealth);

			// Create session with two platforms
			monitor.startMonitoring('mixed-session', 'marketinout');
			monitor.startMonitoring('mixed-session', 'tradingview');

			// Make only marketinout expire
			mockValidateSessionHealth.mockResolvedValue(false);
			await monitor.checkSessionHealth('mixed-session', 'marketinout');
			await monitor.checkSessionHealth('mixed-session', 'marketinout');
			await monitor.checkSessionHealth('mixed-session', 'marketinout');

			const healthMIO = monitor.getSessionHealth('mixed-session', 'marketinout');
			const healthTV = monitor.getSessionHealth('mixed-session', 'tradingview');

			expect(healthMIO!.status).toBe('expired');
			expect(healthTV!.status).toBe('healthy');
		});
	});

	describe('Edge Cases Coverage', () => {
		it('should handle error scenarios properly', async () => {
			const mockValidateSessionHealth = vi.mocked(MIOService.validateSessionHealth);

			// Create an error to test error handling
			const testError = new Error('Test error');
			mockValidateSessionHealth.mockRejectedValueOnce(testError);

			monitor.startMonitoring('error-test-session', 'marketinout');
			await monitor.checkSessionHealth('error-test-session', 'marketinout');

			// Verify error was handled properly
			expect(mockConsoleError).toHaveBeenCalledWith(
				'[SessionHealthMonitor] Health check failed for marketinout:error-test-session:',
				expect.objectContaining({
					message: 'Test error'
				})
			);

			const health = monitor.getSessionHealth('error-test-session', 'marketinout');
			expect(health!.status).toBe('critical');
		});

		it('should handle complex platform combinations', async () => {
			const mockValidateSessionHealth = vi.mocked(MIOService.validateSessionHealth);

			// Create multiple sessions with different platform combinations
			monitor.startMonitoring('complex-session-1', 'marketinout');
			monitor.startMonitoring('complex-session-1', 'tradingview');
			monitor.startMonitoring('complex-session-2', 'marketinout');

			// Make complex-session-1 marketinout expire
			mockValidateSessionHealth.mockResolvedValue(false);
			await monitor.checkSessionHealth('complex-session-1', 'marketinout');
			await monitor.checkSessionHealth('complex-session-1', 'marketinout');
			await monitor.checkSessionHealth('complex-session-1', 'marketinout');

			// Stop monitoring the expired platform
			monitor.stopMonitoring('complex-session-1', 'marketinout');

			// Should not delete complex-session-1 since tradingview is still active
			// This tests the platform filtering logic in cleanupExpiredSession
			const remainingHealth = monitor.getSessionHealth('complex-session-1', 'tradingview');
			expect(remainingHealth).not.toBeNull();
			expect(remainingHealth!.status).toBe('healthy');
		});
	});

	describe('Comprehensive Coverage Tests', () => {
		it('should handle network errors properly', async () => {
			const mockValidateSessionHealth = vi.mocked(MIOService.validateSessionHealth);

			// Create a network error scenario
			const networkError = new Error('Network timeout');
			mockValidateSessionHealth.mockRejectedValueOnce(networkError);

			monitor.startMonitoring('network-error-test', 'marketinout');
			await monitor.checkSessionHealth('network-error-test', 'marketinout');

			// Verify error was handled
			expect(mockConsoleError).toHaveBeenCalledWith(
				'[SessionHealthMonitor] Health check failed for marketinout:network-error-test:',
				expect.objectContaining({
					message: 'Network timeout'
				})
			);

			const health = monitor.getSessionHealth('network-error-test', 'marketinout');
			expect(health!.status).toBe('critical');
		});

		it('should handle session expiration and cleanup scheduling', async () => {
			const mockValidateSessionHealth = vi.mocked(MIOService.validateSessionHealth);

			monitor.startMonitoring('expiration-test', 'marketinout');

			// Make session expire
			mockValidateSessionHealth.mockResolvedValue(false);
			await monitor.checkSessionHealth('expiration-test', 'marketinout');
			await monitor.checkSessionHealth('expiration-test', 'marketinout');
			await monitor.checkSessionHealth('expiration-test', 'marketinout');

			const health = monitor.getSessionHealth('expiration-test', 'marketinout');
			expect(health!.status).toBe('expired');
			expect(health!.isMonitoring).toBe(false);

			// Verify expiration was logged
			expect(mockConsoleError).toHaveBeenCalledWith(
				'[SessionHealthMonitor] Session expiration-test for marketinout marked as expired'
			);
		});
	});
});
