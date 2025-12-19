# Cross-Timeframe Chart Synchronization

## Overview

This POC demonstrates cursor and scroll/zoom synchronization between two separate charts with different timeframes:
- **Chart 1**: 1D timeframe (Price + Volume + CVD)
- **Chart 2**: 188m timeframe (CVD only)

## Architecture

```
┌──────────────────────────────────────┐
│  Chart 1 (ReusableChart)             │
│  - Resolution: 1D                    │
│  - 3 Panes (auto-synced):            │
│    ├─ Pane 0: Price (Candlesticks)  │
│    ├─ Pane 1: Volume Histogram      │
│    └─ Pane 2: CVD 1D                │
└──────────────────────────────────────┘
              ↕ ↕ ↕
      useCrossChartSync Hook
    (with time mapping 1D ↔ 188m)
              ↕ ↕ ↕
┌──────────────────────────────────────┐
│  Chart 2 (ReusableChart)             │
│  - Resolution: 1D (main bars)        │
│  - CVD Timeframe: 188m               │
│  - 1 Pane:                           │
│    └─ Pane 0: CVD 188m               │
└──────────────────────────────────────┘
```

## Indian Trading Hours

**Trading Day**: 9:15 AM - 3:30 PM IST (375 minutes total)

**Sessions**:
- Morning: 9:15 AM - 12:23 PM (188 minutes)
- Afternoon: 12:23 PM - 3:30 PM (187 minutes)

**Result**: 1 trading day = 2 bars in 188m timeframe

## Implementation Files

### 1. `/src/lib/chart/timeframeMapping.ts`
Time conversion utilities for mapping between 1D and 188m timeframes.

**Functions**:
- `map1DTo188m(timestamp, bars188m)`: Maps 1D timestamp → array of 188m timestamps (returns 2)
- `map188mTo1D(timestamp, bars1D)`: Maps 188m timestamp → parent 1D timestamp

**Logic**:
```typescript
// Example: Dec 15, 2025 (1D bar)
const daily = 1734220800; // Unix timestamp for Dec 15

// Maps to:
const morning = 1734253500;  // Dec 15, 9:15 AM
const afternoon = 1734264780; // Dec 15, 12:23 PM
```

### 2. `/src/hooks/useCrossChartSync.ts`
Hook that synchronizes two chart instances with different timeframes.

**Features**:
- ✅ Bidirectional crosshair sync (1D ↔ 188m)
- ✅ Scroll/zoom sync (bidirectional)
- ✅ Circular update prevention
- ✅ Time mapping between timeframes

**Circular Prevention Pattern**:
```typescript
// Prevent infinite loops using ref flags
isUpdatingFromChart1.current = true;
chart2.setCrosshairPosition(...);
setTimeout(() => {
  isUpdatingFromChart1.current = false;
}, 50);
```

### 3. `/src/app/test-multi-pane-chart/page.tsx`
POC test page demonstrating the two-chart layout.

**Structure**:
```tsx
<ReusableChart 
  resolution="1D"
  indicators={[Volume, CVD 1D]}
  onChartReady={(chart) => setChart1(chart)}
  onDataLoaded={(data) => setBars1D(data.bars)}
/>

<ReusableChart
  resolution="1D"
  indicators={[CVD 188m]}
  onChartReady={(chart) => setChart2(chart)}
  onDataLoaded={(data) => setBars188m(data.indicators.cvd.values)}
/>

useCrossChartSync({ chart1, chart2, bars1D, bars188m });
```

## How It Works

### Crosshair Sync Flow

**When hovering on Chart 1 (1D)**:
```
1. User hovers on Dec 15, 2025 bar
2. Chart1 emits crosshair event (time: 1734220800)
3. Hook receives event in handleChart1CrosshairMove()
4. Calls map1DTo188m(1734220800, bars188m)
5. Returns [morning_time, afternoon_time]
6. Sets crosshair on Chart2 to morning_time
7. User sees crosshair on first 188m bar (9:15 AM session)
```

**When hovering on Chart 2 (188m)**:
```
1. User hovers on Dec 15, 9:15 AM bar
2. Chart2 emits crosshair event (time: 1734253500)
3. Hook receives event in handleChart2CrosshairMove()
4. Calls map188mTo1D(1734253500, bars1D)
5. Returns 1734220800 (Dec 15 daily bar)
6. Sets crosshair on Chart1 to 1734220800
7. User sees crosshair on Dec 15 bar in all Chart1 panes
```

### Scroll/Zoom Sync Flow

**When scrolling/zooming Chart 1**:
```
1. User scrolls or zooms Chart1
2. timeScale emits visibleTimeRangeChange event
3. Hook receives event with { from: time1, to: time2 }
4. Calls chart2.timeScale().setVisibleRange({ from, to })
5. Chart2 scrolls/zooms to match Chart1's viewport
```

Same applies in reverse (Chart2 → Chart1).

## Time Mapping Details

### 1D → 188m Mapping

