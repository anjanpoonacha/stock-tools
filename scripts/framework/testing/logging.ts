/**
 * Logging Utilities
 * 
 * Console logging helpers for test output.
 */

/**
 * Log a section header
 */
export function logSection(title: string): void {
	console.log('\n' + '='.repeat(80));
	console.log(`  ${title}`);
	console.log('='.repeat(80));
}

/**
 * Log a success message
 */
export function logSuccess(msg: string): void {
	console.log(`✅ ${msg}`);
}

/**
 * Log an info message
 */
export function logInfo(msg: string): void {
	console.log(`ℹ️  ${msg}`);
}

/**
 * Log a warning message
 */
export function logWarning(msg: string): void {
	console.log(`⚠️  ${msg}`);
}

/**
 * Log an error message
 */
export function logError(msg: string): void {
	console.error(`❌ ${msg}`);
}

/**
 * Log a test result
 */
export function logTestResult(name: string, passed: boolean, duration: number, error?: string): void {
	const status = passed ? '✅ PASSED' : '❌ FAILED';
	const time = `(${duration.toFixed(0)}ms)`;
	
	if (passed) {
		console.log(`${status} ${name} ${time}`);
	} else {
		console.log(`${status} ${name} ${time}`);
		if (error) {
			console.log(`    Error: ${error}`);
		}
	}
}

/**
 * Log test statistics
 */
export function logStats(stats: { passed: number; failed: number; skipped: number; total: number; duration: number }): void {
	console.log('\n' + '='.repeat(80));
	console.log('  TEST STATISTICS');
	console.log('='.repeat(80));
	console.log(`  Total:    ${stats.total}`);
	console.log(`  Passed:   ${stats.passed}`);
	console.log(`  Failed:   ${stats.failed}`);
	console.log(`  Skipped:  ${stats.skipped}`);
	console.log(`  Duration: ${(stats.duration / 1000).toFixed(2)}s`);
	console.log('='.repeat(80));
}
