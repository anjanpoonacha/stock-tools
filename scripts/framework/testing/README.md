# Test Framework

Simple, extensible testing framework for integration tests.

## Overview

This framework provides a clean, DRY approach to writing integration tests with:

- **Test isolation** - Each test runs independently
- **Shared context** - Connection and auth setup once
- **Easy extensibility** - Add new tests in < 5 lines
- **Clear error reporting** - Detailed assertion messages
- **Flexible execution** - Run all, one, or filtered tests
- **Good DX** - Progress indicators, timing, colored output

## Architecture

```
scripts/framework/testing/
├── types.ts          # Core types (TestCase, TestContext, TestResult)
├── TestSuite.ts      # Main test runner
├── assertions.ts     # Assertion helpers
├── logging.ts        # Logging utilities
├── setup.ts          # Setup/teardown helpers
└── index.ts          # Main exports
```

## Quick Start

### 1. Create a Test Case

Create a new file in `scripts/tests/v2/`:

```typescript
// scripts/tests/v2/07-my-new-test.ts
import { TestCase } from '../../framework/testing/types.js';
import { assertEqual, assertTrue } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess } from '../../framework/testing/logging.js';

export const test_MyNewFeature: TestCase = {
	name: 'My New Feature',
	description: 'Test description (optional)',
	timeout: 30000, // optional, default 30s
	
	async run(ctx) {
		logInfo('Testing my feature...');
		
		// Your test code here
		const result = await ctx.connection.someMethod();
		
		// Assertions
		assertTrue(result.success, 'Should succeed');
		assertEqual(result.value, 42, 'Value should be 42');
		
		logSuccess('Feature works!');
	}
};
```

### 2. Register the Test

Add to `scripts/tests/v2/index.ts`:

```typescript
export { test_MyNewFeature } from './07-my-new-test.js';
```

### 3. Add to Main Test File

Import and register in `scripts/test-v2-real-integration.ts`:

```typescript
import {
	test_BasicConnection,
	test_MyNewFeature, // Add this
	// ... other tests
} from './tests/v2/index.js';

// ...

suite.addTests(
	test_BasicConnection,
	test_MyNewFeature, // Add this
	// ... other tests
);
```

### 4. Run Tests

```bash
tsx scripts/test-v2-real-integration.ts
```

## Core Concepts

### TestContext

Shared context available to all tests:

```typescript
interface TestContext {
	jwtToken: string;              // JWT token for auth
	connection: WebSocketConnection; // WebSocket connection
	credentials: any;              // Raw credentials
	session: any;                  // Session data from KV
	metadata?: Record<string, any>; // Additional metadata
}
```

### TestCase

Test definition:

```typescript
interface TestCase {
	name: string;           // Unique test name
	description?: string;   // Optional description
	skip?: boolean;         // Skip this test
	timeout?: number;       // Timeout in ms (default: 30000)
	run: (ctx: TestContext) => Promise<void>;
}
```

### TestResult

Test execution result:

```typescript
interface TestResult {
	name: string;     // Test name
	passed: boolean;  // Pass/fail status
	duration: number; // Execution time in ms
	error?: string;   // Error message (if failed)
	stack?: string;   // Stack trace (if failed)
	skipped?: boolean; // Test was skipped
}
```

## Assertions

### Basic Assertions

```typescript
import { 
	assertEqual, 
	assertTrue, 
	assertFalse,
	assertDefined,
	assertUndefined 
} from '../../framework/testing/assertions.js';

// Equality
assertEqual(actual, expected, 'Custom message');
assertDeepEqual(obj1, obj2, 'Objects should match');

// Boolean
assertTrue(condition, 'Should be true');
assertFalse(condition, 'Should be false');

// Null/undefined
assertDefined(value, 'Should not be null/undefined');
assertUndefined(value, 'Should be null/undefined');
```

### Numeric Assertions

