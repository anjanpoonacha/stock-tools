# Pane Separation Fix - Lightweight Charts v5

## Problem

CVD and Volume indicators were not appearing in separate panes. All series (price, SMA, volume, CVD) were rendering in a single pane, making the chart cluttered and difficult to read.

## Root Cause

The implementation was using the correct lightweight-charts v5 API (`addSeries` with `paneIndex` parameter), but **panes were not visually separating** due to missing explicit pane height configuration.

## Solution

### 1. Use `moveToPane()` API

Instead of passing `paneIndex` as the third parameter to `addSeries()`, use the `moveToPane()` method on the series instance:

```typescript
// ❌ Old approach (works but less explicit)
const volumeSeries = chart.addSeries(HistogramSeries, {
  priceFormat: { type: 'volume' },
}, 1);

// ✅ New approach (more reliable)
const volumeSeries = chart.addSeries(HistogramSeries, {
  priceFormat: { type: 'volume' },
});
volumeSeries.moveToPane(1); // Explicitly move to pane 1
```

### 2. Set Explicit Pane Heights

After creating panes, **explicitly set their heights** using the Pane API:

```typescript
// Set volume pane height (pane 1)
const panes = chart.panes();
if (panes[1]) {
  panes[1].setHeight(100); // 100px for volume
}

// Set CVD pane height (pane 2)
if (panes[2]) {
  panes[2].setHeight(120); // 120px for CVD
}
```

**Why this matters:**
- Default pane sizing may not allocate enough space for indicators
- Explicit heights ensure visual separation is obvious
- Minimum pane height is 30px (enforced by library)

### 3. Complete Implementation

```typescript
// Pane 0: Main price chart (candlesticks + SMA) - created by default
const candlestickSeries = chart.addSeries(CandlestickSeries, {
  upColor: '#26a69a',
  downColor: '#ef5350',
});
candlestickSeries.setData(priceData);

// Pane 1: Volume histogram
const volumeSeries = chart.addSeries(HistogramSeries, {
  priceFormat: { type: 'volume' },
});
volumeSeries.setData(volumeData);
volumeSeries.moveToPane(1); // Move to pane 1

// Set volume pane height
const panes = chart.panes();
if (panes[1]) {
  panes[1].setHeight(100);
}

// Pane 2: CVD candlesticks
const cvdSeries = chart.addSeries(CandlestickSeries, {
  upColor: '#26a69a',
  downColor: '#ef5350',
});
cvdSeries.setData(cvdData);
cvdSeries.moveToPane(2); // Move to pane 2

// Set CVD pane height
if (panes[2]) {
  panes[2].setHeight(120);
}
```

## Result

Now the chart correctly displays three visually distinct panes:

```
┌─────────────────────────────────────────────┐
│  Pane 0: Price (dynamic height)             │
│  Price candlesticks + SMA overlay           │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│  Pane 1: Volume (100px)                     │
│  Volume histogram bars                      │
├─────────────────────────────────────────────┤
│  Pane 2: CVD (120px)                        │
│  CVD candlestick chart                      │
└─────────────────────────────────────────────┘
```

## Key Learnings

### 1. Pane API Behavior

- **Pane 0** always exists (main pane)
- Calling `moveToPane(n)` creates pane `n` if it doesn't exist
- Panes share synchronized time scale
- Empty panes are automatically removed

### 2. Height Management

- Default pane sizing may not provide enough visual separation
- Always set explicit heights for indicator panes
- Main pane (0) takes remaining space automatically
- Users can manually resize panes by dragging separators

### 3. Rendering Order

1. Create all series first
2. Set their data
3. Move to appropriate panes
4. Set pane heights last

This order ensures panes exist before trying to configure them.

## Testing

To verify panes are working correctly:

1. Check `chart.panes().length` - should be 3 (with volume + CVD)
2. Inspect each pane's height: `chart.panes()[1].getHeight()`
3. Visually confirm separators appear between panes
4. Test dragging pane separators to resize

## Files Modified

- `src/components/TradingViewLiveChart.tsx` - Updated pane creation logic
- `docs/CHART_INTEGRATION_COMPLETE.md` - Updated chart layout diagram

## References

- [Lightweight Charts v5 Panes Tutorial](https://tradingview.github.io/lightweight-charts/tutorials/how_to/panes)
- [Pane API Documentation](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/IPaneApi)
- [ISeriesApi.moveToPane()](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/ISeriesApi#movetopane)

---

**Status**: ✅ **FIXED** (December 17, 2025)

**Impact**: CVD and Volume now display in properly separated, resizable panes with appropriate heights.
