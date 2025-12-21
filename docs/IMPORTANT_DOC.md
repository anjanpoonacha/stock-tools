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

## 👤 User-Scoped Settings Storage (CRITICAL)

**Issue**: Settings must be stored per-user, not globally  
**Pattern**: Reuses session storage pattern with SHA-256 hashed user IDs  
**Implementation**: `src/lib/storage/userIdentity.ts` + `src/app/api/kv/settings/route.ts`

```typescript
// Key format: settings:user_{hash32}
const userId = await generateUserId(userEmail, userPassword);
const key = `settings:${userId}`;  // e.g., settings:user_a1b2c3d4...

// Each user gets isolated settings in KV
await kv.set(key, userSettings);
```

**Auto-Migration**: First load tries global key `mio-tv:all-settings-v2`, then saves to user key  
**Privacy**: Email/password never stored, only SHA-256 hash used in keys

---

---

## 🔥 MIO Response Validation (CRITICAL)

**Issue**: Response parser returned hardcoded `success: true` without validating HTML - caused false positives  
**Root Cause**: Parser ignored HTML response, stocks appeared "added" but weren't in MIO watchlist  
**Fix Location**: `src/lib/mio/apiClient.ts` - use `ResponseParser.parseAddAllResponse()`

**Pattern to Follow:**
```typescript
// ❌ WRONG - Only checks HTTP status
if (!res.ok) throw Error(res.status)
return { success: true }  // Assumes success

// ✅ RIGHT - Validates business logic result
if (!res.ok) throw Error(res.status)
const data = await res.json()
if (!data.result.success) throw Error(data.result.error.message)
```

**Remember:** HTTP 200 ≠ Operation Success. Always validate `result.success` field.

---

## 🔤 MIO Symbol Format (CRITICAL)

**Issue**: MIO silently rejects symbols without exchange suffix  
**Required Format**: `SYMBOL.EXCHANGE` (e.g., `TCS.NS`, `RELIANCE.NS`)  
**Auto-conversion**: Use `normalizeSymbol(symbol, 'mio')` to add .NS/.BO automatically

```typescript
// ❌ WRONG
await addStock('BELRISE')  // Rejected by MIO

// ✅ RIGHT
await addStock('BELRISE.NS')  // Accepted
```

**Exchange Mappings:**
- NSE → `.NS`
- BSE → `.BO`
- TradingView → `NSE:SYMBOL` converts to `SYMBOL.NS`

---

## ⚛️ React Refs + Chart Sync Pattern

**Issue**: Refs update but components don't re-render → hooks receive stale values  
**Root Cause**: `chartRefs.current[0] = chart` doesn't trigger React re-renders  
**Solution**: Callback Ref Pattern + Version Counter

```typescript
const [syncVersion, setSyncVersion] = useState(0)
const handleChartReady = (chart, idx) => {
  chartRefs.current[idx] = chart
  setSyncVersion(v => v + 1)  // ✅ Force re-render
}

// Hook receives fresh ref values on every version increment
useCrossChartSync({
  chart1: chartRefs.current[0],
  chart2: chartRefs.current[1],
  enabled: syncVersion > 0  // Only enable after charts loaded
})
```

**Pattern:** Refs (no re-renders) + State counter (trigger updates) = Best of both worlds

---

## 🎨 Chart Zoom Flicker Fix

**Issue**: Zoom level flashes to max zoom out then back to correct level  
**Root Cause**: `fitContent()` called before zoom applied  
**Fix**: Apply zoom synchronously during chart creation

```typescript
// ❌ WRONG - Causes flicker
chartRef.current = chart
chart.timeScale().fitContent()  // Flash of zoom out
// Later effect applies zoom

// ✅ RIGHT - No flicker
chartRef.current = chart
if (bars.length > 0) {
  applyZoom(chart.timeScale(), zoomLevel, bars)  // Immediate
} else {
  chart.timeScale().fitContent()
}
```