```typescript
import { assertGreaterThan, assertLessThan } from '../../framework/testing/assertions.js';

assertGreaterThan(10, 5, '10 > 5');
assertLessThan(5, 10, '5 < 10');
```

### Array Assertions

```typescript
import { assertContains, assertLength } from '../../framework/testing/assertions.js';

assertContains([1, 2, 3], 2, 'Array should contain 2');
assertLength([1, 2, 3], 3, 'Array should have length 3');
```

### Error Assertions

```typescript
import { assertThrows } from '../../framework/testing/assertions.js';

// Assert that function throws
await assertThrows(
	async () => { throw new Error('boom'); },
	'boom', // Expected error message substring
	'Should throw error'
);

// With regex
await assertThrows(
	async () => { throw new Error('Connection failed'); },
	/connection/i,
	'Should throw connection error'
);
```

## Logging

```typescript
import { 
	logSection, 
	logInfo, 
	logSuccess, 
	logWarning, 
	logError 
} from '../../framework/testing/logging.js';

logSection('My Test Section');
logInfo('Fetching data...');
logSuccess('Data fetched successfully');
logWarning('Rate limit approaching');
logError('Failed to connect');
```

## Test Suite

### Run All Tests

```typescript
const suite = new TestSuite('My Test Suite');
suite.addTests(test1, test2, test3);
const stats = await suite.runAll(ctx);
```

### Run Single Test

```typescript
const result = await suite.runByName('Basic Connection', ctx);
```

### Run Filtered Tests

```typescript
// Run all tests with "symbol" in name
const stats = await suite.runMatching(/symbol/i, ctx);
```

### Skip Tests

```typescript
export const test_Experimental: TestCase = {
	name: 'Experimental Feature',
	skip: true, // Skip this test
	async run(ctx) {
		// ...
	}
};
```

## Setup & Teardown

### Global Setup

Setup is done once before all tests:

```typescript
const ctx = await setupTestContext();
// Loads credentials, gets JWT, creates connection
```

### Global Teardown

Teardown is done once after all tests:

```typescript
await teardownTestContext(ctx);
// Disposes connection, cleanup
```

### Per-Test Setup

If you need test-specific setup:

```typescript
export const test_WithSetup: TestCase = {
	name: 'Test with Setup',
	async run(ctx) {
		// Test-specific setup
		const tempData = await setupTempData();
		
		try {
			// Test logic
			const result = await ctx.connection.fetch(tempData);
			assertTrue(result.success);
		} finally {
			// Test-specific cleanup
			await cleanupTempData(tempData);
		}
	}
};
```

## Examples

### Basic Test

```typescript
export const test_Example: TestCase = {
	name: 'Example Test',
	async run(ctx) {
		const data = await ctx.connection.fetchSymbol({
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			barsCount: 100
		});
		
		assertGreaterThan(data.bars.length, 0, 'Should have bars');
		assertTrue(data.bars[0].close > 0, 'Close price should be positive');
	}
};
```

### Test with Multiple Assertions

```typescript
export const test_ValidationExample: TestCase = {
	name: 'Validation Example',
	async run(ctx) {
		const data = await ctx.connection.fetchSymbol({
			symbol: 'NSE:TCS',
			resolution: '1D',
			barsCount: 300
		});
		
		// Structure validation
		assertDefined(data.bars, 'Should have bars array');
		assertDefined(data.metadata, 'Should have metadata');
		assertGreaterThan(data.bars.length, 0, 'Should have at least one bar');
		
		// Bar validation
		const lastBar = data.bars[data.bars.length - 1];
		assertTrue(lastBar.time > 0, 'Time should be positive');
		assertTrue(lastBar.high >= lastBar.low, 'High should be >= Low');
		assertTrue(lastBar.close >= lastBar.low, 'Close should be >= Low');
		assertTrue(lastBar.close <= lastBar.high, 'Close should be <= High');
		
		// Chronological order
		for (let i = 1; i < data.bars.length; i++) {
			assertGreaterThan(
				data.bars[i].time,
				data.bars[i - 1].time,
				`Bar ${i} should come after bar ${i - 1}`
			);
		}
	}
};
```

