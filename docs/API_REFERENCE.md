# API Reference

**Last Updated:** December 24, 2025

Complete reference for external APIs and integration patterns used in this project.

---

## TradingView WebSocket API

### Connection Details

| Property | Value |
|----------|-------|
| **Endpoint** | `wss://prodata.tradingview.com/socket.io/websocket` |
| **Authentication** | JWT token via `set_auth_token` |
| **Protocol** | Custom frame format (`~m~<length>~m~<json>`) |
| **Heartbeat** | `~h~N` messages every ~5s (must echo back) |

### Frame Format

```typescript
// Standard message
~m~<length>~m~<json_payload>

// Example
~m~54~m~{"m":"set_auth_token","p":["eyJhbGciOiJIUzI1NiIs..."]}

// Heartbeat (echo back immediately)
~m~3~m~~h~1
```

### Connection Lifecycle

```typescript
// 1. Connect
ws = new WebSocket('wss://prodata.tradingview.com/socket.io/websocket');

// 2. Authenticate (immediately, no delay)
send({ m: "set_auth_token", p: [jwtToken] });
send({ m: "set_locale", p: ["en", "US"] });

// 3. Create sessions
send({ m: "chart_create_session", p: ["cs_ABC123", ""] });
send({ m: "quote_create_session", p: ["qs_DEF456"] });

// 4. Resolve symbol (~1-2ms)
send({ 
  m: "resolve_symbol",
  p: ["cs_ABC123", "sds_sym_1", "={\"symbol\":\"NSE:RELIANCE\"}"]
});
// Response: symbol_resolved or symbol_error

// 5. Create series (3-5s for 300 bars)
send({
  m: "create_series",
  p: ["cs_ABC123", "sds_1", "s1", "sds_sym_1", "1D", 300, ""]
  //   session     series  turn   symbol       res   bars
});
// Response: timescale_update with OHLCV bars

// 6. Switch symbols (subsequent requests)
send({
  m: "modify_series",
  p: ["cs_ABC123", "sds_1", "s2", "sds_sym_2", "1D", ""]
  //   same session  same    new turn  new symbol
});
```

### Resolutions

```typescript
// Minutes: Number only (no suffix)
'1'    // 1 minute
'5'    // 5 minutes
'15'   // 15 minutes
'30'   // 30 minutes
'60'   // 60 minutes (1 hour)

// Days/Weeks/Months: Uppercase letter
'1D'   // Daily
'1W'   // Weekly
'1M'   // Monthly

// Seconds: Uppercase S
'15S'  // 15 seconds
'30S'  // 30 seconds

// ❌ WRONG
'5m'   // Should be '5'
'1h'   // Should be '60'
'1d'   // Should be '1D'
```

### CVD (Cumulative Volume Delta) Indicator

#### Configuration

```typescript
interface CVDConfig {
  anchorPeriod: '1W' | '1M' | '3M' | '6M' | '12M';  // Historical lookback
  timeframe: '15S' | '30S' | '1' | '5' | '15' | '30' | '60' | 'D' | 'W';  // Delta granularity
}

// ⚠️ CRITICAL CONSTRAINT: timeframe MUST be < chart resolution
// ✅ Valid:   { chart: '1D', timeframe: '1' }   // 1min < 1day
// ❌ Invalid: { chart: '1D', timeframe: 'W' }   // 1week > 1day
```

#### Usage

```typescript
// After create_series, request CVD study
send({
  m: "create_study",
  p: [
    "cs_ABC123",              // Chart session
    "cvd_1",                  // Study ID
    "s1",                     // Turnaround ID
    "sds_1",                  // Series ID
    "Script",                 // Study type
    "STD;Cumulative%1Volume%1Delta",  // Pine ID
    {
      text: "bmI9Ks46_...",   // Encrypted Pine script (fetch from HTML)
      pineId: "STD;Cumulative%1Volume%1Delta",
      pineVersion: "7.0",
      inputs: {
        anchorPeriod: "3M",
        timeframe: "1"
      }
    }
  ]
});

// Response (200-500ms later): CVD data in 'du' message
// indicators.cvd.st = [ [timestamp, cvdValue], ... ]
```

#### Fetching CVD Config

