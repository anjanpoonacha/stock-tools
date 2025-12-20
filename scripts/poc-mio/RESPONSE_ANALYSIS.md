# MIO API Response Structure Analysis & Design Recommendations

**Date:** 2025-12-20  
**Based on:** Real production API responses from marketinout.com  
**Purpose:** Design centralized validation, parsing, and error handling

---

## Executive Summary

**Key Finding:** MIO API uses a **consistent 302 redirect pattern** for state-changing operations, with success/error messages embedded in redirect target pages.

**Response Breakdown:**
- **5 out of 6** operations return `HTTP 302` redirects
- **1 out of 6** returns full HTML (watchlist list)
- **0** operations return JSON
- **All** operations use cookies for authentication

---

## 📊 Response Patterns by Endpoint

### 1. GET Watchlist List

**Endpoint:** `GET /wl/watch_list.php?mode=list`

**Response Structure:**
```
HTTP 200 OK
Content-Type: text/html

<html>
  <select id="sel_wlid" class="name-select">
    <option value="74562">AnalysedAlready</option>
    <option value="52736">IndexWatchlist</option>
    ...
  </select>
</html>
```

**Parsing Strategy:**
```typescript
// Extract watchlists using cheerio
const $ = cheerio.load(html);
const watchlists: Watchlist[] = [];

$('#sel_wlid option').each((_, element) => {
  const id = $(element).attr('value')?.trim();
  const name = $(element).text().trim();
  if (id && name && /^\d+$/.test(id)) {
    watchlists.push({ id, name });
  }
});
```

**Success Validation:**
- ✅ Response contains `<select id="sel_wlid">`
- ✅ At least one `<option>` element exists
- ✅ Option values are numeric IDs

**Error Detection:**
- ❌ Response contains login indicators (login, signin, password)
- ❌ Missing `sel_wlid` element
- ❌ HTTP status != 200

---

### 2. Create Watchlist

**Endpoint:** `GET /wl/my_watch_lists.php?mode=new&name={name}&wlid=`

**Response Structure:**
```
HTTP 302 Object moved
Location: watch_list.php?wlid=75859

<head><title>Object moved</title></head>
<body>
  <h1>Object Moved</h1>
  This object may be found <a HREF="watch_list.php?wlid=75859">here</a>.
</body>
```

**Parsing Strategy:**
```typescript
// Extract watchlist ID from redirect URL
const extractWatchlistId = (html: string): string | null => {
  const match = html.match(/wlid=(\d+)/);
  return match ? match[1] : null;
};

// Usage
if (response.status === 302) {
  const wlid = extractWatchlistId(html);
  return { created: true, wlid };
}
```

**Success Validation:**
- ✅ HTTP 302 status
- ✅ Redirect URL contains `wlid=<numeric>`
- ✅ Body contains `<a HREF="watch_list.php?wlid=..."`

**Error Detection:**
- ❌ HTTP 200 with login page
- ❌ HTTP 40x/50x errors
- ❌ No wlid in redirect URL

**Important:** Need to extract wlid from HTML body, not headers (Location header may not be accessible)

---

### 3. Add Stocks (Bulk POST)

**Endpoint:** `POST /wl/watch_list.php`  
**Body:** `mode=add&wlid={id}&overwrite=0&name=&stock_list={symbols}`

**Response Structure:**
```
HTTP 302 Object moved
Location: watch_list.php?wlid=75859

<head><title>Object moved</title></head>
<body>
  <h1>Object Moved</h1>
  This object may be found <a HREF="watch_list.php?wlid=75859">here</a>.
</body>
```

**Parsing Strategy:**
```typescript
// 302 redirect = success
if (response.status === 302) {
  return { success: true, message: 'Stocks added' };
}

// Need to follow redirect to get actual success/error message
// (Or accept 302 as success indicator)
```

**Success Validation:**
- ✅ HTTP 302 status
- ✅ Redirect to `watch_list.php?wlid={id}`

