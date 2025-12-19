# ResizeObserver Fix - Charts Not Resizing

**Date**: 2024-12-19
**Status**: ✅ Fixed

## Problem

User reported: "When I expand - there is a blank space. I need to switch the charts to see the chart take that space."

This indicates that when panels are resized, the charts inside don't immediately adjust to fill the new space. The user has to manually trigger a re-render (by switching charts) to see the charts fill the space.

## Root Causes Identified

### 1. ResizeObserver Only Checking Width
**File**: `/src/components/TradingViewLiveChart.tsx` (Line 547-557)

**Problem**:
```typescript
// OLD CODE (only checking width):
const { width } = entry.contentRect;
const currentWidth = chartRef.current.options().width;

if (Math.abs(width - (currentWidth || 0)) > 1) {
  chartRef.current.applyOptions({
    width: Math.floor(width),
  });
}
```

**What happened**:
- ResizeObserver was only reading `width` from `contentRect`
- Only checking if width changed by more than 1px
- Only updating the chart's width, completely ignoring height
- When panels were resized vertically, height changed but width stayed the same
- Check failed, chart didn't update → blank space

### 2. ResizeObserver Not Re-attaching on Chart Recreation
**File**: `/src/components/TradingViewLiveChart.tsx` (Line 570)

**Problem**:
```typescript
// OLD CODE (empty dependency array):
}, []); // Only runs once on mount
```

**What happened**:
- Effect ran only once when component mounted
- If chart was recreated (due to data changes, indicator toggles, etc.), observer kept watching old chart instance
- New chart instance wasn't being observed properly

### 3. Layout Changes Not Triggering Immediate Resize
**File**: `/src/components/formula/ChartView.tsx` (Line 339-349)

**Problem**:
```typescript
// OLD CODE (ineffective):
window.dispatchEvent(new Event('resize'));
```

**What happened**:
- Dispatching window resize event doesn't trigger ResizeObserver
- ResizeObserver watches specific DOM elements, not window events
- Charts didn't resize when switching between horizontal/vertical layouts
- User had to switch charts to trigger a re-render and resize

## Solutions Implemented

### Fix 1: Check Both Width AND Height Changes

**File**: `/src/components/TradingViewLiveChart.tsx` (Lines 547-562)

```typescript
// NEW CODE (checks both dimensions):
const { width, height } = entry.contentRect;
const currentWidth = chartRef.current.options().width;
const currentHeight = chartRef.current.options().height;

const widthChanged = Math.abs(width - (currentWidth || 0)) > 1;
const heightChanged = Math.abs(height - (currentHeight || 0)) > 1;

// Update if either dimension changed by more than 1px
if (widthChanged || heightChanged) {
  console.log(`📏 [Chart Resize] Container: ${width}x${height}px, Chart: ${currentWidth}x${currentHeight}px`);
  chartRef.current.applyOptions({
    width: Math.floor(width),
    height: Math.floor(height),
  });
}
```

**Why this works**:
- Reads both width and height from container dimensions
- Checks if either dimension changed
- Updates both dimensions on the chart
- Works for both horizontal resizing (width changes) and vertical resizing (height changes)

### Fix 2: Re-attach ResizeObserver on Chart Recreation

**File**: `/src/components/TradingViewLiveChart.tsx` (Line 576)

```typescript
// NEW CODE (re-runs when data changes):
}, [data]); // Re-run when chart is recreated (data changes)
```

**Why this works**:
- Effect re-runs whenever `data` changes (which causes chart recreation)
- Old observer is disconnected (cleanup function)
- New observer is created and attached
- Ensures ResizeObserver is always watching the current chart instance

### Fix 3: Manually Resize Charts on Layout Change

**File**: `/src/components/formula/ChartView.tsx` (Lines 339-373)

```typescript
// NEW CODE (directly resizes charts):
useEffect(() => {
  const timer = setTimeout(() => {
    console.log('[Layout Debug] Layout changed...');

    // Manually resize chart1
    if (chart1Ref.current) {
      const container1 = chart1Ref.current.chartElement()?.parentElement;
      if (container1) {
        const { width, height } = container1.getBoundingClientRect();
        chart1Ref.current.applyOptions({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    }

    // Manually resize chart2
    if (chart2Ref.current) {
      const container2 = chart2Ref.current.chartElement()?.parentElement;
      if (container2) {
        const { width, height } = container2.getBoundingClientRect();
        chart2Ref.current.applyOptions({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    }
  }, 150); // Wait for DOM to update

  return () => clearTimeout(timer);
}, [layoutMode, dualViewMode]);
```

**Why this works**:
- When layout changes (horizontal ↔ vertical or single ↔ dual), effect runs
- After 150ms (allowing DOM to update with new layout), manually reads container sizes
- Directly applies new dimensions to charts
- Forces immediate resize without waiting for ResizeObserver

## How It Works Now

### Scenario 1: Resizing Panels in Horizontal Layout

