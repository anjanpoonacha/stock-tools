import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MIOService } from '../../lib/MIOService';
import * as sessionStore from '../../lib/sessionStore';
import { CookieParser } from '../../lib/cookieParser';
import { ErrorHandler, Platform, SessionError, SessionErrorType } from '../../lib/sessionErrors';
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

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MIOService - Additional Coverage', () => {
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

	describe('getSessionKeyValue - Edge Cases', () => {
		it('should return undefined when health check fails', async () => {
			const mockHealthResult = {
				sessionExists: false,
				platforms: [],
				healthReport: null,
				overallStatus: 'expired' as const,
				recommendations: ['Session not found'],
				canAutoRecover: false,
				timestamp: '2023-01-01T00:00:00Z',
			};

			vi.mocked(sessionValidation.getHealthAwareSessionData).mockResolvedValue(mockHealthResult);

			const result = await MIOService.getSessionKeyValue('test-session-id');

			expect(result).toBeUndefined();
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[MIOService] No valid session found for ID: test-session-id',
				{
					overallStatus: 'expired',
					recommendations: ['Session not found']
				}
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
	});

	describe('extractSessionFromResponse - Edge Cases', () => {
		it('should handle response with no session data after filtering', async () => {
			const mockResponse = {
				headers: {
					get: vi.fn().mockReturnValue('regularCookie=value; anotherCookie=value2'),
				},
			} as unknown as Response;

			const mockParseResult = {
				cookies: [
					{ name: 'regularCookie', value: 'value' },
					{ name: 'anotherCookie', value: 'value2' },
				],
				aspSessionCookies: [],
				errors: [],
			};

			vi.mocked(CookieParser.parseSetCookieHeader).mockReturnValue(mockParseResult);
			vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({});
			vi.mocked(CookieParser.isASPSESSIONCookie).mockReturnValue(false);

			const result = MIOService.extractSessionFromResponse(mockResponse);

			expect(result).toBeNull();
			expect(consoleDebugSpy).toHaveBeenCalledWith('[MIOService] No session cookies found in response');
		});

		it('should handle mixed session and non-session cookies', async () => {
			const mockResponse = {
				headers: {
					get: vi.fn().mockReturnValue('sessionToken=abc123; regularCookie=value; authCookie=def456'),
				},
			} as unknown as Response;

			const mockParseResult = {
				cookies: [
					{ name: 'sessionToken', value: 'abc123' },
					{ name: 'regularCookie', value: 'value' },
					{ name: 'authCookie', value: 'def456' },
				],
				aspSessionCookies: [],
				errors: [],
			};

			vi.mocked(CookieParser.parseSetCookieHeader).mockReturnValue(mockParseResult);
			vi.mocked(CookieParser.extractASPSESSION).mockReturnValue({});
			vi.mocked(CookieParser.isASPSESSIONCookie).mockImplementation((name) => name === 'ASPSESSIONIDABC123');

			const result = MIOService.extractSessionFromResponse(mockResponse);

			expect(result).toEqual({
				sessionToken: 'abc123',
				authCookie: 'def456',
			});
		});
	});

	describe('validateSessionHealth - Edge Cases', () => {
		it('should handle non-Error objects in catch block', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const nonErrorObject = 'string error';
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
			mockFetch.mockRejectedValue(nonErrorObject);
			vi.mocked(ErrorHandler.createNetworkError).mockReturnValue(mockSessionError);

			const result = await MIOService.validateSessionHealth('test-session-id');

			expect(result).toBe(false);
			expect(ErrorHandler.createNetworkError).toHaveBeenCalledWith(
				Platform.MARKETINOUT,
				'validateSessionHealth',
				new Error('string error'),
				'https://www.marketinout.com/wl/watch_list.php?mode=list'
			);
		});
	});

	describe('refreshSession - Edge Cases', () => {
		it('should handle redirect status (302) as successful refresh', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const mockResponse = {
				ok: false,
				status: 302,
			} as Response;

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			mockFetch.mockResolvedValue(mockResponse);

			const result = await MIOService.refreshSession('test-session-id');

			expect(result).toBe(true);
			expect(consoleSpy).toHaveBeenCalledWith('[MIOService] Session refreshed successfully for ID: test-session-id');
		});
	});

	describe('addWatchlist - Edge Cases', () => {
		it('should handle regroupTVWatchlist function', async () => {
			const mockResponse = {
				ok: true,
				text: vi.fn().mockResolvedValue('Success'),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			const result = await MIOService.addWatchlist({
				sessionKey: 'ASPSESSIONIDABC123',
				sessionValue: 'xyz789',
				mioWlid: '1',
				symbols: 'AAPL,GOOGL,MSFT',
			});

			expect(result).toBe('Success');
			expect(mockFetch).toHaveBeenCalledWith(
				'https://www.marketinout.com/wl/watch_list.php',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Cookie: 'ASPSESSIONIDABC123=xyz789',
					},
					body: 'mode=add&wlid=1&overwrite=0&name=&stock_list=AAPL%2CGOOGL%2CMSFT',
				}
			);
		});

		it('should detect login page in response and throw session expired error', async () => {
			const mockResponse = {
				ok: true,
				text: vi.fn().mockResolvedValue('<html><body>Please login to continue</body></html>'),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			await expect(MIOService.addWatchlist({
				sessionKey: 'ASPSESSIONIDABC123',
				sessionValue: 'xyz789',
				mioWlid: '1',
				symbols: 'AAPL,GOOGL',
			})).rejects.toThrow('Session expired. Please re-authenticate with MIO.');
		});

		it('should detect signin page in response and throw session expired error', async () => {
			const mockResponse = {
				ok: true,
				text: vi.fn().mockResolvedValue('<html><body>Please signin to access this page</body></html>'),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			await expect(MIOService.addWatchlist({
				sessionKey: 'ASPSESSIONIDABC123',
				sessionValue: 'xyz789',
				mioWlid: '1',
				symbols: 'AAPL,GOOGL',
			})).rejects.toThrow('Session expired. Please re-authenticate with MIO.');
		});

		it('should detect password page in response and throw session expired error', async () => {
			const mockResponse = {
				ok: true,
				text: vi.fn().mockResolvedValue('<html><body>Enter your password</body></html>'),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			await expect(MIOService.addWatchlist({
				sessionKey: 'ASPSESSIONIDABC123',
				sessionValue: 'xyz789',
				mioWlid: '1',
				symbols: 'AAPL,GOOGL',
			})).rejects.toThrow('Session expired. Please re-authenticate with MIO.');
		});
	});

	describe('deleteWatchlists - Edge Cases', () => {
		it('should throw error for non-array todeleteIds', async () => {
			// @ts-expect-error - Testing invalid input
			await expect(MIOService.deleteWatchlists('ASPSESSIONIDABC123', 'xyz789', 'not-array')).rejects.toThrow(
				'No watchlist IDs provided for deletion.'
			);
		});

		it('should handle URL encoding of delete IDs', async () => {
			const mockResponse = {
				ok: true,
				text: vi.fn().mockResolvedValue('Success'),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			await MIOService.deleteWatchlists('ASPSESSIONIDABC123', 'xyz789', ['1', '2', 'special&id']);

			expect(mockFetch).toHaveBeenCalledWith(
				'https://www.marketinout.com/wl/my_watch_lists.php?todelete=1&todelete=2&todelete=special%26id&mode=delete',
				{
					method: 'GET',
					headers: {
						Cookie: 'ASPSESSIONIDABC123=xyz789',
					},
				}
			);
		});

		it('should log URL and parameters for debugging', async () => {
			const mockResponse = {
				ok: true,
				text: vi.fn().mockResolvedValue('Success'),
			} as unknown as Response;

			mockFetch.mockResolvedValue(mockResponse);

			await MIOService.deleteWatchlists('ASPSESSIONIDABC123', 'xyz789', ['1', '2']);

			expect(consoleSpy).toHaveBeenCalledWith(
				'[MIOService][deleteWatchlists] url:',
				'https://www.marketinout.com/wl/my_watch_lists.php?todelete=1&todelete=2&mode=delete',
				'params:',
				'todelete=1&todelete=2',
				'ids:',
				['1', '2']
			);
		});
	});

	describe('deleteWatchlistsWithSession - Edge Cases', () => {
		it('should propagate errors from deleteWatchlists', async () => {
			const mockSessionKeyValue = { key: 'ASPSESSIONIDABC123', value: 'xyz789' };
			const deleteError = new Error('Delete failed');

			vi.spyOn(MIOService, 'getSessionKeyValue').mockResolvedValue(mockSessionKeyValue);
			vi.spyOn(MIOService, 'deleteWatchlists').mockRejectedValue(deleteError);

			await expect(MIOService.deleteWatchlistsWithSession('test-session-id', ['1'])).rejects.toThrow(deleteError);
		});
	});
});
