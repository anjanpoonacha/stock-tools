#!/usr/bin/env tsx
/**
 * Comprehensive CVD Integration Test Script
 * 
 * This script verifies that CVD (Cumulative Volume Delta) is working correctly
 * after the recent fixes. It tests the complete data flow:
 * 
 * 1. Session Resolution from KV storage
 * 2. JWT Token Extraction
 * 3. CVD Config Fetching (dynamic)
 * 4. Connection Pool with CVD enabled
 * 5. CVD Data Verification
 * 
 * Usage:
 *   tsx scripts/test-cvd-integration.ts <userEmail> <userPassword>
 * 
 * Example:
 *   tsx scripts/test-cvd-integration.ts user@example.com mypassword
 */

import { SessionResolver } from '../src/lib/SessionResolver';
import { getDataAccessToken } from '../src/lib/tradingview/jwtService';
import { getCVDConfig, cvdConfigService } from '../src/lib/tradingview/cvdConfigService';
import { getConnectionPool } from '../src/lib/tradingview/connectionPool';

// ANSI color codes for better output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m',
};

// Formatting helpers
const section = (title: string) => {
	console.log('\n' + colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
	console.log(colors.bright + colors.blue + '  ' + title + colors.reset);
	console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset + '\n');
};

const subsection = (title: string) => {
	console.log('\n' + colors.cyan + '─'.repeat(80) + colors.reset);
	console.log(colors.cyan + '  ' + title + colors.reset);
	console.log(colors.cyan + '─'.repeat(80) + colors.reset);
};

const success = (msg: string) => console.log(colors.green + '✅ ' + msg + colors.reset);
const error = (msg: string) => console.log(colors.red + '❌ ' + msg + colors.reset);
const warning = (msg: string) => console.log(colors.yellow + '⚠️  ' + msg + colors.reset);
const info = (msg: string) => console.log(colors.gray + '   ' + msg + colors.reset);
const detail = (key: string, value: any) => console.log(colors.gray + '   ' + key + ': ' + colors.reset + value);

interface TestResult {
	passed: boolean;
	message: string;
	details?: Record<string, any>;
	duration?: number;
}

interface TestSummary {
	total: number;
	passed: number;
	failed: number;
	warnings: number;
	duration: number;
}

// Test results tracking
const testResults: Array<{ name: string; result: TestResult }> = [];

function recordTest(name: string, result: TestResult): void {
	testResults.push({ name, result });
	if (result.passed) {
		success(`${name} (${result.duration}ms)`);
	} else {
		error(`${name}: ${result.message}`);
	}
	if (result.details) {
		for (const [key, value] of Object.entries(result.details)) {
			detail(key, value);
		}
	}
}

/**
 * Test 1: Session Resolution from KV
 */
async function testSessionResolution(
	userEmail: string,
	userPassword: string
): Promise<{ sessionId: string; sessionIdSign?: string; userId: number }> {
	subsection('Test 1: Session Resolution from KV');
	
	const start = Date.now();
	try {
		const sessionInfo = await SessionResolver.getLatestSessionForUser('tradingview', {
			userEmail,
			userPassword
		});
		
		if (!sessionInfo) {
			recordTest('Session Resolution', {
				passed: false,
				message: 'No TradingView session found for this user',
				duration: Date.now() - start
			});
			throw new Error('Session not found - please log in via the browser extension');
		}
		
		const { sessionData } = sessionInfo;
		const sessionId = sessionData.sessionId;
		const sessionIdSign = sessionData.sessionid_sign;
		const userId = sessionData.userId ? parseInt(sessionData.userId, 10) : 0;
		
		recordTest('Session Resolution', {
			passed: true,
			message: 'Session retrieved from KV',
			details: {
				sessionId: `${sessionId.substring(0, 10)}...`,
				hasSessionIdSign: !!sessionIdSign,
				userId,
				source: sessionData.source || 'unknown'
			},
			duration: Date.now() - start
		});
		
		// Validate required fields
		if (!sessionIdSign) {
			warning('sessionid_sign is missing - CVD may not work correctly');
			warning('Please update the browser extension to capture both sessionid and sessionid_sign');
		}
		
		return { sessionId, sessionIdSign, userId };
	} catch (err) {
		recordTest('Session Resolution', {
			passed: false,
			message: err instanceof Error ? err.message : String(err),
			duration: Date.now() - start
		});
		throw err;
	}
}

