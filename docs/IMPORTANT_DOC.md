# Important Documentation - Critical Issues & Quirks

## 📐 CVD Timeframe Format (CRITICAL)

**Issue**: CVD custom periods use TradingView-specific format, NOT standard notation  
**Root Cause**: TradingView API requires specific uppercase/lowercase and suffix rules  
**Fix Location**: `src/lib/chart/constants.ts`, `src/components/chart/indicators/CVDSettings.tsx`

```typescript
// ✅ CORRECT FORMAT
'15S'   // Seconds: Uppercase S
'30S'   // Seconds: Uppercase S
'1'     // Minutes: Number only (NO suffix)
'5'     // Minutes: Number only
'60'    // 1 hour = 60 minutes (NO 'h' suffix)
'1D'    // Days: Uppercase D
'1W'    // Weeks: Uppercase W
'3M'    // Months: Uppercase M
'1Y'    // Years: Uppercase Y

// ❌ WRONG FORMAT
'15s'   // Should be '15S' (uppercase)
'5m'    // Should be '5' (no suffix for minutes)
'1h'    // Should be '60' (hours not supported)
'1d'    // Should be '1D' (uppercase)
```

**Reference**: 
- API: `src/app/api/chart-data/route.ts:26`
- Types: `src/lib/tradingview/types.ts:136`
- Full spec: `docs/CVD_TIMEFRAME_FORMAT.md`

---

## 🔥 TradingView WebSocket Heartbeat (CRITICAL)

**Issue**: WebSocket connections become "stale" after ~11-12 requests  
**Root Cause**: TradingView sends `~h~N` heartbeat every 10s, must echo back or server drops connection  
**Fix Location**: `src/lib/tradingview/protocol.ts` + `src/lib/tradingview/baseWebSocketClient.ts`

```typescript
// Detect: ~m~4~m~~h~N
// Must echo back immediately or connection dies
if (heartbeats.length > 0) {
  this.ws.send(heartbeat); // CRITICAL: Echo back
}
```

---

## ⏱️ CVD Timeout Calculation (QUIRK)

**Issue**: CVD timeout must scale with bar count (300 bars = 2s, 2000 bars = 5s)  
**Root Cause**: Use `barsCount` param (requested), NOT `this.bars.length` (=0 at call time)  
**Fix Location**: `src/lib/tradingview/baseWebSocketClient.ts:waitForData()`

```typescript
// WRONG: this.bars.length is 0 when waitForData() called!
const timeout = 2000 + (this.bars.length - 300) / 500 * 1000; // ❌

// RIGHT: Use barsCount parameter (requested bars)
const timeout = Math.min(5000, 2000 + Math.max(0, (barsCount - 300) / 500 * 1000)); // ✅
```

---

## 📊 Bar Count Validation (HACK)

**Issue**: Frontend sends 1000-2000 bars, validator hardcoded to 300 max  
**Fix Location**: `src/lib/chart-data/validators.ts:62`

```typescript
// Changed: 300 → 2000
barsCount: z.number().min(1).max(2000) // Increased limit
```

---

## 🔄 Persistent WebSocket Connections

**Architecture**: Server-side singleton pool with reference counting  
**Quirk**: Cleanup after 5min idle, NOT per-request  
**File**: `src/lib/tradingview/PersistentConnectionManager.ts`

```typescript
// Reference counting prevents premature cleanup
acquire() → refCount++  
release() → refCount-- → setTimeout(cleanup, 5min) if zero
```

**Why**: 40-60% faster (no 3-5s connection handshake per request)

---

## 📐 Lightweight Charts Pane Separation

**Issue**: Volume/CVD overlaying price chart instead of separate panes  
**Root Cause**: v5 API changed, must use `chart.moveToPane(paneIndex)`  
**Fix Location**: `src/components/ReusableChart.tsx`

```typescript
// CRITICAL: Must move to pane AFTER creating series
const volumeSeries = chart.addHistogramSeries();
chart.moveToPane(volumeSeries, 1); // Move to pane 1 (below price)
```

---

## 🔐 Auth Context isLoading Race Condition

**Issue**: `isLoading` shows misleading "not authenticated" errors during 5s check  
**Fix**: Always check `isLoading` before showing auth errors

```tsx
// WRONG: Shows error during loading
{!isAuthenticated && <AuthError />} // ❌

// RIGHT: Wait for loading to finish
{isLoading ? <Loader /> : !isAuthenticated && <AuthError />} // ✅
```

**Files**: All `AuthGuard`, `LoginForm`, page components using `useAuth()`

---

## 📝 Note

**This is a LEAN document** - only critical production issues/quirks that cause bugs.  
Implementation details → separate docs. Keep this under 150 lines.
