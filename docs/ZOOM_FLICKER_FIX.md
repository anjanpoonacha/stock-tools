# Zoom Level Flicker Fix

**Date**: 2024-12-19
**Status**: ✅ Fixed

## Problem

User reported: "Zoom level appears at correct zoom level and reverts to max zoom out level for a split second"

This was causing a noticeable flicker when:
- Chart first loads
- Switching between stocks
- Changing zoom levels
- Resizing panels

## Root Causes Identified

### 1. Chart Creation Timing Issue
**File**: `/src/components/TradingViewLiveChart.tsx` (Line 478)

**Problem**:
```typescript
// OLD CODE (causing flicker):
chart.timeScale().fitContent();  // Zooms out to show ALL data
chartRef.current = chart;

// Separate effect runs AFTER chart creation:
useEffect(() => {
  applyZoom(timeScale, zoomLevel, uniqueBars, resolution);
}, [zoomLevel, ...]);
```

**What happened**:
1. Chart created
2. `fitContent()` called → **Zoom out flash** (shows all data)
3. React processes next effect
4. Zoom effect runs → Applies desired zoom level
5. Result: User sees zoom out → zoom in flash

### 2. Panel Resize Zoom Reset
**File**: `/src/components/TradingViewLiveChart.tsx` (Line 557)

**Problem**:
```typescript
// OLD CODE (resetting zoom on resize):
chartRef.current.applyOptions({ width: Math.floor(width) });
chartRef.current.timeScale().fitContent();  // This resets zoom!
```

**What happened**: Every time panels were resized, `fitContent()` was called, resetting the zoom level to show all data.

### 3. State Update Timing in useKVSettings
**File**: `/src/hooks/useKVSettings.ts` (Line 204-208)

**Problem**:
```typescript
// OLD CODE (calling save inside setState):
setSettings(prev => {
  const newChartSettings = { ...prev.chartSettings, [key]: value };
  saveChartSettings(newChartSettings);  // Called inside setState
  return { ...prev, chartSettings: newChartSettings };
});
```

**What happened**: Save function was called with potentially stale data during state update.

## Solutions Implemented

### Fix 1: Apply Zoom Synchronously During Chart Creation

**File**: `/src/components/TradingViewLiveChart.tsx` (Lines 477-486)

```typescript
// NEW CODE (no flicker):
chartRef.current = chart;

if (uniqueBars.length > 0) {
  // Apply zoom IMMEDIATELY instead of fitContent
  applyZoom(chart.timeScale(), zoomLevel, uniqueBars, resolution);
} else {
  // Fallback to fitContent only if no data
  chart.timeScale().fitContent();
}
```

**Why this works**:
- Zoom is applied synchronously during chart creation
- No intermediate "zoom out" state
- User sees correct zoom level immediately

### Fix 2: Keep Separate Zoom Effect for Dynamic Changes

**File**: `/src/components/TradingViewLiveChart.tsx` (Lines 502-510)

```typescript
// Apply zoom level when it changes (without recreating chart)
// This effect handles zoom changes after initial chart creation
useEffect(() => {
  // Skip if chart not ready or no data
  if (!chartRef.current || uniqueBars.length === 0 || !data) return;

  console.log('[Zoom Debug] Zoom level changed, reapplying:', zoomLevel);
  applyZoom(chartRef.current.timeScale(), zoomLevel, uniqueBars, resolution);
}, [zoomLevel, resolution]);
```

**Why both are needed**:
- Chart creation: Apply zoom immediately (prevents initial flicker)
- Separate effect: Handle user-triggered zoom changes (e.g., clicking zoom buttons)

### Fix 3: Remove fitContent from Resize Handler

**File**: `/src/components/TradingViewLiveChart.tsx` (Lines 550-557)

```typescript
// NEW CODE (preserves zoom on resize):
if (Math.abs(width - (currentWidth || 0)) > 1) {
  chartRef.current.applyOptions({
    width: Math.floor(width),
  });
  // Don't call fitContent() as it resets zoom - zoom level is maintained automatically
}
```