/**
 * Test 2: JWT Token Extraction
 */
async function testJWTExtraction(
	sessionId: string,
	sessionIdSign: string | undefined,
	userId: number
): Promise<string> {
	subsection('Test 2: JWT Token Extraction');
	
	const start = Date.now();
	try {
		const token = await getDataAccessToken(
			sessionId,
			sessionIdSign || '',
			userId
		);
		
		if (!token || token.length < 100) {
			throw new Error('Invalid JWT token received');
		}
		
		recordTest('JWT Token Extraction', {
			passed: true,
			message: 'JWT token extracted successfully',
			details: {
				tokenLength: token.length,
				tokenStart: token.substring(0, 20) + '...'
			},
			duration: Date.now() - start
		});
		
		return token;
	} catch (err) {
		recordTest('JWT Token Extraction', {
			passed: false,
			message: err instanceof Error ? err.message : String(err),
			duration: Date.now() - start
		});
		throw err;
	}
}

/**
 * Test 3: CVD Config Fetching
 */
async function testCVDConfig(
	sessionId: string,
	sessionIdSign: string | undefined
): Promise<void> {
	subsection('Test 3: CVD Config Fetching');
	
	// Test 3a: Cache Status Before
	info('Checking initial cache status...');
	const cacheStatusBefore = await cvdConfigService.getCacheStatus();
	detail('Cache status before', cacheStatusBefore.cached ? 'CACHED' : 'EMPTY');
	if (cacheStatusBefore.cached && cacheStatusBefore.ttl) {
		const hoursRemaining = Math.round(cacheStatusBefore.ttl / 3600);
		detail('Cache TTL remaining', `${cacheStatusBefore.ttl}s (~${hoursRemaining} hours)`);
	}
	
	// Test 3b: First Fetch
	const start1 = Date.now();
	try {
		const config1 = await getCVDConfig(sessionId, sessionIdSign);
		
		recordTest('CVD Config Fetch (First)', {
			passed: true,
			message: 'CVD config fetched successfully',
			details: {
				source: config1.source,
				pineId: config1.pineId,
				pineVersion: config1.pineVersion,
				encryptedTextLength: config1.text.length,
				textStartsWith: config1.text.substring(0, 20) + '...',
				fetchedAt: config1.fetchedAt?.toISOString() || 'N/A'
			},
			duration: Date.now() - start1
		});
		
		// Validate config structure
		if (!config1.text || config1.text.length < 1000) {
			warning('Encrypted text seems too short');
		}
		if (!config1.text.startsWith('bmI9Ks46_')) {
			warning('Encrypted text has unexpected format');
		}
		if (config1.pineId !== 'STD;Cumulative%1Volume%1Delta') {
			warning(`Unexpected Pine ID: ${config1.pineId}`);
		}
	} catch (err) {
		recordTest('CVD Config Fetch (First)', {
			passed: false,
			message: err instanceof Error ? err.message : String(err),
			duration: Date.now() - start1
		});
		throw err;
	}
	
	// Test 3c: Second Fetch (Should use cache)
	info('Testing cache hit...');
	const start2 = Date.now();
	try {
		const config2 = await getCVDConfig(sessionId, sessionIdSign);
		
		const isCacheHit = config2.source === 'kv-cache';
		
		recordTest('CVD Config Fetch (Cached)', {
			passed: isCacheHit,
			message: isCacheHit ? 'Cache hit confirmed' : `Expected cache hit but got: ${config2.source}`,
			details: {
				source: config2.source,
				textLength: config2.text.length
			},
			duration: Date.now() - start2
		});
		
		if (!isCacheHit) {
			warning('Cache is not working correctly - may impact performance');
		}
	} catch (err) {
		recordTest('CVD Config Fetch (Cached)', {
			passed: false,
			message: err instanceof Error ? err.message : String(err),
			duration: Date.now() - start2
		});
		// Don't throw - cache test is not critical
	}
	
	// Test 3d: Cache Status After
	const cacheStatusAfter = await cvdConfigService.getCacheStatus();
	detail('Cache status after', cacheStatusAfter.cached ? 'CACHED' : 'EMPTY');
	if (cacheStatusAfter.cached && cacheStatusAfter.config) {
		detail('Cached Pine version', cacheStatusAfter.config.pineVersion);
	}
}

