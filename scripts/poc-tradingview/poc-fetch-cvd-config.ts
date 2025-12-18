/**
 * POC: Fetch CVD Configuration Dynamically
 * 
 * This script attempts to fetch CVD indicator metadata from TradingView
 * to avoid hardcoding the encrypted text.
 * 
 * Approach:
 * 1. Try TradingView indicator metadata API endpoints
 * 2. Fall back to parsing from chart page HTML
 * 3. Extract encrypted text, pine version, and features
 */

interface CVDConfigResult {
	text: string;           // Encrypted Pine script
	pineId: string;         // Study ID
	pineVersion: string;    // Pine version
	pineFeatures: any;      // Feature flags
	source: 'api' | 'html'; // Where it came from
}

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

/**
 * Attempt 1: Fetch from TradingView API endpoints
 */
async function fetchFromAPI(jwtToken: string): Promise<CVDConfigResult | null> {
	console.log('🔍 Attempting to fetch from TradingView API...');
	
	// Potential API endpoints to try
	const endpoints = [
		'https://www.tradingview.com/api/v1/indicators/',
		'https://www.tradingview.com/pine_perm/list/',
		'https://www.tradingview.com/pine_facade/list/',
		'https://www.tradingview.com/study/metadata/',
		'https://prodata.tradingview.com/indicators/',
	];
	
	const headers = {
		'Authorization': `Bearer ${jwtToken}`,
		'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
		'Accept': 'application/json',
	};
	
	for (const endpoint of endpoints) {
		try {
			console.log(`   Testing: ${endpoint}`);
			const response = await fetch(endpoint, { headers });
			
			if (response.ok) {
				const data = await response.json();
				console.log(`   ✅ Success! Status: ${response.status}`);
				console.log(`   Response:`, JSON.stringify(data).substring(0, 200));
				
				// TODO: Parse response to extract CVD config
				// For now, just log it
				return null;
			} else {
				console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
			}
		} catch (error) {
			console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	
	return null;
}

/**
 * Attempt 2: Parse from TradingView chart page HTML
 */
async function fetchFromHTML(sessionId: string, sessionIdSign?: string): Promise<CVDConfigResult | null> {
	console.log('\n🔍 Attempting to parse from TradingView chart page HTML...');
	
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
	
	// Strategy 1: Look for embedded study registry
	console.log('   Strategy 1: Looking for study registry...');
	const studyRegistryMatch = html.match(/studyRegistry["\s:]+(\{[\s\S]*?\})/);
	if (studyRegistryMatch) {
		console.log('   ✅ Found study registry!');
		console.log('   Sample:', studyRegistryMatch[1].substring(0, 200));
	} else {
		console.log('   ❌ No study registry found');
	}
	
	// Strategy 2: Look for indicator metadata
	console.log('   Strategy 2: Looking for indicator metadata...');
	const indicatorMatch = html.match(/indicators["\s:]+(\[[\s\S]*?\])/);
	if (indicatorMatch) {
		console.log('   ✅ Found indicators array!');
		console.log('   Sample:', indicatorMatch[1].substring(0, 200));
	} else {
		console.log('   ❌ No indicators array found');
	}
	
	// Strategy 3: Look for pine scripts
	console.log('   Strategy 3: Looking for pine scripts...');
	const pineMatch = html.match(/pineScripts["\s:]+(\{[\s\S]*?\})/);
	if (pineMatch) {
		console.log('   ✅ Found pine scripts!');
		console.log('   Sample:', pineMatch[1].substring(0, 200));
	} else {
		console.log('   ❌ No pine scripts found');
	}
	
	// Strategy 4: Look for CVD specifically
	console.log('   Strategy 4: Looking for CVD-specific data...');
	const cvdMatches = html.match(/Cumulative[\s\S]{0,100}Volume[\s\S]{0,100}Delta/g);
	if (cvdMatches && cvdMatches.length > 0) {
		console.log(`   ✅ Found ${cvdMatches.length} CVD references!`);
		cvdMatches.slice(0, 3).forEach((match, i) => {
			console.log(`   Reference ${i + 1}:`, match.substring(0, 100));
		});
	} else {
		console.log('   ❌ No CVD references found');
	}
	
	// Strategy 5: Look for encrypted text pattern
	console.log('   Strategy 5: Looking for encrypted text pattern (bmI9Ks46_...)...');
	const encryptedPattern = /bmI9Ks46_[A-Za-z0-9+/=_]{1000,}/g;
	const encryptedMatches = html.match(encryptedPattern);
	if (encryptedMatches && encryptedMatches.length > 0) {
		console.log(`   ✅ Found ${encryptedMatches.length} encrypted text(s)!`);
		
		// Look for the longest one (likely CVD)
		const sortedByLength = [...encryptedMatches].sort((a, b) => b.length - a.length);
		console.log('\n   Sorted by length:');
		sortedByLength.forEach((match, i) => {
			console.log(`   ${i + 1}. Length: ${match.length}, Start: ${match.substring(0, 50)}...`);
		});
		
		// Find CVD specifically
		console.log('\n   🎯 Looking for CVD indicator (Cumulative%1Volume%1Delta)...');
		
		for (const encryptedText of sortedByLength) {
			const matchIndex = html.indexOf(encryptedText);
			
			// Get a larger context window (10KB before and after)
			const contextWindow = html.substring(
				Math.max(0, matchIndex - 10000),
				Math.min(html.length, matchIndex + encryptedText.length + 10000)
			);
			
			// Look for CVD-specific patterns
			const isCVD = contextWindow.includes('Cumulative%1Volume%1Delta') ||
			              contextWindow.includes('Cumulative Volume Delta');
			
			if (isCVD) {
				console.log(`   ✅ Found CVD encrypted text! (length: ${encryptedText.length})`);
				
				// The structure in HTML is: 
				// "Script$STD;Cumulative%1Volume%1Delta@tv-scripting-101[v.X.X]":{...metadata...}
				// Extract the study metadata object
				const studyKeyPattern = /"Script\$STD;Cumulative%1Volume%1Delta@tv-scripting-101\[v\.\d+\.\d+\]":\{([^}]+\{[^}]+\}[^}]+)\}/;
				const studyMetaMatch = contextWindow.match(studyKeyPattern);
				
				if (studyMetaMatch) {
					console.log('   📦 Found CVD study metadata block');
					const metadataBlock = studyMetaMatch[0];
					
					// Extract pineId, pineVersion from the key
					const studyKeyMatch = metadataBlock.match(/"Script\$STD;Cumulative%1Volume%1Delta@tv-scripting-101\[v\.(\d+\.\d+)\]"/);
					const pineVersion = studyKeyMatch ? studyKeyMatch[1] : null;
					
					// pineId is always this for CVD
					const pineId = 'STD;Cumulative%1Volume%1Delta';
					
					// Extract pineFeatures (it's a JSON string value)
					const pineFeaturesMatch = metadataBlock.match(/"pineFeatures":\{([^}]+)\}/);
					
					if (pineVersion) {
						console.log('\n   🎉 Successfully extracted CVD configuration!');
						console.log(`   pineId: ${pineId}`);
						console.log(`   pineVersion: ${pineVersion}`);
						console.log(`   encrypted text length: ${encryptedText.length}`);
						
						let pineFeatures = undefined;
						if (pineFeaturesMatch) {
							try {
								pineFeatures = JSON.parse(`{${pineFeaturesMatch[1]}}`);
								console.log(`   pineFeatures: ${JSON.stringify(pineFeatures)}`);
							} catch (e) {
								console.log(`   ⚠️  Could not parse pineFeatures: ${e}`);
							}
						}
						
						// Return the complete config
						const result: CVDConfigResult = {
							text: encryptedText,
							pineId,
							pineVersion,
							pineFeatures,
							source: 'html'
						};
						
						return result;
					}
				} else {
					console.log('   ⚠️  Could not find study metadata block');
					// Save a sample of the context for debugging
					const sampleContext = contextWindow.substring(matchIndex - 1000, matchIndex + 500);
					console.log('   Context sample (1000 chars before encrypted text):');
					console.log('   ' + sampleContext.replace(/\n/g, ' ').substring(0, 500));
				}
			}
		}
		
		console.log('   ⚠️  Found encrypted texts but could not identify CVD');
		
	} else {
		console.log('   ❌ No encrypted text pattern found');
	}
	
	return null;
}

/**
 * Attempt 3: Fetch via WebSocket metadata request
 */
async function fetchViaWebSocket(_jwtToken: string): Promise<CVDConfigResult | null> {
	console.log('\n🔍 Attempting to fetch via WebSocket...');
	console.log('   (Not implemented yet - would require WebSocket connection)');
	return null;
}

async function main() {
	console.log('🚀 POC: Fetch CVD Configuration Dynamically\n');
	console.log('=' + '='.repeat(79));
	
	const sessionId = process.argv[2];
	const sessionIdSign = process.argv[3];
	
	if (!sessionId) {
		console.error('\n❌ Usage: tsx poc-fetch-cvd-config.ts <session-id> [session-id-sign]');
		console.error('Example: tsx poc-fetch-cvd-config.ts c21wcqky6leod5cjl2fh6i660sy411jb v3:bzvfwN6hsScvTRCKRursdZHSjt9p8Yv5UM3R8YVGUSM=');
		process.exit(1);
	}
	
	try {
		// Get JWT token
		console.log('\n🔐 Fetching JWT token...');
		const jwtToken = await getJWTToken(sessionId, sessionIdSign);
		console.log('✅ JWT obtained\n');
		console.log('=' + '='.repeat(79));
		
		// Attempt 1: API endpoints
		const apiResult = await fetchFromAPI(jwtToken);
		if (apiResult) {
			console.log('\n✅ Successfully fetched from API!');
			console.log(JSON.stringify(apiResult, null, 2));
			process.exit(0);
		}
		
		// Attempt 2: HTML parsing
		const htmlResult = await fetchFromHTML(sessionId, sessionIdSign);
		if (htmlResult) {
			console.log('\n✅ Successfully parsed from HTML!');
			console.log(JSON.stringify(htmlResult, null, 2));
			process.exit(0);
		}
		
		// Attempt 3: WebSocket (future)
		const wsResult = await fetchViaWebSocket(jwtToken);
		if (wsResult) {
			console.log('\n✅ Successfully fetched via WebSocket!');
			console.log(JSON.stringify(wsResult, null, 2));
			process.exit(0);
		}
		
		console.log('\n' + '=' + '='.repeat(79));
		console.log('\n❌ Could not fetch CVD config from any source');
		console.log('\n💡 Next steps:');
		console.log('   1. Analyze the output above for clues');
		console.log('   2. Check if encrypted text is embedded in page');
		console.log('   3. Try capturing network traffic when adding CVD indicator');
		console.log('   4. Consider using browser extension to capture config');
		
	} catch (error) {
		console.error('\n❌ Error:', error);
		process.exit(1);
	}
}

main();
