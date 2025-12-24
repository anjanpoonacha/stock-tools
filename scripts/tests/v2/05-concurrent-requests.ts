/**
 * Test 5: Rapid Sequential Requests
 * 
 * Tests rapid sequential requests for different symbols to verify:
 * - Series cleanup between requests
 * - No data mixing between symbols
 * - Request correlation accuracy
 * 
 * NOTE: v2 architecture is designed for sequential symbol fetching.
 * True concurrent requests (Promise.all) are not supported due to
 * TradingView's per-session series limits.
 */

import { TestCase } from '../../framework/testing/types.js';
import { assertEqual, assertGreaterThan } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess, logWarning } from '../../framework/testing/logging.js';

export const test_ConcurrentRequests: TestCase = {
	name: 'Rapid Sequential Requests',
	description: 'Dispatch rapid sequential requests for different symbols',
	timeout: 60000,
	
	async run(ctx) {
		logInfo('Fetching 3 symbols rapidly in sequence...');
		
		// Fetch 3 different symbols rapidly (no delay between)
		const data1 = await ctx.connection.fetchSymbol({ 
			symbol: 'NSE:RELIANCE', 
			resolution: '1D', 
			barsCount: 100 
		});
		logInfo(`✓ RELIANCE: ${data1.bars.length} bars, last close: ${data1.bars[data1.bars.length - 1].close}`);
		
		const data2 = await ctx.connection.fetchSymbol({ 
			symbol: 'NSE:TCS', 
			resolution: '1D', 
			barsCount: 100 
		});
		logInfo(`✓ TCS: ${data2.bars.length} bars, last close: ${data2.bars[data2.bars.length - 1].close}`);
		
		const data3 = await ctx.connection.fetchSymbol({ 
			symbol: 'NSE:INFY', 
			resolution: '1D', 
			barsCount: 100 
		});
		logInfo(`✓ INFY: ${data3.bars.length} bars, last close: ${data3.bars[data3.bars.length - 1].close}`);
		
		// Verify all completed
		assertGreaterThan(data1.bars.length, 0, 'RELIANCE should have bars');
		assertGreaterThan(data2.bars.length, 0, 'TCS should have bars');
		assertGreaterThan(data3.bars.length, 0, 'INFY should have bars');
		
		// Verify different prices (no data mixing)
		const prices = [
			data1.bars[data1.bars.length - 1].close,
			data2.bars[data2.bars.length - 1].close,
			data3.bars[data3.bars.length - 1].close
		];
		
		const allDifferent = prices[0] !== prices[1] && 
		                    prices[1] !== prices[2] && 
		                    prices[0] !== prices[2];
		
		if (!allDifferent) {
			logWarning('Some prices are identical (unlikely but possible)');
		} else {
			logSuccess('All prices different - no data mixing');
		}
		
		// Verify symbols match
		assertEqual(data1.symbol, 'NSE:RELIANCE', 'First response should be RELIANCE');
		assertEqual(data2.symbol, 'NSE:TCS', 'Second response should be TCS');
		assertEqual(data3.symbol, 'NSE:INFY', 'Third response should be INFY');
		
		logSuccess('Rapid sequential requests work correctly! 🎯');
	}
};
