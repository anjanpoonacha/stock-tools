import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	fetchShortlist,
	postAlert,
	parseAlertPayload,
	fetchWatchlistsWithAuth,
	appendSymbolToWatchlist,
	validateTradingViewSession,
	type TradingViewWatchlist
} from '../../lib/tradingview';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

describe('tradingview', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockConsoleError.mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('fetchShortlist', () => {
		it('should throw error as not implemented', async () => {
			await expect(fetchShortlist()).rejects.toThrow('fetchShortlist not implemented');
		});
	});

	describe('postAlert', () => {
		it('should throw error as not implemented', async () => {
			await expect(postAlert()).rejects.toThrow('postAlert not implemented');
		});
	});

	describe('parseAlertPayload', () => {
		it('should return the same data for string input', () => {
			const input = 'test payload';
			const result = parseAlertPayload(input);
			expect(result).toBe(input);
		});

		it('should return the same data for object input', () => {
			const input = { symbol: 'NSE:TCS', price: 100 };
			const result = parseAlertPayload(input);
			expect(result).toEqual(input);
		});

		it('should return the same data for array input', () => {
			const input = ['symbol1', 'symbol2'];
			const result = parseAlertPayload(input);
			expect(result).toEqual(input);
		});

		it('should return the same data for number input', () => {
			const input = 42;
			const result = parseAlertPayload(input);
			expect(result).toBe(input);
		});

		it('should return the same data for boolean input', () => {
			const input = true;
			const result = parseAlertPayload(input);
			expect(result).toBe(input);
		});

		it('should return the same data for null input', () => {
			const input = null;
			const result = parseAlertPayload(input);
			expect(result).toBe(input);
		});

		it('should return the same data for undefined input', () => {
			const input = undefined;
			const result = parseAlertPayload(input);
			expect(result).toBe(input);
		});
	});

	describe('fetchWatchlistsWithAuth', () => {
		const mockUrl = 'https://api.tradingview.com/watchlists';
		const mockCookie = 'sessionid=test123';

		it('should successfully fetch and filter watchlists', async () => {
			const mockResponse = [
				{
					id: 'wl1',
					name: 'My Watchlist',
					symbols: ['NSE:TCS', 'NSE:INFY'],
					extraField: 'should be filtered out'
				},
				{
					id: 'wl2',
					name: 'Tech Stocks',
					symbols: ['NASDAQ:AAPL', 'NASDAQ:GOOGL'],
					anotherField: 'also filtered'
				}
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse)
			});

			const result = await fetchWatchlistsWithAuth(mockUrl, mockCookie);

			expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
					Cookie: mockCookie,
				},
			});

			expect(result).toEqual([
				{
					id: 'wl1',
					name: 'My Watchlist',
					symbols: ['NSE:TCS', 'NSE:INFY']
				},
				{
					id: 'wl2',
					name: 'Tech Stocks',
					symbols: ['NASDAQ:AAPL', 'NASDAQ:GOOGL']
				}
			]);
		});

		it('should filter out invalid watchlist objects', async () => {
			const mockResponse = [
				{
					id: 'wl1',
					name: 'Valid Watchlist',
					symbols: ['NSE:TCS']
				},
				{
					// Missing id
					name: 'Invalid Watchlist 1',
					symbols: ['NSE:INFY']
				},
				{
					id: 'wl2',
					// Missing name
					symbols: ['NSE:RELIANCE']
				},
				{
					id: 'wl3',
					name: 'Invalid Watchlist 2',
					// Missing symbols
				},
				{
					id: 'wl4',
					name: 'Invalid Watchlist 3',
					symbols: 'not an array'
				},
				null,
				'invalid string',
				42
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse)
			});

			const result = await fetchWatchlistsWithAuth(mockUrl, mockCookie);

			expect(result).toEqual([
				{
					id: 'wl1',
					name: 'Valid Watchlist',
					symbols: ['NSE:TCS']
				}
			]);
		});

		it('should handle HTTP error responses', async () => {
			const mockErrorText = 'Unauthorized access';
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				text: vi.fn().mockResolvedValue(mockErrorText)
			});

			await expect(fetchWatchlistsWithAuth(mockUrl, mockCookie))
				.rejects.toThrow('Failed to fetch: 401 Unauthorized');

			// Console error is called but we don't need to assert it since it's logged in the catch block
		});

		it('should handle non-array response format', async () => {
			const mockResponse = { error: 'Invalid format' };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse)
			});

			await expect(fetchWatchlistsWithAuth(mockUrl, mockCookie))
				.rejects.toThrow('Unexpected response format from TradingView API');

			// Console error is called but we don't need to assert it since it's logged in the catch block
		});

		it('should handle fetch network errors', async () => {
			const networkError = new Error('Network error');
			mockFetch.mockRejectedValueOnce(networkError);

			await expect(fetchWatchlistsWithAuth(mockUrl, mockCookie))
				.rejects.toThrow('Network error');

			// Console error is called but we don't need to assert it since it's logged in the catch block
		});

		it('should handle JSON parsing errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
			});

			await expect(fetchWatchlistsWithAuth(mockUrl, mockCookie))
				.rejects.toThrow('Invalid JSON');

			// Console error is called but we don't need to assert it since it's logged in the catch block
		});

		it('should return empty array when all watchlists are invalid', async () => {
			const mockResponse = [
				{ invalid: 'object' },
				null,
				'string',
				42,
				[]
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse)
			});

			const result = await fetchWatchlistsWithAuth(mockUrl, mockCookie);
			expect(result).toEqual([]);
		});
	});

	describe('appendSymbolToWatchlist', () => {
		const mockWatchlistId = 'wl123';
		const mockSymbol = 'NSE:TCS';
		const mockCookie = 'sessionid=test123';

		it('should successfully append symbol to watchlist', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true
			});

			await appendSymbolToWatchlist(mockWatchlistId, mockSymbol, mockCookie);

			expect(mockFetch).toHaveBeenCalledWith(
				`https://www.tradingview.com/api/v1/symbols_list/custom/${mockWatchlistId}/append/`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Cookie: mockCookie,
						Origin: 'https://www.tradingview.com',
						'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
					},
					body: JSON.stringify([mockSymbol]),
				}
			);
		});

		it('should handle HTTP error responses', async () => {
			const mockErrorText = 'Watchlist not found';
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				text: vi.fn().mockResolvedValue(mockErrorText)
			});

			await expect(appendSymbolToWatchlist(mockWatchlistId, mockSymbol, mockCookie))
				.rejects.toThrow('[TradingView API] Failed to append symbol: 404 Not Found - Watchlist not found');
		});

		it('should handle network errors', async () => {
			const networkError = new Error('Network timeout');
			mockFetch.mockRejectedValueOnce(networkError);

			await expect(appendSymbolToWatchlist(mockWatchlistId, mockSymbol, mockCookie))
				.rejects.toThrow('Network timeout');
		});

		it('should handle different symbol formats', async () => {
			const symbols = ['NASDAQ:AAPL', 'NYSE:TSLA', 'BSE:SENSEX'];

			// Mock fetch for each symbol call
			symbols.forEach(() => {
				mockFetch.mockResolvedValueOnce({
					ok: true
				});
			});

			for (const symbol of symbols) {
				await appendSymbolToWatchlist(mockWatchlistId, symbol, mockCookie);
			}

			// Verify all calls were made with correct parameters
			symbols.forEach((symbol, index) => {
				expect(mockFetch).toHaveBeenNthCalledWith(
					index + 1,
					expect.any(String),
					expect.objectContaining({
						body: JSON.stringify([symbol])
					})
				);
			});
		});
	});

	describe('validateTradingViewSession', () => {
		const mockCookie = 'sessionid=test123';
		const validationUrl = 'https://www.tradingview.com/api/v1/symbols_list/custom/';

		it('should return valid session for logged-in user with multiple watchlists', async () => {
			const mockResponse = [
				{ id: 'wl1', name: 'Watchlist 1' },
				{ id: 'wl2', name: 'Watchlist 2' }
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse)
			});

			const result = await validateTradingViewSession(mockCookie);

			expect(mockFetch).toHaveBeenCalledWith(validationUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
					Cookie: mockCookie,
				},
			});

			expect(result).toEqual({
				isValid: true,
				watchlistCount: 2,
				hasValidIds: true
			});
		});

		it('should return valid session for logged-in user with single valid watchlist', async () => {
			const mockResponse = [
				{ id: 'wl1', name: 'My Watchlist' }
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse)
			});

			const result = await validateTradingViewSession(mockCookie);

			expect(result).toEqual({
				isValid: true,
				watchlistCount: 1,
				hasValidIds: true
			});
		});

		it('should return invalid session for logged-out user (null id)', async () => {
			const mockResponse = [
				{ id: null, name: 'Default Watchlist' }
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse)
			});

			const result = await validateTradingViewSession(mockCookie);

			expect(result).toEqual({
				isValid: false,
				watchlistCount: 1,
				hasValidIds: false,
				error: 'Session appears to be logged out (null watchlist ID detected)'
			});
		});

		it('should handle HTTP error responses', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized'
			});

			const result = await validateTradingViewSession(mockCookie);

			expect(result).toEqual({
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: 'HTTP 401: Unauthorized'
			});
		});

		it('should handle non-array response format', async () => {
			const mockResponse = { error: 'Invalid format' };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse)
			});

			const result = await validateTradingViewSession(mockCookie);

			expect(result).toEqual({
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: 'Unexpected response format'
			});
		});

		it('should handle network errors', async () => {
			const networkError = new Error('Connection timeout');
			mockFetch.mockRejectedValueOnce(networkError);

			const result = await validateTradingViewSession(mockCookie);

			// Console error is called but we don't need to assert it since it's logged in the catch block

			expect(result).toEqual({
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: 'Connection timeout'
			});
		});

		it('should handle JSON parsing errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
			});

			const result = await validateTradingViewSession(mockCookie);

			expect(result).toEqual({
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: 'Invalid JSON'
			});
		});

		it('should handle non-Error exceptions', async () => {
			mockFetch.mockRejectedValueOnce('String error');

			const result = await validateTradingViewSession(mockCookie);

			expect(result).toEqual({
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: 'Unknown validation error'
			});
		});

		it('should handle empty array response', async () => {
			const mockResponse: unknown[] = [];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse)
			});

			const result = await validateTradingViewSession(mockCookie);

			expect(result).toEqual({
				isValid: false,
				watchlistCount: 0,
				hasValidIds: false,
				error: 'Session appears to be logged out (null watchlist ID detected)'
			});
		});
	});

	describe('TradingViewWatchlist type', () => {
		it('should have correct type structure', () => {
			const watchlist: TradingViewWatchlist = {
				id: 'test-id',
				name: 'Test Watchlist',
				symbols: ['NSE:TCS', 'NSE:INFY']
			};

			expect(typeof watchlist.id).toBe('string');
			expect(typeof watchlist.name).toBe('string');
			expect(Array.isArray(watchlist.symbols)).toBe(true);
			expect(watchlist.symbols.every(symbol => typeof symbol === 'string')).toBe(true);
		});
	});
});
