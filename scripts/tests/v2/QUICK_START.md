# Quick Start Guide - Adding a New Test

## 5-Step Process (< 2 minutes)

### Step 1: Copy Template

```bash
cp scripts/tests/v2/TEMPLATE.ts scripts/tests/v2/07-my-feature.ts
```

### Step 2: Write Test

```typescript
// scripts/tests/v2/07-my-feature.ts
import { TestCase } from '../../framework/testing/types.js';
import { assertEqual, assertTrue } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess } from '../../framework/testing/logging.js';

export const test_MyFeature: TestCase = {
	name: 'My Feature',
	description: 'Tests my awesome feature',
	timeout: 30000,
	
	async run(ctx) {
		logInfo('Testing feature...');
		
		// Your test logic
		const result = await ctx.connection.fetchSymbol({
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			barsCount: 100
		});
		
		// Assertions
		assertTrue(result.bars.length > 0, 'Should have bars');
		assertEqual(result.symbol, 'NSE:RELIANCE', 'Symbol should match');
		
		logSuccess('Feature works!');
	}
};
```

### Step 3: Export Test

Add to `scripts/tests/v2/index.ts`:

```typescript
export { test_MyFeature } from './07-my-feature.js';
```

### Step 4: Register Test

Add to `scripts/test-v2-real-integration.ts`:

```typescript
import {
	test_BasicConnection,
	test_SingleSymbolFetch,
	test_SymbolSwitching,
	test_CVDTimeout,
	test_ConcurrentRequests,
	test_ConnectionHealth,
	test_MyFeature  // <-- Add this
} from './tests/v2/index.js';

// ...

suite.addTests(
	test_BasicConnection,
	test_SingleSymbolFetch,
	test_SymbolSwitching,
	test_CVDTimeout,
	test_ConcurrentRequests,
	test_ConnectionHealth,
	test_MyFeature  // <-- Add this
);
```

### Step 5: Run Tests

```bash
tsx scripts/test-v2-real-integration.ts
```

## Common Assertions

```typescript
import {
	assertEqual,
	assertTrue,
	assertFalse,
	assertDefined,
	assertGreaterThan,
	assertLessThan,
	assertContains,
	assertLength,
	assertThrows
} from '../../framework/testing/assertions.js';

// Equality
assertEqual(actual, expected, 'Custom message');

// Boolean
assertTrue(condition, 'Should be true');
assertFalse(condition, 'Should be false');

// Null check
assertDefined(value, 'Should not be null/undefined');

// Numeric
assertGreaterThan(10, 5, '10 > 5');
assertLessThan(5, 10, '5 < 10');

// Arrays
assertContains([1, 2, 3], 2, 'Array should contain 2');
assertLength([1, 2, 3], 3, 'Array length should be 3');

// Errors
await assertThrows(
	async () => { throw new Error('boom'); },
	'boom',
	'Should throw error'
);
```

## Common Patterns

### Basic Fetch

```typescript
const data = await ctx.connection.fetchSymbol({
	symbol: 'NSE:RELIANCE',
	resolution: '1D',
	barsCount: 300
});

assertGreaterThan(data.bars.length, 0);
assertEqual(data.symbol, 'NSE:RELIANCE');
```

### Fetch with Indicator

```typescript
const data = await ctx.connection.fetchSymbol({
	symbol: 'NSE:NIFTY',
	resolution: '1D',
	barsCount: 300,
	indicators: [{ type: 'cvd', config: { anchorPeriod: '3M' } }]
});

if (data.indicators?.has('cvd')) {
	const cvd = data.indicators.get('cvd');
	assertGreaterThan(cvd.bars.length, 0);
}
```

### Parallel Requests

```typescript
const [data1, data2] = await Promise.all([
	ctx.connection.fetchSymbol({ symbol: 'NSE:RELIANCE', resolution: '1D', barsCount: 100 }),
	ctx.connection.fetchSymbol({ symbol: 'NSE:TCS', resolution: '1D', barsCount: 100 })
]);

assertGreaterThan(data1.bars.length, 0);
assertGreaterThan(data2.bars.length, 0);
```

### Configure Timeout

```typescript
ctx.connection.setRequestTimeout('create_study', 45000);

const data = await ctx.connection.fetchSymbol({
	symbol: 'NSE:NIFTY',
	resolution: '1D',
	barsCount: 300,
	indicators: [{ type: 'cvd' }]
});
```

### Skip Test

```typescript
export const test_Experimental: TestCase = {
	name: 'Experimental Feature',
	skip: true,  // <-- Skip this test
	async run(ctx) {
		// ...
	}
};
```

### Custom Timeout

```typescript
export const test_LongRunning: TestCase = {
	name: 'Long Running Test',
	timeout: 60000,  // <-- 60 seconds
	async run(ctx) {
		// ...
	}
};
```

## Test Context

Available in every test:

```typescript
interface TestContext {
	jwtToken: string;              // JWT token
	connection: WebSocketConnection; // WebSocket connection
	credentials: any;              // From credentials.json
	session: any;                  // From KV store
}
```

## Logging

```typescript
import { logSection, logInfo, logSuccess, logWarning, logError } from '../../framework/testing/logging.js';

logSection('My Section');  // Section header
logInfo('Fetching...');    // Info message
logSuccess('Done!');       // Success message
logWarning('Warning!');    // Warning message
logError('Failed!');       // Error message
```

## Full Documentation

- Framework: `scripts/framework/testing/README.md`
- Tests: `scripts/tests/v2/README.md`
- Template: `scripts/tests/v2/TEMPLATE.ts`
