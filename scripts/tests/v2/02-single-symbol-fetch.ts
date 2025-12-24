/**
 * Test 2: Single Symbol Fetch
 * 
 * Fetches OHLCV data for a single symbol and validates structure.
 */

import { TestCase } from '../../framework/testing/types.js';
import { assertTrue, assertGreaterThan } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess } from '../../framework/testing/logging.js';

export const test_SingleSymbolFetch: TestCase = {
	name: 'Single Symbol Fetch',
	description: 'Fetch NSE:RELIANCE OHLCV data and validate structure',
	timeout: 30000,
	
	async run(ctx) {
		logInfo('Fetching NSE:RELIANCE (1D, 300 bars)...');
		
		const relianceData = await ctx.connection.fetchSymbol({
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			barsCount: 300
		});
		
		logInfo(`Received ${relianceData.bars.length} bars`);
		logInfo(`Timing: ${JSON.stringify(relianceData.timing)}`);
		
		// Validate response structure
		assertGreaterThan(relianceData.bars.length, 0, 'Should have at least one bar');
		assertTrue(relianceData.metadata !== undefined, 'Metadata should be present');
		
		// Check bar structure
		const lastBar = relianceData.bars[relianceData.bars.length - 1];
		assertTrue(lastBar.time > 0, 'Bar should have valid time');
		assertTrue(lastBar.open > 0, 'Bar should have valid open price');
		assertTrue(lastBar.high > 0, 'Bar should have valid high price');
		assertTrue(lastBar.low > 0, 'Bar should have valid low price');
		assertTrue(lastBar.close > 0, 'Bar should have valid close price');
		assertTrue(lastBar.volume !== undefined, 'Bar should have volume');
		
		logInfo(`Last bar: Time=${new Date(lastBar.time * 1000).toISOString()}, Close=${lastBar.close}`);
		
		// Check timestamps are in chronological order
		for (let i = 1; i < relianceData.bars.length; i++) {
			assertTrue(
				relianceData.bars[i].time > relianceData.bars[i - 1].time,
				`Bars should be in chronological order at index ${i}`
			);
		}
		
		logSuccess(`Validated ${relianceData.bars.length} bars with correct structure`);
	}
};