**Error Detection:**
- ❌ HTTP 200 with error message
- ❌ Redirect to login page
- ❌ HTTP 40x/50x errors

**Design Decision:** Accept 302 as success without following redirect (performance)

---

### 4. Add Single Stock (NEW)

**Endpoint:** `GET /wl/wl_add_all.php?action=add&wlid={id}&wl_name=&symbol={symbol}`

**Response Structure:**
```
HTTP 302 Object moved
Location: wl_add_all_done.php?action=add&symbol=WIPRO.NS

<head><title>Object moved</title></head>
<body>
  <h1>Object Moved</h1>
  This object may be found 
  <a HREF="wl_add_all_done.php?action=add&amp;symbol=WIPRO.NS">here</a>.
</body>
```

**Parsing Strategy:**
```typescript
// Extract action and symbol from redirect
const parseAddAllRedirect = (html: string): {
  action: 'add' | 'remove';
  symbol: string;
} => {
  const actionMatch = html.match(/action=(add|remove)/);
  const symbolMatch = html.match(/symbol=([^"&]+)/);
  
  return {
    action: actionMatch?.[1] as 'add' | 'remove',
    symbol: symbolMatch?.[1] || '',
  };
};
```

**Success Validation:**
- ✅ HTTP 302 status
- ✅ Redirect to `wl_add_all_done.php`
- ✅ URL contains `action=add` and `symbol={symbol}`

**Error Detection:**
- ❌ HTTP 200 with error message
- ❌ No redirect to wl_add_all_done.php
- ❌ Missing symbol in redirect URL

**Note:** This endpoint is **faster** than bulk POST for single stock operations

---

### 5. Remove Single Stock (NEW)

**Endpoint:** `GET /wl/wl_add_all.php?action=remove&wlid={id}&wl_name=&symbol={symbol}`

**Response Structure:**
```
HTTP 302 Object moved
Location: wl_add_all_done.php?action=remove&symbol=INFY.NS

<head><title>Object moved</title></head>
<body>
  <h1>Object Moved</h1>
  This object may be found 
  <a HREF="wl_add_all_done.php?action=remove&amp;symbol=INFY.NS">here</a>.
</body>
```

**Parsing Strategy:**
```typescript
// Same as Add Single Stock, but action=remove
if (response.status === 302 && 
    html.includes('wl_add_all_done.php') && 
    html.includes('action=remove')) {
  const symbol = extractSymbolFromUrl(html);
  return { deleted: true, symbol };
}
```

**Success Validation:**
- ✅ HTTP 302 status
- ✅ Redirect to `wl_add_all_done.php`
- ✅ URL contains `action=remove` and `symbol={symbol}`

**Error Detection:**
- ❌ HTTP 200 with error message
- ❌ Symbol not found error (need to follow redirect)
- ❌ Invalid wlid or symbol

---

### 6. Delete Watchlist

**Endpoint:** `GET /wl/my_watch_lists.php?todelete={id}&mode=delete`

**Response Structure:**
```
HTTP 302 Object moved
Location: my_watch_lists.php

<head><title>Object moved</title></head>
<body>
  <h1>Object Moved</h1>
  This object may be found <a HREF="my_watch_lists.php">here</a>.
</body>
```

**Parsing Strategy:**
```typescript
// Simple: 302 redirect = success
if (response.status === 302 && html.includes('my_watch_lists.php')) {
  return { deleted: true };
}
```

**Success Validation:**
- ✅ HTTP 302 status
- ✅ Redirect to `my_watch_lists.php`

**Error Detection:**
- ❌ HTTP 200 with error message
- ❌ HTTP 40x/50x errors
- ❌ Invalid watchlist ID

---

## 🎯 Centralized Response Structure Design

Based on the analysis, here's the recommended response structure:

### TypeScript Type Definitions

