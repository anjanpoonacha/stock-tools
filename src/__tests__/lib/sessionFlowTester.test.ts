import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionFlowTester, TestSuite } from '../../lib/sessionFlowTester';

// Mock all dependencies
vi.mock('../../lib/MIOService', () => ({
	MIOService: {
		getSessionKeyValue: vi.fn(),
		validateSessionHealth: vi.fn(),
		getWatchlistsWithSession: vi.fn(),
		refreshSession: vi.fn()
	}
}));

vi.mock('../../lib/sessionStore', () => ({
	savePlatformSessionWithCleanup: vi.fn(),
	getPlatformSession: vi.fn(),
	getSession: vi.fn()
}));

vi.mock('../../lib/sessionValidation', () => ({
	validateAndMonitorAllPlatforms: vi.fn(),
	getHealthAwareSessionData: vi.fn(),
	refreshSessionWithHealthCheck: vi.fn()
}));

vi.mock('../../lib/sessionHealthMonitor', () => ({
	SessionHealthMonitor: {
		getInstance: vi.fn(() => ({
			checkSessionHealth: vi.fn(),
			getSessionHealth: vi.fn(),
			getMonitoringStats: vi.fn(() => ({ isGlobalMonitoringActive: true }))
		}))
	}
}));

vi.mock('../../lib/cookieParser', () => ({
	CookieParser: {
		isASPSESSIONCookie: vi.fn(),
		parseSetCookieHeader: vi.fn(),
		getPrimaryASPSESSION: vi.fn(),
		extractASPSESSION: vi.fn()
	}
}));

vi.mock('../../lib/sessionErrors', () => ({
	SessionError: vi.fn().mockImplementation((type, userMessage, technicalMessage, context, severity, recoverySteps) => {
		const error = new Error(technicalMessage);
		error.name = 'SessionError';
		Object.assign(error, {
			type,
			severity: severity || 'error',
			platform: context.platform,
			context,
			recoverySteps: recoverySteps || [],
			userMessage,
			technicalMessage,
			errorCode: `${context.platform.toUpperCase()}_${type}`,
			timestamp: context.timestamp,
			code: `${context.platform.toUpperCase()}_${type}`,
			getDisplayMessage: vi.fn().mockReturnValue(userMessage),
			getTechnicalDetails: vi.fn().mockReturnValue({}),
			getRecoveryInstructions: vi.fn().mockReturnValue(['Recovery instruction']),
			canAutoRecover: vi.fn().mockReturnValue(false),
			getAutomatedRecoveryActions: vi.fn().mockReturnValue([])
		});
		return error;
	}),
	ErrorHandler: {
		createSessionExpiredError: vi.fn(),
		createGenericError: vi.fn()
	},
	ErrorLogger: {
		logError: vi.fn()
	},
	Platform: {
		MARKETINOUT: 'marketinout',
		TRADINGVIEW: 'tradingview'
	}
}));

// Import mocked modules
import { MIOService } from '../../lib/MIOService';
import { savePlatformSessionWithCleanup, getPlatformSession, getSession } from '../../lib/sessionStore';
import { getHealthAwareSessionData } from '../../lib/sessionValidation';
import { SessionHealthMonitor } from '../../lib/sessionHealthMonitor';
import { CookieParser } from '../../lib/cookieParser';
import { SessionError, ErrorHandler, ErrorLogger } from '../../lib/sessionErrors';

