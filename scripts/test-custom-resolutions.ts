/**
 * Test Script: Custom Resolution Support
 * 
 * Tests whether TradingView API supports custom minute-based resolutions:
 * - 5 minutes
 * - 15 minutes
 * - 75 minutes
 * - 188 minutes
 * 
 * This is a simplified test that uses the existing chart-data API endpoint.
 * 
 * Usage:
 *   pnpm tsx scripts/test-custom-resolutions.ts
 * 
 * Prerequisites:
 *   - Must have valid credentials in localStorage (mio-tv-auth-credentials)
 *   - Must run the app at least once to set up credentials
 */

const TEST_SYMBOL = 'NSE:RELIANCE'; // Popular stock for testing
const TEST_RESOLUTIONS = [
	{ value: '5', label: '5min', barsCount: 5760 },
	{ value: '15', label: '15min', barsCount: 1920 },
	{ value: '75', label: '75min', barsCount: 384 },
	{ value: '188', label: '188min', barsCount: 154 },
];

interface TestResult {
	resolution: string;
	label: string;
	supported: boolean;
	barsReceived: number;
	error?: string;
	details?: string;
}

async function testResolutionViaAPI(
	userEmail: string,
	userPassword: string,
	resolution: string,
	label: string,
	barsCount: number
): Promise<TestResult> {
	console.log(`\n[TEST] Testing resolution: ${label} (${resolution})`);
	console.log(`[TEST] Requesting ${barsCount} bars`);
	
	try {
		const url = new URL('http://localhost:3000/api/chart-data');
		url.searchParams.set('symbol', TEST_SYMBOL);
		url.searchParams.set('resolution', resolution);
		url.searchParams.set('barsCount', barsCount.toString());
		
		const response = await fetch(url.toString(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				userEmail,
				userPassword
			})
		});
		
		const result = await response.json();
		
		if (result.success && result.bars && result.bars.length > 0) {
			console.log(`[TEST] ✓ Received ${result.bars.length} bars`);
			return {
				resolution,
				label,
				supported: true,
				barsReceived: result.bars.length,
				details: `${result.bars.length} bars returned`
			};
		} else {
			const errorMsg = result.error || 'No bars returned';
			console.log(`[TEST] ✗ Failed: ${errorMsg}`);
			return {
				resolution,
				label,
				supported: false,
				barsReceived: 0,
				error: errorMsg
			};
		}
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Unknown error';
		console.log(`[TEST] ✗ Error: ${errorMsg}`);
		return {
			resolution,
			label,
			supported: false,
			barsReceived: 0,
			error: errorMsg
		};
	}
}

async function main() {
	console.log('='.repeat(70));
	console.log('Testing Custom Resolution Support via Chart Data API');
	console.log('='.repeat(70));
	
	console.log('\n[INFO] This test checks if TradingView supports custom minute resolutions.');
	console.log('[INFO] Make sure the Next.js dev server is running on localhost:3000\n');
	
	// Check if credentials are available
	console.log('[SETUP] Reading credentials from environment...');
	const userEmail = process.env.MIO_USER_EMAIL;
	const userPassword = process.env.MIO_USER_PASSWORD;
	
	if (!userEmail || !userPassword) {
		console.error('\n❌ ERROR: Credentials not found!');
		console.error('\nPlease set environment variables:');
		console.error('  export MIO_USER_EMAIL="your-email@example.com"');
		console.error('  export MIO_USER_PASSWORD="your-password"\n');
		console.error('Or run the app once to set up credentials in localStorage.\n');
		process.exit(1);
	}
	
	console.log(`[SETUP] ✓ Using credentials for: ${userEmail}`);
	
	// Test each resolution
	const results: TestResult[] = [];
	
	for (const resConfig of TEST_RESOLUTIONS) {
		const result = await testResolutionViaAPI(
			userEmail,
			userPassword,
			resConfig.value,
			resConfig.label,
			resConfig.barsCount
		);
		results.push(result);
		
		// Wait between tests to avoid rate limiting
		await new Promise(resolve => setTimeout(resolve, 2000));
	}
	
	// Print results
	console.log('\n' + '='.repeat(70));
	console.log('TEST RESULTS');
	console.log('='.repeat(70));
	
	console.log('\n✅ SUPPORTED RESOLUTIONS:');
	const supported = results.filter(r => r.supported);
	if (supported.length === 0) {
		console.log('   None - TradingView API may not support these custom resolutions');
	} else {
		supported.forEach(r => {
			console.log(`   • ${r.label} (${r.resolution}) - ${r.details}`);
		});
	}
	
	console.log('\n❌ UNSUPPORTED RESOLUTIONS:');
	const unsupported = results.filter(r => !r.supported);
	if (unsupported.length === 0) {
		console.log('   None - All resolutions supported! 🎉');
	} else {
		unsupported.forEach(r => {
			console.log(`   • ${r.label} (${r.resolution}) - ${r.error}`);
		});
	}
	
	console.log('\n' + '='.repeat(70));
	console.log('SUMMARY');
	console.log('='.repeat(70));
	console.log(`Total Tested: ${results.length}`);
	console.log(`Supported: ${supported.length} (${((supported.length / results.length) * 100).toFixed(0)}%)`);
	console.log(`Unsupported: ${unsupported.length} (${((unsupported.length / results.length) * 100).toFixed(0)}%)`);
	
	if (supported.length === results.length) {
		console.log('\n🎉 SUCCESS! All custom resolutions are supported by TradingView API.');
	} else if (supported.length > 0) {
		console.log('\n⚠️  PARTIAL: Some resolutions work, others don\'t.');
		console.log('    Consider removing unsupported resolutions from the UI.');
	} else {
		console.log('\n❌ FAILURE: None of the custom resolutions are supported.');
		console.log('    Recommend using standard resolutions only (1D, 1W, etc.)');
	}
	
	console.log('\n' + '='.repeat(70));
	
	// Standard resolutions that always work
	console.log('\nNOTE: Standard TradingView resolutions that always work:');
	console.log('  • 1, 5, 15, 30, 60 (minutes)');
	console.log('  • 1D, 1W, 1M (day, week, month)');
	console.log('\nIf custom resolutions fail, the UI will fall back to these.\n');
}

main().catch(err => {
	console.error('\n[FATAL ERROR]', err);
	process.exit(1);
});