```typescript
/**
 * Standardized MIO API Response
 */
type MIOResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: MIOError;
  meta: ResponseMeta;
};

type MIOError = {
  code: ErrorCode;
  message: string;
  needsRefresh?: boolean;  // Session expired
  details?: string;
};

type ErrorCode =
  | 'SESSION_EXPIRED'     // Login required
  | 'INVALID_INPUT'       // Validation failed
  | 'NOT_FOUND'           // Resource not found
  | 'NETWORK_ERROR'       // Fetch failed
  | 'PARSE_ERROR'         // Response parsing failed
  | 'HTTP_ERROR'          // HTTP 4xx/5xx
  | 'UNKNOWN_ERROR';      // Unexpected error

type ResponseMeta = {
  statusCode: number;
  responseType: 'html' | 'redirect' | 'json' | 'text';
  url: string;
  rawResponse?: string;   // For debugging
  redirectUrl?: string;   // Extracted from 302 responses
};
```

### Endpoint-Specific Response Types

```typescript
// 1. Get Watchlists
type GetWatchlistsResponse = {
  watchlists: Watchlist[];
};

type Watchlist = {
  id: string;
  name: string;
};

// 2. Create Watchlist
type CreateWatchlistResponse = {
  created: boolean;
  wlid: string;
  name: string;
};

// 3. Add Stocks (Bulk)
type AddStocksBulkResponse = {
  added: boolean;
  wlid: string;
  symbols: string[];
  count: number;
};

// 4. Add/Remove Single Stock
type SingleStockResponse = {
  success: boolean;
  action: 'add' | 'remove';
  wlid: string;
  symbol: string;
};

// 5. Delete Watchlist
type DeleteWatchlistResponse = {
  deleted: boolean;
  wlids: string[];
};
```

---

## 🔍 Validation Rules

### Request Validation (Pre-API call)

```typescript
class RequestValidator {
  // Watchlist ID: Must be numeric, non-empty
  static validateWatchlistId(wlid: string): ValidationResult {
    if (!wlid || wlid.trim() === '') {
      return { valid: false, error: 'Watchlist ID required' };
    }
    if (!/^\d+$/.test(wlid)) {
      return { valid: false, error: 'Watchlist ID must be numeric' };
    }
    return { valid: true };
  }

  // Symbol: Must match pattern (e.g., TCS.NS, INFY.NS)
  static validateSymbol(symbol: string): ValidationResult {
    if (!symbol || symbol.trim() === '') {
      return { valid: false, error: 'Symbol required' };
    }
    // Allow: SYMBOL.EXCHANGE or just SYMBOL
    if (!/^[A-Z0-9]+(\.[A-Z]+)?$/i.test(symbol)) {
      return { valid: false, error: 'Invalid symbol format' };
    }
    return { valid: true };
  }

  // Watchlist Name: Non-empty, max length
  static validateWatchlistName(name: string): ValidationResult {
    if (!name || name.trim() === '') {
      return { valid: false, error: 'Watchlist name required' };
    }
    if (name.length > 100) {
      return { valid: false, error: 'Name too long (max 100 chars)' };
    }
    return { valid: true };
  }
}
```

### Response Validation (Post-API call)

```typescript
class ResponseValidator {
  // Check for session expiry
  static isSessionExpired(html: string): boolean {
    const LOGIN_INDICATORS = ['login', 'signin', 'password', 'Sign In'];
    return LOGIN_INDICATORS.some(indicator => 
      html.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  // Check for successful redirect
  static isSuccessRedirect(statusCode: number, html: string): boolean {
    return statusCode === 302 && html.includes('Object moved');
  }

  // Extract redirect URL
  static extractRedirectUrl(html: string): string | null {
    const match = html.match(/<a\s+HREF="([^"]+)">(?:here|click here)/i);
    return match ? match[1] : null;
  }

  // Validate watchlist list response
  static validateWatchlistResponse(html: string): ValidationResult {
    if (!html.includes('sel_wlid')) {
      return { 
        valid: false, 
        error: 'Missing watchlist selector element' 
      };
    }
    if (this.isSessionExpired(html)) {
      return { 
        valid: false, 
        error: 'Session expired',
        needsRefresh: true
      };
    }
    return { valid: true };
  }
}
```

