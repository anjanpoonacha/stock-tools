# Quick Start: Testing TradingView Watchlist API Formats

## 1. Get Your Session ID

### Option A: From Browser DevTools
1. Open TradingView.com in your browser
2. Open DevTools (F12)
3. Go to Application → Cookies → https://www.tradingview.com
4. Copy the `sessionid` cookie value

### Option B: From Your App's KV Storage
```bash
# Use your extension to get the session
# Or check the console logs for the session ID
```

## 2. Configure the POC

```bash
# If poc-config.ts doesn't exist, copy the example
cp scripts/poc-tradingview/poc-config.example.ts scripts/poc-tradingview/poc-config.ts

# Edit poc-config.ts and update:
export const config = {
  tradingViewSession: {
    sessionId: 'YOUR_SESSION_ID_HERE',  // Paste your actual session ID
  },
  // ... keep the rest as-is
};
```

## 3. Run the Test

```bash
npx tsx scripts/poc-tradingview/poc-test-watchlist-formats.ts
```

## 4. Interpret Results

### Success Output:
```
✅ Use JSON Array format in production code
```
→ Update `unifiedWatchlistService.ts` to use JSON format

### Failure Output:
```
❌ Both formats failed. Check session validity and watchlist ID.
```
→ Verify your session ID is correct and not expired

## 5. After POC (Apply Fix)

Once you know the correct format:

```bash
# The fix will be applied to:
# src/lib/watchlist-sync/unifiedWatchlistService.ts
# 
# Change from:
#   'Content-Type': 'application/x-www-form-urlencoded',
#   body: `symbol=${encodeURIComponent(symbol)}`
#
# To (if JSON works):
#   'Content-Type': 'application/json',
#   body: JSON.stringify([symbol])
```

## Troubleshooting

### "No watchlists found"
→ Create at least one watchlist on TradingView first

### "403 Forbidden" for both formats
→ Session expired, get a fresh session ID

### "sessionId not configured"
→ Make sure poc-config.ts exists and has valid sessionId

## What This Tests

1. **JSON Array Format** (from original tradingview.ts)
   - Content-Type: application/json
   - Body: ["NSE:RELIANCE"]

2. **Form-Encoded Format** (from current unifiedWatchlistService.ts)
   - Content-Type: application/x-www-form-urlencoded  
   - Body: symbol=NSE%3ARELIANCE

The script will tell you which one TradingView actually accepts.