```typescript
// CVD config must be fetched dynamically (not hardcoded)
const response = await fetch('https://www.tradingview.com/chart/', {
  headers: {
    'Cookie': `sessionid=${sessionId}; sessionid_sign=${sessionIdSign}`
  }
});

const html = await response.text();

// Parse encrypted Pine script (starts with 'bmI9Ks46_', ~17KB)
const encryptedPattern = /bmI9Ks46_[A-Za-z0-9+/=_]{1000,}/g;
const matches = html.match(encryptedPattern);
const cvdScript = matches.sort((a, b) => b.length - a.length)[0];  // Longest match

// Extract version
const versionMatch = html.match(/v\.(\d+\.\d+)/);
const pineVersion = versionMatch[1];  // e.g., "7.0"

// Cache for 24 hours (script rarely changes)
```

### Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| WebSocket connect | 300-500ms | Network dependent |
| Auth + sessions | ~0ms | No server response |
| Resolve symbol | 1-2ms | Cached on server |
| Create series (300 bars) | 3-5s | Data generation |
| Modify series | 3-5s | Same as create |
| CVD indicator | 1-3s | Server calculation |
| Heartbeat echo | <1ms | Critical path |

### Error Handling

```typescript
// Symbol error
{
  m: "symbol_error",
  p: ["cs_ABC123", "NSE:INVALID", "Symbol not found"]
}
// Action: Return empty result, DO NOT hang

// Protocol error
{
  m: "protocol_error",
  p: ["Invalid auth token"]
}
// Action: Close connection, cleanup resources, DO NOT retry with same token
```

### Best Practices

✅ **DO:**
- Echo heartbeats immediately (critical for connection stability)
- Use event-driven data waiting (not fixed timeouts)
- Refresh connections after 20 requests (prevents staleness)
- Reuse connections via `modify_series` (90% faster)
- Handle `symbol_error` gracefully

❌ **DON'T:**
- Send parallel requests on same connection (data will mix)
- Use fixed sleeps instead of event waiting
- Keep connections alive indefinitely (degrades over time)
- Ignore `protocol_error` (won't self-resolve)

---

## MIO (MarketInOut) API

### Base URL

```
https://www.marketinout.com/
```

### Authentication

```typescript
// Use session cookies (captured via browser extension)
headers: {
  'Cookie': `PHPSESSID=${phpSessionId}`
}
```

### Symbol Format

```typescript
// ⚠️ CRITICAL: MIO requires exchange suffix
'RELIANCE.NS'  // ✅ Correct (NSE)
'RELIANCE.BO'  // ✅ Correct (BSE)
'RELIANCE'     // ❌ Wrong (silently rejected)

// Conversion
NSE:RELIANCE → RELIANCE.NS
BSE:RELIANCE → RELIANCE.BO
```

### Watchlist Operations

#### Fetch Watchlists

```typescript
const response = await fetch('https://www.marketinout.com/watchlist.php', {
  headers: { Cookie: `PHPSESSID=${sessionId}` }
});

const html = await response.text();

// Parse HTML for watchlist entries
// Format: <option value="123">Daily Setup</option>
```

#### Add Stock to Watchlist

```typescript
const response = await fetch('https://www.marketinout.com/watchlist_add.php', {
  method: 'POST',
  headers: {
    'Cookie': `PHPSESSID=${sessionId}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    watchlist_id: '123',
    symbol: 'RELIANCE.NS'
  })
});

// ⚠️ HTTP 200 ≠ Success
// Must validate response HTML/JSON for actual result
const data = await response.json();
if (!data.result.success) {
  throw new Error(data.result.error.message);
}
```

---

---

## Rate Limiting

### TradingView

- **Connections per JWT:** ~10-20 (exact limit unknown)
- **Requests per connection:** Refresh after 20 (performance degrades)
- **Heartbeat timeout:** 30s (connection closed if no echo)

### MIO

- **Unknown:** No documented limits
- **Best practice:** Reasonable delays between requests

---

## Error Codes

### TradingView

| Code | Meaning | Action |
|------|---------|--------|
| `symbol_error` | Invalid/delisted symbol | Return empty, don't hang |
| `protocol_error` | Auth/rate limit | Close connection, don't retry |
| Timeout | No response within window | Retry with exponential backoff |

### MIO

| Status | Meaning | Action |
|--------|---------|--------|
| 200 + success: false | Business logic error | Check error message |
| 401 | Session expired | Re-authenticate |
| 500 | Server error | Retry after delay |

---

---

---

## References

- **TradingView Protocol:** `docs/TRADINGVIEW_WEBSOCKET_PROTOCOL.md` (complete spec)
- **CVD Settings:** `docs/CVD_SETTINGS_GUIDE.md` (comprehensive guide)
- **Known Issues:** `docs/KNOWN_ISSUES.md` (troubleshooting)
