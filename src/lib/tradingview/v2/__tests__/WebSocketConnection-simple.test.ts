/**
 * Simple WebSocketConnection Test
 * 
 * Tests basic symbol fetch to verify mock adapter works correctly
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketConnection } from '../WebSocketConnection';
import { MockWebSocketAdapter } from '../adapters/MockWebSocketAdapter';
import { ConnectionState } from '../core/types';

describe('WebSocketConnection - Simple Test', () => {
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

	test('should fetch TCS symbol successfully', { timeout: 10000 }, async () => {
		// Start TCS request
		const tcsPromise = connection.fetchSymbol({
			symbol: 'NSE:TCS',
			resolution: '1D',
			barsCount: 300
		});

		// Wait for request to be sent
		await new Promise(resolve => setTimeout(resolve, 50));

		// Get chart session and symbol session IDs
		const messages = mockWs.getParsedMessages();
		const chartSessionMsg = messages.find(m => m.m === 'chart_create_session');
		const resolveMsg = messages.find(m => m.m === 'resolve_symbol');
		
		const chartSessionId = chartSessionMsg?.p[0] as string;
		const symbolSessionId = resolveMsg?.p[1] as string;

		console.log('[TEST] Chart Session:', chartSessionId);
		console.log('[TEST] Symbol Session:', symbolSessionId);

		// Simulate symbol resolution
		mockWs.simulateSymbolResolved(
			chartSessionId,
			symbolSessionId,
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

		await new Promise(resolve => setTimeout(resolve, 50));

		// Simulate bars
		const bars = Array.from({ length: 300 }, (_, i) => ({
			time: 1703376000 + i * 86400,
			open: 3500 + i,
			high: 3520 + i,
			low: 3490 + i,
			close: 3510 + i,
			volume: 2000000
		}));

		mockWs.simulateTimescaleUpdate(chartSessionId, bars);

		// Wait for completion
		const result = await tcsPromise;

		expect(result.symbol).toBe('NSE:TCS');
		expect(result.bars.length).toBe(300);
		expect(result.bars[0].open).toBe(3500);
	});
});
