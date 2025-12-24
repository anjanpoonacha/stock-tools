/**
 * Test Framework Types
 * 
 * Simple, extensible test framework for integration tests.
 */

import { WebSocketConnection } from '../../../src/lib/tradingview/v2/WebSocketConnection.js';
import type { CVDConfigProvider } from '../../../src/lib/tradingview/v2/providers/index.js';

/**
 * Test context shared across all tests
 */
export interface TestContext {
	/** JWT token for authentication */
	jwtToken: string;
	/** WebSocket connection instance */
	connection: WebSocketConnection;
	/** Raw credentials from credentials.json */
	credentials: any;
	/** Session data from KV store */
	session: any;
	/** CVD config provider (optional) */
	cvdProvider?: CVDConfigProvider;
	/** Additional metadata */
	metadata?: Record<string, any>;
}

/**
 * Test case definition
 */
export interface TestCase {
	/** Unique test name */
	name: string;
	/** Test description (optional) */
	description?: string;
	/** Skip this test */
	skip?: boolean;
	/** Test timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** Test function */
	run: (ctx: TestContext) => Promise<void>;
}

/**
 * Test result
 */
export interface TestResult {
	/** Test name */
	name: string;
	/** Pass/fail status */
	passed: boolean;
	/** Execution time in milliseconds */
	duration: number;
	/** Error message (if failed) */
	error?: string;
	/** Stack trace (if failed) */
	stack?: string;
	/** Test was skipped */
	skipped?: boolean;
}

/**
 * Test suite statistics
 */
export interface TestStats {
	/** Total tests */
	total: number;
	/** Passed tests */
	passed: number;
	/** Failed tests */
	failed: number;
	/** Skipped tests */
	skipped: number;
	/** Total execution time in milliseconds */
	duration: number;
}