/**
 * Test 4: Connection Pool with CVD
 */
async function testConnectionPoolWithCVD(
	jwtToken: string,
	sessionId: string,
	sessionIdSign: string | undefined
): Promise<void> {
	subsection('Test 4: Connection Pool with CVD Enabled');
	
	const pool = getConnectionPool();
	const testSymbol = 'NSE:RELIANCE';
	const resolution = '1D';
	const barsCount = 100;
	
	const start = Date.now();
	try {
		info(`Fetching ${testSymbol} with CVD enabled...`);
		
		const result = await pool.fetchChartData(
			jwtToken,
			testSymbol,
			resolution,
			barsCount,
			{
				cvdEnabled: true,
				cvdAnchorPeriod: '3M',
				cvdTimeframe: undefined,
				sessionId,
				sessionIdSign
			}
		);
		
		// Validate bars
		if (!result.bars || result.bars.length === 0) {
			throw new Error('No bars returned from connection pool');
		}
		
		// Validate CVD data
		const hasCVD = !!result.indicators?.cvd;
		const cvdDataCount = result.indicators?.cvd?.values?.length || 0;
		
		recordTest('Connection Pool Fetch', {
			passed: true,
			message: 'Chart data fetched successfully',
			details: {
				symbol: testSymbol,
				barsReceived: result.bars.length,
				hasCVD,
				cvdDataPoints: cvdDataCount,
				firstBarTime: new Date(result.bars[0].time * 1000).toISOString(),
				lastBarTime: new Date(result.bars[result.bars.length - 1].time * 1000).toISOString()
			},
			duration: Date.now() - start
		});
		
		// Validate CVD indicator data
		if (!hasCVD) {
			recordTest('CVD Data Verification', {
				passed: false,
				message: 'CVD indicator data not found in response'
			});
			warning('CVD was requested but not returned - this indicates a problem with CVD integration');
		} else {
			recordTest('CVD Data Verification', {
				passed: true,
				message: 'CVD indicator data present',
				details: {
					dataPoints: cvdDataCount,
					studyId: result.indicators?.cvd?.studyId || 'unknown',
					studyName: result.indicators?.cvd?.studyName || 'unknown',
					hasData: cvdDataCount > 0
				}
			});
			
			// Show sample CVD values
			if (result.indicators?.cvd?.values && result.indicators.cvd.values.length > 0) {
				const sampleSize = Math.min(5, result.indicators.cvd.values.length);
				info('Sample CVD values (first 5):');
				for (let i = 0; i < sampleSize; i++) {
					const dataPoint = result.indicators.cvd.values[i];
					detail(`  [${i}]`, JSON.stringify(dataPoint));
				}
			}
		}
		
		// Validate metadata
		if (result.metadata) {
			detail('Symbol metadata', JSON.stringify(result.metadata, null, 2));
		}
		
	} catch (err) {
		recordTest('Connection Pool Fetch', {
			passed: false,
			message: err instanceof Error ? err.message : String(err),
			duration: Date.now() - start
		});
		throw err;
	}
}

/**
 * Test 5: Connection Pool Statistics
 */
async function testPoolStatistics(): Promise<void> {
	subsection('Test 5: Connection Pool Statistics');
	
	const pool = getConnectionPool();
	const stats = pool.getStats();
	
	detail('Max Connections', stats.maxConnections);
	detail('Requests Per Connection', stats.requestsPerConnection);
	detail('Persistent Mode', stats.persistentMode ? 'ENABLED' : 'DISABLED');
	detail('Persistent Connections', stats.persistentConnections);
	
	recordTest('Pool Statistics', {
		passed: true,
		message: 'Pool statistics retrieved',
		details: stats
	});
}

