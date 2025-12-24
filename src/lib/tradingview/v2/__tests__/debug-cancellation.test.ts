/**
 * Debug test for cancellation behavior
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketConnection } from '../WebSocketConnection';
import { MockWebSocketAdapter } from '../adapters/MockWebSocketAdapter';
import { ConnectionState } from '../core/types';
import { RequestCancelledError } from '../errors';

describe('Debug Cancellation', () => {
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
			enableLogging: true // Enable logging for debug
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

	test('fetchSymbol promise should reject when cancelled', { timeout: 5000 }, async () => {
		console.log('\n=== TEST START ===\n');

		// Start RELIANCE fetch (no responses simulated)
		console.log('1. Starting RELIANCE fetch...');
		const reliancePromise = connection.fetchSymbol({
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			barsCount: 300
		});

		let relianceRejected = false;
		let rejectionError: Error | null = null;

		reliancePromise.catch((err) => {
			console.log('>>> RELIANCE PROMISE REJECTED <<<', err.message);
			relianceRejected = true;
			rejectionError = err;
		});

		// Give it time to send requests
		await new Promise(resolve => setTimeout(resolve, 100));

		// Get chart session ID before starting TCS
		const messages = mockWs.getParsedMessages();
		const chartSessionId = messages.find(m => m.m === 'chart_create_session')?.p[0] as string;
		
		// Start TCS fetch (should cancel RELIANCE)
		console.log('2. Starting TCS fetch (should cancel RELIANCE)...');
		const tcsPromise = connection.fetchSymbol({
			symbol: 'NSE:TCS',
			resolution: '1D',
			barsCount: 300
		});

		//Wait for TCS resolve_symbol to be sent
		await new Promise(resolve => setTimeout(resolve, 100));
		
		const messages2 = mockWs.getParsedMessages();
		const resolveMessages = messages2.filter(m => m.m === 'resolve_symbol');
		
		const tcsResolve = resolveMessages.pop();
		const tcsSymbolId = tcsResolve?.p[1] as string;
		
		console.log('3. Simulating TCS symbol resolution...');
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

		// Wait for create_series to be sent after symbol resolution
		await new Promise(resolve => setTimeout(resolve, 100));
		
		const messages3 = mockWs.getParsedMessages();
		const seriesMessages = messages3.filter(m => m.m === 'create_series');
		const tcsCreateSeries = seriesMessages.pop();
		const tcsSeriesId = tcsCreateSeries?.p[1] as string;
		
		console.log('4. TCS series ID:', tcsSeriesId);
		console.log('5. Simulating TCS bars for series:', tcsSeriesId);
		// Use the actual series ID from the create_series message
		mockWs.simulateTimescaleUpdate(chartSessionId, [{
			time: 1703376000,
			open: 3500,
			high: 3510,
			low: 3490,
			close: 3505,
			volume: 1000000
		}], tcsSeriesId);

		console.log('6. Waiting for TCS to complete...');
		const tcsData = await tcsPromise;
		console.log('7. TCS completed!', tcsData.symbol);

		// Give time for RELIANCE rejection to propagate
		await new Promise(resolve => setTimeout(resolve, 200));

		console.log('8. Checking if RELIANCE was rejected...');
		console.log('   relianceRejected:', relianceRejected);
		if (rejectionError) {
			console.log('   rejectionError:', (rejectionError as Error).message);
		}

		expect(relianceRejected).toBe(true);
		expect(rejectionError).toBeInstanceOf(RequestCancelledError);

		console.log('\n=== TEST END ===\n');
	});
});
