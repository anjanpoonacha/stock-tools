# HTTP Clients Module

Reusable HTTP clients for MarketInOut (MIO) and TradingView (TV) APIs with automatic retry logic, session management, and response parsing.

## Overview

This module provides:
- **BaseHttpClient**: Abstract base class with retry logic and request handling
- **MIOHttpClient**: MarketInOut-specific client with HTML parsing utilities
- **TVHttpClient**: TradingView-specific client with auth helpers
- **Type-safe responses**: Strongly typed with success/error handling

## Key Features

### ✅ Constructor-Injected Authentication
- **NO hardcoded sessions** - all credentials passed via constructor
- Supports cookie-based authentication
- Integrates with KV store for session management

### ✅ Automatic Retry Logic
- Retries on transient failures (408, 429, 500-504)
- Exponential backoff strategy (1s → 2s → 4s)
- Configurable retry behavior
- Network error handling

### ✅ Response Parsing
- Detects response types (JSON, HTML, text, redirect)
- Extracts success/error messages from HTML
- Login page detection (session expiry)
- Redirect URL extraction

### ✅ Error Handling
- Strongly typed error responses
- Session expiry detection (`needsRefresh` flag)
- Clear error codes and messages
- Request duration tracking

## Installation

```typescript
import { MIOHttpClient, TVHttpClient } from './framework/http/index.js';
import type { HttpResponse } from './framework/http/index.js';
```

## Quick Start

### MIOHttpClient

```typescript
// Initialize with session credentials
const mioClient = new MIOHttpClient(
  'PHPSESSID',      // Session key
  'abc123xyz...'    // Session value
);

// Make a GET request
const response = await mioClient.request<string>(
  'https://www.marketinout.com/wl/watch_list.php?mode=list',
  { method: 'GET' }
);

if (response.success) {
  console.log('Data:', response.data);
  console.log('Duration:', response.meta.duration, 'ms');
} else {
  console.error('Error:', response.error?.message);
  if (response.error?.needsRefresh) {
    // Session expired - refresh needed
  }
}

// Parse HTML responses
if (typeof response.data === 'string') {
  const isLogin = mioClient.isLoginPage(response.data);
  const successMsg = mioClient.extractSuccessMessage(response.data);
  const errorMsg = mioClient.extractErrorMessage(response.data);
  const redirectUrl = mioClient.extractRedirectUrl(response.data);
  const wlid = mioClient.extractWatchlistId(response.data);
}
```

### TVHttpClient

```typescript
// Initialize with session credentials
const tvClient = new TVHttpClient(
  'sessionid_value',      // Required
  'sessionid_sign_value'  // Optional
);

// Get user ID
const userResponse = await tvClient.getUserId();
if (userResponse.success && userResponse.data) {
  console.log('User ID:', userResponse.data.userId);
  console.log('Username:', userResponse.data.username);
}

// Get JWT token for WebSocket
const tokenResponse = await tvClient.getJWTToken(
  userId,
  'chart_id_abc123'
);
if (tokenResponse.success && tokenResponse.data) {
  console.log('JWT Token:', tokenResponse.data);
}

// Make custom requests
const customResponse = await tvClient.request<any>(
  'https://www.tradingview.com/api/v1/some-endpoint',
  { method: 'GET' }
);
```

## API Reference

### Types

#### HttpResponse<T>
```typescript
interface HttpResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    needsRefresh?: boolean;  // Session expired/invalid
  };
  meta: {
    statusCode: number;
    responseType: 'json' | 'html' | 'text' | 'redirect';
    url: string;
    duration: number;  // Request duration in ms
  };
}
```

#### RequestOptions
```typescript
interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: URLSearchParams | string | Record<string, any>;
  timeout?: number;
  followRedirects?: boolean;
}
```

#### RetryConfig
```typescript
interface RetryConfig {
  maxRetries: number;      // Default: 3
  retryDelay: number;      // Default: 1000ms
  retryOn: number[];       // Default: [408, 429, 500, 502, 503, 504]
}
```

### BaseHttpClient (Abstract)

#### `request<T>(url: string, options: RequestOptions): Promise<HttpResponse<T>>`
Make HTTP request with automatic retry logic.

#### `protected abstract buildHeaders(options: RequestOptions): Record<string, string>`
Subclasses implement to provide authentication headers.

### MIOHttpClient extends BaseHttpClient

#### Constructor
```typescript
new MIOHttpClient(sessionKey: string, sessionValue: string)
```

#### Methods
- `request<T>(url, options)` - Make authenticated request
- `isLoginPage(html: string): boolean` - Check if session expired
- `extractSuccessMessage(html: string): string | null` - Extract success message
- `extractErrorMessage(html: string): string | null` - Extract error message
- `extractRedirectUrl(html: string): string | null` - Extract redirect URL
- `extractWatchlistId(text: string): string | null` - Extract watchlist ID