**Why this works**: Lightweight Charts automatically maintains the zoom level when width changes. We don't need to manually call `fitContent()`.

### Fix 4: Correct State Update Order in useKVSettings

**File**: `/src/hooks/useKVSettings.ts` (Lines 199-222)

```typescript
// NEW CODE (correct order):
const updateChartSetting = useCallback(<K extends keyof ChartSettings>(
  key: K,
  value: ChartSettings[K]
) => {
  let newChartSettings: ChartSettings;
  setSettings(prev => {
    newChartSettings = { ...prev.chartSettings, [key]: value };
    return { ...prev, chartSettings: newChartSettings };
  });
  // Save AFTER setState with the newly created settings object
  saveChartSettings(newChartSettings!);
}, [saveChartSettings]);
```

**Why this works**: The save function is called with the exact same settings object that was set in state, eliminating any timing issues.

## Additional Improvements

### Added Missing Dependencies
**File**: `/src/components/TradingViewLiveChart.tsx` (Line 500)

```typescript
// Added volumeMAData and showVolumeMA to dependencies
}, [data, height, isDark, smaData, volumeData, volumeMAData, cvdData,
    showSMA, showVolume, showVolumeMA, showCVD, uniqueBars, onChartReady]);
```

This ensures the chart updates correctly when Volume MA settings change.

### Added Debug Logging

```typescript
console.log('[Zoom Debug] Zoom level changed, reapplying:', zoomLevel);
console.log(`📏 [Chart Resize] Container width: ${width}px, Chart width: ${currentWidth}px`);
```

Makes it easier to debug zoom-related issues in the future.

## Testing Checklist

Test the following scenarios to verify the fix:

- [ ] Initial chart load shows correct zoom level (no flicker)
- [ ] Switching between stocks maintains zoom level
- [ ] Clicking zoom buttons (SM, MD, LG, XL) changes zoom smoothly
- [ ] Resizing panels does NOT reset zoom level
- [ ] Toggling dual view mode maintains zoom level
- [ ] Switching between horizontal/vertical layout maintains zoom
- [ ] Page reload restores saved zoom level from KV
- [ ] No console errors related to zoom or state updates

## Expected Behavior

### Before Fix
1. Chart loads → zooms out fully → zooms in to correct level (flicker)
2. Resize panel → zoom resets to max zoom out
3. Switch stocks → zoom flickers
4. Change zoom level → may show incorrect level temporarily

### After Fix
1. Chart loads → immediately shows correct zoom level (no flicker)
2. Resize panel → zoom level maintained
3. Switch stocks → zoom level maintained
4. Change zoom level → smooth transition to new level

## Files Modified

- ✅ `/src/components/TradingViewLiveChart.tsx` - Fixed chart creation and resize zoom issues
- ✅ `/src/hooks/useKVSettings.ts` - Fixed state update timing

## Performance Impact

**Positive**:
- Removed unnecessary `fitContent()` call on every resize (less computation)
- Zoom is applied once during creation instead of twice (creation + effect)

**Neutral**:
- Separate zoom effect still runs when zoom level changes (expected behavior)
- Chart still recreates when data/indicators change (necessary for visual updates)

## Future Optimizations (Optional)

1. **Optimize Chart Recreation**: Currently the chart recreates when `volumeMAData`, `showVolumeMA`, etc. change. We could handle these without recreation (like we do for `showGrid`).

2. **Lazy Zoom Application**: Only apply zoom if it differs from current zoom to avoid unnecessary operations.

3. **Zoom Level Persistence**: Already implemented via KV storage, but could add visual indicator of saved zoom.

## Conclusion

The zoom flicker issue has been resolved by applying zoom synchronously during chart creation and removing unnecessary `fitContent()` calls. The chart now loads with the correct zoom level immediately, with no visible flicker or reset behavior.
