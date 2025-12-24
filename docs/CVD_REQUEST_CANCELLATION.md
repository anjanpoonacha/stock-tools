# CVD Request Cancellation Protocol

**Problem:** CVD data times out on slow internet, and switching stocks can cause stale data issues.

---

## TradingView Protocol Behavior

**Key Characteristics:**

1. **No Native Cancellation:** TradingView WebSocket protocol doesn't support request cancellation
2. **Response Tracking:** Must track requests by turnaround ID to filter old responses
3. **CVD Timing:** CVD requests (`create_study`) take 1-3 seconds (300 bars) to 5-10 seconds (2000 bars)
4. **Timeout Strategy:** Adaptive timeouts based on bar count and network speed

---

## Timeout Guidelines

### Recommended Timeouts by Operation

| Operation | Base Timeout | Notes |
|-----------|--------------|-------|
| `resolve_symbol` | 5s | Symbol lookup (usually <1s) |
| `create_series` | 15s | OHLCV data (3-5s typical) |
| `modify_series` | 15s | Same as create_series |
| `create_study` (CVD) | 30-60s | Scales with bar count |

### CVD Adaptive Timeout Formula

```
timeout = MIN(60000ms, 2000ms + MAX(0, (barsCount - 300) / 500 * 1000))

Examples:
  300 bars: 2s
 1000 bars: 3.4s
 2000 bars: 5s (capped at 60s max)
```

---

## Handling Slow Connections

### Network Speed Detection

Measure first request to calibrate timeouts:

```
firstRequestDuration < 5s  → Fast network (use base timeouts)
firstRequestDuration 5-20s → Normal network (use base timeouts)
firstRequestDuration > 20s → Slow network (increase CVD timeout to 60s)
```

### Symbol Switch Behavior

**Without Cancellation (Problem):**
```
User views RELIANCE (CVD loading, 25s elapsed)
User switches to TCS
  → Wait for RELIANCE CVD timeout (30s) before TCS loads
  → Total delay: 30s before TCS starts
```

**With Request Tracking (Solution):**
```
User views RELIANCE (CVD loading, 25s elapsed)
User switches to TCS
  → Track RELIANCE request as "stale"
  → Start TCS immediately
  → Ignore RELIANCE response when it arrives
  → Total delay: 0s (TCS starts immediately)
```

---

## Implementation Requirements

### 1. Turnaround ID Tracking

Track active requests by symbol and turnaround ID:

```typescript
interface ActiveRequest {
  symbolId: string;          // e.g., "NSE:RELIANCE"
  turnaroundId: string;      // e.g., "s1", "s2", "cvd_1"
  type: 'create_study' | 'create_series' | 'modify_series';
  startTime: number;         // timestamp
  timeout: number;           // ms
}
```

### 2. Response Filtering

When WebSocket message arrives, check if request is still active:

```
1. Parse turnaround ID from message (e.g., "s1")
2. Check if request is in activeRequests map
3. If found: process response
4. If not found: ignore (symbol switched or timeout)
```

### 3. Symbol Switch Handling

When user switches symbols:

```
1. Mark all old symbol requests as "stale"
2. Remove from activeRequests map
3. Start new symbol requests immediately
4. Old symbol responses will be ignored (not in map)
```

---

## Error Scenarios

### Scenario 1: CVD Timeout on Slow Connection

**Behavior:**
- CVD request started at t=0s
- Network slow, CVD data arrives at t=35s
- Timeout set to 30s
- Request marked as failed at t=30s
- Response at t=35s is ignored (request already removed)

**User Experience:**
- Chart shows OHLCV data (available at t=5s)
- CVD indicator shows error state
- User can retry with longer timeout

### Scenario 2: Symbol Switch During CVD Load

**Behavior:**
- RELIANCE CVD request started at t=0s
- User switches to TCS at t=20s
- RELIANCE request marked as stale, removed from activeRequests
- TCS requests start immediately at t=20s
- RELIANCE CVD arrives at t=25s → ignored (not in activeRequests)
- TCS data arrives at t=25s → processed (active request)

**User Experience:**
- No delay switching symbols
- No stale RELIANCE data shown on TCS chart
- Clean separation between symbol data

---

## Best Practices

### ✅ DO
- Use adaptive timeouts based on bar count
- Track requests by (symbol, turnaround ID)
- Filter responses using activeRequests map
- Ignore responses for stale/cancelled requests
- Provide clear error messages for timeouts

### ❌ DON'T
- Use fixed timeouts for all requests
- Mix data from different symbols
- Block new requests waiting for old timeouts
- Attempt protocol-level cancellation (not supported)
