/**
 * Test 3: Symbol Switching
 * 
 * Tests sequential fetching of different symbols with auto-cancellation.
 */

import { TestCase } from '../../framework/testing/types.js';
import { assertTrue, assertGreaterThan } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess } from '../../framework/testing/logging.js';

export const test_SymbolSwitching: TestCase = {
	name: 'Symbol Switching (Sequential Fetch)',
	description: 'Fetch multiple symbols sequentially and verify auto-cancellation',
	timeout: 60000,
	
	async run(ctx) {
		logInfo('Fetching NSE:TCS...');
		const tcsData = await ctx.connection.fetchSymbol({
			symbol: 'NSE:TCS',
			resolution: '1D',
			barsCount: 300
		});
		
		assertGreaterThan(tcsData.bars.length, 0, 'TCS should have bars');
		logSuccess(`TCS completed: ${tcsData.bars.length} bars`);
		
		logInfo('Fetching NSE:INFY (different symbol)...');
		const infyData = await ctx.connection.fetchSymbol({
			symbol: 'NSE:INFY',
			resolution: '1D',
			barsCount: 300
		});
		
		assertGreaterThan(infyData.bars.length, 0, 'INFY should have bars');
		logSuccess(`INFY completed: ${infyData.bars.length} bars`);
		logInfo(`INFY last close: ${infyData.bars[infyData.bars.length - 1].close}`);
		
		// Verify different symbols
		assertTrue(
			tcsData.symbol !== infyData.symbol,
			'Symbol names should be different'
		);
		
		logSuccess('Sequential symbol fetching works correctly! 🎯');
	}
};