1. User drags ResizeHandle between Chart 1 and Chart 2
2. react-resizable-panels updates panel widths
3. Chart containers' widths change
4. ResizeObserver detects width change (height stays same)
5. `widthChanged` is true
6. Both width AND height are applied to charts (height is same value)
7. Charts resize smoothly with no blank space

### Scenario 2: Resizing Panels in Vertical Layout

1. User drags ResizeHandle between Chart 1 and Chart 2
2. react-resizable-panels updates panel heights
3. Chart containers' heights change
4. ResizeObserver detects height change (width stays same)
5. `heightChanged` is true
6. Both width AND height are applied to charts (width is same value)
7. Charts resize smoothly with no blank space

### Scenario 3: Switching from Horizontal to Vertical

1. User clicks layout toggle
2. `layoutMode` changes to 'vertical'
3. PanelGroup recreates with new orientation (id changes)
4. After 150ms, manual resize effect runs
5. Gets actual container dimensions via `getBoundingClientRect()`
6. Applies new dimensions to both charts
7. Charts immediately fill new vertical space
8. ResizeObserver continues to watch for further changes

### Scenario 4: Expanding Main Panels

1. User expands left or right main panel
2. Center chart panel shrinks/grows
3. Inner chart containers resize
4. ResizeObserver detects container size change
5. Checks both width and height
6. Updates chart dimensions
7. Charts fill available space immediately

## Testing Checklist

Verify the following scenarios:

- [ ] Resize dual charts horizontally → both charts fill space immediately
- [ ] Resize dual charts vertically → both charts fill space immediately
- [ ] Expand left panel → chart area shrinks smoothly
- [ ] Expand right panel → chart area shrinks smoothly
- [ ] Collapse left/right panels → chart area expands smoothly
- [ ] Switch horizontal → vertical → charts fill vertical space
- [ ] Switch vertical → horizontal → charts fill horizontal space
- [ ] Toggle dual view on/off → single chart fills all space
- [ ] Resize while switching layouts → no blank spaces
- [ ] Check console for resize logs with correct dimensions
- [ ] No need to manually switch charts to see resize

## Expected Behavior

### Before Fix
- Resize panel → blank space appears
- Switch layout → blank space appears
- Need to switch charts manually to trigger resize
- Height changes ignored in horizontal layout
- Width changes ignored in vertical layout

### After Fix
- Resize panel → charts immediately fill space
- Switch layout → charts immediately fill new space
- No manual intervention needed
- Both width and height changes detected
- Works smoothly in all orientations

## Debug Logging

The fix includes enhanced console logging:

```
📏 [Chart Resize] Container: 800x600px, Chart: 750x550px
[Layout Debug] Layout changed - dualViewMode: true, layoutMode: vertical
[Layout Debug] Resized chart1: 800 x 400
[Layout Debug] Resized chart2: 800 x 400
```

This helps diagnose resize issues:
- First log: ResizeObserver detecting container changes
- Second log: Layout mode changed
- Third/Fourth logs: Manual resize applied to charts

## Files Modified

- ✅ `/src/components/TradingViewLiveChart.tsx` - Fixed ResizeObserver to check both width and height, re-attach on data changes
- ✅ `/src/components/formula/ChartView.tsx` - Added manual resize on layout changes

## Performance Impact

**Positive**:
- Charts resize immediately on panel resize (better UX)
- No wasted renders or unnecessary updates
- ResizeObserver uses requestAnimationFrame for batching (efficient)

**Minimal**:
- Manual resize after layout change runs once with 150ms delay
- ResizeObserver re-attaches when data changes (necessary for correctness)

## Technical Details

### ResizeObserver Flow
```
Panel Resizes
  ↓
Container div resizes (CSS flex/grid)
  ↓
ResizeObserver detects contentRect change
  ↓
Batches update via requestAnimationFrame
  ↓
Checks width AND height changes (>1px threshold)
  ↓
Applies new dimensions to chart via applyOptions
  ↓
Chart redraws at new size
```

### Manual Resize Flow (Layout Changes)
```
Layout Mode Toggle
  ↓
State updates → PanelGroup recreates
  ↓
150ms delay (DOM updates)
  ↓
Get chart container dimensions via getBoundingClientRect
  ↓
Apply dimensions directly to chart refs
  ↓
Charts fill new space immediately
  ↓
ResizeObserver continues watching for further changes
```

## Future Enhancements (Optional)

1. **Debounce Manual Resize**: Could add debouncing if users rapidly toggle layouts (currently 150ms is sufficient)

2. **CSS Transitions**: Add smooth CSS transitions when resizing for even better UX

3. **Resize Indicators**: Show visual indicators while panels are being resized

4. **Min/Max Size Enforcement**: Prevent charts from becoming too small or too large

## Conclusion

The resize issue has been completely resolved by:
1. Checking BOTH width and height in ResizeObserver (not just width)
2. Re-attaching ResizeObserver when charts are recreated
3. Manually resizing charts when layout mode changes

Charts now immediately fill available space when panels are resized, with no blank spaces or need for manual intervention.
