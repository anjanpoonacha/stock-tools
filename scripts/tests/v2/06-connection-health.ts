/**
 * Test 6: Connection Health
 * 
 * Tests connection health monitoring and statistics.
 */

import { TestCase } from '../../framework/testing/types.js';
import { assertTrue } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess } from '../../framework/testing/logging.js';
import { delay } from '../../framework/testing/setup.js';

export const test_ConnectionHealth: TestCase = {
	name: 'Connection Health',
	description: 'Monitor connection health and verify statistics',
	timeout: 15000,
	
	async run(ctx) {
		logInfo('Waiting 10 seconds for heartbeats...');
		await delay(10000);
		
		const stats = ctx.connection.getStats();
		logInfo('Connection stats:');
		logInfo(`  Request count: ${stats.requestCount}`);
		logInfo(`  Success count: ${stats.successCount}`);
		logInfo(`  Error count: ${stats.errorCount}`);
		logInfo(`  Avg response time: ${stats.avgResponseTime.toFixed(0)}ms`);
		logInfo(`  Uptime: ${(stats.uptime / 1000).toFixed(0)}s`);
		logInfo(`  State: ${stats.state}`);
		
		assertTrue(ctx.connection.isReady(), 'Connection should still be ready');
		
		logSuccess('Connection healthy and stable');
	}
};