```typescript
// Given 1D timestamp
const dailyTime = 1734220800; // Dec 15, 2025 00:00:00

// Calculate trading day boundaries
const tradingStart = Dec 15, 2025 09:15:00
const tradingEnd = Dec 15, 2025 15:30:00

// Filter 188m bars within this range
const matched = bars188m.filter(bar => 
  bar.time >= tradingStart && bar.time <= tradingEnd
);

// Returns: [morning_bar, afternoon_bar]
```

### 188m → 1D Mapping

```typescript
// Given 188m timestamp
const bar188m = 1734253500; // Dec 15, 2025 09:15:00

// Extract date
const date = new Date(bar188m * 1000);
// Dec 15, 2025

// Find 1D bar with same date
const matched = bars1D.find(bar => 
  sameDate(bar.time, date)
);

// Returns: 1734220800 (Dec 15 daily bar)
```

## Testing

### Access the POC
Navigate to: `http://localhost:3000/test-multi-pane-chart`

### Manual Test Checklist

**Crosshair Sync**:
- [ ] Hover on Chart 1 → crosshair appears on Chart 2
- [ ] Hover on Chart 2 → crosshair appears on Chart 1
- [ ] Move cursor slowly → crosshair follows smoothly
- [ ] Leave chart area → crosshair disappears from both

**Scroll/Zoom Sync**:
- [ ] Scroll Chart 1 → Chart 2 scrolls
- [ ] Scroll Chart 2 → Chart 1 scrolls
- [ ] Zoom in Chart 1 → Chart 2 zooms
- [ ] Zoom in Chart 2 → Chart 1 zooms
- [ ] Fit content in one chart → other adjusts

**Time Mapping Accuracy**:
- [ ] Hover on 1D bar shows corresponding 188m bar
- [ ] Check console logs for mapped timestamps
- [ ] Verify 188m bar count is ~2x daily bar count
- [ ] Confirm 188m bars align with trading hours (9:15 AM - 3:30 PM)

**Edge Cases**:
- [ ] Hover on most recent bar (incomplete day)
- [ ] Hover on oldest bar (edge of data)
- [ ] Toggle sync on/off
- [ ] Switch symbols (future enhancement)

### Debug Information

The page displays real-time debug info:
- Chart status (Ready/Loading)
- Bar counts (1D and 188m)
- Sync enabled state
- Expected vs actual bar ratio

## Known Limitations

1. **Crosshair Position**: When hovering a 1D bar, only the **first** 188m bar (morning session) shows the crosshair. The afternoon bar is not highlighted.
   - **Future**: Implement dual crosshair or region highlighting

2. **Multiple API Calls**: Each chart makes a separate API call. Chart 1 fetches CVD 1D, Chart 2 fetches CVD 188m.
   - **Future**: Batch API endpoint to fetch both in one call

3. **Price Coordinate**: Crosshair price is set to 0 since we're using `setCrosshairPosition(0, time, null)`.
   - **Reason**: Different charts have different price scales (price vs CVD)
   - **Impact**: Crosshair appears but may not align vertically

4. **Timezone Handling**: Trading hours assume local timezone is IST. May not work correctly in other timezones.
   - **Future**: Use proper timezone conversion (UTC → IST)

## Future Enhancements

1. **Bar Highlighting**: Highlight both 188m bars when hovering 1D bar
2. **Custom Overlay**: Draw custom crosshair lines for more precise control
3. **Tooltip Enhancement**: Show time mapping info in tooltip (e.g., "Dec 15: Morning 9:15 AM, Afternoon 12:23 PM")
4. **Batch API**: Single endpoint to fetch both CVD timeframes
5. **Configurable Timeframes**: Allow user to select different CVD timeframes
6. **Symbol Sync**: Automatically sync symbol changes between charts
7. **Pane Toggle**: Add ability to toggle Chart 2 visibility

## Performance Considerations

- **Event Throttling**: Currently not throttled. May add debouncing if performance issues occur.
- **Memory**: Two separate chart instances consume ~2x memory compared to single chart.
- **Re-renders**: State updates trigger re-renders. Memoization may be needed for larger datasets.

## Troubleshooting

**Crosshair not syncing**:
- Check console for "useCrossChartSync: Missing bar data" warning
- Verify both charts are ready (Debug panel shows "✓ Ready")
- Ensure bars1D and bars188m arrays are populated

**Incorrect time mapping**:
- Check console logs for mapped timestamps
- Verify 188m bars fall within trading hours (9:15 AM - 3:30 PM)
- Inspect `timeframeMapping.ts` logic

**Circular updates (infinite loop)**:
- Check if flags are being reset properly
- Increase timeout in useCrossChartSync.ts (currently 50ms)
- Add more logging to track update flow

**Charts not scrolling together**:
- Verify scroll/zoom sync is enabled
- Check visible time range subscriptions
- Test with simple scroll first, then zoom

## Related Files

- `/src/components/ReusableChart.tsx` - Base chart component
- `/src/hooks/useChartData.ts` - Data fetching hook
- `/src/types/chartIndicators.ts` - Indicator type definitions
- `/src/lib/tradingview/types.ts` - TradingView type definitions

## References

- [lightweight-charts API](https://tradingview.github.io/lightweight-charts/)
- [Indian Stock Market Hours](https://www.nseindia.com/)
- TradingView chart synchronization patterns
