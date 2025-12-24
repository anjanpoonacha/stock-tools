/**
 * Test 1: Basic Connection
 * 
 * Verifies that WebSocketConnection can initialize and reach READY state.
 */

import { TestCase } from '../../framework/testing/types.js';
import { assertEqual, assertTrue } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess } from '../../framework/testing/logging.js';
import { ConnectionState } from '../../../src/lib/tradingview/v2/core/types.js';

export const test_BasicConnection: TestCase = {
	name: 'Basic Connection',
	description: 'Initialize WebSocket connection and verify READY state',
	timeout: 30000,
	
	async run(ctx) {
		logInfo('Verifying connection is ready...');
		
		assertTrue(ctx.connection.isReady(), 'Connection should be ready');
		
		const state = ctx.connection.getState();
		logSuccess(`Connection state: ${state}`);
		
		assertEqual(state, ConnectionState.READY, 'State should be READY');
		
		logSuccess('Connection initialized successfully');
	}
};
