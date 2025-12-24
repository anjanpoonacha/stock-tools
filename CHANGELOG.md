# Changelog

All notable changes, features, and fixes completed in this project.

---

## December 24, 2025

### 🧹 Root Folder Documentation Cleanup (Phase 2)

**Action:** Final cleanup of root MD files - external API docs only

**Deleted Files (1):**
- CLAUDE.md - Duplicate development instructions (content already in AGENTS.md)

**Updated Files (3):**
- README.md - Simplified to project overview with external API references only
- CVD_QUICK_REFERENCE.md - Removed references to deleted internal docs
- CHANGELOG.md - Added this cleanup entry

**Final Root Structure:**
- README.md - Project overview and getting started
- CHANGELOG.md - Project history
- AGENTS.md - Development guidelines
- todo.md - Current tasks
- CVD_QUICK_REFERENCE.md - CVD API quick reference

**Rationale:**
- Root folder now contains only essential project management files
- External API documentation centralized in docs/ folder
- Internal architecture/implementation docs removed
- Clean separation: root = project management, docs/ = external APIs

---

### 🧹 Documentation Cleanup (Phase 1)

**Action:** Cleaned up root folder MD files

**Deleted Files (13):**
- Historical completion reports: CVD_INTEGRATION_COMPLETE.md, WATCHLIST_INTEGRATION_COMPLETE.md, TEST_FRAMEWORK_REFACTOR_COMPLETE.md
- Bug fix reports: CVD_TIMESTAMP_BUG_REPORT.md, CVD_TIMESTAMP_FIX.md, FIX_REPORT.md, PANEL_RESIZE_FIX.md
- Internal docs: CVD_CHANGES_LIST.md, CVD_FIX_CUSTOM_TIMEFRAMES.md, CVD_TEST_RESULTS_SUMMARY.md, TEST_RESULT_REPORT.md, TEST_VALIDATION_REPORT.md

**Rationale:**
- Historical completion reports → Info consolidated in CHANGELOG
- Bug fix reports → Fixes are in code, history in CHANGELOG
- Internal documentation → Already cleaned from docs/ folder

---

### 🎉 TradingView WebSocket System in Production

**Status:** ✅ Production system (V1 removed)

**Changes:**
- Production WebSocket connection manager with pooling
- Optimized `chartDataService.ts` for parallel execution
- Fixed dual layout CVD hang (now parallel execution)
- CVD timeout configurable (45s default, tested)
- Integration tests passing (6/6)

**Performance:**
- Dual layout: 2.7s → 0.97s (3x faster!)
- No more blocking on CVD requests
- Reliable symbol switching with automatic request cancellation

**Files:**
- `src/lib/tradingview/v2/WebSocketConnectionManager.ts`
- `src/lib/chart-data/chartDataService.ts`

---

### 🐛 Race Condition Fix - Symbol Switching

**Issue:** Switching symbols caused subsequent requests to timeout

**Root Cause:** `pendingSymbolData` cleared by previous request's finally block

**Fix:** Added ownership checks before cleanup

**Impact:** Symbol switching now reliable

**Files:**
- `src/lib/tradingview/v2/WebSocketConnection.ts`

---

## December 23, 2025

### 🎉 CVD Integration Complete

**Achievement:** 100% type-safe CVD with comprehensive validation

**Components:**
1. **Type System** (`cvdTypes.ts`)
   - Strict TypeScript types
   - Compile-time validation
   - IDE autocomplete

2. **Validation** (`cvdValidation.ts`)
   - Runtime validation at API level
   - Dynamic UI filtering
   - Clear error messages

3. **Documentation** (`CVD_SETTINGS_GUIDE.md`)
   - 240 combinations tested (100% success)
   - Comprehensive user guide
   - Troubleshooting section

**Critical Constraint Enforced:**
- Delta timeframe MUST be < chart resolution
- Validated at type, API, and UI levels

**Files Changed:**
- New: `src/lib/tradingview/cvdTypes.ts`
- New: `src/lib/tradingview/cvdValidation.ts`
- New: `docs/CVD_SETTINGS_GUIDE.md`
- Modified: `src/app/api/chart-data/route.ts`
- Modified: `src/types/chartIndicators.ts`
- Modified: `src/components/chart/indicators/CVDSettings.tsx`
- Modified: `src/lib/chart/constants.ts`
- Modified: `src/hooks/useChartData.ts`

---

### ⚡ CVD Config Caching

**Problem:** 650ms overhead fetching ~400KB HTML on every CVD request

**Solution:** 24-hour cache for CVD Pine script config

**Configuration:**
```bash
ENABLE_CVD_CONFIG_CACHE=true  # Default enabled
CVD_CONFIG_CACHE_TTL=86400    # 24 hours
```

**Impact:** 92% faster (650ms → 50ms)

**Files:**
- Modified: `src/lib/tradingview/cvdConfigService.ts`

---

## December 20, 2025

### 🎯 Watchlist Integration Feature

**Feature:** Keyboard-driven watchlist management

**Capabilities:**
- Press `;` to search watchlists
- Press `Alt+W` (Option+W on Mac) for quick add
- Dual-platform sync (MIO + TradingView)
- Persistent selection (localStorage)

