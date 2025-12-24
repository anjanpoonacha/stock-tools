/**
 * Test Template
 * 
 * Copy this template to create new tests.
 */

import { TestCase } from '../../framework/testing/types.js';
import { assertEqual, assertTrue, assertGreaterThan } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess } from '../../framework/testing/logging.js';

export const test_TemplateName: TestCase = {
	name: 'Test Name',
	description: 'Brief description of what this test does',
	timeout: 30000, // Optional, default 30s
	skip: false,    // Optional, set to true to skip
	
	async run(ctx) {
		// Test implementation
		logInfo('Starting test...');
		
		// Example: Fetch data
		const data = await ctx.connection.fetchSymbol({
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			barsCount: 100
		});
		
		// Example: Assertions
		assertTrue(data.bars.length > 0, 'Should have bars');
		assertGreaterThan(data.bars.length, 50, 'Should have at least 50 bars');
		assertEqual(data.symbol, 'NSE:RELIANCE', 'Symbol should match');
		
		logSuccess('Test completed successfully');
	}
};
