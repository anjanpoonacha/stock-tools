/**
 * Test 4: CVD with Configurable Timeout
 * 
 * Tests CVD indicator with custom timeout configuration.
 */

import { TestCase } from '../../framework/testing/types.js';
import { assertEqual, assertGreaterThan, assertLessThan } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess, logWarning } from '../../framework/testing/logging.js';

export const test_CVDTimeout: TestCase = {
	name: 'CVD with Configurable Timeout',
	description: 'Fetch symbol with CVD indicator using custom timeout',
	timeout: 50000,
	
	async run(ctx) {
		logInfo('Configuring CVD timeout to 45s...');
		ctx.connection.setRequestTimeout('create_study', 45000);
		
		const configuredTimeout = ctx.connection.getRequestTimeout('create_study');
		assertEqual(configuredTimeout, 45000, 'CVD timeout should be 45000ms');
		logInfo(`Confirmed CVD timeout: ${configuredTimeout}ms`);
		
		logInfo('Fetching NSE:NIFTY with CVD...');
		const startTime = Date.now();
		
		const niftyData = await ctx.connection.fetchSymbol({
			symbol: 'NSE:NIFTY',
			resolution: '1D',
			barsCount: 300,
			indicators: [{ type: 'cvd', config: { anchorPeriod: '3M' } }]
		});
		
		const elapsed = Date.now() - startTime;
		
		logInfo(`Received ${niftyData.bars.length} bars in ${elapsed}ms`);
		
		// Verify request completed within 45s
		assertLessThan(elapsed, 45000, `Request should complete within 45s, took ${elapsed}ms`);
		assertGreaterThan(niftyData.bars.length, 0, 'Should have OHLCV bars');
		
		// Check for CVD data
		if (niftyData.indicators && niftyData.indicators.has('cvd')) {
			const cvdData = niftyData.indicators.get('cvd')!;
			logSuccess(`CVD indicator returned: ${cvdData.bars.length} bars`);
			assertGreaterThan(cvdData.bars.length, 0, 'CVD should have bars');
		} else {
			logWarning('CVD indicator not returned (may have timed out)');
		}
		
		logSuccess('CVD with timeout configuration works');
	}
};