**Architecture:**
- Service layer: `unifiedWatchlistService.ts`
- React hook: `useWatchlistIntegration.ts`
- UI component: `WatchlistSearchDialog.tsx`
- Config: `keybindings.json`

**Files Created:**
- `src/lib/watchlist-sync/types.ts`
- `src/lib/watchlist-sync/unifiedWatchlistService.ts`
- `src/lib/watchlist-sync/index.ts`
- `src/hooks/useWatchlistIntegration.ts`
- `src/components/chart/WatchlistSearchDialog.tsx`
- `src/config/keybindings.json`

**Files Modified:**
- `src/components/formula/ChartView.tsx`
- `src/hooks/useChartKeybindings.ts`

---

## Earlier Improvements

### 🏗️ Connection Pool Architecture v2

**Achievement:** World-class connection pool with intelligent load balancing

**Features:**
- Adaptive batching (parallel vs batch mode)
- Least-loaded allocation strategy
- Zero-contention execution
- Enhanced observability

**Performance:**
- Dual layout: 45% faster (2.7s → 1.5s)
- Load distribution: 50/50 (was 93/7)
- Parallel execution: 100% (was 0%)

**Files:**
- Modified: `src/lib/tradingview/connectionPool.ts`
- New: `docs/POOL_ARCHITECTURE.md`

---

### 📊 Chart Data Flow Optimization

**Caching Strategy:** Multi-layer with granular controls

**Layers:**
1. **Session/JWT Cache** (5min)
   - Saves 900ms per request
   - 80%+ hit rate
   - Default enabled

2. **CVD Config Cache** (24h)
   - Saves 650ms per CVD request
   - 95%+ hit rate
   - Default enabled

3. **Chart Data Cache** (5min)
   - Saves 2500ms per request
   - 70%+ hit rate
   - Opt-in only (high risk)

**Configuration:**
```bash
ENABLE_SESSION_JWT_CACHE=true       # Default
ENABLE_CVD_CONFIG_CACHE=true        # Default
ENABLE_CHART_DATA_CACHE=false       # Opt-in
```

**Impact:** 96% faster for cache hits (3s → 100ms)

**Files:**
- Modified: `src/lib/cache/cacheConfig.ts`
- Modified: `src/lib/chart-data/chartDataService.ts`
- Modified: `src/app/api/chart-data/route.ts`
- New: `docs/CHART_DATA_FLOW.md`

---

### 🔐 User-Scoped Settings

**Feature:** Per-user settings storage with privacy

**Architecture:**
- SHA-256(email + password) for user ID
- KV key: `settings:user_{hash32}`
- Auto-migration from global settings

**Privacy:**
- Email/password never stored (only hash)
- Each user isolated
- Deterministic hashing

**Files:**
- New: `src/lib/storage/userIdentity.ts`
- New: `src/app/api/kv/settings/route.ts`
- Modified: Settings-related hooks/components

---

### 📐 Lightweight Charts Pane Separation

**Problem:** Volume/CVD overlaying price chart

**Root Cause:** v5 API change

**Fix:** Use `chart.moveToPane(series, paneIndex)` after creation

**Files:**
- Modified: `src/components/ReusableChart.tsx`

---

### ⌨️ Keyboard Shortcuts - Mac Compatibility

**Problem:** Alt+W not working on Mac (produces '∑')

**Fix:** Use `event.code === 'KeyW'` instead of `event.key === 'w'`

**Files:**
- Modified: `src/hooks/useChartKeybindings.ts`

---

### 🔄 React Refs + Chart Sync Pattern

**Problem:** Refs update but components don't re-render

**Solution:** Callback Ref Pattern + Version Counter

```typescript
const [syncVersion, setSyncVersion] = useState(0);
const handleChartReady = (chart, idx) => {
  chartRefs.current[idx] = chart;
  setSyncVersion(v => v + 1);  // Force re-render
};
```

**Files:**
- Modified: Chart components using cross-sync

---

### 🎨 Chart Zoom Flicker Fix

**Problem:** Zoom level flashes to max before correct level

**Solution:** Apply zoom synchronously during chart creation (remove `fitContent()` from timing-sensitive paths)

**Files:**
- Modified: `src/components/ReusableChart.tsx`

---

### 📐 Panel Layout Orientation Fix

**Problem:** Horizontal/vertical layouts sharing same localStorage key

**Solution:** Orientation-specific IDs

```typescript
<PanelGroup id={`dual-chart-${layoutMode}`} />
```

**Files:**
- Modified: Layout components

---

### 🔥 MIO Response Validation

**Problem:** Parser returned hardcoded `success: true` without validating HTML

**Fix:** Validate business logic result, not just HTTP status

```typescript
// Must check data.result.success
if (!data.result.success) {
  throw Error(data.result.error.message);
}
```

**Files:**
- Modified: `src/lib/mio/apiClient.ts`

---

### 🔤 MIO Symbol Format Auto-Conversion

**Problem:** MIO silently rejects symbols without exchange suffix

**Solution:** Auto-convert using `normalizeSymbol(symbol, 'mio')`

