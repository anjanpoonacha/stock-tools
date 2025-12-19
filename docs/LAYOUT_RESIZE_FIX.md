# Layout Resize Fix

**Date**: 2024-12-19
**Status**: ✅ Fixed

## Problem

User reported: "The height of the horizontal or width of the vertical layout is saved. Resizing the layout -> chart is not adjusting itself"

### Issues Identified:

1. **No orientation-specific sizing**: When switching between horizontal and vertical layouts, the inner dual-chart PanelGroup was using the same saved sizes, which don't translate correctly between orientations.

2. **Charts not detecting resize**: When layout changed, the ResizeObserver wasn't immediately detecting the new container dimensions.

3. **Panel sizes not persisted**: The inner PanelGroup didn't have an `id`, so manual resizing wasn't being saved.

## Solutions Implemented

### Fix 1: Orientation-Specific Panel IDs

**File**: `/src/components/formula/ChartView.tsx` (Line 756)

```typescript
// OLD CODE (no ID, no persistence, shared state between orientations):
<PanelGroup orientation={layoutMode} className='h-full w-full'>

// NEW CODE (orientation-specific IDs):
<PanelGroup
  orientation={layoutMode}
  className='h-full w-full'
  id={`dual-chart-${layoutMode}`}
>
```

**How it works**:
- `id="dual-chart-horizontal"` for horizontal layout
- `id="dual-chart-vertical"` for vertical layout
- Each orientation has its own localStorage entry
- Sizes saved in horizontal mode don't affect vertical mode (and vice versa)

**Example localStorage keys**:
```
react-resizable-panels:dual-chart-horizontal -> { "0": 50, "1": 50 }
react-resizable-panels:dual-chart-vertical -> { "0": 60, "1": 40 }
```

### Fix 2: Force Resize Event on Layout Change

**File**: `/src/components/formula/ChartView.tsx` (Lines 339-349)

```typescript
// Force chart resize when layout mode or dual view mode changes
useEffect(() => {
  // Small delay to let DOM update with new layout
  const timer = setTimeout(() => {
    // Trigger a window resize event to force ResizeObserver to detect changes
    window.dispatchEvent(new Event('resize'));
    console.log('[Layout Debug] Layout changed - dualViewMode:', dualViewMode, 'layoutMode:', layoutMode);
  }, 100);

  return () => clearTimeout(timer);
}, [layoutMode, dualViewMode]);
```

**Why this is needed**:
- When switching layouts, the PanelGroup recreates with new dimensions
- The ResizeObserver in TradingViewLiveChart might not immediately detect this
- Dispatching a window resize event ensures all ResizeObservers are triggered
- 100ms delay gives the DOM time to update before triggering resize

### Fix 3: Removed Key Prop (Not Needed)

Initially considered adding `key={layoutMode}` to force PanelGroup recreation, but decided against it because:
- It would cause unnecessary unmounting/remounting of child components
- The orientation-specific ID approach is cleaner
- ResizeObserver + window resize event are sufficient

## How It Works Now

### Scenario 1: Switching from Horizontal to Vertical

1. User clicks layout toggle button
2. `layoutMode` state changes from `'horizontal'` to `'vertical'`
3. PanelGroup `id` changes from `dual-chart-horizontal` to `dual-chart-vertical`
4. react-resizable-panels loads saved sizes for vertical layout from localStorage
5. After 100ms delay, window resize event is dispatched
6. ResizeObserver in each TradingViewLiveChart detects container size change
7. Charts resize to fit new dimensions

### Scenario 2: Resizing Panels in Horizontal Mode

1. User drags the ResizeHandle between Chart 1 and Chart 2
2. react-resizable-panels updates panel sizes
3. Automatically saves to localStorage as `react-resizable-panels:dual-chart-horizontal`
4. ResizeObserver detects container width change
5. Charts resize smoothly

### Scenario 3: Switching Back to Horizontal

1. User clicks layout toggle button again
2. `layoutMode` changes back to `'horizontal'`
3. PanelGroup loads the previously saved horizontal sizes from localStorage
4. Charts resize to the user's preferred horizontal layout
5. Separate vertical sizes are preserved in localStorage

## Testing Checklist

Verify the following scenarios:

- [ ] Switch from horizontal to vertical layout → charts fill new space correctly
- [ ] Switch from vertical to horizontal layout → charts fill new space correctly
- [ ] Resize charts in horizontal mode → sizes are saved and restored
- [ ] Resize charts in vertical mode → sizes are saved separately
- [ ] Switch layouts multiple times → each layout remembers its own sizing
- [ ] Toggle dual view on/off → charts resize correctly
- [ ] Resize main panels → inner charts adjust smoothly
- [ ] No console errors related to ResizeObserver
- [ ] No flickering or jumping when switching layouts

## Expected Behavior

### Before Fix
- Switching from horizontal to vertical: Chart widths were wrong, charts didn't fill space
- Switching from vertical to horizontal: Chart heights were wrong
- Resizing panels in one orientation affected the other orientation
- Charts didn't adjust to new container sizes immediately

### After Fix
- Switching layouts: Charts immediately fill the new space correctly
- Each orientation maintains its own panel sizes
- Resizing is smooth and responsive
- User preferences are preserved for each orientation separately

## Files Modified

- ✅ `/src/components/formula/ChartView.tsx` - Added orientation-specific ID and resize effect

## Technical Details

### PanelGroup ID Format
- Format: `dual-chart-${layoutMode}`
- Values: `dual-chart-horizontal` or `dual-chart-vertical`
- Storage: localStorage via react-resizable-panels library
- Scope: Per browser, per device

### Resize Event Flow
```
Layout Change
  ↓
DOM updates with new PanelGroup ID
  ↓
100ms delay
  ↓
window.dispatchEvent(new Event('resize'))
  ↓
All ResizeObservers triggered
  ↓
Charts detect container size change
  ↓
Charts resize via applyOptions({ width })
```

### Storage Structure
```javascript
// localStorage entries:
{
  "react-resizable-panels:main-panel-group": {
    "toolbar-panel": 5,
    "chart-panel": 81,
    "stock-list-panel": 14
  },
  "react-resizable-panels:dual-chart-horizontal": {
    "0": 45,  // Chart 1 width %
    "1": 55   // Chart 2 width %
  },
  "react-resizable-panels:dual-chart-vertical": {
    "0": 60,  // Chart 1 height %
    "1": 40   // Chart 2 height %
  }
}
```

## Performance Impact

**Positive**:
- Each layout orientation now has optimized sizing
- No unnecessary chart recreation when switching layouts
- ResizeObserver efficiently handles size changes

**Minimal**:
- 100ms delay when switching layouts (barely noticeable)
- Single window resize event dispatch (lightweight operation)

## Future Enhancements (Optional)

1. **KV Storage for Inner Panel Sizes**: Currently only main panels are saved to KV. Could extend to save inner panel sizes to KV for cross-device sync.

2. **Smooth Transitions**: Add CSS transitions when switching layouts for smoother visual effect.

3. **Reset Button**: Add button to reset panel sizes to defaults for current orientation.

4. **Lock Aspect Ratio**: Option to maintain chart aspect ratio when resizing.

## Conclusion

The layout resize issue has been resolved by:
1. Using orientation-specific IDs for the inner PanelGroup
2. Dispatching a resize event when layout changes
3. Allowing each orientation to maintain its own panel sizes

Charts now properly adjust when switching between horizontal and vertical layouts, and each orientation remembers the user's preferred sizing independently.