describe('SessionFlowTester', () => {
	let tester: SessionFlowTester;

	beforeEach(() => {
		vi.clearAllMocks();
		tester = new SessionFlowTester();

		// Setup default mock implementations
		vi.mocked(getPlatformSession).mockResolvedValue({
			sessionId: 'test-session',
			ASPSESSIONIDCQTQTQTQ: 'TESTCOOKIE123456789',
			timestamp: Date.now().toString()
		});

		vi.mocked(getSession).mockResolvedValue({
			marketinout: {
				sessionId: 'test-session',
				ASPSESSIONIDCQTQTQTQ: 'TESTCOOKIE123456789',
				timestamp: Date.now().toString()
			}
		});

		vi.mocked(MIOService.getSessionKeyValue).mockResolvedValue({
			key: 'ASPSESSIONIDCQTQTQTQ',
			value: 'TESTCOOKIE123456789'
		});

		vi.mocked(getHealthAwareSessionData).mockResolvedValue({
			sessionExists: true,
			platforms: ['marketinout'],
			healthReport: null,
			overallStatus: 'healthy',
			recommendations: [],
			canAutoRecover: false,
			timestamp: new Date().toISOString()
		});

		vi.mocked(CookieParser.isASPSESSIONCookie).mockImplementation((cookie: string) =>
			cookie.startsWith('ASPSESSIONID')
		);

		vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({
			'ASPSESSIONIDCQTQTQTQ': 'TESTCOOKIE123456789'
		});

		vi.mocked(ErrorHandler.createGenericError).mockImplementation((platform: string, operation: string, originalError: Error | string, httpStatus?: number) => {
			const message = typeof originalError === 'string' ? originalError : originalError.message;
			const mockSessionError = Object.create(SessionError.prototype);
			Object.assign(mockSessionError, {
				name: 'SessionError',
				message,
				type: 'OPERATION_FAILED',
				severity: 'error',
				platform,
				context: { platform, operation, timestamp: new Date(), httpStatus },
				recoverySteps: [],
				userMessage: `Operation failed for ${platform}. Please try again.`,
				technicalMessage: message,
				errorCode: `${platform.toUpperCase()}_OPERATION_FAILED`,
				timestamp: new Date(),
				code: `${platform.toUpperCase()}_OPERATION_FAILED`,
				getDisplayMessage: vi.fn().mockReturnValue(`Operation failed for ${platform}. Please try again.`),
				getTechnicalDetails: vi.fn().mockReturnValue({}),
				getRecoveryInstructions: vi.fn().mockReturnValue(['Recovery instruction']),
				canAutoRecover: vi.fn().mockReturnValue(false),
				getAutomatedRecoveryActions: vi.fn().mockReturnValue([])
			});
			return mockSessionError;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Constructor and Basic Setup', () => {
		it('should create SessionFlowTester instance', () => {
			expect(tester).toBeInstanceOf(SessionFlowTester);
		});
	});

	describe('runAllTests', () => {
		it('should run all test suites', async () => {
			const testSuites = await tester.runAllTests();

			expect(testSuites).toHaveLength(7);
			expect(testSuites.every(suite => suite.suiteName)).toBe(true);
			expect(testSuites.every(suite => Array.isArray(suite.tests))).toBe(true);
		});
	});

	describe('testSessionOperations', () => {
		it('should run session operations tests', async () => {
			const suite = await tester.testSessionOperations();

			expect(suite.suiteName).toBe('Session Creation & Validation');
			expect(suite.tests).toHaveLength(3);
			expect(suite.tests[0].testName).toBe('Create New Session');
			expect(suite.tests[1].testName).toBe('Health-Aware Session Validation');
			expect(suite.tests[2].testName).toBe('MIOService Session Key Extraction');
		});
	});

	describe('testHealthMonitoring', () => {
		it('should run health monitoring tests', async () => {
			const suite = await tester.testHealthMonitoring();

			expect(suite.suiteName).toBe('Health Monitoring Integration');
			expect(suite.tests).toHaveLength(3);
			expect(suite.tests[0].testName).toBe('Health Monitor Initialization');
			expect(suite.tests[1].testName).toBe('Session Health Status Tracking');
			expect(suite.tests[2].testName).toBe('Health Monitoring with Validation Integration');
		});
	});

	describe('testErrorHandling', () => {
		it('should run error handling tests', async () => {
			const suite = await tester.testErrorHandling();

			expect(suite.suiteName).toBe('Error Handling Scenarios');
			expect(suite.tests).toHaveLength(4);
			expect(suite.tests[0].testName).toBe('Session Expired Error Handling');
			expect(suite.tests[1].testName).toBe('Network Error Handling');
			expect(suite.tests[2].testName).toBe('Invalid Credentials Error Handling');
			expect(suite.tests[3].testName).toBe('Error Logging and Categorization');
		});
	});

	describe('testCookieParsing', () => {
		it('should run cookie parsing tests', async () => {
			vi.mocked(CookieParser.parseSetCookieHeader).mockReturnValue({
				cookies: [{ name: 'ASPSESSIONIDCQTQTQTQ', value: 'TESTVALUE' }],
				aspSessionCookies: [{ name: 'ASPSESSIONIDCQTQTQTQ', value: 'TESTVALUE' }],
				errors: []
			});

			vi.mocked(CookieParser.getPrimaryASPSESSION).mockReturnValue({
				key: 'ASPSESSIONIDCQTQTQTQ',
				value: 'TESTVALUE'
			});

			const suite = await tester.testCookieParsing();

			expect(suite.suiteName).toBe('Cookie Parsing Robustness');
			expect(suite.tests).toHaveLength(4);
			expect(suite.tests[0].testName).toBe('ASPSESSION Cookie Detection');
			expect(suite.tests[1].testName).toBe('Set-Cookie Header Parsing');
			expect(suite.tests[2].testName).toBe('Primary ASPSESSION Selection');
			expect(suite.tests[3].testName).toBe('Cookie Extraction from Session Data');
		});
	});

	describe('testSessionRefresh', () => {
		it('should run session refresh tests', async () => {
			const suite = await tester.testSessionRefresh();

			expect(suite.suiteName).toBe('Session Refresh Mechanisms');
			expect(suite.tests).toHaveLength(3);
			expect(suite.tests[0].testName).toBe('Health-Integrated Session Refresh');
			expect(suite.tests[1].testName).toBe('MIOService Refresh Integration');
			expect(suite.tests[2].testName).toBe('Automatic Retry on Auth Failure');
		});
	});

	describe('testCrossPlatform', () => {
		it('should run cross-platform tests', async () => {
			const suite = await tester.testCrossPlatform();

			expect(suite.suiteName).toBe('Cross-Platform Operations');
			expect(suite.tests).toHaveLength(3);
			expect(suite.tests[0].testName).toBe('Multi-Platform Session Storage');
			expect(suite.tests[1].testName).toBe('Cross-Platform Validation');
			expect(suite.tests[2].testName).toBe('Session Bridging Functionality');
		});
	});

	describe('testEndToEnd', () => {
		it('should run end-to-end tests', async () => {
			const suite = await tester.testEndToEnd();

			expect(suite.suiteName).toBe('Complete End-to-End Flow');
			expect(suite.tests).toHaveLength(2);
			expect(suite.tests[0].testName).toBe('Full Session Lifecycle');
			expect(suite.tests[1].testName).toBe('Integration with All Components');
		});
	});

	describe('generateTestReport', () => {
		it('should generate comprehensive test report', () => {
			const mockTestSuites: TestSuite[] = [
				{
					suiteName: 'Test Suite 1',
					tests: [
						{
							testName: 'Test 1',
							success: true,
							message: 'Test passed',
							duration: 100,
							timestamp: '2023-01-01T00:00:00.000Z'
						},
						{
							testName: 'Test 2',
							success: false,
							message: 'Test failed',
							duration: 200,
							timestamp: '2023-01-01T00:00:01.000Z'
						}
					],
					overallSuccess: false,
					totalDuration: 300,
					successCount: 1,
					failureCount: 1
				}
			];

			const report = tester.generateTestReport(mockTestSuites);

			expect(report).toContain('Session Management Flow Test Report');
			expect(report).toContain('**Total Test Suites**: 1');
			expect(report).toContain('**Total Tests**: 2');
			expect(report).toContain('**Successful Tests**: 1');
			expect(report).toContain('**Failed Tests**: 1');
			expect(report).toContain('**Success Rate**: 50.0%');
			expect(report).toContain('Test Suite 1');
			expect(report).toContain('✅ **Test 1**');
			expect(report).toContain('❌ **Test 2**');
		});
	});

	describe('quickHealthCheck', () => {
		it('should perform quick health check of all components', async () => {
			const healthCheck = await tester.quickHealthCheck();

			expect(healthCheck).toHaveProperty('sessionStore');
			expect(healthCheck).toHaveProperty('healthMonitor');
			expect(healthCheck).toHaveProperty('cookieParser');
			expect(healthCheck).toHaveProperty('errorHandler');
			expect(healthCheck).toHaveProperty('mioService');
			expect(healthCheck).toHaveProperty('overallHealth');

			expect(typeof healthCheck.sessionStore).toBe('boolean');
			expect(typeof healthCheck.healthMonitor).toBe('boolean');
			expect(typeof healthCheck.cookieParser).toBe('boolean');
			expect(typeof healthCheck.errorHandler).toBe('boolean');
			expect(typeof healthCheck.mioService).toBe('boolean');
			expect(typeof healthCheck.overallHealth).toBe('boolean');
		});

		it('should return true for all components when mocks are working', async () => {
			// Create a proper SessionError-like object that passes instanceof check
			const mockSessionError = Object.create(SessionError.prototype);
			Object.assign(mockSessionError, {
				name: 'SessionError',
				message: 'Test error',
				platform: 'marketinout',
				context: { operation: 'healthCheck' },
				getRecoveryInstructions: vi.fn().mockReturnValue(['Recovery instruction'])
			});

			vi.mocked(ErrorHandler.createGenericError).mockReturnValue(mockSessionError);

			const healthCheck = await tester.quickHealthCheck();

			expect(healthCheck.sessionStore).toBe(true);
			expect(healthCheck.healthMonitor).toBe(true);
			expect(healthCheck.cookieParser).toBe(true);
			expect(healthCheck.errorHandler).toBe(true);
			expect(healthCheck.mioService).toBe(true);
			expect(healthCheck.overallHealth).toBe(true);
		});

		it('should handle errors gracefully during health check', async () => {
			vi.mocked(savePlatformSessionWithCleanup).mockRejectedValue(new Error('Storage error'));

			const healthCheck = await tester.quickHealthCheck();

			expect(healthCheck.sessionStore).toBe(false);
			expect(healthCheck.overallHealth).toBe(false);
		});
	});

	describe('Error Handling in Tests', () => {
		it('should handle test failures gracefully', async () => {
			vi.mocked(getPlatformSession).mockRejectedValue(new Error('Session not found'));

			const suite = await tester.testSessionOperations();

			expect(suite.tests[0].success).toBe(false);
			expect(suite.tests[0].message).toContain('Test failed');
			expect(suite.overallSuccess).toBe(false);
			expect(suite.failureCount).toBeGreaterThan(0);
		});

		it('should measure test duration correctly', async () => {
			const suite = await tester.testSessionOperations();

			suite.tests.forEach(test => {
				expect(test.duration).toBeGreaterThanOrEqual(0);
				expect(typeof test.duration).toBe('number');
			});
		});

		it('should include timestamps in test results', async () => {
			const suite = await tester.testSessionOperations();

			suite.tests.forEach(test => {
				expect(test.timestamp).toBeDefined();
				expect(new Date(test.timestamp).getTime()).toBeGreaterThan(0);
			});
		});
	});

	describe('Test Suite Creation', () => {
		it('should create test suite with correct statistics', async () => {
			const suite = await tester.testSessionOperations();

			expect(suite.suiteName).toBeDefined();
			expect(suite.tests).toBeInstanceOf(Array);
			expect(suite.successCount).toBe(suite.tests.filter(t => t.success).length);
			expect(suite.failureCount).toBe(suite.tests.filter(t => !t.success).length);
			expect(suite.totalDuration).toBe(suite.tests.reduce((sum, t) => sum + t.duration, 0));
			expect(suite.overallSuccess).toBe(suite.failureCount === 0);
		});
	});

	describe('Mock Interactions', () => {
		it('should call session store methods during session tests', async () => {
			await tester.testSessionOperations();

			expect(savePlatformSessionWithCleanup).toHaveBeenCalled();
			expect(getPlatformSession).toHaveBeenCalled();
		});

		it('should call MIOService methods during MIO tests', async () => {
			await tester.testSessionOperations();

			expect(MIOService.getSessionKeyValue).toHaveBeenCalled();
		});

		it('should call health monitoring methods during health tests', async () => {
			await tester.testHealthMonitoring();

			expect(SessionHealthMonitor.getInstance).toHaveBeenCalled();
		});

		it('should call cookie parser methods during cookie tests', async () => {
			await tester.testCookieParsing();

			expect(CookieParser.isASPSESSIONCookie).toHaveBeenCalled();
			expect(CookieParser.extractASPSESSION).toHaveBeenCalled();
		});

		it('should call error handler methods during error tests', async () => {
			await tester.testErrorHandling();

			expect(ErrorHandler.createSessionExpiredError).toHaveBeenCalled();
			expect(ErrorLogger.logError).toHaveBeenCalled();
		});
	});
});
