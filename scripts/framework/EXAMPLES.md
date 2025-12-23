# CLI & Utilities Module Examples

## Overview
This document provides quick reference examples for the CLI and Utils modules.

## ArgParser Examples

### Basic Usage
```typescript
import { ArgParser } from './cli/index.js';

// Command: tsx script.ts myfile.txt --debug --port=3000
const parser = new ArgParser();

// Get positional arguments
const filename = parser.get(0);        // 'myfile.txt'
const missing = parser.get(1);         // undefined

// Get required arguments (throws if missing)
const file = parser.getRequired(0, 'filename'); // 'myfile.txt'

// Check flags
const debug = parser.hasFlag('--debug');      // true
const verbose = parser.hasFlag('--verbose');  // false

// Get flag values
const port = parser.getFlag('--port');        // '3000'
const config = parser.getFlag('--config');    // undefined
```

### Sample Args Test
```typescript
// Simulate: script.ts myfile.txt 123 --debug --port=3000 -v
const testArgs = ['myfile.txt', '123', '--debug', '--port=3000', '-v'];
const parser = new ArgParser(testArgs);

console.log(parser.get(0));              // 'myfile.txt'
console.log(parser.get(1));              // '123'
console.log(parser.hasFlag('--debug'));  // true
console.log(parser.hasFlag('-v'));       // true
console.log(parser.getFlag('--port'));   // '3000'
```

### Real-world Script Example
```typescript
#!/usr/bin/env tsx
import { ArgParser } from './framework/cli/index.js';

const parser = new ArgParser();

// Show usage if --help
if (parser.hasFlag('--help')) {
  ArgParser.printUsage(
    'my-script.ts',
    '<symbol> [options]',
    [
      '--wlid=<id>         Watchlist ID (required)',
      '--debug             Enable debug mode',
      '--retry=<n>         Number of retries (default: 3)',
    ]
  );
  process.exit(0);
}

// Get required arguments
const symbol = parser.getRequired(0, 'symbol');
const wlid = parser.getFlag('--wlid');

if (!wlid) {
  console.error('Error: --wlid is required');
  process.exit(1);
}

console.log(`Processing ${symbol} for watchlist ${wlid}`);
```

## Retry with Backoff Examples

### Basic Retry with Exponential Backoff
```typescript
import { retry } from './utils/index.js';

// Function that might fail intermittently
async function fetchData() {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

// Retry with exponential backoff
const data = await retry(fetchData, {
  maxRetries: 5,
  delay: 1000,      // Start with 1 second
  backoff: true,    // Delays: 1s, 2s, 4s, 8s, 16s
});
```

### Retry without Backoff (Constant Delay)
```typescript
import { retry } from './utils/index.js';

// Retry with constant delay
await retry(
  () => checkServiceHealth(),
  {
    maxRetries: 3,
    delay: 500,       // Always 500ms between retries
    backoff: false,
  }
);
```

### Real Example: API Call with Retry
```typescript
import { retry, sleep } from './utils/index.js';

async function addToWatchlist(symbol: string, wlid: string) {
  return retry(
    async () => {
      const response = await fetch(`/api/watchlist/${wlid}`, {
        method: 'POST',
        body: JSON.stringify({ symbol }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    {
      maxRetries: 3,
      delay: 1000,
      backoff: true,
    }
  );
}

// Use it
try {
  const result = await addToWatchlist('TCS.NS', '12345');
  console.log('Added:', result);
} catch (err) {
  console.error('Failed after retries:', err);
}
```

### Demonstrating Backoff Timing
```typescript
import { retry } from './utils/index.js';

let attempt = 0;
await retry(
  async () => {
    attempt++;
    console.log(`[${new Date().toISOString()}] Attempt ${attempt}`);
    
    if (attempt < 4) {
      throw new Error('Not ready yet');
    }
    
    return 'Success!';
  },
  {
    maxRetries: 5,
    delay: 200,      // 200ms base delay
    backoff: true,   // Actual delays: 200ms, 400ms, 800ms, 1600ms
  }
);

// Output:
// [2025-12-23T12:39:52.123Z] Attempt 1
// [2025-12-23T12:39:52.323Z] Attempt 2  (+200ms)
// [2025-12-23T12:39:52.723Z] Attempt 3  (+400ms)
// [2025-12-23T12:39:53.523Z] Attempt 4  (+800ms)
```

## Validators Examples

### Symbol Validation
```typescript
import { validateSymbol, validateWatchlistId } from './utils/index.js';

const result = validateSymbol('TCS.NS');
if (!result.valid) {
  console.error(result.error);
  process.exit(1);
}

console.log('Symbol is valid!');
```

### Watchlist ID Validation
```typescript
import { validateWatchlistId } from './utils/index.js';

const wlid = parser.getFlag('--wlid');
const validation = validateWatchlistId(wlid || '');

if (!validation.valid) {
  console.error(`Invalid watchlist ID: ${validation.error}`);
  process.exit(1);
}
```

### JWT Token Validation
```typescript
import { validateJWT } from './utils/index.js';

const token = process.env.JWT_TOKEN;
const result = validateJWT(token || '');

if (!result.valid) {
  console.error(`Invalid JWT: ${result.error}`);
  process.exit(1);
}
```

## Sleep Utility

```typescript
import { sleep } from './utils/index.js';

// Wait 1 second
await sleep(1000);

// Rate limiting example
for (const item of items) {
  await processItem(item);
  await sleep(100); // 100ms between each item
}
```

## Complete Example: CLI Script with Retry

```typescript
#!/usr/bin/env tsx
import { ArgParser, Validator } from './framework/cli/index.js';
import { retry, validateSymbol, sleep } from './framework/utils/index.js';

const parser = new ArgParser();

// Parse arguments
const symbol = parser.getRequired(0, 'symbol');
const wlid = parser.getFlag('--wlid');
const debug = parser.hasFlag('--debug');

// Validate inputs
Validator.validateRequired(wlid, 'wlid');

const symbolCheck = validateSymbol(symbol);
if (!symbolCheck.valid) {
  console.error(symbolCheck.error);
  process.exit(1);
}

// Make API call with retry
try {
  const result = await retry(
    async () => {
      if (debug) console.log(`Attempting to add ${symbol}...`);
      
      // Your API call here
      const response = await fetch(`/api/add`, {
        method: 'POST',
        body: JSON.stringify({ symbol, wlid }),
      });
      
      if (!response.ok) throw new Error('API call failed');
      return response.json();
    },
    {
      maxRetries: 3,
      delay: 1000,
      backoff: true,
    }
  );
  
  console.log('✅ Success:', result);
} catch (err) {
  console.error('❌ Failed after retries:', err);
  process.exit(1);
}
```

## Running the Test Suite

```bash
# Run comprehensive tests
tsx scripts/framework/test-cli-utils.ts

# Expected output:
# ✅ ArgParser tests
# ✅ Validator tests  
# ✅ Utils validators tests
# ✅ Sleep utility tests
# ✅ Retry with backoff tests
```