---

## 🏗️ Recommended Code Structure

### File Organization

```
src/lib/mio/
├── types.ts                    # Type definitions
├── response-types.ts           # MIOResponse<T> types (NEW)
├── request-validator.ts        # Pre-request validation (NEW)
├── response-parser.ts          # HTML parsing utilities (NEW)
├── response-validator.ts       # Post-response validation (NEW)
├── http-client.ts             # Centralized fetch wrapper (NEW)
├── apiClient.ts               # API methods (REFACTOR)
├── sessionManager.ts          # Session handling (EXISTING)
└── MIOService.ts              # Public facade (EXISTING)
```

### Response Parser Implementation

```typescript
// response-parser.ts
export class ResponseParser {
  /**
   * Parse watchlist list HTML
   */
  static parseWatchlistList(html: string): Watchlist[] {
    const $ = cheerio.load(html);
    const watchlists: Watchlist[] = [];
    
    $('#sel_wlid option').each((_, el) => {
      const id = $(el).attr('value')?.trim();
      const name = $(el).text().trim();
      if (id && name && /^\d+$/.test(id)) {
        watchlists.push({ id, name });
      }
    });
    
    return watchlists;
  }

  /**
   * Extract watchlist ID from redirect HTML
   */
  static extractWatchlistId(html: string): string | null {
    const match = html.match(/wlid=(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract symbol from wl_add_all redirect
   */
  static extractSymbolFromRedirect(html: string): string | null {
    const match = html.match(/symbol=([^"&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Parse action from wl_add_all redirect
   */
  static extractAction(html: string): 'add' | 'remove' | null {
    const match = html.match(/action=(add|remove)/);
    return match ? (match[1] as 'add' | 'remove') : null;
  }

  /**
   * Check if response is a redirect
   */
  static isRedirect(statusCode: number): boolean {
    return statusCode === 302 || statusCode === 301;
  }

  /**
   * Extract redirect target URL
   */
  static extractRedirectUrl(html: string): string | null {
    const match = html.match(/<a\s+HREF="([^"]+)">(?:here|click here)/i);
    return match ? match[1] : null;
  }
}
```

---

## 🚨 Error Handling Strategy

### Error Priority (Highest to Lowest)

1. **Session Expired** → `needsRefresh: true`, suggest re-authentication
2. **Validation Errors** → Caught before API call, return immediately
3. **HTTP Errors** → 4xx/5xx status codes, extract error message
4. **Parse Errors** → Unexpected response format, log raw response
5. **Network Errors** → Fetch failures, timeout, no internet

### Error Response Examples

```typescript
// Session expired
{
  success: false,
  error: {
    code: 'SESSION_EXPIRED',
    message: 'Session expired - please refresh your session',
    needsRefresh: true
  },
  meta: { statusCode: 200, responseType: 'html', url: '...' }
}

// Validation error
{
  success: false,
  error: {
    code: 'INVALID_INPUT',
    message: 'Invalid watchlist ID format: abc',
    details: 'Watchlist ID must be numeric'
  },
  meta: { statusCode: 0, responseType: 'text', url: 'N/A' }
}

// HTTP error
{
  success: false,
  error: {
    code: 'HTTP_ERROR',
    message: 'HTTP 404: Not Found',
    details: 'Watchlist with ID 99999 does not exist'
  },
  meta: { statusCode: 404, responseType: 'html', url: '...' }
}
```

---

## 🎯 Design Decisions & Rationale

### 1. **Accept 302 as Success Without Following Redirect**

**Rationale:**
- Following redirects adds latency (extra HTTP request)
- 302 status is sufficient success indicator
- Actual success/error messages are in redirect target (optional)
- For most operations, knowing "operation completed" is enough

**Implementation:**
```typescript
if (response.status === 302) {
  // Success - don't follow redirect
  return { success: true, data: {...} };
}
```

