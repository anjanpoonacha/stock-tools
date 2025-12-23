#!/usr/bin/env tsx
/**
 * Example: Retry Logic Demonstration
 * 
 * Shows how the HTTP clients handle retries automatically
 */

import { MIOHttpClient, TVHttpClient } from './index.js';

console.log('📘 HTTP Client Retry Logic Examples\n');

// ============================================================================
// Example 1: Understanding Retry Configuration
// ============================================================================

console.log('Example 1: Default Retry Configuration');
console.log('─'.repeat(50));
console.log('Both MIOHttpClient and TVHttpClient inherit from BaseHttpClient');
console.log('with the following default retry configuration:\n');

console.log('RetryConfig:');
console.log('  maxRetries: 3');
console.log('  retryDelay: 1000ms (base delay)');
console.log('  retryOn: [408, 429, 500, 502, 503, 504]');
console.log();

console.log('HTTP Status Codes that trigger retry:');
console.log('  408 - Request Timeout');
console.log('  429 - Too Many Requests');
console.log('  500 - Internal Server Error');
console.log('  502 - Bad Gateway');
console.log('  503 - Service Unavailable');
console.log('  504 - Gateway Timeout');
console.log();

// ============================================================================
// Example 2: Exponential Backoff Strategy
// ============================================================================

console.log('Example 2: Exponential Backoff');
console.log('─'.repeat(50));
console.log('The retry delay increases exponentially:');
console.log();

const baseDelay = 1000;
for (let attempt = 1; attempt <= 3; attempt++) {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  console.log(`  Attempt ${attempt}: wait ${delay}ms before retry`);
}
console.log();
console.log('Total time before giving up: ~7 seconds');
console.log('(1000ms + 2000ms + 4000ms)');
console.log();

// ============================================================================
// Example 3: Retry Flow Visualization
// ============================================================================

console.log('Example 3: Retry Flow');
console.log('─'.repeat(50));
console.log('What happens when a request fails:\n');

console.log('┌─────────────────────────────────────────────┐');
console.log('│ 1. Initial request sent                     │');
console.log('└─────────────────────────────────────────────┘');
console.log('              ↓');
console.log('┌─────────────────────────────────────────────┐');
console.log('│ 2. Response received (e.g., 503)            │');
console.log('└─────────────────────────────────────────────┘');
console.log('              ↓');
console.log('┌─────────────────────────────────────────────┐');
console.log('│ 3. Check if status code is in retryOn list │');
console.log('└─────────────────────────────────────────────┘');
console.log('              ↓');
console.log('┌─────────────────────────────────────────────┐');
console.log('│ 4. Wait with exponential backoff (1s)       │');
console.log('└─────────────────────────────────────────────┘');
console.log('              ↓');
console.log('┌─────────────────────────────────────────────┐');
console.log('│ 5. Retry request (attempt 2)                │');
console.log('└─────────────────────────────────────────────┘');
console.log('              ↓');
console.log('┌─────────────────────────────────────────────┐');
console.log('│ 6. If still fails, wait 2s and retry again  │');
console.log('└─────────────────────────────────────────────┘');
console.log('              ↓');
console.log('┌─────────────────────────────────────────────┐');
console.log('│ 7. If still fails, wait 4s and final retry  │');
console.log('└─────────────────────────────────────────────┘');
console.log('              ↓');
console.log('┌─────────────────────────────────────────────┐');
console.log('│ 8. If still fails, return error response    │');
console.log('└─────────────────────────────────────────────┘');
console.log();

// ============================================================================
// Example 4: Network Error Retry
// ============================================================================

console.log('Example 4: Network Error Handling');
console.log('─'.repeat(50));
console.log('Network errors also trigger retry logic:\n');
console.log('Scenarios:');
console.log('  • DNS resolution failures');
console.log('  • Connection timeouts');
console.log('  • Socket errors');
console.log('  • Request aborted (timeout)');
console.log();
console.log('The client will retry up to 3 times before giving up.');
console.log();

// ============================================================================
// Example 5: Practical Example with MIO Client
// ============================================================================

