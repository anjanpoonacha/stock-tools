#!/usr/bin/env tsx
/**
 * Test CLI and Utils modules
 * Demonstrates ArgParser, validators, retry, and sleep functionality
 */

import { ArgParser, Validator } from './cli/index.js';
import { sleep, retry, validateSymbol, validateWatchlistId, validateJWT } from './utils/index.js';

console.log('='.repeat(60));
console.log('TEST: CLI & UTILS MODULE');
console.log('='.repeat(60));

// ============================================================================
// TEST 1: ArgParser with sample arguments
// ============================================================================
console.log('\n📋 TEST 1: ArgParser with sample arguments');
console.log('-'.repeat(60));

// Simulate command: script.ts myfile.txt 123 --debug --port=3000 -v
const testArgs = ['myfile.txt', '123', '--debug', '--port=3000', '-v'];
const parser = new ArgParser(testArgs);

console.log('Input args:', testArgs);
console.log('\nPositional arguments:');
console.log('  get(0):', parser.get(0)); // 'myfile.txt'
console.log('  get(1):', parser.get(1)); // '123'
console.log('  get(2):', parser.get(2)); // undefined

console.log('\nFlags:');
console.log('  hasFlag("--debug"):', parser.hasFlag('--debug')); // true
console.log('  hasFlag("-v"):', parser.hasFlag('-v')); // true
console.log('  hasFlag("--verbose"):', parser.hasFlag('--verbose')); // false

console.log('\nFlag values:');
console.log('  getFlag("--port"):', parser.getFlag('--port')); // '3000'
console.log('  getFlag("--missing"):', parser.getFlag('--missing')); // undefined

// Test required argument
try {
  const filename = parser.getRequired(0, 'filename');
  console.log('\n✅ Required arg "filename":', filename);
} catch (err) {
  console.log('❌ Error:', (err as Error).message);
}

// Test missing required argument
try {
  const missing = parser.getRequired(5, 'missing-arg');
  console.log('✅ Got:', missing);
} catch (err) {
  console.log('✅ Expected error for missing arg:', (err as Error).message);
}

// ============================================================================
// TEST 2: Validator
// ============================================================================
console.log('\n\n📋 TEST 2: Validator');
console.log('-'.repeat(60));

// Test email validation
const emails = ['test@example.com', 'invalid-email', 'user@domain.co.uk'];
console.log('Email validation:');
emails.forEach((email) => {
  const isValid = Validator.validateEmail(email);
  console.log(`  ${email}: ${isValid ? '✅' : '❌'}`);
});

// Test number validation
console.log('\nNumber validation:');
try {
  const num1 = Validator.validateNumber('42', 'count');
  console.log(`  "42" → ${num1} ✅`);
  
  const num2 = Validator.validateNumber('abc', 'invalid');
  console.log(`  "abc" → ${num2} ✅`);
} catch (err) {
  console.log(`  "abc" → ❌ ${(err as Error).message}`);
}

// Test positive validation
console.log('\nPositive number validation:');
try {
  Validator.validatePositive(10, 'count');
  console.log('  10 > 0 ✅');
} catch (err) {
  console.log(`  ❌ ${(err as Error).message}`);
}

try {
  Validator.validatePositive(-5, 'count');
  console.log('  -5 > 0 ✅');
} catch (err) {
  console.log(`  -5 > 0 → ❌ ${(err as Error).message}`);
}

// ============================================================================
// TEST 3: Utils validators (from POCs)
// ============================================================================
console.log('\n\n📋 TEST 3: Utils validators (from POCs)');
console.log('-'.repeat(60));

// Test symbol validation
const symbols = ['TCS.NS', 'INFY', 'invalid symbol', 'RELIANCE.BSE'];
console.log('Symbol validation:');
symbols.forEach((symbol) => {
  const result = validateSymbol(symbol);
  if (result.valid) {
    console.log(`  ${symbol}: ✅`);
  } else {
    console.log(`  ${symbol}: ❌ ${result.error}`);
  }
});