### TVHttpClient extends BaseHttpClient

#### Constructor
```typescript
new TVHttpClient(sessionId: string, sessionIdSign?: string)
```

#### Methods
- `request<T>(url, options)` - Make authenticated request
- `getUserId(): Promise<HttpResponse<TVUserInfo>>` - Get user ID and username
- `getJWTToken(userId: number, chartId: string): Promise<HttpResponse<string>>` - Get JWT token

## Retry Logic

### Configuration
- **Max Retries**: 3 attempts
- **Base Delay**: 1000ms
- **Strategy**: Exponential backoff

### Retry Timeline
```
Attempt 1: Initial request
  ↓ (fails)
Wait 1000ms
  ↓
Attempt 2: Retry
  ↓ (fails)
Wait 2000ms
  ↓
Attempt 3: Final retry
  ↓ (fails)
Total time: ~7 seconds
```

### Retriable Status Codes
- `408` - Request Timeout
- `429` - Too Many Requests
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable
- `504` - Gateway Timeout

### Non-Retriable Errors
- `400` - Bad Request (client error)
- `401` - Unauthorized (session invalid)
- `403` - Forbidden (no permission)
- `404` - Not Found (wrong URL)

## Examples

See the example files:
- `example-mio-client.ts` - MIOHttpClient usage
- `example-tv-client.ts` - TVHttpClient usage
- `example-retry-logic.ts` - Retry logic demonstration

Run examples:
```bash
tsx scripts/framework/http/example-mio-client.ts
tsx scripts/framework/http/example-tv-client.ts
tsx scripts/framework/http/example-retry-logic.ts
```

## Integration with KV Store

```typescript
import { getFromKV } from '../session/KVAdapter.js';

// Fetch MIO session from KV
const mioSession = await getFromKV('MIO_SESSION');
const mioClient = new MIOHttpClient(
  mioSession.key,
  mioSession.value
);

// Fetch TV session from KV
const tvSession = await getFromKV('TV_SESSION');
const tvClient = new TVHttpClient(
  tvSession.sessionid,
  tvSession.sessionid_sign
);
```

## Best Practices

### 1. Always Check Success
```typescript
const response = await client.request(...);
if (!response.success) {
  console.error(response.error?.message);
  return;
}
// Use response.data safely
```

### 2. Handle Session Expiry
```typescript
if (response.error?.needsRefresh) {
  // Refresh session from KV store
  await refreshSession();
}
```

### 3. Use Type Parameters
```typescript
interface Watchlist {
  id: string;
  name: string;
}

const response = await client.request<Watchlist[]>(...);
if (response.success && response.data) {
  response.data.forEach(wl => {
    console.log(wl.id, wl.name);  // Type-safe
  });
}
```

### 4. Monitor Request Duration
```typescript
const response = await client.request(...);
console.log(`Request took ${response.meta.duration}ms`);

if (response.meta.duration > 5000) {
  console.warn('Slow request detected');
}
```

## Testing

Run the test suite:
```bash
tsx scripts/framework/http/test-http-module.ts
```

Expected output:
```
✅ 1. Imports successful
✅ 2. No hardcoded sessions
✅ 3. Retry logic implemented
✅ 4. MIOHttpClient instantiated successfully
✅ 5. TVHttpClient instantiated successfully
✅ 6. Type exports work correctly
```

## Architecture

```
scripts/framework/http/
├── types.ts              # Type definitions
├── BaseHttpClient.ts     # Abstract base with retry logic
├── MIOHttpClient.ts      # MarketInOut implementation
├── TVHttpClient.ts       # TradingView implementation
├── index.ts              # Barrel exports
├── test-http-module.ts   # Test suite
├── example-mio-client.ts # MIO examples
├── example-tv-client.ts  # TV examples
├── example-retry-logic.ts # Retry examples
└── README.md             # This file
```

## Extracted from POC

This module was refactored from:
- `scripts/poc-mio/poc-mio-watchlist-client.ts` (lines 152-452)

Key patterns extracted:
- Cookie-based authentication
- Response type detection
- HTML parsing utilities
- Login page detection
- Success/error message extraction
- Redirect URL handling

## Line Counts

```
types.ts:           35 lines
BaseHttpClient.ts:  206 lines
MIOHttpClient.ts:   114 lines
TVHttpClient.ts:    147 lines
index.ts:           16 lines
─────────────────────────────
Total:              518 lines
```

## Security Notes

- ✅ **NO hardcoded credentials** - All auth via constructor
- ✅ Session values passed from KV store or environment
- ✅ Credentials not logged or exposed
- ✅ Supports secure cookie-based authentication

## Future Enhancements

- [ ] Customizable retry configuration per request
- [ ] Request caching support
- [ ] Rate limiting support
- [ ] Request queue management
- [ ] Metrics and monitoring hooks
