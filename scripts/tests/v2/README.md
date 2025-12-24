# v2 WebSocket Integration Tests

Integration tests for v2 WebSocketConnection architecture.

## Test Files

| File | Test Name | Description |
|------|-----------|-------------|
| `01-basic-connection.ts` | Basic Connection | Verifies connection initialization and READY state |
| `02-single-symbol-fetch.ts` | Single Symbol Fetch | Fetches OHLCV data and validates structure |
| `03-symbol-switching.ts` | Symbol Switching | Tests sequential symbol fetching with auto-cancellation |
| `04-cvd-timeout.ts` | CVD with Timeout | Tests CVD indicator with configurable timeout |
| `05-concurrent-requests.ts` | Concurrent Requests | Tests parallel requests for different symbols |
| `06-connection-health.ts` | Connection Health | Monitors connection health and statistics |

## Adding New Tests

### Step 1: Create Test File

Copy `TEMPLATE.ts` to a new file:

```bash
cp scripts/tests/v2/TEMPLATE.ts scripts/tests/v2/07-my-feature.ts
```

### Step 2: Implement Test

```typescript
// scripts/tests/v2/07-my-feature.ts
import { TestCase } from '../../framework/testing/types.js';
import { assertEqual } from '../../framework/testing/assertions.js';
import { logInfo, logSuccess } from '../../framework/testing/logging.js';

export const test_MyFeature: TestCase = {
	name: 'My Feature',
	description: 'Tests my new feature',
	
	async run(ctx) {
		logInfo('Testing my feature...');
		
		// Your test code
		const result = await ctx.connection.myFeature();
		assertEqual(result, expected);
		
		logSuccess('Feature works!');
	}
};
```

### Step 3: Export Test

Add to `index.ts`:

```typescript
export { test_MyFeature } from './07-my-feature.js';
```

### Step 4: Register in Main File

Add to `scripts/test-v2-real-integration.ts`:

```typescript
import {
	// ... existing tests
	test_MyFeature
} from './tests/v2/index.js';

// ...

suite.addTests(
	// ... existing tests
	test_MyFeature
);
```

### Step 5: Run Tests

```bash
tsx scripts/test-v2-real-integration.ts
```

## Test Context

All tests receive a `TestContext` with:

```typescript
interface TestContext {
	jwtToken: string;              // JWT token
	connection: WebSocketConnection; // WebSocket connection
	credentials: any;              // Credentials from credentials.json
	session: any;                  // Session from KV store
}
```

## Common Patterns

### Basic Symbol Fetch

```typescript
const data = await ctx.connection.fetchSymbol({
	symbol: 'NSE:RELIANCE',
	resolution: '1D',
	barsCount: 300
});

assertGreaterThan(data.bars.length, 0);
```

### Fetch with Indicators

```typescript
const data = await ctx.connection.fetchSymbol({
	symbol: 'NSE:NIFTY',
	resolution: '1D',
	barsCount: 300,
	indicators: [
		{ type: 'cvd', config: { anchorPeriod: '3M' } }
	]
});

if (data.indicators?.has('cvd')) {
	const cvd = data.indicators.get('cvd');
	assertGreaterThan(cvd.bars.length, 0);
}
```

### Concurrent Requests

```typescript
const [data1, data2] = await Promise.all([
	ctx.connection.fetchSymbol({ symbol: 'NSE:RELIANCE', resolution: '1D', barsCount: 100 }),
	ctx.connection.fetchSymbol({ symbol: 'NSE:TCS', resolution: '1D', barsCount: 100 })
]);

assertGreaterThan(data1.bars.length, 0);
assertGreaterThan(data2.bars.length, 0);
```

### Configure Timeouts

```typescript
ctx.connection.setRequestTimeout('create_study', 45000);

const data = await ctx.connection.fetchSymbol({
	symbol: 'NSE:NIFTY',
	resolution: '1D',
	barsCount: 300,
	indicators: [{ type: 'cvd' }]
});
```