/**
 * Print Summary
 */
function printSummary(totalDuration: number): void {
	section('TEST SUMMARY');
	
	const summary: TestSummary = {
		total: testResults.length,
		passed: testResults.filter(t => t.result.passed).length,
		failed: testResults.filter(t => !t.result.passed).length,
		warnings: 0, // Can be enhanced to track warnings
		duration: totalDuration
	};
	
	console.log(colors.bright + '\nResults:' + colors.reset);
	console.log(colors.green + `  ✅ Passed:  ${summary.passed}/${summary.total}` + colors.reset);
	console.log(colors.red + `  ❌ Failed:  ${summary.failed}/${summary.total}` + colors.reset);
	console.log(colors.gray + `  ⏱️  Duration: ${summary.duration}ms (${(summary.duration / 1000).toFixed(2)}s)` + colors.reset);
	
	if (summary.failed > 0) {
		console.log('\n' + colors.red + colors.bright + 'Failed Tests:' + colors.reset);
		testResults
			.filter(t => !t.result.passed)
			.forEach(t => {
				console.log(colors.red + `  • ${t.name}: ${t.result.message}` + colors.reset);
			});
	}
	
	// Overall result
	console.log('\n' + colors.bright + '─'.repeat(80) + colors.reset);
	if (summary.failed === 0) {
		console.log(colors.green + colors.bright + '\n  🎉 ALL TESTS PASSED! CVD integration is working correctly.\n' + colors.reset);
	} else {
		console.log(colors.red + colors.bright + '\n  ❌ SOME TESTS FAILED. Please review the errors above.\n' + colors.reset);
	}
	console.log(colors.bright + '─'.repeat(80) + colors.reset + '\n');
}

/**
 * Main Test Runner
 */
async function main() {
	const startTime = Date.now();
	
	// Parse command line arguments
	const userEmail = process.argv[2];
	const userPassword = process.argv[3];
	
	if (!userEmail || !userPassword) {
		console.error('\n' + colors.red + '❌ Usage: tsx scripts/test-cvd-integration.ts <userEmail> <userPassword>' + colors.reset);
		console.error(colors.gray + 'Example: tsx scripts/test-cvd-integration.ts user@example.com mypassword\n' + colors.reset);
		process.exit(1);
	}
	
	// Print header
	console.log('\n' + colors.bright + colors.blue + '╔' + '═'.repeat(78) + '╗' + colors.reset);
	console.log(colors.bright + colors.blue + '║' + ' '.repeat(20) + 'CVD INTEGRATION TEST SUITE' + ' '.repeat(32) + '║' + colors.reset);
	console.log(colors.bright + colors.blue + '╚' + '═'.repeat(78) + '╝' + colors.reset);
	
	info('Testing CVD after recent fixes');
	info('User: ' + userEmail);
	console.log('');
	
	try {
		// Test 1: Session Resolution
		const { sessionId, sessionIdSign, userId } = await testSessionResolution(
			userEmail,
			userPassword
		);
		
		// Test 2: JWT Token Extraction
		const jwtToken = await testJWTExtraction(sessionId, sessionIdSign, userId);
		
		// Test 3: CVD Config Fetching
		await testCVDConfig(sessionId, sessionIdSign);
		
		// Test 4: Connection Pool with CVD
		await testConnectionPoolWithCVD(jwtToken, sessionId, sessionIdSign);
		
		// Test 5: Pool Statistics
		await testPoolStatistics();
		
		// Print summary
		const totalDuration = Date.now() - startTime;
		printSummary(totalDuration);
		
		// Exit with appropriate code
		const failedCount = testResults.filter(t => !t.result.passed).length;
		process.exit(failedCount > 0 ? 1 : 0);
		
	} catch (err) {
		error('\n💥 Fatal error during test execution:');
		console.error(err);
		
		const totalDuration = Date.now() - startTime;
		printSummary(totalDuration);
		
		process.exit(1);
	}
}

// Run the test suite
main().catch(err => {
	console.error('\n' + colors.red + '💥 Unhandled error:' + colors.reset, err);
	process.exit(1);
});
