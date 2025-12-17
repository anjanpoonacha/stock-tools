# TradingView Historical Data POC

Standalone proof-of-concept scripts to extract historical OHLCV data from TradingView using WebSocket API.

## 🎯 Objective

Validate the complete flow from TradingView session → JWT token → WebSocket connection → Historical bars, before integrating into the main application.

## 📁 File Structure

```
/scripts/poc-tradingview/
  ├── README.md                     # This file
  ├── poc-config.example.ts         # Configuration template
  ├── poc-config.ts                 # Your config (gitignored)
  ├── poc-types.ts                  # TypeScript interfaces
  ├── poc-protocol.ts               # Protocol helpers (~m~ format)
  ├── poc-1-get-user-id.ts          # Step 1: Extract user ID
  ├── poc-2-get-jwt-token.ts        # Step 2: Get JWT token
  └── poc-3-websocket-client.ts     # Step 3: Fetch historical bars

/scripts/poc-output/ (gitignored)
  ├── 1-user-data.json              # User ID output
  ├── 2-jwt-token.json              # JWT token output
  ├── 3-bars-output.json            # Historical OHLCV data
  └── 3-websocket-messages.log      # Full WebSocket traffic
```

## 🚀 Quick Start

### 1. Setup Configuration

```bash
# Configuration is already created, just update with your session
# Edit: scripts/poc-tradingview/poc-config.ts
```

Update the `sessionId` field with your TradingView session cookie:

```typescript
tradingViewSession: {
  sessionId: 'YOUR_SESSIONID_HERE',  // Get from browser or KV storage
},
```

**How to get session cookie:**
- Option A: Use browser extension (already installed)
- Option B: Check KV storage via `/api/session/status`
- Option C: Browser DevTools → Application → Cookies → `sessionid`

### 2. Run POC Scripts

```bash
# Run all steps sequentially
pnpm poc-all

# Or run individually
pnpm poc-1   # Get user ID
pnpm poc-2   # Get JWT token
pnpm poc-3   # Fetch historical bars
```

### 3. Review Output

```bash
# Check outputs
cat scripts/poc-output/1-user-data.json
cat scripts/poc-output/2-jwt-token.json
cat scripts/poc-output/3-bars-output.json

# Review WebSocket messages
less scripts/poc-output/3-websocket-messages.log
```

## 📊 Expected Output

### Step 1: User ID
```json
{
  "success": true,
  "userId": 63642928,
  "username": "your_username"
}
```

### Step 2: JWT Token
```json
{
  "success": true,
  "jwtToken": "eyJhbGciOiJSUzUxMiIsImtpZCI6IkdaeFUi...",
  "userId": 63642928,
  "chartId": "S09yY40x",
  "expiresAt": 1765973038
}
```

**JWT Payload** (decoded):
```json
{
  "user_id": 63642928,
  "exp": 1765973038,
  "iat": 1765958638,
  "plan": "pro_premium",
  "perm": "nse"
}
```

### Step 3: Historical Bars
```json
{
  "success": true,
  "symbol": "NSE:JUNIPER",
  "resolution": "1D",
  "bars": [
    {
      "time": 1709078400,
      "open": 260.6,
      "high": 267.6,
      "low": 255.6,
      "close": 257.84,
      "volume": 134142
    },
    ...
  ],
  "symbolMetadata": {
    "name": "JUNIPER",
    "exchange": "NSE",
    "currency_code": "INR",
    "pricescale": 100,
    "minmov": 5,
    "timezone": "Asia/Kolkata"
  },
  "websocketSession": "0.28583.1563_mum1-charts-pro-4-tvbs-dr7ok-3",
  "messagesExchanged": {
    "sent": 7,
    "received": 15
  }
}
```

## 🔧 Configuration Options

Edit `poc-config.ts` to customize:

```typescript
{
  chart: {
    symbol: 'NSE:JUNIPER',    // Any TradingView symbol
    resolution: '1D',         // 1D, 1W, 1M, 1H, etc.
    barsCount: 300,           // Number of historical bars
  },
  
  output: {
    saveMessages: true,       // Log all WebSocket messages
    prettyPrint: true,        // Pretty JSON output
  }
}
```

**Available Resolutions:**
- `1D` - Daily bars
- `1W` - Weekly bars
- `1M` - Monthly bars
- `1H` - Hourly bars (if supported)
- `5`, `15`, `30` - Minute bars (if supported)

**Symbols:**
- NSE stocks: `NSE:JUNIPER`, `NSE:TCS`, `NSE:INFY`
- NYSE stocks: `NYSE:AAPL`, `NASDAQ:MSFT`
- Crypto: `BINANCE:BTCUSDT`
- Forex: `FX:EURUSD`

## 🐛 Troubleshooting

### Step 1 Fails: "Session invalid"
**Solution:**
- Refresh session using browser extension
- Check cookie format (should start with letters/numbers, ~25-30 chars)
- Verify you can access tradingview.com in browser

### Step 2 Fails: "HTTP 403/401"
**Solution:**
- Verify user_id from Step 1 is correct
- Check that session cookie hasn't expired
- Try refreshing session

### Step 3 Fails: "Connection timeout"
**Solution:**
- Check network connectivity
- Verify WebSocket URL is accessible
- Check if JWT token expired (re-run Step 2)

