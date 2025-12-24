# Known Issues

**Last Updated:** December 24, 2025

Current known issues and their workarounds.

---

## Known External API Issues

### Issue #1: CVD Timeout on Slow Connections

**Severity:** MEDIUM  
**Status:** Protocol Limitation  
**Affects:** TradingView WebSocket API  

#### Description

CVD indicator data can take 30-60+ seconds to arrive on slow internet connections, especially for large bar counts (1000+).

#### Root Cause

TradingView server-side CVD calculation time scales with:
- Bar count (300 bars: 2s, 2000 bars: 5-10s)
- Network latency (family WiFi + streaming: +50-100% overhead)
- Server load (peak hours: additional delays)

#### Workaround

Use adaptive timeouts based on bar count and network speed detection:

```
timeout = MIN(60000ms, 2000ms + (barsCount - 300) / 500 * 1000)
```

#### Priority

MEDIUM - User configuration recommended for slow connections

---

### Issue #2: TradingView Symbol Resolution Delays

**Status:** Protocol Limitation  
**Affects:** `resolve_symbol` message  

#### Description

Symbol resolution can occasionally take 1-2 seconds instead of typical <100ms.

#### Root Cause

TradingView server-side caching behavior - fresh lookups take longer.

#### Workaround

Use 5-second timeout with retry logic.

---

---

## References

- **API Reference:** `docs/API_REFERENCE.md`
- **CVD Guide:** `docs/CVD_SETTINGS_GUIDE.md`
- **TradingView Protocol:** `docs/TRADINGVIEW_WEBSOCKET_PROTOCOL.md`