**Panel Resize:** Remove `fitContent()` from resize handler - Lightweight Charts maintains zoom automatically

---

## 📐 Panel Layout Orientation Collision

**Issue**: Horizontal and vertical layouts shared same localStorage key → wrong sizes when switching  
**Fix**: Orientation-specific IDs

```typescript
// ❌ WRONG
<PanelGroup id="dual-chart" />  // Same for both orientations

// ✅ RIGHT
<PanelGroup id={`dual-chart-${layoutMode}`} />
// → dual-chart-horizontal
// → dual-chart-vertical
```

**Force Resize Detection:**
```typescript
setTimeout(() => window.dispatchEvent(new Event('resize')), 100)
```

---

## ⌨️ Keyboard Shortcuts - Modifier Key Order

**Issue**: Alt+W handler was AFTER early return on modifier key detection  
**Fix**: Check specific shortcut BEFORE generic modifier block

**Mac Compatibility:**
```typescript
// ❌ WRONG - Mac Option+W produces '∑' special char
event.key === 'w'

// ✅ RIGHT - Physical key works cross-platform
event.code === 'KeyW'
```

---

## 💾 SWR Cache Key Stability (PREVENTS CACHE THRASHING)

**Issue**: Objects/inline arrays break cache (referential equality)

```typescript
// ❌ WRONG - Re-fetches every render
useSWR({ symbol, resolution }, fetcher)
useSWR([symbol, { cvdEnabled }], fetcher)  // Object in array

// ✅ RIGHT - Stable array keys
useSWR(['chart', symbol, resolution, cvdEnabled], fetcher)
const key = useMemo(() => [...], deps)  // Or stabilize with useMemo
```

---

## 🔄 SWR Conditional Fetching

```typescript
// ❌ WRONG - Empty array is truthy, fetch still happens
useSWR(condition ? ['key'] : [], fetcher)

// ✅ RIGHT - null prevents fetch
useSWR(condition ? ['key', id] : null, fetcher)
```

---

## 🌐 SWR Fetcher Error Handling

```typescript
// ❌ WRONG - SWR thinks success
const fetcher = async (url) => {
  const res = await fetch(url)
  if (!res.ok) return { error: res.status }
  return res.json()
}

// ✅ RIGHT - SWR catches errors
const fetcher = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
```

---

## ⏱️ SWR Deduplication Intervals (By Resource Type)

Different resources need different deduplication windows:

```typescript
// Chart data - stable, changes rarely
{ dedupingInterval: 60000 }  // 1 minute

// Formulas - infrequent changes
{ dedupingInterval: 2000 }   // 2 seconds

// Watchlists - moderate updates
{ dedupingInterval: 5000 }   // 5 seconds

// Settings - debounced mutations
{ dedupingInterval: 2000 }   // 2 seconds
```

**Chart-specific:**
- Use `keepPreviousData: true` for smooth symbol transitions (no flash)
- Use `revalidateOnFocus: false` (charts don't need focus refresh)
- Separate cache keys for CVD enabled vs disabled

---

## 🔐 User-Scoped Settings Storage

**Pattern**: SHA-256(email + password) for per-user isolation  
**Key Format**: `settings:user_{hash32}`  
**Privacy**: Email/password never stored, only hash used in keys  
**Auto-Migration**: First load tries global key, then saves to user key

---

## 🚀 WebSocket Connection Pooling

**Architecture**: Server-side singleton with reference counting  
**Cleanup**: After 5min idle, NOT per-request  
**Performance**: 40-60% faster (no 3-5s handshake per request)

```typescript
acquire() → refCount++
release() → refCount-- → setTimeout(cleanup, 5min) if zero
```

---

## 📝 Note

**This is a LEAN document** - only critical production issues/quirks that cause bugs.  
Implementation details → separate docs. Keep focused on GOTCHAS and WHY decisions were made.

**For detailed consolidation**: See `docs/.consolidation-review/CONSOLIDATED.md`
