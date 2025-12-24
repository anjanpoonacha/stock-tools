# Symbol Normalization Fix

## Problem
When viewing stocks from MIO watchlists, the chart fails to load with error:
```
Failed to fetch chart data: Symbol error for "sds_sym_4": invalid symbol
Symbol: WIPRO.NS
Resolution: 1D
```

**Root Cause**: 
- MIO symbols use format: `SYMBOL.EXCHANGE` (e.g., `WIPRO.NS`, `TCS.NS`)
- TradingView expects format: `EXCHANGE:SYMBOL` (e.g., `NSE:WIPRO`, `NSE:TCS`)
- The chart component was trying to fetch data with MIO format directly

## Solution Implemented

### 1. Existing Normalization Utility (Already Present)

The project already has a comprehensive symbol normalization utility at:
- **File**: `src/lib/utils/exchangeMapper.ts`

**Key Functions**:
- `mioToTv(symbol: string)` - Convert MIO format to TradingView format
- `tvToMio(symbol: string)` - Convert TradingView format to MIO format
- `normalizeSymbol(symbol: string, format: 'tv' | 'mio')` - Universal normalization

**Exchange Mappings**:
```typescript
NSE (National Stock Exchange):
  MIO: .NS suffix (e.g., WIPRO.NS)
  TV: NSE: prefix (e.g., NSE:WIPRO)

BSE (Bombay Stock Exchange):
  MIO: .BO suffix (e.g., TCS.BO)
  TV: BSE: prefix (e.g., BSE:TCS)
```

### 2. Applied Normalization in Two Key Locations

#### A. WatchlistStocksView Component
**File**: `src/app/stocks/components/WatchlistStocksView.tsx`

**Changes**:
1. Added import: `import { mioToTv } from '@/lib/utils/exchangeMapper';`
2. Updated symbol conversion logic (lines 50-66):

```typescript
// Before:
return selectedWatchlist.symbols.map(symbol => ({
  symbol,
  name: symbol,
  sector: 'Watchlist',
  industry: 'N/A',
}));

// After:
return selectedWatchlist.symbols.map(symbol => {
  // Normalize MIO format (WIPRO.NS) to TradingView format (NSE:WIPRO)
  const tvSymbol = mioToTv(symbol);
  
  return {
    symbol: tvSymbol,
    name: symbol, // Keep original for display
    sector: 'Watchlist',
    industry: 'N/A',
  };
});
```

**Impact**: When watchlist already has symbols (TradingView watchlists), they are normalized before being passed to charts.

#### B. useWatchlistStocks Hook
**File**: `src/hooks/useWatchlistStocks.ts`

**Changes**:
1. Added import: `import { mioToTv } from '@/lib/utils/exchangeMapper';`
2. Updated `fetchWatchlistStocks` function to normalize per-platform (lines 40-85):

```typescript
// Before:
const results = await Promise.all(promises);
const allSymbols = results.flat();
const uniqueSymbols = Array.from(new Set(allSymbols));

// After:
const results = await Promise.all(promises);

// Flatten symbols and normalize to TradingView format
const normalizedSymbols: string[] = [];

for (const { symbols, platform } of results) {
  for (const symbol of symbols) {
    // MIO symbols need conversion (WIPRO.NS -> NSE:WIPRO)
    // TradingView symbols are already in correct format (NSE:WIPRO)
    const tvSymbol = platform === 'mio' ? mioToTv(symbol) : symbol;
    normalizedSymbols.push(tvSymbol);
  }
}

// Deduplicate symbols
const uniqueSymbols = Array.from(new Set(normalizedSymbols));
```

**Impact**: When fetching symbols from MIO watchlists via API, they are normalized before being returned to components.

### 3. Test Coverage

Created comprehensive test suite:
**File**: `scripts/test-symbol-normalization.ts`

**Test Results**: ✅ All 21 tests passed

```bash
=== Summary ===
✅ Passed: 21
❌ Failed: 0
📊 Total:  21
🎉 All tests passed!
```

**Test Categories**:
1. MIO to TradingView conversion (8 tests)
2. TradingView to MIO conversion (3 tests)
3. Format validation (6 tests)
4. Normalize symbol function (4 tests)

## Files Modified

1. `src/app/stocks/components/WatchlistStocksView.tsx`
   - Added `mioToTv` import
   - Updated symbol mapping logic

2. `src/hooks/useWatchlistStocks.ts`
   - Added `mioToTv` import
   - Updated `fetchWatchlistStocks` to normalize per-platform

3. `scripts/test-symbol-normalization.ts` (NEW)
   - Comprehensive test suite for symbol normalization

4. `SYMBOL_NORMALIZATION_FIX.md` (THIS FILE)
   - Documentation of the fix

## Verification

### Manual Testing Steps

1. **Create or select a MIO watchlist** with Indian stocks (e.g., WIPRO.NS, TCS.NS)
2. **Open the watchlist** in the stocks view
3. **Switch to Chart View**
4. **Verify**:
   - Charts load successfully
   - No "invalid symbol" errors
   - Symbol display shows clean format (NSE:WIPRO)

### Automated Testing

Run the test script:
```bash
tsx scripts/test-symbol-normalization.ts
```

Expected output: All tests pass

## Expected Behavior After Fix

1. ✅ MIO symbols (`WIPRO.NS`) are converted to TradingView format (`NSE:WIPRO`)
2. ✅ Charts load successfully for MIO watchlist stocks
3. ✅ No "invalid symbol" errors
4. ✅ Both MIO and TradingView watchlists work correctly
5. ✅ Symbol display remains user-friendly

## Technical Details

### Symbol Flow

```
MIO Watchlist API
    ↓
Returns: ["WIPRO.NS", "TCS.NS", "INFY.NS"]
    ↓
useWatchlistStocks Hook
    ↓ (applies mioToTv)
Returns: ["NSE:WIPRO", "NSE:TCS", "NSE:INFY"]
    ↓
WatchlistStocksView Component
    ↓
ChartView Component
    ↓
TradingViewLiveChart Component
    ↓
useChartData Hook
    ↓
/api/chart-data Endpoint
    ↓ (expects TradingView format)
TradingView API ✅
```

### Why This Approach

1. **DRY Principle**: Reuses existing `exchangeMapper.ts` utility
2. **Consistency**: Normalizes at data layer (hooks), not at render layer
3. **Performance**: Single normalization per symbol, cached by SWR
4. **Maintainability**: Centralized mapping configuration
5. **Type Safety**: TypeScript types ensure correct usage

## Edge Cases Handled

1. ✅ Symbols without exchange (defaults to NSE)
2. ✅ Already normalized symbols (no double-conversion)
3. ✅ Mixed MIO/TradingView watchlists (unified format)
4. ✅ Unknown exchange codes (defaults to NSE)
5. ✅ Case sensitivity (normalized to uppercase)

## No Breaking Changes

- Existing TradingView watchlists continue to work
- Formula results (already in TV format) unaffected
- Chart settings and preferences preserved
- No database migration required

## References

- Exchange Mapper: `src/lib/utils/exchangeMapper.ts`
- Chart Data API: `src/app/api/chart-data/route.ts`
- Watchlist Service: `src/lib/watchlist-sync/unifiedWatchlistService.ts`