**Mapping:**
- NSE → `.NS`
- BSE → `.BO`
- `NSE:SYMBOL` → `SYMBOL.NS`

**Files:**
- New: `src/lib/utils/symbolUtils.ts`
- Modified: MIO API client

---

### 💾 SWR Cache Improvements

**Issues Fixed:**
1. **Cache Thrashing:** Objects/inline arrays break referential equality
   - Solution: Use stable array keys

2. **Conditional Fetching:** Empty array is truthy
   - Solution: Use `null` to prevent fetch

3. **Error Handling:** Returning error object instead of throwing
   - Solution: Throw errors for SWR to catch

4. **Deduplication Intervals:** One size doesn't fit all
   - Solution: Resource-specific intervals (2s-60s)

**Files:**
- Modified: All SWR hooks (`src/hooks/use*.ts`)
- New: `src/config/swr.config.ts`

---

### 🔥 TradingView WebSocket Heartbeat

**Problem:** Connections become stale after ~11-12 requests

**Root Cause:** Not echoing `~h~N` heartbeat messages

**Fix:** Immediate echo of heartbeat frames

```typescript
if (heartbeats.length > 0) {
  this.ws.send(heartbeat);  // Echo back immediately
}
```

**Files:**
- Modified: `src/lib/tradingview/protocol.ts`
- Modified: `src/lib/tradingview/baseWebSocketClient.ts`

---

### ⏱️ CVD Timeout Calculation Fix

**Problem:** Using `this.bars.length` (=0 at call time) instead of `barsCount` param

**Fix:** Use requested bar count for timeout calculation

```typescript
// Scale timeout: 2s base + 1s per 500 bars (max 5s)
const timeout = Math.min(5000, 2000 + Math.max(0, (barsCount - 300) / 500 * 1000));
```

**Files:**
- Modified: `src/lib/tradingview/baseWebSocketClient.ts`

---

### 📊 Bar Count Validation Update

**Problem:** Validator hardcoded to 300 max, frontend sends 1000-2000

**Fix:** Increased limit to 2000

```typescript
barsCount: z.number().min(1).max(2000)  // Was 300
```

**Files:**
- Modified: `src/lib/chart-data/validators.ts`

---

### 🔄 Persistent WebSocket Connections

**Feature:** Server-side singleton pool with reference counting

**Pattern:**
```typescript
acquire() → refCount++  
release() → refCount-- → setTimeout(cleanup, 5min) if zero
```

**Impact:** 40-60% faster (no 3-5s handshake per request)

**Files:**
- New: `src/lib/tradingview/PersistentConnectionManager.ts`

---

## Testing Achievements

### CVD Settings Testing
- **240 combinations tested** (100% success rate)
- All anchor periods validated
- All delta timeframes validated
- Constraint rules confirmed

### WebSocket V2 Testing
- **6/6 integration tests passing**
- Symbol switching validated
- CVD timeout validated
- Connection health validated

### Connection Pool Testing
- Load distribution: 50/50 (optimal)
- Parallel execution: 100%
- Adaptive batching: Working

---

## Documentation Created

### Essential Docs
- `docs/API_REFERENCE.md` - External APIs (TradingView, MIO)
- `docs/ARCHITECTURE.md` - Core systems overview
- `docs/KNOWN_ISSUES.md` - Current issues
- `docs/CVD_SETTINGS_GUIDE.md` - CVD comprehensive guide

### Architecture Docs
- `docs/POOL_ARCHITECTURE.md` - Connection pool design
- `docs/CHART_DATA_FLOW.md` - Data flow & caching
- `docs/TRADINGVIEW_WEBSOCKET_PROTOCOL.md` - Protocol spec

### Completion Reports (Historical)
- `CVD_INTEGRATION_COMPLETE.md` - CVD integration summary
- `V2_MIGRATION_COMPLETE.md` - WebSocket v2 status
- `WATCHLIST_INTEGRATION_COMPLETE.md` - Watchlist feature
- `WEBSOCKET_ARCHITECTURE_STATUS.md` - v1 vs v2 clarification

---

## Performance Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Dual Layout** | 2.7s | 1.5s | 45% faster |
| **CVD Config** | 650ms | 50ms | 92% faster |
| **Chart Data (cached)** | 3s | 100ms | 96% faster |
| **Connection Load** | 93/7 | 50/50 | Balanced |
| **Parallel Execution** | 0% | 100% | ∞ |

---

## Breaking Changes

### CVD Type Changes (Dec 23, 2025)

**Compile-time only:**
- `CVDIndicatorConfig.options.anchorPeriod`: `string` → `CVDAnchorPeriod`
- `CVDIndicatorConfig.options.timeframe`: `string` → `CVDDeltaTimeframe`

**Migration:**
```typescript
// No runtime changes needed
// Just stricter types for safety
const config: CVDIndicatorConfig['options'] = {
  anchorPeriod: '3M',  // Still valid
  timeframe: '1'       // Still valid
};
```

---

## Contributors

- Development Team (parallel agent execution)
- Integration testing
- Performance optimization
- Documentation consolidation

---

**Last Updated:** December 24, 2025