console.log('Example 5: Retry in Action (MIOHttpClient)');
console.log('─'.repeat(50));

// Create client for demonstration
new MIOHttpClient('test_key', 'test_value');

console.log('Simulating a request that might fail temporarily:\n');
console.log('Code:');
console.log('  const response = await mioClient.request(');
console.log('    "https://www.marketinout.com/wl/watch_list.php",');
console.log('    { method: "GET" }');
console.log('  );');
console.log();
console.log('If the server returns 503 (Service Unavailable):');
console.log('  [Request] GET https://www.marketinout.com/wl/watch_list.php');
console.log('  [Response] 503 Service Unavailable');
console.log('  ⏳ Retrying in 1000ms (attempt 2/3)...');
console.log('  [Request] GET https://www.marketinout.com/wl/watch_list.php');
console.log('  [Response] 200 OK ✅');
console.log();
console.log('The retry was successful on the second attempt!');
console.log();

// ============================================================================
// Example 6: Practical Example with TV Client
// ============================================================================

console.log('Example 6: Retry in Action (TVHttpClient)');
console.log('─'.repeat(50));

// Create client for demonstration
new TVHttpClient('test_session');

console.log('Getting user ID with automatic retry:\n');
console.log('Code:');
console.log('  const userResponse = await tvClient.getUserId();');
console.log();
console.log('If TradingView API is temporarily unavailable:');
console.log('  [Request] GET https://www.tradingview.com/api/v1/user/');
console.log('  [Response] 502 Bad Gateway');
console.log('  ⏳ Retrying in 1000ms (attempt 2/3)...');
console.log('  [Request] GET https://www.tradingview.com/api/v1/user/');
console.log('  [Response] 502 Bad Gateway');
console.log('  ⏳ Retrying in 2000ms (attempt 3/3)...');
console.log('  [Request] GET https://www.tradingview.com/api/v1/user/');
console.log('  [Response] 200 OK ✅');
console.log();
console.log('The retry was successful on the third attempt!');
console.log();

// ============================================================================
// Example 7: When Retry Gives Up
// ============================================================================

console.log('Example 7: Exhausting All Retries');
console.log('─'.repeat(50));
console.log('If all retries fail, you get a clear error response:\n');

console.log('Response structure:');
console.log('  {');
console.log('    success: false,');
console.log('    error: {');
console.log('      code: "HTTP_503",');
console.log('      message: "HTTP 503: Service Unavailable",');
console.log('      needsRefresh: false');
console.log('    },');
console.log('    meta: {');
console.log('      statusCode: 503,');
console.log('      responseType: "text",');
console.log('      url: "https://...",');
console.log('      duration: 7500  // Total time including retries');
console.log('    }');
console.log('  }');
console.log();

// ============================================================================
// Example 8: Non-Retriable Errors
// ============================================================================

console.log('Example 8: Non-Retriable Errors');
console.log('─'.repeat(50));
console.log('Some errors are NOT retried:\n');

console.log('HTTP Status Codes that do NOT trigger retry:');
console.log('  400 - Bad Request (client error)');
console.log('  401 - Unauthorized (session expired)');
console.log('  403 - Forbidden (no permission)');
console.log('  404 - Not Found (wrong URL)');
console.log('  422 - Unprocessable Entity (validation error)');
console.log();
console.log('These errors indicate client-side issues that');
console.log('retrying will not fix, so they fail immediately.');
console.log();

// ============================================================================
// Summary
// ============================================================================

console.log('📋 Summary');
console.log('─'.repeat(50));
console.log('Benefits of Automatic Retry:');
console.log('  ✅ Resilient to temporary network issues');
console.log('  ✅ Handles server overload gracefully');
console.log('  ✅ No manual retry logic needed in your code');
console.log('  ✅ Exponential backoff prevents overwhelming servers');
console.log('  ✅ Transparent - works automatically for all requests');
console.log();
console.log('Best Practices:');
console.log('  • Let the client handle retries automatically');
console.log('  • Check response.success before using data');
console.log('  • Handle response.error?.needsRefresh for auth issues');
console.log('  • Use response.meta.duration to track total time');
console.log();
