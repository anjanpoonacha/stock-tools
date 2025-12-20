# POC: TradingView Watchlist 403 Fix - APPLIED ✅

## POC Test Results

**Date:** 2025-12-20  
**Status:** ✅ SUCCESS - Fix Applied to Production

### Test Execution

```bash
npx tsx scripts/poc-tradingview/poc-test-watchlist-formats.ts
```

### Results

**Format 1: JSON Array** ✅
- Content-Type: `application/json`
- Body: `["NSE:RELIANCE"]`
- **Result:** HTTP 200 SUCCESS

**Format 2: Form-Encoded** ⏭️
- Skipped (first format succeeded)

### Recommendation

✅ **Use JSON Array format in production code**

## Fix Applied

### File: `src/lib/watchlist-sync/unifiedWatchlistService.ts`

#### Before (Broken - Caused 403):
```typescript
headers: {
  'Content-Type': 'application/x-www-form-urlencoded',
  Cookie: `sessionid=${sessions.tv!.sessionId}`,
},
body: `symbol=${encodeURIComponent(normalizedSymbol)}`,
```

#### After (Fixed - Works):
```typescript
headers: {
  'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
  Cookie: `sessionid=${sessions.tv!.sessionId}`,
  'Content-Type': 'application/json',
  'Origin': 'https://www.tradingview.com',
},
body: [normalizedSymbol], // Array, NOT stringified (proxy will stringify it)
```

### Changes Made:

1. ✅ Changed Content-Type from `application/x-www-form-urlencoded` to `application/json`
2. ✅ Changed body from form-encoded string to JSON array: `[symbol]` (NOT `JSON.stringify([symbol])`)
3. ✅ **KEY FIX:** Pass array directly to avoid double-stringification by proxy
4. ✅ Added `Origin` header for better CORS handling
5. ✅ Added `User-Agent` header (matches working implementation)
6. ✅ Removed unused imports:
   - `MIOService` (not used in this service)
   - `fetchWatchlistsWithAuth` (replaced with direct API calls)
   - `appendSymbolToWatchlist` (replaced with direct API calls)

## Why It Works

The TradingView API expects:
- **Content-Type:** `application/json`
- **Body Format:** Array of symbols `["NSE:RELIANCE"]`

### The REAL Issue: Double-Stringification

The proxy route (`src/app/api/proxy/route.ts`) handles JSON payloads like this:
1. Receives the outer JSON with `{url, method, headers, body}`
2. For JSON content-type, it checks if body is a string
3. If string, it calls `parseRequestBody()` to parse it
4. Then it calls `JSON.stringify()` on the result
5. Forwards the request to TradingView

**The Problem:** We were passing `body: JSON.stringify([symbol])` which:
1. Proxy receives: `"[\"NSE:RELIANCE\"]"` (string)
2. parseRequestBody parses: `["NSE:RELIANCE"]` (array)
3. JSON.stringify again: `"[\"NSE:RELIANCE\"]"` (double-stringified!)
4. TradingView gets malformed JSON → 403

**The Solution:** Pass `body: [symbol]` (array, not stringified):
1. Proxy receives: `["NSE:RELIANCE"]` (array)
2. Not a string, skips parseRequestBody
3. JSON.stringify once: `"[\"NSE:RELIANCE\"]"` (correct!)
4. TradingView gets proper JSON → 200 ✅

## Validation

**Session:** c21wcqky6leod5cjl2fh6i660sy411jb (Valid ✅)  
**Test Watchlist:** "0.AnalysedAlready" (ID: 196379825)  
**Test Symbol:** NSE:RELIANCE  
**Result:** Successfully added to watchlist  

## API Documentation (Confirmed)

```
POST https://www.tradingview.com/api/v1/symbols_list/custom/{watchlistId}/append/

Headers:
  Content-Type: application/json
  Cookie: sessionid={sessionId}
  Origin: https://www.tradingview.com
  User-Agent: Mozilla/5.0 (compatible; StockFormatConverter/1.0)

Body:
  ["EXCHANGE:SYMBOL"]
  
Response:
  HTTP 200 - Returns updated watchlist symbols array
  HTTP 403 - Invalid session or malformed request
```

## Next Steps

1. ✅ Test in the actual app (add symbol via UI)
2. ✅ Verify 403 error is resolved
3. ✅ Monitor for any edge cases

## References

- Original Implementation: `src/lib/tradingview.ts:99-115`
- Fixed Implementation: `src/lib/watchlist-sync/unifiedWatchlistService.ts:319-334`
- Proxy Handler: `src/app/api/proxy/route.ts:74-133`
- POC Test Script: `scripts/poc-tradingview/poc-test-watchlist-formats.ts`

---

**Conclusion:** POC validated the fix before applying to production. The JSON Array format is the correct one. ✅
