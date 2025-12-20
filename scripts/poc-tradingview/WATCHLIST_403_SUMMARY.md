# TradingView Watchlist 403 Error - Investigation Summary

## Status: 🧪 POC Ready for Testing

## Quick Test

Your session ID: `c21wcqky6leod5cjl2fh6i660sy411jb`

```bash
# 1. Setup config (if not done)
cd /Users/i548399/SAPDevelop/github.com/personal/mio-tv-scripts
cp scripts/poc-tradingview/poc-config.example.ts scripts/poc-tradingview/poc-config.ts

# 2. Edit poc-config.ts and set:
#    sessionId: 'c21wcqky6leod5cjl2fh6i660sy411jb'

# 3. Run the test
npx tsx scripts/poc-tradingview/poc-test-watchlist-formats.ts
```

## The Issue

**Symptom:** 403 Forbidden when adding stocks to TradingView watchlists  
**Session Status:** ✅ Valid (confirmed in logs)  
**Root Cause:** Content-Type mismatch between implementations

## Technical Details

### Two Conflicting Implementations Found

**Original (tradingview.ts:104):**
```typescript
// ✅ This format might be correct
headers: { 'Content-Type': 'application/json' }
body: JSON.stringify(["NSE:RELIANCE"])
```

**Current (unifiedWatchlistService.ts:329):**
```typescript
// ❌ This format is causing 403
headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
body: 'symbol=NSE%3ARELIANCE'
```

### Why This Causes 403

The proxy (`src/app/api/proxy/route.ts`) handles these differently:
- JSON: Parses with `parseRequestBody()` and re-stringifies
- Form: Forwards as-is

The mismatch corrupts the request body before it reaches TradingView.

## POC Test Plan

The test script will:
1. ✅ Fetch your actual watchlists (validate session)
2. ✅ Test JSON Array format
3. ✅ Test Form-Encoded format (if JSON fails)
4. ✅ Tell you which format TradingView accepts
5. ✅ Provide clear fix recommendation

## Expected Results

### Scenario A: JSON Format Works
```
✅ Use JSON Array format in production code
```
→ **Fix:** Change unifiedWatchlistService.ts to use JSON format

### Scenario B: Form Format Works
```
✅ Use Form-Encoded format in production code
```
→ **Fix:** Update proxy to handle form-encoded correctly

### Scenario C: Both Fail
```
❌ Both formats failed
```
→ **Debug:** Session issue or API change

## Files Created

1. **POC Test Script:** `scripts/poc-tradingview/poc-test-watchlist-formats.ts`
2. **Documentation:** `POC_WATCHLIST_403_FIX.md`
3. **Quick Start:** `README_WATCHLIST_TEST.md`
4. **Helper Script:** `extract-session-from-logs.sh`

## After POC: Implementation Plan

Once we know the correct format, we'll:

1. Update `src/lib/watchlist-sync/unifiedWatchlistService.ts:320-337`
2. Remove unused imports (MIOService, fetchWatchlistsWithAuth, appendSymbolToWatchlist)
3. Add proper error handling
4. Test in the actual app
5. Document the correct API format

## Console Log Evidence

```
✅ Session Valid:
useSessionBridge.ts:60 [useSessionBridge] tradingview session resolved: 
  {hasSession: true, sessionId: 'c21wcqky6leod5cjl2fh6i660sy411jb'}

✅ Watchlists Fetched:
unifiedWatchlistService.ts:218 TV returned 22 watchlists

❌ Add Symbol Failed:
POST http://localhost:3000/api/proxy 403 (Forbidden)
Failed to add NSE:AEGISVOPAK to TV watchlist: Error: Failed to add to TV watchlist: 403
```

## TradingView API Endpoint

```
POST https://www.tradingview.com/api/v1/symbols_list/custom/{watchlistId}/append/

Required Headers:
- Cookie: sessionid={sessionId}
- Content-Type: ??? (TBD by POC)
- Origin: https://www.tradingview.com
- User-Agent: Mozilla/5.0 ...

Body Format: ??? (TBD by POC)
```

---

**Next Step:** Run the POC test to determine the correct format! 🚀