**Exception:** When we need data from redirect target (e.g., detailed error messages)

---

### 2. **Centralized HTML Parsing**

**Rationale:**
- MIO returns HTML, not JSON
- Parsing logic is complex and error-prone
- Duplication across methods leads to inconsistencies
- Single source of truth for selectors/patterns

**Implementation:**
```typescript
// Before (scattered)
$('#sel_wlid option').each(...)  // in getWatchlists
html.match(/wlid=(\d+)/)         // in createWatchlist

// After (centralized)
ResponseParser.parseWatchlistList(html)
ResponseParser.extractWatchlistId(html)
```

---

### 3. **Pre-Request Validation**

**Rationale:**
- Catch errors before making API calls
- Save network bandwidth
- Faster feedback to user
- Consistent validation rules

**Implementation:**
```typescript
// Validate before calling API
const validation = RequestValidator.validateWatchlistId(wlid);
if (!validation.valid) {
  return {
    success: false,
    error: { code: 'INVALID_INPUT', message: validation.error }
  };
}

// Proceed with API call
const response = await fetch(...);
```

---

### 4. **Typed Responses**

**Rationale:**
- TypeScript type safety
- Clear API contracts
- Better IDE autocomplete
- Easier to refactor

**Implementation:**
```typescript
// Before (untyped)
async getWatchlists(): Promise<any>

// After (typed)
async getWatchlists(): Promise<MIOResponse<GetWatchlistsResponse>>
```

---

### 5. **Session Expiry Detection**

**Rationale:**
- Session can expire at any time
- Need consistent detection across all endpoints
- User should be notified to refresh session
- Avoid misleading error messages

**Implementation:**
```typescript
// Check on every response
if (ResponseValidator.isSessionExpired(html)) {
  return {
    success: false,
    error: {
      code: 'SESSION_EXPIRED',
      message: 'Session expired',
      needsRefresh: true  // Client can handle refresh
    }
  };
}
```

---

## 📊 Response Pattern Summary

| Endpoint | HTTP Status | Body Type | Success Indicator | ID Location |
|----------|-------------|-----------|-------------------|-------------|
| Get Watchlists | 200 | HTML | `<select id="sel_wlid">` | `<option value="{id}">` |
| Create Watchlist | 302 | Redirect | `wlid` in URL | `wlid=(\d+)` in body |
| Add Bulk | 302 | Redirect | Redirect success | N/A |
| Add Single | 302 | Redirect | `wl_add_all_done.php` | `symbol=` in URL |
| Remove Single | 302 | Redirect | `wl_add_all_done.php` | `symbol=` in URL |
| Delete | 302 | Redirect | `my_watch_lists.php` | N/A |

---

## ✅ Validation Checklist

### For All Responses:
- [ ] Check HTTP status code
- [ ] Detect session expiry
- [ ] Validate expected response type (HTML/redirect)
- [ ] Extract error messages if present
- [ ] Log raw response for debugging (optional)

### For GET Watchlists:
- [ ] HTTP 200
- [ ] Contains `<select id="sel_wlid">`
- [ ] At least one `<option>` element
- [ ] All IDs are numeric

### For Create/Modify Operations:
- [ ] HTTP 302
- [ ] Contains `<a HREF="...">here</a>`
- [ ] Redirect URL is expected pattern
- [ ] Extract relevant IDs from redirect

### For Session Validation:
- [ ] No LOGIN_INDICATORS in response
- [ ] Expected HTML structure present
- [ ] No HTTP 401/403 errors

---

## 🚀 Next Steps

1. **Implement Response Parser** → `response-parser.ts`
2. **Implement Request Validator** → `request-validator.ts`
3. **Implement HTTP Client** → `http-client.ts`
4. **Refactor API Client** → Use new utilities
5. **Update MIOService** → Add new endpoint methods
6. **Add Tests** → Unit tests for parsers/validators
7. **Update API Routes** → Return typed responses

---

**Status:** ✅ Analysis complete - Ready for implementation
