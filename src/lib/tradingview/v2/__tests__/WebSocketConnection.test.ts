/**
 * WebSocketConnection Integration Test
 * 
 * Tests the most difficult real-world scenario:
 * User switches from RELIANCE to TCS while CVD is still loading on slow internet
 * 
 * This test validates:
 * 1. Requests can be cancelled when switching symbols
 * 2. Second symbol loads successfully after cancellation
 * 3. Connection remains healthy
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketConnection } from '../WebSocketConnection';
import { MockWebSocketAdapter } from '../adapters/MockWebSocketAdapter';
import { MockCVDProvider } from '../providers/CVDConfigProvider';
import { ConnectionState } from '../core/types';
import { RequestCancelledError } from '../errors';

describe('WebSocketConnection - Symbol Switching with CVD', () => {
	let connection: WebSocketConnection;
	let mockWs: MockWebSocketAdapter;

	beforeEach(async () => {
		mockWs = new MockWebSocketAdapter({
			connectionDelay: 10,
			autoHandshake: true,
			sessionId: 'test_session_123'
		});

		const wsFactory = () => mockWs;
		connection = new WebSocketConnection({
			jwtToken: 'test_jwt_token',
			connectionTimeout: 5000,
			dataTimeout: 15000,
			enableLogging: false
		}, undefined, wsFactory);

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('Init timeout')), 2000);
			connection.once('initialized', () => {
				clearTimeout(timeout);
				resolve();
			});
			connection.once('error', (error) => {
				clearTimeout(timeout);
				reject(error);
			});
		});

		expect(connection.getState()).toBe(ConnectionState.READY);
	});

	afterEach(async () => {
		await connection.dispose();
	});

	test('should cancel RELIANCE requests when switching to TCS while CVD is loading', { timeout: 15000 }, async () => {
		const events: string[] = [];
		connection.on('warning', (msg) => events.push(`warning: ${msg}`));

		// Get chart session ID
		const messages = mockWs.getParsedMessages();
		const chartSessionId = messages.find(m => m.m === 'chart_create_session')?.p[0] as string;

		// ====================================================================
		// STEP 1: Start RELIANCE with CVD (will be slow/cancelled)
		// ====================================================================
		const reliancePromise = connection.fetchSymbol({
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			barsCount: 300,
			indicators: [{ type: 'cvd', config: { anchorPeriod: '3M' } }]
		});

		// Don't wait for RELIANCE - just catch the rejection
		let relianceRejected = false;
		reliancePromise.catch((err) => {
			relianceRejected = true;
			expect(err).toBeInstanceOf(RequestCancelledError);
		});

		await new Promise(resolve => setTimeout(resolve, 50));

		// ====================================================================
		// STEP 2: Switch to TCS (should cancel RELIANCE)
		// ====================================================================
		const tcsPromise = connection.fetchSymbol({
			symbol: 'NSE:TCS',
			resolution: '1D',
			barsCount: 300
		});

		// Wait for TCS resolve_symbol to be sent
		await new Promise(resolve => setTimeout(resolve, 100));

		// ====================================================================
		// STEP 3: Simulate TCS symbol resolution
		// ====================================================================
		const messages2 = mockWs.getParsedMessages();
		const tcsResolve = messages2.filter(m => m.m === 'resolve_symbol').pop();
		const tcsSymbolId = tcsResolve?.p[1] as string;

		mockWs.simulateSymbolResolved(
			chartSessionId,
			tcsSymbolId,
			{
				name: 'TCS',
				full_name: 'NSE:TCS',
				ticker: 'TCS',
				exchange: 'NSE',
				type: 'stock',
				timezone: 'Asia/Kolkata',
				minmov: 1,
				pricescale: 100,
				session: '0915-1530'
			}
		);

		// Wait for TCS create_series to be sent after symbol resolution
		await new Promise(resolve => setTimeout(resolve, 100));
		
		// Get the actual series ID for TCS
		const messages3 = mockWs.getParsedMessages();
		const tcsCreateSeries = messages3.filter(m => m.m === 'create_series').pop();
		const tcsSeriesId = tcsCreateSeries?.p[1] as string;

		// ====================================================================
		// STEP 4: Simulate TCS bars (using correct series ID)
		// ====================================================================
		mockWs.simulateTimescaleUpdate(chartSessionId, generateBars(300, 3500), tcsSeriesId);

		// ====================================================================
		// STEP 5: Verify TCS completes successfully
		// ====================================================================
		const tcsData = await tcsPromise;

		expect(tcsData.symbol).toBe('NSE:TCS');
		expect(tcsData.bars.length).toBe(300);
		expect(tcsData.bars[0].open).toBe(3500);

		// ====================================================================
		// STEP 6: Verify RELIANCE was cancelled
		// ====================================================================
		await new Promise(resolve => setTimeout(resolve, 100));
		expect(relianceRejected).toBe(true);

		const cancelWarning = events.find(e => 
			e.includes('warning') && 
			e.includes('Symbol switched') && 
			e.includes('RELIANCE')
		);
		expect(cancelWarning).toBeDefined();

		// ====================================================================
		// STEP 7: Verify connection is still healthy
		// ====================================================================
		expect(connection.getState()).toBe(ConnectionState.READY);
		expect(connection.isReady()).toBe(true);

		const stats = connection.getStats();
		expect(stats.successCount).toBeGreaterThan(0);

		// SUCCESS! Test validates:
		// ✅ RELIANCE request was started
		// ✅ Switching to TCS cancelled RELIANCE
		// ✅ RELIANCE promise rejected with RequestCancelledError
		// ✅ TCS loaded successfully
		// ✅ Connection remains healthy
	});
});

describe('WebSocketConnection - CVD Timeout Tests', () => {
	let connection: WebSocketConnection;
	let mockWs: MockWebSocketAdapter;
	let mockCVDProvider: MockCVDProvider;

	beforeEach(async () => {
		mockWs = new MockWebSocketAdapter({
			connectionDelay: 10,
			autoHandshake: true,
			sessionId: 'test_session_123'
		});

		mockCVDProvider = new MockCVDProvider();
		const wsFactory = () => mockWs;
		connection = new WebSocketConnection({
			jwtToken: 'test_jwt_token',
			connectionTimeout: 5000,
			dataTimeout: 15000,
			enableLogging: false
		}, mockCVDProvider, wsFactory);

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('Init timeout')), 2000);
			connection.once('initialized', () => {
				clearTimeout(timeout);
				resolve();
			});
			connection.once('error', (error) => {
				clearTimeout(timeout);
				reject(error);
			});
		});

		expect(connection.getState()).toBe(ConnectionState.READY);
	});

	afterEach(async () => {
		await connection.dispose();
	});

	test('should complete successfully when CVD arrives within timeout', { timeout: 10000 }, async () => {
		// Configure CVD timeout to 30s
		connection.setRequestTimeout('create_study', 30000);

		// Get chart session ID from initialization
		const initMessages = mockWs.getParsedMessages();
		const chartSessionId = initMessages.find(m => m.m === 'chart_create_session')?.p[0] as string;

		// ====================================================================
		// STEP 1: Start RELIANCE with CVD
		// ====================================================================
		const reliancePromise = connection.fetchSymbol({
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			barsCount: 300,
			indicators: [{ type: 'cvd', config: { anchorPeriod: '3M' } }]
		});

		// Wait for requests to be sent
		await new Promise(resolve => setTimeout(resolve, 100));

		// ====================================================================
		// STEP 2: Simulate symbol resolution
		// ====================================================================
		const allMessages = mockWs.getParsedMessages();
		const symbolResolve = allMessages.filter(m => m.m === 'resolve_symbol').pop();
		const symbolSessionId = symbolResolve?.p[1] as string;

		mockWs.simulateSymbolResolved(
			chartSessionId,
			symbolSessionId,
			{
				name: 'RELIANCE',
				full_name: 'NSE:RELIANCE',
				ticker: 'RELIANCE',
				exchange: 'NSE',
				type: 'stock',
				timezone: 'Asia/Kolkata',
				minmov: 1,
				pricescale: 100,
				session: '0915-1530'
			}
		);

		await new Promise(resolve => setTimeout(resolve, 50));

		// ====================================================================
		// STEP 3: Simulate OHLCV bars
		// ====================================================================
		mockWs.simulateTimescaleUpdate(chartSessionId, generateBars(300, 2500));

		// Wait for create_study message to be sent
		await new Promise(resolve => setTimeout(resolve, 100));

		// ====================================================================
		// STEP 4: Simulate CVD data arrives (within timeout)
		// ====================================================================
		const allMessages2 = mockWs.getParsedMessages();
		const createStudy = allMessages2.filter(m => m.m === 'create_study').pop();
		const studyId = createStudy?.p[1] as string;

		// Simulate CVD data
		mockWs.simulateCVDUpdate(chartSessionId, studyId, generateCVDData(300));

		// ====================================================================
		// STEP 5: Verify request completes successfully
		// ====================================================================
		const data = await reliancePromise;

		expect(data.symbol).toBe('NSE:RELIANCE');
		expect(data.bars.length).toBe(300);
		expect(data.indicators).toBeDefined();
		expect(data.indicators?.get('cvd')).toBeDefined();
		expect(data.indicators?.get('cvd')?.bars.length).toBe(300);

		// SUCCESS! Test validates:
		// ✅ CVD timeout was configured to 30s
		// ✅ CVD arrived within timeout
		// ✅ Request completed successfully with indicators
	});

	test('should allow configuring longer CVD timeout for slow connections', { timeout: 1000 }, async () => {
		// Test that we can configure up to 60s timeout
		const originalTimeout = connection.getRequestTimeout('create_study');
		expect(originalTimeout).toBe(30000); // Default 30s

		// Set to 60s for slow connections
		connection.setRequestTimeout('create_study', 60000);
		
		const newTimeout = connection.getRequestTimeout('create_study');
		expect(newTimeout).toBe(60000);

		// Test that we can set even longer (no hard limit)
		connection.setRequestTimeout('create_study', 90000);
		expect(connection.getRequestTimeout('create_study')).toBe(90000);

		// SUCCESS! Test validates:
		// ✅ CVD timeout is configurable
		// ✅ No hard upper limit on timeout
	});
});

function generateCVDData(count: number): Array<{ time: number; value: number }> {
	return Array.from({ length: count }, (_, i) => ({
		time: 1703376000 + i * 86400,
		value: Math.random() * 1000000 // CVD cumulative value
	}));
}

function generateBars(count: number, basePrice: number) {
	return Array.from({ length: count }, (_, i) => ({
		time: 1703376000 + i * 86400,
		open: basePrice + i,
		high: basePrice + i + 10,
		low: basePrice + i - 10,
		close: basePrice + i + 5,
		volume: 2000000
	}));
}
