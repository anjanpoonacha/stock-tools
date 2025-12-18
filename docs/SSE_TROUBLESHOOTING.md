# SSE Streaming Troubleshooting Guide

## Common Issues and Fixes

### Issue 1: "Unexpected end of JSON input" Error

**Error Message**:
```
[SSE] Error setting up stream: SyntaxError: Unexpected end of JSON input
    at JSON.parse (<anonymous>)
    at POST (src/app/api/formula-results-with-charts/route.ts:73:30)
```

**Cause**: The SSE endpoint is receiving a POST request with an empty or malformed body.

**Root Causes**:
1. **Credentials not loaded**: The frontend hook tries to fetch before credentials are in localStorage
2. **Invalid formulaId**: The formulaId is null, undefined, or empty string
3. **Hook initialized incorrectly**: The hook is being called when streaming mode is disabled

**Fix Applied** (v1.1 - 2024-12-18):
- ✅ Added early credential validation before making request
- ✅ Added request body validation and logging
- ✅ Added explicit formulaId check in useEffect
- ✅ Added better error messages for debugging

**How to Verify Fix**:
1. Check console logs for:
   ```
   [useFormulaResultsWithCharts] Auto-fetching for formula: formula_xxx
   [SSE] Received request: { userEmail: '...', formulaId: '...', ... }
   ```
2. If you see "Skipping fetch - no valid formulaId", streaming is correctly disabled

**Manual Workaround** (if issue persists):
1. Make sure you're logged in first (credentials in localStorage)
2. Ensure streaming mode is enabled (⚡ badge should be active)
3. Try refreshing the page
4. Check browser console for more specific error messages

---

### Issue 2: Hook Runs When Streaming Disabled

**Symptoms**: 
- Streaming hook makes requests even in "Classic" mode
- Unnecessary API calls in Network tab
- Console shows streaming logs when it shouldn't

**Cause**: The hook is initialized on every render, even when `formulaId` is `null`.

**Fix Applied**:
```typescript
// OLD (problematic):
const streamingHook = useFormulaResultsWithCharts(formulaId);

// NEW (fixed):
const streamingHook = useFormulaResultsWithCharts(streamingEnabled ? formulaId : null);

// Hook now checks:
if (formulaId && formulaId.trim() !== '') {
  fetchResults();
} else {
  console.log('Skipping fetch - no valid formulaId');
}
```

**How to Verify**:
1. Switch to "Classic" mode
2. Check console - should NOT see streaming logs
3. Check Network tab - should NOT see `/api/formula-results-with-charts` requests

---

### Issue 3: Credentials Not Found

**Error Message**:
```
Error: Not authenticated. Please log in first.
```

**Cause**: Authentication credentials are missing from localStorage.

**Fix**:
1. Log in through the authentication flow
2. Ensure credentials are stored:
   ```javascript
   localStorage.getItem('mio-tv-auth-credentials')
   // Should return: {"userEmail":"...","userPassword":"..."}
   ```
3. If missing, log in again

**Debug Command**:
```javascript
// Check if credentials exist
const creds = localStorage.getItem('mio-tv-auth-credentials');
console.log('Credentials:', creds ? JSON.parse(creds) : 'NOT FOUND');
```

---

### Issue 4: Stream Starts But No Data

**Symptoms**:
- Progress bar appears but stays at 0%
- No batch events received
- Console shows authentication succeeded but nothing after

**Possible Causes**:
1. **TradingView session expired**: JWT token is invalid
2. **No stocks in formula**: Formula returns 0 stocks
3. **Network timeout**: Connection drops mid-stream

**Debug Steps**:
1. Check console for:
   ```
   [SSE] Authenticated successfully
   [BatchChartFetcher] Starting batch fetch: X symbols × 2 resolutions = Y charts
   ```
2. If you see "authenticated" but no "batch fetch", check backend logs
3. If you see "batch fetch" but no batches, check TradingView session

**Fix**:
1. **Expired session**: Refresh TradingView session via browser extension
2. **Empty formula**: Check formula has stocks (view in table mode first)
3. **Network issues**: Check Network tab for failed requests

---

### Issue 5: Progress Bar Stuck

**Symptoms**:
- Progress bar shows 20% and never updates
- Console shows batch events but UI doesn't update

**Cause**: Frontend not parsing SSE events correctly.

**Debug**:
1. Open Network tab → Find `/api/formula-results-with-charts` request
2. Look at EventStream tab (Chrome DevTools)
3. Verify events are being sent:
   ```
   data: {"type":"formula-results",...}
   
   data: {"type":"chart-batch",...}
   ```

**Fix**:
- If events are coming through, check browser console for parsing errors
- If no events, check backend is sending them (backend logs)

---

### Issue 6: "Formula not found" Error

**Error Message**:
```
data: {"type":"error","data":{"message":"Formula not found"}}
```

**Cause**: Invalid formulaId or formula doesn't exist in storage.