### Check Connection Stats

```typescript
const stats = ctx.connection.getStats();

logInfo(`Requests: ${stats.requestCount}`);
logInfo(`Success: ${stats.successCount}`);
logInfo(`Errors: ${stats.errorCount}`);
logInfo(`Avg time: ${stats.avgResponseTime}ms`);
```

## Running Tests

### Run All Tests

```bash
tsx scripts/test-v2-real-integration.ts
```

### Run Specific Test

Currently not supported via CLI. To run a specific test, temporarily comment out other tests in the main file or set `skip: true` on tests you want to skip.

### Skip Tests

Set `skip: true` in the test definition:

```typescript
export const test_Experimental: TestCase = {
	name: 'Experimental',
	skip: true, // Skip this test
	async run(ctx) {
		// ...
	}
};
```

## Test Output

```
================================================================================
  SETUP: Authentication & Connection
================================================================================
ℹ️  Loaded app credentials: user@example.com
ℹ️  JWT token retrieved from KV
✅ Authentication setup complete
ℹ️  Created WebSocketConnection instance
ℹ️  Initializing connection...
✅ Connection initialized and ready
✅ Setup complete

================================================================================
  v2 WebSocket Integration Tests
================================================================================
ℹ️  Running 6 tests...

================================================================================
  Basic Connection
================================================================================
Verifies that WebSocketConnection can initialize and reach READY state
ℹ️  Verifying connection is ready...
✅ Connection state: READY
✅ Connection initialized successfully
✅ Test passed in 45ms

================================================================================
  Single Symbol Fetch
================================================================================
Fetch NSE:RELIANCE OHLCV data and validate structure
ℹ️  Fetching NSE:RELIANCE (1D, 300 bars)...
ℹ️  Received 305 bars
ℹ️  Timing: {"total":1234}
ℹ️  Last bar: Time=2025-12-24T00:00:00.000Z, Close=1234.56
✅ Validated 305 bars with correct structure
✅ Test passed in 1234ms

...

================================================================================
  TEST RESULTS SUMMARY
================================================================================

✅ Basic Connection - PASSED (45ms)
✅ Single Symbol Fetch - PASSED (1234ms)
✅ Symbol Switching (Sequential Fetch) - PASSED (2456ms)
✅ CVD with Configurable Timeout - PASSED (15678ms)
✅ Concurrent Requests - PASSED (3456ms)
✅ Connection Health - PASSED (10234ms)

================================================================================
  TEST STATISTICS
================================================================================
  Total:    6
  Passed:   6
  Failed:   0
  Skipped:  0
  Duration: 33.15s
================================================================================

🎉 ALL TESTS PASSED! 🎉
```

## Troubleshooting

### Test Fails with Timeout

1. Increase timeout in test definition: `timeout: 60000`
2. Check connection logs for hanging requests
3. Verify TradingView server is responsive

### Test Fails with Connection Error

1. Check credentials.json exists and is valid
2. Verify KV store has valid session: `tsx scripts/list-sessions.ts`
3. Check TradingView session not expired

### Test Fails with Assertion Error

Read the assertion error message carefully:

```
AssertionError: Expected 300 bars, got 250
  Expected: 300
  Actual: 250
```

Check if:
- TradingView returned less data than expected
- Symbol has limited historical data
- Resolution/barsCount combination is valid

## Best Practices

1. **Use descriptive names** - Test names should clearly describe what's being tested
2. **Add descriptions** - Help future developers understand test purpose
3. **Log progress** - Use logInfo/logSuccess to show test progress
4. **Meaningful assertions** - Include clear error messages
5. **Keep tests isolated** - Don't rely on side effects from other tests
6. **Set appropriate timeouts** - Quick tests = 5s, slow tests = 60s

## See Also

- [Test Framework Documentation](../../framework/testing/README.md)
- [Test Template](./TEMPLATE.ts)
- [Main Test File](../../test-v2-real-integration.ts)
