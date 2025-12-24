/**
 * Test Suite
 * 
 * Main test runner for integration tests.
 */

import { TestCase, TestContext, TestResult, TestStats } from './types.js';
import { logSection, logSuccess, logError, logInfo, logStats } from './logging.js';

/**
 * Test suite runner
 */
export class TestSuite {
	private tests: TestCase[] = [];
	private results: TestResult[] = [];
	
	constructor(private name: string) {}
	
	/**
	 * Add a test case to the suite
	 */
	addTest(test: TestCase): void {
		this.tests.push(test);
	}
	
	/**
	 * Add multiple test cases
	 */
	addTests(...tests: TestCase[]): void {
		this.tests.push(...tests);
	}
	
	/**
	 * Run all tests in the suite
	 * 
	 * IMPORTANT: Each test gets a fresh context to prevent cascade failures.
	 * If a test fails, it won't affect subsequent tests.
	 */
	async runAll(ctx: TestContext): Promise<TestStats> {
		logSection(this.name);
		logInfo(`Running ${this.tests.length} tests...\n`);
		logInfo('⚠️  Note: Each test runs with a fresh connection for isolation\n');
		
		const startTime = Date.now();
		
		for (const test of this.tests) {
			// Create fresh context for each test to prevent cascade failures
			const freshCtx = await this.createFreshContext(ctx);
			
			try {
				await this.runOne(test, freshCtx);
			} finally {
				// Clean up test-specific connection
				await this.cleanupContext(freshCtx);
			}
		}
		
		const duration = Date.now() - startTime;
		const stats = this.getStats(duration);
		
		this.printSummary(stats);
		
		return stats;
	}
	
	/**
	 * Run a single test by name
	 */
	async runByName(name: string, ctx: TestContext): Promise<TestResult | null> {
		const test = this.tests.find(t => t.name === name);
		
		if (!test) {
			logError(`Test not found: ${name}`);
			return null;
		}
		
		return await this.runOne(test, ctx);
	}
	
	/**
	 * Run tests matching a pattern
	 */
	async runMatching(pattern: RegExp, ctx: TestContext): Promise<TestStats> {
		const matchingTests = this.tests.filter(t => pattern.test(t.name));
		
		if (matchingTests.length === 0) {
			logError(`No tests match pattern: ${pattern}`);
			return {
				total: 0,
				passed: 0,
				failed: 0,
				skipped: 0,
				duration: 0
			};
		}
		
		logSection(`${this.name} (Filtered)`);
		logInfo(`Running ${matchingTests.length} matching tests...\n`);
		
		const startTime = Date.now();
		
		for (const test of matchingTests) {
			await this.runOne(test, ctx);
		}
		
		const duration = Date.now() - startTime;
		const stats = this.getStats(duration);
		
		this.printSummary(stats);
		
		return stats;
	}
	
	/**
	 * Run a single test case
	 */
	private async runOne(test: TestCase, ctx: TestContext): Promise<TestResult> {
		logSection(test.name);
		
		if (test.description) {
			logInfo(test.description);
		}
		
		// Skip test if requested
		if (test.skip) {
			logInfo('Skipped');
			const result: TestResult = {
				name: test.name,
				passed: true,
				duration: 0,
				skipped: true
			};
			this.results.push(result);
			return result;
		}
		
		const timeout = test.timeout || 30000;
		const startTime = Date.now();
		
		try {
			// Run test with timeout
			await this.runWithTimeout(test.run(ctx), timeout, test.name);
			
			const duration = Date.now() - startTime;
			
			logSuccess(`Test passed in ${duration}ms`);
			
			const result: TestResult = {
				name: test.name,
				passed: true,
				duration
			};
			
			this.results.push(result);
			return result;
			
		} catch (error: any) {
			const duration = Date.now() - startTime;
			
			logError(`Test failed: ${error.message}`);
			
			if (error.stack) {
				console.error('\nStack trace:');
				console.error(error.stack);
			}
			
			const result: TestResult = {
				name: test.name,
				passed: false,
				duration,
				error: error.message,
				stack: error.stack
			};
			
			this.results.push(result);
			return result;
		}
	}
	
	/**
	 * Run a promise with timeout
	 */
	private async runWithTimeout<T>(
		promise: Promise<T>,
		timeout: number,
		_testName: string
	): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) =>
				setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout)
			)
		]);
	}
	
	/**
	 * Get test statistics
	 */
	private getStats(duration: number): TestStats {
		const passed = this.results.filter(r => r.passed && !r.skipped).length;
		const failed = this.results.filter(r => !r.passed).length;
		const skipped = this.results.filter(r => r.skipped).length;
		const total = this.results.length;
		
		return { total, passed, failed, skipped, duration };
	}
	
	/**
	 * Print test summary
	 */
	private printSummary(stats: TestStats): void {
		console.log('\n' + '='.repeat(80));
		console.log('  TEST RESULTS SUMMARY');
		console.log('='.repeat(80));
		console.log('');
		
		for (const result of this.results) {
			if (result.skipped) {
				console.log(`⏭️  ${result.name} - SKIPPED`);
			} else if (result.passed) {
				console.log(`✅ ${result.name} - PASSED (${result.duration}ms)`);
			} else {
				console.log(`❌ ${result.name} - FAILED (${result.duration}ms)`);
				if (result.error) {
					console.log(`    Error: ${result.error}`);
				}
			}
		}
		
		console.log('');
		logStats(stats);
		
		if (stats.failed > 0) {
			console.log('\n⚠️  Some tests failed. Review the output above for details.\n');
		} else {
			console.log('\n🎉 ALL TESTS PASSED! 🎉\n');
		}
	}
	
	/**
	 * Get all test results
	 */
	getResults(): TestResult[] {
		return this.results;
	}
	
	/**
	 * Clear all results (for re-running)
	 */
	clearResults(): void {
		this.results = [];
	}
	
	/**
	 * Create fresh test context with new connection
	 * 
	 * Reuses JWT token but creates new WebSocket connection.
	 * This prevents test failures from cascading.
	 */
	private async createFreshContext(baseCtx: TestContext): Promise<TestContext> {
		// Import setup functions dynamically to avoid circular deps
		const { setupConnection } = await import('./setup.js');
		
		// Extract session credentials for CVD provider
		const sessionId = baseCtx.session?.sessionData?.sessionId;
		const sessionIdSign = baseCtx.session?.sessionData?.sessionIdSign;
		const hasCVDProvider = !!baseCtx.cvdProvider;
		
		// Create new connection with same JWT token and CVD provider if original context had one
		const { connection, cvdProvider } = await setupConnection(baseCtx.jwtToken, {
			sessionId,
			sessionIdSign,
			withCVD: hasCVDProvider
		});
		
		return {
			jwtToken: baseCtx.jwtToken,
			credentials: baseCtx.credentials,
			session: baseCtx.session,
			connection,
			cvdProvider
		};
	}
	
	/**
	 * Cleanup test-specific context
	 */
	private async cleanupContext(ctx: TestContext): Promise<void> {
		try {
			await ctx.connection.dispose();
		} catch (error) {
			// Ignore cleanup errors
		}
	}
}