**Fix**:
1. Verify formulaId is correct (check URL)
2. Check formula exists:
   ```javascript
   // In console
   const key = `mio-formulas:${userEmail}:${userPassword}`;
   // Check in KV store
   ```
3. Re-extract formulas if needed

---

### Issue 7: Charts Don't Display After Streaming

**Symptoms**:
- Streaming completes successfully (100%)
- Switch to Chart View
- Charts are blank or show loading spinners

**Cause**: ChartView is not using cached data from streaming hook.

**Current Behavior** (Known Limitation):
- ChartView makes its own requests (doesn't use `chartData` from hook)
- Charts will load on-demand even though data was streamed

**Workaround**:
- Charts will load quickly due to localStorage caching
- No action needed - this is expected behavior

**Future Enhancement**:
- Update ChartView to use `chartData` prop for instant rendering

---

## Debugging Commands

### Check Streaming Mode
```javascript
localStorage.getItem('streaming-mode-enabled') // "true" or "false"
```

### Check Credentials
```javascript
const creds = localStorage.getItem('mio-tv-auth-credentials');
console.log(creds ? JSON.parse(creds) : 'NOT FOUND');
```

### Check Cached Formula Results
```javascript
const formulaId = 'formula_xxx'; // Replace with actual ID
const key = `formula-results-with-charts:${formulaId}`;
const cached = localStorage.getItem(key);
console.log(cached ? JSON.parse(cached) : 'NOT CACHED');
```

### Check Cached Batches
```javascript
const formulaId = 'formula_xxx';
const batches = Object.keys(localStorage).filter(k => 
  k.startsWith(`chart-data-batch:${formulaId}`)
);
console.log('Cached batches:', batches);
```

### Clear Everything
```javascript
// Nuclear option - clear all caches
localStorage.clear();
// Then refresh page and log in again
```

### Monitor SSE Events (Browser)
1. Open DevTools → Network tab
2. Find `/api/formula-results-with-charts` request
3. Click on it
4. Go to "EventStream" tab (Chrome) or "Response" tab (Firefox)
5. Watch events stream in real-time

---

## Server-Side Debugging

### Enable Verbose Logging
Add to `.env.local`:
```
DEBUG_SSE=true
```

### Check Backend Logs
Look for these log messages:
```
[SSE] Received request: { userEmail: '...', formulaId: '...', ... }
[SSE] Fetching stock results from: <mio-url>
[SSE] Parsed X stocks from MIO response
[SSE] Sent formula results (X stocks)
[SSE] Authenticated successfully
[BatchChartFetcher] Starting batch fetch: ...
[SSE] Sent batch 1/5 (20%)
[SSE] Stream complete: X charts in Xms
```

### Check for Errors
Common error patterns:
```
[SSE] Failed to parse request body: ...
[SSE] Missing required fields: ...
[SessionResolver] No session found for user: ...
[JWTService] Failed to get token: ...
```

---

## Performance Issues

### Slow Streaming (>15 seconds total)
**Causes**:
1. **Too many symbols**: >100 stocks = slower
2. **Slow TradingView API**: Network latency
3. **Connection pool exhausted**: Too many concurrent requests

**Fix**:
1. Reduce batch size: Change `batchSize: 18` → `batchSize: 10`
2. Reduce parallel connections: Change `parallelConnections: 5` → `parallelConnections: 3`
3. Check network latency (ping tradingview.com)

### First Batch Takes Forever (>10 seconds)
**Cause**: Session resolution and JWT fetch are slow.

**Fix**:
1. Check session cache is working (should be <100ms after first request)
2. Check JWT cache is working (should be <100ms after first request)
3. Verify TradingView session is valid

---

## Emergency Fallback

If streaming is completely broken:

1. **Switch to Classic Mode**:
   - Click ⚡ Streaming badge → Switch to "Classic"
   - Reload page
   - Old behavior should work

2. **Use Old Endpoint Directly**:
   - Navigate to `/api/formula-results` (non-streaming)
   - Should return full results without streaming

3. **Report Issue**:
   - Capture console logs
   - Capture Network tab (HAR file)
   - Note exact steps to reproduce
   - Include formulaId and timestamp

---

## Version History

### v1.1 (2024-12-18)
- ✅ Fixed: "Unexpected end of JSON input" error
- ✅ Added: Early credential validation
- ✅ Added: Request body logging
- ✅ Added: Better error messages
- ✅ Improved: Hook initialization logic

### v1.0 (2024-12-18)
- ✅ Initial SSE streaming implementation
- ✅ Dual-mode support (streaming + classic)
- ✅ Progress tracking
- ✅ Caching layer

---

## Need More Help?

1. Check logs: Browser console + Server logs
2. Try test page: Open `test-sse-stream.html`
3. Check documentation: `SSE_STREAMING_IMPLEMENTATION.md`
4. Check testing guide: `SSE_STREAMING_TESTING_GUIDE.md`
5. Report bug with full error logs and reproduction steps
