import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MIOService } from '../../lib/MIOService';
import * as sessionStore from '../../lib/sessionStore';
import { CookieParser } from '../../lib/cookieParser';
import { ErrorHandler, ErrorLogger, Platform, SessionError, SessionErrorType } from '../../lib/sessionErrors';
import { SessionHealthMonitor } from '../../lib/sessionHealthMonitor';
import * as sessionValidation from '../../lib/sessionValidation';

// Mock all dependencies
vi.mock('../../lib/sessionStore');
vi.mock('../../lib/cookieParser');
vi.mock('../../lib/sessionErrors', () => ({
	SessionError: vi.fn().mockImplementation((type, message) => {
		const error = new Error(message);
		error.name = 'SessionError';
		return error;
	}),
	ErrorHandler: {
		parseError: vi.fn().mockReturnValue(new Error('Parsed error')),
		createSessionExpiredError: vi.fn().mockReturnValue(new Error('Session expired')),
		createGenericError: vi.fn().mockReturnValue(new Error('Generic error')),
		createNetworkError: vi.fn().mockReturnValue(new Error('Network error')),
	},
	ErrorLogger: {
		logError: vi.fn(),
	},
	Platform: {
		MARKETINOUT: 'marketinout',
	},
	SessionErrorType: {
		SESSION_EXPIRED: 'SESSION_EXPIRED',
		OPERATION_FAILED: 'OPERATION_FAILED',
		NETWORK_ERROR: 'NETWORK_ERROR',
	},
}));
vi.mock('../../lib/sessionHealthMonitor');
vi.mock('../../lib/sessionValidation');
vi.mock('cheerio', () => ({
	load: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MIOService', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
		consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => { });

		// Reset all mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		consoleWarnSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		consoleDebugSpy.mockRestore();
	});

	describe('getSessionKeyValue', () => {
		it('should return session key-value when valid session exists', async () => {
			const mockHealthResult = {
				sessionExists: true,
				platforms: ['marketinout'],
				healthReport: null,
				overallStatus: 'healthy' as const,
				recommendations: [],
				canAutoRecover: false,
				timestamp: '2023-01-01T00:00:00Z',
			};
			const mockSession = {
				sessionId: 'test-session',
				ASPSESSIONIDABC123: 'xyz789',
			};
			const mockPrimarySession = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };

			vi.mocked(sessionValidation.getHealthAwareSessionData).mockResolvedValue(mockHealthResult);
			vi.mocked(sessionStore.getPlatformSession).mockResolvedValue(mockSession);
			vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ ASPSESSIONIDABC123: 'xyz789' });
			vi.mocked(CookieParser.getPrimaryASPSESSION).mockReturnValue(mockPrimarySession);

			const result = await MIOService.getSessionKeyValue('test-session-id');

			expect(result).toEqual(mockPrimarySession);
			expect(sessionValidation.getHealthAwareSessionData).toHaveBeenCalledWith('test-session-id');
			expect(sessionStore.getPlatformSession).toHaveBeenCalledWith('test-session-id', 'marketinout');
		});

		it('should return undefined when session does not exist', async () => {
			const mockHealthResult = {
				sessionExists: false,
				platforms: [],
				healthReport: null,
				overallStatus: 'expired' as const,
				recommendations: ['Re-authenticate'],
				canAutoRecover: false,
				timestamp: '2023-01-01T00:00:00Z',
			};

			vi.mocked(sessionValidation.getHealthAwareSessionData).mockResolvedValue(mockHealthResult);

			const result = await MIOService.getSessionKeyValue('test-session-id');

			expect(result).toBeUndefined();
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[MIOService] No valid session found for ID: test-session-id',
				expect.objectContaining({
					overallStatus: 'expired',
					recommendations: ['Re-authenticate'],
				})
			);
		});

		it('should return undefined when platform session is not found', async () => {
			const mockHealthResult = {
				sessionExists: true,
				platforms: ['marketinout'],
				healthReport: null,
				overallStatus: 'healthy' as const,
				recommendations: [],
				canAutoRecover: false,
				timestamp: '2023-01-01T00:00:00Z',
			};

			vi.mocked(sessionValidation.getHealthAwareSessionData).mockResolvedValue(mockHealthResult);
			vi.mocked(sessionStore.getPlatformSession).mockResolvedValue(undefined);

			const result = await MIOService.getSessionKeyValue('test-session-id');

			expect(result).toBeUndefined();
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[MIOService] No MarketInOut session found for ID: test-session-id'
			);
		});

		it('should use fallback key when no ASPSESSION cookies found', async () => {
			const mockHealthResult = {
				sessionExists: true,
				platforms: ['marketinout'],
				healthReport: null,
				overallStatus: 'healthy' as const,
				recommendations: [],
				canAutoRecover: false,
				timestamp: '2023-01-01T00:00:00Z',
			};
			const mockSession = {
				sessionId: 'test-session',
				otherKey: 'otherValue',
			};

			vi.mocked(sessionValidation.getHealthAwareSessionData).mockResolvedValue(mockHealthResult);
			vi.mocked(sessionStore.getPlatformSession).mockResolvedValue(mockSession);
			vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({});
			vi.mocked(CookieParser.getPrimaryASPSESSION).mockReturnValue(null);

			const result = await MIOService.getSessionKeyValue('test-session-id');

			expect(result).toEqual({ key: 'otherKey', value: 'otherValue' });
		});

		it('should return undefined when no valid cookies found', async () => {
			const mockHealthResult = {
				sessionExists: true,
				platforms: ['marketinout'],
				healthReport: null,
				overallStatus: 'healthy' as const,
				recommendations: [],
				canAutoRecover: false,
				timestamp: '2023-01-01T00:00:00Z',
			};
			const mockSession = {
				sessionId: 'test-session',
			};

			vi.mocked(sessionValidation.getHealthAwareSessionData).mockResolvedValue(mockHealthResult);
			vi.mocked(sessionStore.getPlatformSession).mockResolvedValue(mockSession);
			vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({});
			vi.mocked(CookieParser.getPrimaryASPSESSION).mockReturnValue(null);

			const result = await MIOService.getSessionKeyValue('test-session-id');

			expect(result).toBeUndefined();
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[MIOService] No valid session cookies found for ID: test-session-id'
			);
		});

		it('should handle errors and return undefined', async () => {
			const mockError = new Error('Test error');
			const mockSessionError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'Parsed error',
				'Technical error message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'getSessionKeyValue',
					timestamp: new Date()
				}
			);

			vi.mocked(sessionValidation.getHealthAwareSessionData).mockRejectedValue(mockError);
			vi.mocked(ErrorHandler.parseError).mockReturnValue(mockSessionError);

			const result = await MIOService.getSessionKeyValue('test-session-id');

			expect(result).toBeUndefined();
			expect(ErrorHandler.parseError).toHaveBeenCalledWith(
				mockError,
				Platform.MARKETINOUT,
				'getSessionKeyValue',
				undefined,
				undefined
			);
			expect(ErrorLogger.logError).toHaveBeenCalledWith(mockSessionError);
		});
	});

	describe('extractSessionFromResponse', () => {
		it('should extract ASPSESSION cookies from response', () => {
			const mockResponse = {
				headers: {
					get: vi.fn().mockReturnValue('ASPSESSIONIDABC123=xyz789; Path=/'),
				},
			} as unknown as Response;

			const mockParseResult = {
				cookies: [{ name: 'ASPSESSIONIDABC123', value: 'xyz789' }],
				aspSessionCookies: [{ name: 'ASPSESSIONIDABC123', value: 'xyz789' }],
				errors: [],
			};

			vi.mocked(CookieParser.parseSetCookieHeader).mockReturnValue(mockParseResult);
			vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({ ASPSESSIONIDABC123: 'xyz789' });

			const result = MIOService.extractSessionFromResponse(mockResponse);

			expect(result).toEqual({ ASPSESSIONIDABC123: 'xyz789' });
			expect(consoleSpy).toHaveBeenCalledWith(
				'[MIOService] Extracted 1 ASPSESSION cookies:',
				['ASPSESSIONIDABC123']
			);
		});

		it('should return null when no set-cookie headers found', () => {
			const mockResponse = {
				headers: {
					get: vi.fn().mockReturnValue(null),
				},
			} as unknown as Response;

			const result = MIOService.extractSessionFromResponse(mockResponse);

			expect(result).toBeNull();
			expect(consoleDebugSpy).toHaveBeenCalledWith('[MIOService] No set-cookie headers found in response');
		});

		it('should handle cookie parsing errors', () => {
			const mockResponse = {
				headers: {
					get: vi.fn().mockReturnValue('invalid-cookie'),
				},
			} as unknown as Response;

			const mockParseResult = {
				cookies: [],
				aspSessionCookies: [],
				errors: ['Parse error'],
			};

			vi.mocked(CookieParser.parseSetCookieHeader).mockReturnValue(mockParseResult);
			vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({});

			const result = MIOService.extractSessionFromResponse(mockResponse);

			expect(result).toBeNull();
			expect(consoleWarnSpy).toHaveBeenCalledWith('[MIOService] Cookie parsing errors:', ['Parse error']);
		});

		it('should extract other session-related cookies when no ASPSESSION found', () => {
			const mockResponse = {
				headers: {
					get: vi.fn().mockReturnValue('sessionToken=abc123; authCookie=def456'),
				},
			} as unknown as Response;

			const mockParseResult = {
				cookies: [
					{ name: 'sessionToken', value: 'abc123' },
					{ name: 'authCookie', value: 'def456' },
				],
				aspSessionCookies: [],
				errors: [],
			};

			vi.mocked(CookieParser.parseSetCookieHeader).mockReturnValue(mockParseResult);
			vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({});
			vi.mocked(CookieParser.isASPSESSIONCookie).mockReturnValue(false);

			const result = MIOService.extractSessionFromResponse(mockResponse);

			expect(result).toEqual({
				sessionToken: 'abc123',
				authCookie: 'def456',
			});
		});

		it('should handle extraction errors', () => {
			const mockResponse = {
				headers: {
					get: vi.fn().mockImplementation(() => {
						throw new Error('Header error');
					}),
				},
				url: 'https://example.com',
			} as unknown as Response;

			const mockSessionError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'Parsed error',
				'Technical error message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'extractSessionFromResponse',
					timestamp: new Date()
				}
			);
			vi.mocked(ErrorHandler.parseError).mockReturnValue(mockSessionError);

			const result = MIOService.extractSessionFromResponse(mockResponse);

			expect(result).toBeNull();
			expect(ErrorHandler.parseError).toHaveBeenCalledWith(
				expect.any(Error),
				Platform.MARKETINOUT,
				'extractSessionFromResponse',
				undefined,
				'https://example.com'
			);
			expect(ErrorLogger.logError).toHaveBeenCalledWith(mockSessionError);
		});
	});

	describe('validateSessionHealth', () => {
		it('should return true for healthy session', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const mockResponse = {
				ok: true,
				status: 200,
			} as Response;

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			mockFetch.mockResolvedValue(mockResponse);

			const result = await MIOService.validateSessionHealth('test-session-id');

			expect(result).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith(
				'https://www.marketinout.com/wl/watch_list.php?mode=list',
				{
					method: 'HEAD',
					headers: {
						Cookie: 'ASPSESSIONIDABC123=xyz789',
					},
				}
			);
		});

		it('should return true for redirect response (302)', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const mockResponse = {
				ok: false,
				status: 302,
			} as Response;

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			mockFetch.mockResolvedValue(mockResponse);

			const result = await MIOService.validateSessionHealth('test-session-id');

			expect(result).toBe(true);
		});

		it('should return false when no session key-value found', async () => {
			const mockSessionError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'Session expired',
				'Technical error message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'validateSessionHealth',
					timestamp: new Date()
				}
			);

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(undefined);
			vi.mocked(ErrorHandler.createSessionExpiredError).mockReturnValue(mockSessionError);

			const result = await MIOService.validateSessionHealth('test-session-id');

			expect(result).toBe(false);
			expect(ErrorHandler.createSessionExpiredError).toHaveBeenCalledWith(
				Platform.MARKETINOUT,
				'validateSessionHealth',
				'test-session-id'
			);
			expect(ErrorLogger.logError).toHaveBeenCalledWith(mockSessionError);
		});

		it('should return false for unhealthy session response', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const mockResponse = {
				ok: false,
				status: 401,
				url: 'https://www.marketinout.com/wl/watch_list.php?mode=list',
			} as Response;
			const mockSessionError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'Health check failed',
				'Technical error message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'validateSessionHealth',
					timestamp: new Date()
				}
			);

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			mockFetch.mockResolvedValue(mockResponse);
			vi.mocked(ErrorHandler.parseError).mockReturnValue(mockSessionError);

			const result = await MIOService.validateSessionHealth('test-session-id');

			expect(result).toBe(false);
			expect(ErrorHandler.parseError).toHaveBeenCalledWith(
				'Session health check failed with status 401',
				Platform.MARKETINOUT,
				'validateSessionHealth',
				401,
				'https://www.marketinout.com/wl/watch_list.php?mode=list'
			);
		});

		it('should handle network errors', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const networkError = new Error('Network error');
			const mockSessionError = new SessionError(
				SessionErrorType.NETWORK_ERROR,
				'Network error',
				'Technical error message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'validateSessionHealth',
					timestamp: new Date()
				}
			);

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			mockFetch.mockRejectedValue(networkError);
			vi.mocked(ErrorHandler.createNetworkError).mockReturnValue(mockSessionError);

			const result = await MIOService.validateSessionHealth('test-session-id');

			expect(result).toBe(false);
			expect(ErrorHandler.createNetworkError).toHaveBeenCalledWith(
				Platform.MARKETINOUT,
				'validateSessionHealth',
				networkError,
				'https://www.marketinout.com/wl/watch_list.php?mode=list'
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith('[MIOService] Session health check failed:', networkError);
		});
	});

	describe('refreshSession', () => {
		it('should refresh session successfully', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const mockResponse = {
				ok: true,
				status: 200,
			} as Response;

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			mockFetch.mockResolvedValue(mockResponse);

			const result = await MIOService.refreshSession('test-session-id');

			expect(result).toBe(true);
			expect(consoleSpy).toHaveBeenCalledWith('[MIOService] Refreshing session for test-session-id');
			expect(consoleSpy).toHaveBeenCalledWith('[MIOService] Session refreshed successfully for ID: test-session-id');
		});

		it('should return false when no session to refresh', async () => {
			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(undefined);

			const result = await MIOService.refreshSession('test-session-id');

			expect(result).toBe(false);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[MIOService] No valid session to refresh for ID: test-session-id'
			);
		});

		it('should return false for failed refresh', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const mockResponse = {
				ok: false,
				status: 401,
			} as Response;

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			mockFetch.mockResolvedValue(mockResponse);

			const result = await MIOService.refreshSession('test-session-id');

			expect(result).toBe(false);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[MIOService] Session refresh failed for ID: test-session-id with status: 401'
			);
		});

		it('should handle refresh errors', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const refreshError = new Error('Refresh error');
			const mockSessionError = new SessionError(
				SessionErrorType.SESSION_EXPIRED,
				'Parsed error',
				'Technical error message',
				{
					platform: Platform.MARKETINOUT,
					operation: 'refreshSession',
					timestamp: new Date()
				}
			);

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			mockFetch.mockRejectedValue(refreshError);
			vi.mocked(ErrorHandler.parseError).mockReturnValue(mockSessionError);

			const result = await MIOService.refreshSession('test-session-id');

			expect(result).toBe(false);
			expect(ErrorHandler.parseError).toHaveBeenCalledWith(
				refreshError,
				Platform.MARKETINOUT,
				'refreshSession',
				undefined,
				undefined
			);
			expect(ErrorLogger.logError).toHaveBeenCalledWith(mockSessionError);
		});
	});

	describe('getWatchlistsWithSession', () => {
		it('should throw error for failed fetch', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const mockResponse = {
				ok: false,
				status: 500,
				url: 'https://www.marketinout.com/wl/watch_list.php?mode=list',
			} as Response;
			const mockError = new SessionError(
				SessionErrorType.OPERATION_FAILED,
				'Fetch failed',
				'HTTP 500 error',
				{
					platform: Platform.MARKETINOUT,
					operation: 'getWatchlistsWithSession',
					timestamp: new Date()
				}
			);

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			mockFetch.mockResolvedValue(mockResponse);
			vi.mocked(ErrorHandler.parseError).mockReturnValue(mockError);

			await expect(MIOService.getWatchlistsWithSession('test-session-id')).rejects.toThrow('Fetch failed');
		});
	});

	describe('addWatchlistWithSession', () => {
		it('should add watchlist successfully and update health monitor', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const mockHealthMonitor = {
				checkSessionHealth: vi.fn().mockResolvedValue(true),
			};

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			vi.spyOn(MIOService, 'addWatchlist').mockResolvedValue('Success');
			vi.mocked(SessionHealthMonitor.getInstance).mockReturnValue(mockHealthMonitor as unknown as SessionHealthMonitor);

			const result = await MIOService.addWatchlistWithSession({
				internalSessionId: 'test-session-id',
				mioWlid: '1',
				symbols: 'AAPL,GOOGL',
			});

			expect(result).toBe('Success');
			expect(MIOService.addWatchlist).toHaveBeenCalledWith({
				sessionKey: 'ASPSESSIONIDABC123',
				sessionValue: 'xyz789',
				mioWlid: '1',
				symbols: 'AAPL,GOOGL',
			});
			expect(mockHealthMonitor.checkSessionHealth).toHaveBeenCalledWith('test-session-id', 'marketinout');
		});

		it('should throw error when no session found', async () => {
			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(undefined);

			await expect(
				MIOService.addWatchlistWithSession({
					internalSessionId: 'test-session-id',
					mioWlid: '1',
					symbols: 'AAPL,GOOGL',
				})
			).rejects.toThrow('No MIO session found for this user.');
		});

		it('should handle health monitor update failure gracefully', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const mockHealthMonitor = {
				checkSessionHealth: vi.fn().mockRejectedValue(new Error('Health check failed')),
			};

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			vi.spyOn(MIOService, 'addWatchlist').mockResolvedValue('Success');
			vi.mocked(SessionHealthMonitor.getInstance).mockReturnValue(mockHealthMonitor as unknown as SessionHealthMonitor);

			const result = await MIOService.addWatchlistWithSession({
				internalSessionId: 'test-session-id',
				mioWlid: '1',
				symbols: 'AAPL,GOOGL',
			});

			expect(result).toBe('Success');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[MIOService] Failed to update health status after successful operation:',
				expect.any(Error)
			);
		});

		it('should handle operation failure', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const operationError = new Error('Operation failed');

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			vi.spyOn(MIOService, 'addWatchlist').mockRejectedValue(operationError);

			await expect(
				MIOService.addWatchlistWithSession({
					internalSessionId: 'test-session-id',
					mioWlid: '1',
					symbols: 'AAPL,GOOGL',
				})
			).rejects.toThrow(operationError);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[MIOService] Operation failed, health status will be updated on next check'
			);
		});
	});


	describe('createWatchlist', () => {
		it('should create watchlist successfully', async () => {
			const mockResponse = {
				ok: true,
				text: vi.fn().mockResolvedValue('Watchlist created successfully'),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			const result = await MIOService.createWatchlist('ASPSESSIONIDABC123', 'xyz789', 'My Watchlist');

			expect(result).toBe('Watchlist created successfully');
			expect(mockFetch).toHaveBeenCalledWith(
				'https://www.marketinout.com/wl/my_watch_lists.php?mode=new&name=My%20Watchlist&wlid=',
				{
					method: 'GET',
					headers: {
						Cookie: 'ASPSESSIONIDABC123=xyz789',
					},
				}
			);
		});

		it('should throw error for failed request', async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				url: 'https://www.marketinout.com/wl/my_watch_lists.php?mode=new&name=Test&wlid=',
			} as Response;
			const mockError = new SessionError(
				SessionErrorType.OPERATION_FAILED,
				'Create failed',
				'HTTP 500 error during createWatchlist',
				{
					platform: Platform.MARKETINOUT,
					operation: 'createWatchlist',
					timestamp: new Date()
				}
			);

			mockFetch.mockResolvedValue(mockResponse);
			vi.mocked(ErrorHandler.parseError).mockReturnValue(mockError);

			await expect(MIOService.createWatchlist('ASPSESSIONIDABC123', 'xyz789', 'Test')).rejects.toThrow('Create failed');
		});
	});

	describe('deleteWatchlists', () => {
		it('should delete watchlists successfully', async () => {
			const mockResponse = {
				ok: true,
				text: vi.fn().mockResolvedValue('Watchlists deleted successfully'),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			const result = await MIOService.deleteWatchlists('ASPSESSIONIDABC123', 'xyz789', ['1', '2']);

			expect(result).toBe('Watchlists deleted successfully');
			expect(mockFetch).toHaveBeenCalledWith(
				'https://www.marketinout.com/wl/my_watch_lists.php?todelete=1&todelete=2&mode=delete',
				{
					method: 'GET',
					headers: {
						Cookie: 'ASPSESSIONIDABC123=xyz789',
					},
				}
			);
		});

		it('should throw error for empty delete IDs', async () => {
			await expect(MIOService.deleteWatchlists('ASPSESSIONIDABC123', 'xyz789', [])).rejects.toThrow(
				'No watchlist IDs provided for deletion.'
			);
		});

		it('should throw error for failed request', async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				text: vi.fn().mockResolvedValue('Server error'),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			await expect(MIOService.deleteWatchlists('ASPSESSIONIDABC123', 'xyz789', ['1'])).rejects.toThrow(
				'Failed to delete watchlists.'
			);
		});
	});

	describe('deleteWatchlistsWithSession', () => {
		it('should delete watchlists with session successfully', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			vi.spyOn(MIOService, 'deleteWatchlists').mockResolvedValue('Success');

			const result = await MIOService.deleteWatchlistsWithSession('test-session-id', ['1', '2']);

			expect(result).toBe('Success');
			expect(MIOService.deleteWatchlists).toHaveBeenCalledWith('ASPSESSIONIDABC123', 'xyz789', ['1', '2']);
		});

		it('should throw error when no session found', async () => {
			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(undefined);

			await expect(MIOService.deleteWatchlistsWithSession('test-session-id', ['1'])).rejects.toThrow(
				'No MIO session found for this user.'
			);
		});
	});
});
