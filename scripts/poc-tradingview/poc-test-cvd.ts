/**
 * POC: Test CVD Indicator Availability
 * 
 * Tests if CVD (Cumulative Volume Delta) data is actually available from TradingView
 */

import { OptimizedPooledClient } from './poc-optimized-client';

async function getJWTToken(sessionId: string, sessionIdSign?: string): Promise<string> {
	const chartUrl = 'https://www.tradingview.com/chart/S09yY40x/';
	const cookies = sessionIdSign 
		? `sessionid=${sessionId}; sessionid_sign=${sessionIdSign}`
		: `sessionid=${sessionId}`;
	
	const response = await fetch(chartUrl, {
		headers: {
			'Cookie': cookies,
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
			'Accept': 'text/html,application/xhtml+xml',
		},
	});
	
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	
	const html = await response.text();
	const match = html.match(/auth_token":"([^"]+)"/);
	
	if (!match || !match[1]) {
		throw new Error('Failed to extract JWT token from chart page. Session may be invalid.');
	}
	
	return match[1];
}

async function main() {
	console.log('🧪 Testing CVD Indicator Availability\n');
	
	const sessionId = process.argv[2];
	const sessionIdSign = process.argv[3];
	
	if (!sessionId) {
		console.error('❌ Usage: tsx poc-test-cvd.ts <session-id> [session-id-sign]');
		console.error('Example: tsx poc-test-cvd.ts c21wcqky6leod5cjl2fh6i660sy411jb v3:bzvfwN6hsScvTRCKRursdZHSjt9p8Yv5UM3R8YVGUSM=');
		process.exit(1);
	}
	
	try {
		// Get JWT token
		console.log('🔐 Fetching JWT token...');
		const jwtToken = await getJWTToken(sessionId, sessionIdSign);
		console.log('✅ JWT obtained\n');
		
		// Test symbol with CVD
		const testSymbol = 'NSE:INFY';
		const resolution = '1D';
		const barsCount = 100;
		
		console.log('=' + '='.repeat(79));
		console.log(`📊 Testing CVD for ${testSymbol}`);
		console.log('=' + '='.repeat(79) + '\n');
		
		const client = new OptimizedPooledClient({
			jwtToken,
			eventDrivenWaits: true,
			dataTimeout: 5000 // 5 second timeout for CVD
		});
		
		console.log('🔌 Initializing connection...');
		const initStart = Date.now();
		await client.initialize();
		console.log(`✅ Connection initialized in ${Date.now() - initStart}ms\n`);
		
		console.log('📈 Fetching chart data WITH CVD enabled...');
		const fetchStart = Date.now();
		
		try {
			const result = await client.fetchChartData(
				testSymbol,
				resolution,
				barsCount,
				{ 
					cvdEnabled: true,
					cvdAnchorPeriod: '3M'
				}
			);
			
			const fetchDuration = Date.now() - fetchStart;
			
			console.log('\n' + '─'.repeat(80));
			console.log('📊 RESULTS');
			console.log('─'.repeat(80) + '\n');
			
			console.log(`Symbol: ${testSymbol}`);
			console.log(`Duration: ${fetchDuration}ms\n`);
			
			console.log(`OHLCV Bars: ${result.bars.length} ✅`);
			console.log(`Metadata: ${result.metadata ? '✅ Present' : '❌ Missing'}`);
			
			// Check indicators
			if (result.indicators) {
				console.log(`\nIndicators object: ✅ Present`);
				console.log(`Indicator keys: ${Object.keys(result.indicators).join(', ') || '(empty)'}`);
				
				// Check CVD specifically
				if (result.indicators.cvd) {
					console.log(`\n✅ CVD INDICATOR FOUND!`);
					console.log(`   Study ID: ${result.indicators.cvd.studyId}`);
					console.log(`   Study Name: ${result.indicators.cvd.studyName}`);
					console.log(`   Values Count: ${result.indicators.cvd.values.length}`);
					
					if (result.indicators.cvd.values.length > 0) {
						const firstValue = result.indicators.cvd.values[0];
						const lastValue = result.indicators.cvd.values[result.indicators.cvd.values.length - 1];
						
						console.log(`\n   First CVD Value:`);
						console.log(`      Time: ${new Date(firstValue.time * 1000).toISOString()}`);
						console.log(`      Values: [${firstValue.values.slice(0, 5).join(', ')}${firstValue.values.length > 5 ? ', ...' : ''}]`);
						
						console.log(`\n   Last CVD Value:`);
						console.log(`      Time: ${new Date(lastValue.time * 1000).toISOString()}`);
						console.log(`      Values: [${lastValue.values.slice(0, 5).join(', ')}${lastValue.values.length > 5 ? ', ...' : ''}]`);
						
						console.log(`\n🎉 CVD IS WORKING! Data successfully retrieved!`);
					} else {
						console.log(`\n⚠️  CVD indicator exists but has NO VALUES`);
						console.log(`   This means TradingView accepted the study but didn't return data.`);
						console.log(`   Possible reasons:`);
						console.log(`   - Account doesn't have access to this indicator`);
						console.log(`   - Indicator requires premium subscription`);
						console.log(`   - Wrong Pine Script ID`);
						console.log(`   - Data not available for this symbol`);
					}
				} else {
					console.log(`\n❌ CVD INDICATOR NOT FOUND`);
					console.log(`   The indicators object exists but doesn't contain 'cvd' key`);
					console.log(`   Available keys: ${Object.keys(result.indicators).join(', ') || '(none)'}`);
				}
			} else {
				console.log(`\n❌ No indicators object in response`);
				console.log(`   CVD study may have been created but data was not returned`);
			}
			
			console.log('\n' + '=' + '='.repeat(79));
			
		} catch (error) {
			console.error(`\n❌ Error fetching data: ${error instanceof Error ? error.message : String(error)}`);
		}
		
		// Close connection
		client.disconnect();
		console.log('\n✅ Test Complete!\n');
		
	} catch (error) {
		console.error('\n❌ Error:', error);
		process.exit(1);
	}
}

main();
