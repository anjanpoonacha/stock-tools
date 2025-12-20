# POC: TradingView Watchlist 403 Error Investigation

## Issue Description

When adding stocks to TradingView watchlists through the unified watchlist service, we're getting a **403 Forbidden** error even with a valid session.

## Root Cause Analysis

Found conflicting Content-Type formats between two implementations:

### Implementation 1: `src/lib/tradingview.ts:104` (Original)
```typescript
headers: {
  'Content-Type': 'application/json',
},
body: JSON.stringify([symbol]),  // Array format
```

### Implementation 2: `src/lib/watchlist-sync/unifiedWatchlistService.ts:329` (Current)
```typescript
headers: {
  'Content-Type': 'application/x-www-form-urlencoded',
},
body: `symbol=${encodeURIComponent(symbol)}`,  // Form-encoded format
```

## The Problem

The proxy route (`src/app/api/proxy/route.ts`) handles these differently:
- **application/json**: Parses and re-stringifies the body
- **application/x-www-form-urlencoded**: Forwards as-is

The mismatch causes the request to be malformed when it reaches TradingView's API.

## POC Test Script

Created: `scripts/poc-tradingview/poc-test-watchlist-formats.ts`

This script:
1. Fetches your actual TradingView watchlists
2. Tests both Content-Type formats against the real API
3. Shows which format TradingView actually accepts
4. Provides a clear recommendation for production code

## Running the POC

```bash
# 1. Configure your session
# Edit scripts/poc-tradingview/poc-config.ts and set:
export const config = {
  tradingViewSession: {
    sessionId: 'YOUR_ACTUAL_SESSION_ID',  // Get from browser or KV storage
  },
  // ... rest of config
};

# 2. Run the test
npx tsx scripts/poc-tradingview/poc-test-watchlist-formats.ts
```

## Expected Output

```
🚀 TradingView Watchlist API Format Test
================================================================================

📋 Fetching your watchlists...
✅ Found 22 watchlists:
   1. My Portfolio (ID: abc123)
   2. Tech Stocks (ID: def456)
   ...

🎯 Using watchlist "My Portfolio" (abc123) for testing
⚠️  Note: This will add NSE:RELIANCE to this watchlist

🧪 Testing Format 1: JSON Array
Content-Type: application/json
Body: ["NSE:RELIANCE"]

================================================================================
📊 TEST RESULTS SUMMARY
================================================================================

1. JSON Array
   Status: 200 ✅ SUCCESS
   Response: {"ok":true}

================================================================================
🎯 RECOMMENDATION
================================================================================
✅ Use JSON Array format in production code
```

## Next Steps (After POC)

Once we determine the correct format:

1. **Update `unifiedWatchlistService.ts`** to use the working format
2. **Remove unused imports** (MIOService, fetchWatchlistsWithAuth, appendSymbolToWatchlist)
3. **Update proxy handling** if needed
4. **Test the fix** in the actual app

## TradingView API Documentation

Endpoint: `POST https://www.tradingview.com/api/v1/symbols_list/custom/{watchlistId}/append/`

Required Headers:
- `Cookie: sessionid=...`
- `Content-Type: ???` (to be determined by POC)
- `Origin: https://www.tradingview.com`
- `User-Agent: Mozilla/5.0 ...`

Body format: **TBD** (testing both options)

## Files Involved

- `src/lib/watchlist-sync/unifiedWatchlistService.ts:320-337` - Current broken implementation
- `src/lib/tradingview.ts:99-115` - Original working implementation
- `src/app/api/proxy/route.ts:74-133` - Proxy that forwards requests
- `src/hooks/useWatchlistIntegration.ts:146` - Hook that calls the service

## Related Console Logs

```
useSessionBridge.ts:60 [useSessionBridge] tradingview session resolved: 
  {hasSession: true, sessionId: 'c21wcqky6leod5cjl2fh6i660sy411jb', ...}

unifiedWatchlistService.ts:320 POST http://localhost:3000/api/proxy 403 (Forbidden)

Failed to add NSE:AEGISVOPAK to TV watchlist: Error: Failed to add to TV watchlist: 403
```

Session is valid (✓) but request format is wrong (✗).
