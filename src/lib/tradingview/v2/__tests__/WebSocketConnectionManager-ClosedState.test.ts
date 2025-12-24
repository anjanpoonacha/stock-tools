/**
 * WebSocketConnectionManager - CLOSED State Bug Reproduction
 * 
 * PRODUCTION BUG:
 * - User on mio-formulas page, switches stock multiple times
 * - User goes AFK (away from keyboard) for 5-10 minutes
 * - Connection closes due to inactivity
 * - User returns and tries to switch stock again
 * - CRASH: "Cannot fetch symbol in state CLOSED. Required state: READY"
 * 
 * ROOT CAUSE:
 * 1. InvalidStateError is always non-recoverable (false)
 * 2. WebSocketConnectionManager.fetchChartData() doesn't check connection state
 * 3. Connection attempts to fetch data while in CLOSED state
 * 
 * EXPECTED BEHAVIOR:
 * - InvalidStateError for CLOSED state should be recoverable
 * - Manager should detect CLOSED state and recreate connection
 * - User should get data without error
 * 
 * TEST APPROACH:
 * Since this is TDD, we start by testing the error class behavior directly.
 * This ensures the fix at the lowest level is correct before testing integration.
 */

import { describe, it, expect } from 'vitest';
import { InvalidStateError } from '../errors/ConnectionError';

describe('WebSocketConnectionManager - CLOSED State Bug', () => {
	/**
	 * Test 1: Verify the bug was fixed - InvalidStateError for CLOSED state is now recoverable
	 * 
	 * BEFORE FIX: error.recoverable === false (WRONG!)
	 * AFTER FIX: error.recoverable === true (CORRECT!)
	 */
	it('should be fixed: InvalidStateError for CLOSED state is now recoverable', () => {
		// Simulate the error that occurs when trying to fetch data on a closed connection
		const error = new InvalidStateError('fetch symbol', 'CLOSED', 'READY');
		
		// AFTER FIX: This should now be true (recoverable)
		expect(error.recoverable).toBe(true);
		expect(error.code).toBe('INVALID_STATE');
		expect(error.message).toContain('Cannot fetch symbol in state CLOSED');
		
		console.log('✅ BUG FIXED: InvalidStateError.recoverable = true for CLOSED state');
		console.log('   Connection will be recreated automatically');
	});

	/**
	 * Test 2: After fix - InvalidStateError for CLOSED state should be recoverable
	 * 
	 * This test will PASS after implementing the fix.
	 */
	it('should fix: InvalidStateError for CLOSED state is recoverable (AFTER FIX)', () => {
		const error = new InvalidStateError('fetch symbol', 'CLOSED', 'READY');
		
		// AFTER FIX: This should be true (recoverable)
		expect(error.recoverable).toBe(true);
		expect(error.code).toBe('INVALID_STATE');
		expect(error.message).toContain('Cannot fetch symbol in state CLOSED');
		
		// User-friendly message should indicate auto-recovery
		expect(error.getUserMessage()).toContain('Reconnecting automatically');
		
		console.log('✅ FIX VERIFIED: InvalidStateError.recoverable = true for CLOSED state');
	});

	/**
	 * Test 3: Other invalid states should remain non-recoverable
	 * 
	 * Only CLOSED state should be recoverable.
	 * Other states like CONNECTING, AUTHENTICATING shouldn't auto-recreate.
	 */
	it('should keep other invalid states as non-recoverable (AFTER FIX)', () => {
		const connectingError = new InvalidStateError('fetch symbol', 'CONNECTING', 'READY');
		expect(connectingError.recoverable).toBe(false);
		
		const authenticatingError = new InvalidStateError('fetch symbol', 'AUTHENTICATING', 'READY');
		expect(authenticatingError.recoverable).toBe(false);
		
		const closingError = new InvalidStateError('fetch symbol', 'CLOSING', 'READY');
		expect(closingError.recoverable).toBe(false);
		
		console.log('✅ Other invalid states remain non-recoverable');
	});
});

/**
 * NEXT STEPS (after fixing InvalidStateError):
 * 
 * 1. Fix InvalidStateError.ts: Make CLOSED state recoverable
 * 2. Fix WebSocketConnectionManager.ts: Add connection.isReady() check
 * 3. Enable integration tests (currently skipped due to mock setup complexity)
 * 
 * Integration test structure (to be implemented):
 * - Create manager with mock WebSocket
 * - Fetch data successfully
 * - Force connection to CLOSED state
 * - Fetch data again - should recreate connection and succeed
 */