### Test with Timeout

```typescript
export const test_LongRunning: TestCase = {
	name: 'Long Running Test',
	timeout: 60000, // 60 seconds
	async run(ctx) {
		const data = await ctx.connection.fetchSymbol({
			symbol: 'NSE:NIFTY',
			resolution: '1D',
			barsCount: 1000,
			indicators: [{ type: 'cvd', config: { anchorPeriod: '1Y' } }]
		});
		
		assertGreaterThan(data.bars.length, 0);
	}
};
```

## Best Practices

### 1. Use Descriptive Names

```typescript
// Good
export const test_SingleSymbolFetch: TestCase = {
	name: 'Single Symbol Fetch',
	// ...
};

// Bad
export const test1: TestCase = {
	name: 'Test 1',
	// ...
};
```

### 2. Add Descriptions

```typescript
export const test_Feature: TestCase = {
	name: 'Feature Test',
	description: 'Validates that feature X works with input Y',
	// ...
};
```

### 3. Use Meaningful Assertion Messages

```typescript
// Good
assertEqual(data.symbol, 'NSE:RELIANCE', 'Symbol should match requested symbol');

// Bad
assertEqual(data.symbol, 'NSE:RELIANCE');
```

### 4. Log Progress

```typescript
async run(ctx) {
	logInfo('Fetching data...');
	const data = await ctx.connection.fetch();
	
	logInfo('Validating structure...');
	assertDefined(data.bars);
	
	logSuccess('All validations passed');
}
```

### 5. Keep Tests Isolated

Each test should be independent and not rely on side effects from other tests.

```typescript
// Good - Each test fetches its own data
export const test_A: TestCase = {
	async run(ctx) {
		const data = await ctx.connection.fetch('A');
		// Test A logic
	}
};

export const test_B: TestCase = {
	async run(ctx) {
		const data = await ctx.connection.fetch('B');
		// Test B logic
	}
};

// Bad - test_B depends on test_A
let sharedData: any;

export const test_A: TestCase = {
	async run(ctx) {
		sharedData = await ctx.connection.fetch('A');
	}
};

export const test_B: TestCase = {
	async run(ctx) {
		// Uses sharedData from test_A
		assertEqual(sharedData.value, 42);
	}
};
```

### 6. Set Appropriate Timeouts

```typescript
// Quick tests
export const test_Validation: TestCase = {
	timeout: 5000, // 5 seconds
	async run(ctx) {
		// Quick validation logic
	}
};

// Slow tests
export const test_LargeDataFetch: TestCase = {
	timeout: 60000, // 60 seconds
	async run(ctx) {
		// Slow data fetching logic
	}
};
```

## Troubleshooting

### Test Timeout

If a test times out:

1. Increase the timeout: `timeout: 60000`
2. Check if the connection is hanging
3. Add logging to see where it's stuck

### Assertion Failures

Assertion errors include context:

```
AssertionError: Bar count should match
  Expected: 300
  Actual: 250
```

### Connection Issues

If connection setup fails:

1. Check credentials.json exists
2. Verify KV store has valid session
3. Check TradingView session is not expired

## Framework Stats

- **Framework code**: ~500 lines
- **No external dependencies** (beyond project deps)
- **Pure TypeScript/JavaScript**
- **Easy to extend**

## Future Enhancements

Potential improvements:

- [ ] Parallel test execution
- [ ] Test hooks (beforeEach, afterEach)
- [ ] Test fixtures
- [ ] Test coverage tracking
- [ ] HTML test reports
- [ ] CI/CD integration helpers

## Contributing

To add new assertions:

1. Add function to `assertions.ts`
2. Export from `index.ts`
3. Update this README

To add new test utilities:

1. Add function to `setup.ts` or create new file
2. Export from `index.ts`
3. Update this README

## License

Same as project license.