// Test watchlist ID validation
const wlids = ['12345', 'abc123', '', '67890'];
console.log('\nWatchlist ID validation:');
wlids.forEach((wlid) => {
  const result = validateWatchlistId(wlid);
  if (result.valid) {
    console.log(`  "${wlid}": ✅`);
  } else {
    console.log(`  "${wlid}": ❌ ${result.error}`);
  }
});

// Test JWT validation
const tokens = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
  'invalid.token',
  '',
];
console.log('\nJWT token validation:');
tokens.forEach((token, i) => {
  const result = validateJWT(token);
  const display = token.length > 40 ? token.slice(0, 40) + '...' : token;
  if (result.valid) {
    console.log(`  Token ${i + 1}: ✅`);
  } else {
    console.log(`  Token ${i + 1} ("${display}"): ❌ ${result.error}`);
  }
});

// ============================================================================
// TEST 4: Sleep utility
// ============================================================================
console.log('\n\n📋 TEST 4: Sleep utility');
console.log('-'.repeat(60));

async function testSleep() {
  console.log('Starting sleep test...');
  const delays = [100, 200, 300];
  
  for (const ms of delays) {
    const start = Date.now();
    await sleep(ms);
    const elapsed = Date.now() - start;
    console.log(`  Slept for ${ms}ms (actual: ${elapsed}ms) ✅`);
  }
}

// ============================================================================
// TEST 5: Retry with exponential backoff
// ============================================================================
console.log('\n\n📋 TEST 5: Retry with exponential backoff');
console.log('-'.repeat(60));

async function testRetry() {
  // Test 1: Function that succeeds on 3rd attempt
  let attempt = 0;
  const flakeyFunction = async () => {
    attempt++;
    console.log(`  Attempt ${attempt}...`);
    if (attempt < 3) {
      throw new Error('Temporary failure');
    }
    return 'Success!';
  };

  console.log('Test 1: Retry with backoff (succeeds on 3rd attempt)');
  try {
    const result = await retry(flakeyFunction, {
      maxRetries: 5,
      delay: 100,
      backoff: true,
    });
    console.log(`  ✅ Result: ${result}`);
  } catch (err) {
    console.log(`  ❌ Failed: ${(err as Error).message}`);
  }

  // Test 2: Function that always fails
  console.log('\nTest 2: Retry without backoff (always fails)');
  let failAttempt = 0;
  const alwaysFailsFunction = async () => {
    failAttempt++;
    console.log(`  Attempt ${failAttempt}...`);
    throw new Error('Permanent failure');
  };

  try {
    await retry(alwaysFailsFunction, {
      maxRetries: 3,
      delay: 50,
      backoff: false,
    });
    console.log('  ✅ Success');
  } catch (err) {
    console.log(`  ✅ Expected failure: ${(err as Error).message}`);
  }

  // Test 3: Demonstrate backoff timing
  console.log('\nTest 3: Backoff timing demonstration');
  let timingAttempt = 0;
  const timingFunction = async () => {
    timingAttempt++;
    const now = new Date().toLocaleTimeString();
    console.log(`  [${now}] Attempt ${timingAttempt}`);
    if (timingAttempt < 4) {
      throw new Error('Retry needed');
    }
    return 'Done';
  };

  try {
    await retry(timingFunction, {
      maxRetries: 5,
      delay: 200,
      backoff: true, // 200ms, 400ms, 800ms, ...
    });
    console.log('  ✅ Completed with exponential backoff (200ms → 400ms → 800ms)');
  } catch (err) {
    console.log(`  ❌ Failed: ${(err as Error).message}`);
  }
}

// ============================================================================
// TEST 6: Usage help example
// ============================================================================
console.log('\n\n📋 TEST 6: Usage help example');
console.log('-'.repeat(60));

ArgParser.printUsage(
  'my-script.ts',
  '<file> [options]',
  [
    '--debug, -d          Enable debug mode',
    '--port=<number>      Port number (default: 3000)',
    '--config=<file>      Configuration file path',
    '--help, -h           Show this help message',
  ]
);

// ============================================================================
// RUN ALL ASYNC TESTS
// ============================================================================
(async () => {
  await testSleep();
  await testRetry();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL TESTS COMPLETED');
  console.log('='.repeat(60));
})();