### No Bars Received
**Solution:**
- Check symbol format (must be `EXCHANGE:SYMBOL`)
- Verify symbol exists on TradingView
- Increase wait time in `poc-3` (currently 5 seconds)
- Check `3-websocket-messages.log` for errors

### "Cannot find module './poc-config.js'"
**Solution:**
- Ensure `poc-config.ts` exists (copy from `poc-config.example.ts`)
- Check that you're running from project root

## 🔍 Understanding the Protocol

### TradingView WebSocket Protocol

**Frame Format:** `~m~<length>~m~<json_payload>`

Example:
```
~m~34~m~{"m":"set_locale","p":["en","US"]}
```

**Message Sequence:**
1. Connect to WebSocket
2. Receive handshake with `session_id`
3. Send `set_auth_token` with JWT
4. Send `set_locale`
5. Create `chart_create_session`
6. Create `quote_create_session`
7. Send `resolve_symbol` (get metadata)
8. Send `create_series` (request bars)
9. Receive `symbol_resolved` (metadata)
10. Receive `du` (data update with bars)

**Data Update Format:**
```json
{
  "m": "du",
  "p": [
    "chart_session_id",
    {
      "study_id": {
        "st": [
          {
            "i": -1000100,
            "v": [timestamp, open, high, low, close, volume]
          }
        ]
      }
    }
  ]
}
```

## 📈 Data Quality Validation

### Expected Bar Data:
- **Time:** Unix timestamp (seconds)
- **OHLC:** Positive numbers, reasonable range
- **Volume:** Positive integer
- **Sequence:** Chronological order

### Validation Checks:
```bash
# Check bar count
jq '.bars | length' scripts/poc-output/3-bars-output.json

# Check date range
jq '.bars | [first.time, last.time] | map(. * 1000 | todateiso8601)' scripts/poc-output/3-bars-output.json

# Check for null values
jq '.bars[] | select(.open == null or .close == null)' scripts/poc-output/3-bars-output.json

# Sample price range
jq '.bars[0:5] | .[] | {date: (.time * 1000 | todateiso8601), close}' scripts/poc-output/3-bars-output.json
```

## 🎯 Success Criteria

POC is successful if:
- ✅ User ID extracted (Step 1)
- ✅ JWT token obtained (Step 2)
- ✅ WebSocket connection established
- ✅ Authentication successful
- ✅ Symbol resolved with metadata
- ✅ Historical bars received (>200 bars)
- ✅ OHLCV data valid (no nulls/NaN)
- ✅ Bars in chronological order

## 🔒 Security Notes

**⚠️ IMPORTANT:**
- `poc-config.ts` is gitignored (contains session cookie)
- `poc-output/` is gitignored (contains JWT tokens)
- **NEVER commit these files to git**
- JWT tokens expire in ~15 minutes
- Session cookies expire based on TradingView settings

**Token Rotation:**
- JWT tokens are short-lived (15 min)
- Re-run Step 2 if token expires
- Session cookies last longer (days/weeks)

## 📦 Next Steps: Integration

Once POC validates successfully:

### 1. Move Protocol Helpers
```bash
# Already done! Protocol helpers in:
# src/lib/tradingview/protocol.ts
```

### 2. Create Services
- [ ] `src/lib/tradingview/jwtService.ts` - JWT token management
- [ ] `src/lib/tradingview/historicalDataClient.ts` - WebSocket client
- [ ] `src/lib/tradingview/dataParser.ts` - OHLCV parser

### 3. Create API Routes
- [ ] `src/app/api/tradingview-jwt/route.ts` - JWT endpoint
- [ ] `src/app/api/chart-data/route.ts` - Historical data endpoint

### 4. Create Frontend Component
- [ ] Install: `pnpm add lightweight-charts`
- [ ] Create: `src/components/TradingViewLiveChart.tsx`
- [ ] Update: `src/app/chart/ChartPageContent.tsx`

### 5. Test & Deploy
- [ ] Test with NSE:JUNIPER
- [ ] Test with multiple symbols
- [ ] Test error handling
- [ ] Deploy to Vercel

## 📚 Resources

**TradingView API:**
- User endpoint: `https://www.tradingview.com/api/v1/user/`
- JWT endpoint: `https://www.tradingview.com/chart-token/`
- WebSocket: `wss://prodata.tradingview.com/socket.io/websocket`

**Lightweight Charts:**
- Docs: https://tradingview.github.io/lightweight-charts/
- GitHub: https://github.com/tradingview/lightweight-charts

**WebSocket Protocol:**
- Based on Socket.IO custom protocol
- Uses ~m~ frame format
- JSON-encoded messages

## 💡 Tips

**Performance:**
- Reduce `barsCount` for faster fetching
- Use daily resolution for less data
- Cache bars locally to avoid re-fetching

**Debugging:**
- Check `3-websocket-messages.log` for raw traffic
- Use `config.output.prettyPrint = true` for readable JSON
- Increase wait times if bars not received

**Production:**
- Implement JWT caching (15-min TTL)
- Add retry logic for WebSocket disconnects
- Validate bar data before rendering
- Handle symbol not found errors

## 🎉 POC Complete!

If all three steps succeed, you've validated:
- ✅ TradingView authentication flow
- ✅ WebSocket protocol implementation
- ✅ Historical data extraction
- ✅ Data quality and format

**Ready for integration!** 🚀

Questions or issues? Check the troubleshooting section or review the WebSocket messages log for details.
