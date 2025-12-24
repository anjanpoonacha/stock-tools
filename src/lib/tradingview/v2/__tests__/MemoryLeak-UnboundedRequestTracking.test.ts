/**
 * Memory Leak Test: Unbounded Request Tracking
 * 
 * **VULNERABILITY:** RequestTracker has no size limit on pendingRequests Map
 * **IMPACT:** Memory leak if requests are created faster than they're resolved
 * **SEVERITY:** HIGH
 * 
 * **Scenario:**
 * A slow/unresponsive WebSocket connection causes requests to pile up.
 * If the application continues creating requests, the pendingRequests Map
 * grows without bounds, eventually causing OOM.
 * 
 * **Test Strategy:**
 * 1. Create a WebSocket that accepts connections but never sends responses
 * 2. Rapidly create 150+ requests
 * 3. Verify that pending request count grows unbounded
 * 4. Demonstrate the vulnerability exists
 * 
 * **Expected Behavior (FIXED):**
 * - First 100 requests should be accepted
 * - Next 50 requests should be rejected with "Queue full" error
 * - Memory usage should be bounded
 * 
 * **Current Behavior (VULNERABLE):**
 * - All 150 requests are accepted
 * - All 150 requests sit in pendingRequests Map
 * - Memory grows without limit
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketConnection } from '../WebSocketConnection';
import { MockWebSocketAdapter } from '../adapters/MockWebSocketAdapter';
import { ConnectionState } from '../core/types';

describe('MemoryLeak: Unbounded Request Tracking', () => {
	let connection: WebSocketConnection;
	let mockWs: MockWebSocketAdapter;

	beforeEach(async () => {
		// Create a mock WebSocket that accepts connection but NEVER responds to data requests
		// This simulates a slow/unresponsive server
		mockWs = new MockWebSocketAdapter({
			connectionDelay: 10,
			autoHandshake: true,
			sessionId: 'unresponsive_session'
		});

		const wsFactory = () => mockWs;
		connection = new WebSocketConnection({
			jwtToken: 'test_jwt_token',
			connectionTimeout: 5000,
			dataTimeout: 60000, // Long timeout so requests don't fail immediately
			enableLogging: false
		}, undefined, wsFactory);

		// Wait for initialization (handshake will complete)
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
		
		// After initialization, the mock adapter will NOT respond to symbol resolution
		// or data requests, simulating a slow/unresponsive server
	});

	afterEach(async () => {
		await connection.dispose();
	});

	test('FIX VERIFIED: Request queue rejects requests when limit exceeded', async () => {
		// Get access to RequestTracker directly
		const tracker = connection['requestTracker'];
		
		// Initial state: no pending requests
		let stats = tracker.getStats();
		expect(stats.pending).toBe(0);

		console.log('\n✅ TESTING FIX: Creating 150 requests on unresponsive connection...\n');
		console.log('Strategy: First 100 should be accepted, next 50 should be rejected\n');

		// Create 150 requests directly using RequestTracker
		const requests: Array<{ id: string; promise: Promise<unknown> }> = [];
		const errors: Error[] = [];
		
		for (let i = 0; i < 150; i++) {
			try {
				// Create request directly
				const { requestId, promise } = tracker.createRequest({
					type: 'resolve_symbol',
					params: ['chart_session', `symbol_${i}`, `NSE:STOCK${i}`],
					timeout: 60000, // Long timeout to keep requests pending
					symbolId: `NSE:STOCK${i}`
				});
				
				requests.push({ id: requestId, promise });

				// Check pending count every 10 requests
				if ((i + 1) % 10 === 0) {
					stats = tracker.getStats();
					console.log(`📊 After ${i + 1} attempts: ${stats.pending} pending, ${errors.length} rejected`);
				}
			} catch (error) {
				// Expected: queue full errors after 100 requests
				errors.push(error as Error);
			}
		}

		// Get final stats
		stats = tracker.getStats();
		console.log(`\n🔍 FINAL STATS:`);
		console.log(`   ✅ Accepted: ${requests.length} requests`);
		console.log(`   ❌ Rejected: ${errors.length} requests`);
		console.log(`   📊 Pending: ${stats.pending} requests`);
		console.log(`   📈 Memory usage: ${(stats.pending * 500 / 1024).toFixed(2)} KB (estimated)`);

		// ✅ FIX VERIFIED: Only 100 requests should be tracked
		expect(stats.pending).toBe(100);
		expect(requests.length).toBe(100);
		expect(errors.length).toBe(50);
		expect(stats.requestsByType['resolve_symbol']).toBe(100);

		// Verify all errors are queue full errors
		for (const error of errors) {
			expect(error.message).toContain('Request queue full');
			expect(error.message).toContain('100/100');
		}

		console.log('\n✅ FIX VERIFIED:');
		console.log('   - First 100 requests were accepted');
		console.log('   - Next 50 requests were rejected with "Queue full" error');
		console.log('   - Memory usage is bounded to MAX_PENDING_REQUESTS');
		console.log('   - Protection against unbounded memory growth is working');

		// Cleanup: Cancel all requests to prevent timeout spam
		for (const req of requests) {
			req.promise.catch(() => {
				// Expected: all requests will be cancelled
			});
		}
		tracker.cancelAllRequests('Test cleanup');
	});

	test('Queue depth tracking with getQueueDepth()', async () => {
		// Test the new getQueueDepth() method
		const tracker = connection['requestTracker'];
		
		console.log('\n📊 TESTING QUEUE DEPTH TRACKING:\n');
		
		// Initial queue depth should be 0
		expect(tracker.getQueueDepth()).toBe(0);
		console.log(`Initial queue depth: ${tracker.getQueueDepth()}`);

		// Create 10 requests
		const requests: Array<{ id: string; promise: Promise<unknown> }> = [];
		for (let i = 0; i < 10; i++) {
			const { requestId, promise } = tracker.createRequest({
				type: 'resolve_symbol',
				params: ['chart_session', `symbol_${i}`, `NSE:STOCK${i}`],
				timeout: 60000,
				symbolId: `NSE:STOCK${i}`
			});
			requests.push({ id: requestId, promise });
		}

		// Queue depth should be 10
		expect(tracker.getQueueDepth()).toBe(10);
		console.log(`After 10 requests: ${tracker.getQueueDepth()}`);

		// Cancel 5 requests
		for (let i = 0; i < 5; i++) {
			requests[i].promise.catch(() => {});
			tracker.cancelRequest(requests[i].id);
		}

		// Queue depth should be 5
		expect(tracker.getQueueDepth()).toBe(5);
		console.log(`After cancelling 5: ${tracker.getQueueDepth()}`);

		// Cancel all remaining
		tracker.cancelAllRequests('Cleanup');
		for (const req of requests.slice(5)) {
			req.promise.catch(() => {});
		}

		// Queue depth should be 0
		expect(tracker.getQueueDepth()).toBe(0);
		console.log(`After cleanup: ${tracker.getQueueDepth()}`);

		console.log('\n✅ Queue depth tracking is working correctly');
	});

	test('Memory impact estimation', async () => {
		// Estimate memory usage of pending requests
		const ESTIMATED_REQUEST_SIZE = 500; // bytes per request (rough estimate)
		const MAX_REQUESTS = 150;
		
		const estimatedMemory = MAX_REQUESTS * ESTIMATED_REQUEST_SIZE;
		const estimatedMemoryKB = estimatedMemory / 1024;
		const estimatedMemoryMB = estimatedMemoryKB / 1024;

		console.log('\n📊 MEMORY IMPACT ESTIMATION:');
		console.log(`   Per request: ~${ESTIMATED_REQUEST_SIZE} bytes`);
		console.log(`   150 requests: ~${estimatedMemoryKB.toFixed(2)} KB (${estimatedMemoryMB.toFixed(2)} MB)`);
		console.log(`   1000 requests: ~${(1000 * ESTIMATED_REQUEST_SIZE / 1024 / 1024).toFixed(2)} MB`);
		console.log(`   10000 requests: ~${(10000 * ESTIMATED_REQUEST_SIZE / 1024 / 1024).toFixed(2)} MB`);
		console.log('\n⚠️  Real-world scenario:');
		console.log('   A busy trading app making 10 req/sec on slow network');
		console.log('   could accumulate 1000+ pending requests in < 2 minutes');
		console.log('   leading to significant memory pressure');

		expect(true).toBe(true);
	});
});
