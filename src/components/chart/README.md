# Multi-Pane Chart System

## Overview

The Multi-Pane Chart system is a proof-of-concept (POC) implementation for displaying synchronized charts across multiple panes with coordinated cursor movement. It was designed to enable:

- **Multi-timeframe CVD analysis** - View Cumulative Volume Delta (CVD) indicators at different timeframes (30S, 1M, etc.) simultaneously
- **Synchronized crosshair** - Cursor movements sync across all chart panes for easier time-based correlation
- **Flexible pane management** - Toggle individual panes on/off without affecting others
- **Independent indicators** - Each pane can display different indicators (Volume, CVD, RSI, etc.)

### Why It Was Created

The POC addresses the need to visualize CVD data at multiple timeframes simultaneously, enabling traders to:
- Correlate intraday price movements with CVD patterns across different time granularities
- Identify divergences between price action and volume delta at various timeframes
- Maintain synchronized time references across all charts for accurate analysis

### Key Features

- ✅ **Synchronized Cursor** - Move cursor on any pane, all others sync automatically
- ✅ **Dynamic Pane Management** - Enable/disable panes on-the-fly
- ✅ **Multi-Timeframe CVD** - Display CVD at 30S, 1M, or any custom timeframe
- ✅ **Theme-Aware** - Automatic dark/light mode support
- ✅ **Error Isolation** - Individual pane failures don't crash the entire system
- ✅ **Responsive Layout** - Vertical stacking with configurable heights
- ⚠️ **Time Range Sync** - Not yet implemented (planned feature)

---

## Architecture

### Component Hierarchy

```
MultiPaneChart (Orchestrator)
│
├── useChartCursorSync (Hook)
│   ├── chartRegistry (Map of IChartApi instances)
│   ├── currentCrosshair (Shared state)
│   └── handleCrosshairMove (Sync coordinator)
│
└── ChartPane[] (Individual Panes)
    ├── useChartData (Data fetching)
    ├── IChartApi (Lightweight Charts instance)
    ├── IndicatorRenderer (Indicator display)
    └── Crosshair Event Handlers
        ├── onCrosshairMove (Emit to parent)
        └── externalCrosshairPosition (Receive from parent)
```

### Data Flow for Cursor Synchronization

```
1. User moves cursor on Pane A
   │
   ├─→ ChartPane A: subscribeCrosshairMove fires
   │
   ├─→ Pane A calls: onCrosshairMove(paneId, MouseEventParams)
   │
   ├─→ MultiPaneChart: handleCrosshairMoveFromPane()
   │
   ├─→ useChartCursorSync: handleCrosshairMove()
       │
       ├─→ Updates currentCrosshair state
       │
       └─→ Propagates to all OTHER panes via externalCrosshairPosition
           │
           ├─→ ChartPane B receives new position
           ├─→ ChartPane C receives new position
           └─→ Sets isUpdatingExternally flag to prevent circular updates
```

### Component Interactions

```mermaid
graph TB
    A[MultiPaneChart] -->|manages| B[ChartPane 1]
    A -->|manages| C[ChartPane 2]
    A -->|manages| D[ChartPane N]
    A -->|uses| E[useChartCursorSync]
    
    B -->|emits| F[onCrosshairMove]
    C -->|emits| F
    D -->|emits| F
    
    F -->|handled by| E
    E -->|updates| G[currentCrosshair]
    G -->|distributed to| B
    G -->|distributed to| C
    G -->|distributed to| D
    
    B -->|fetches| H[/api/chart-data]
    C -->|fetches| H
    D -->|fetches| H
```

---

## Components

### ChartPane

**Location**: `src/components/chart/ChartPane.tsx`

**Purpose**: Renders a single chart with specified symbol, resolution, and indicators. Emits and receives crosshair events.

**Key Props**:
- `paneId` - Unique identifier for the pane
- `symbol` - Trading symbol (e.g., 'NSE:RELIANCE')
- `resolution` - Chart timeframe (e.g., '1D', '1H')
- `indicators` - Array of IndicatorConfig objects
- `onCrosshairMove` - Callback to emit cursor events
- `externalCrosshairPosition` - Incoming cursor position from other panes

**Features**:
- Loading and error states
- Theme-aware rendering
- Automatic chart resizing
- CVD data fetching with custom timeframes
- Indicator rendering via IndicatorRenderer

---

### MultiPaneChart

**Location**: `src/components/chart/MultiPaneChart.tsx`

**Purpose**: Orchestrates multiple ChartPane instances with synchronized cursors and pane visibility controls.

**Key Props**:
- `panes` - Array of PaneConfig objects
- `syncCrosshair` - Enable/disable cursor synchronization (default: true)
- `syncTimeRange` - Future feature for time range synchronization
- `onPaneToggle` - Callback when pane visibility changes

**Features**:
- Vertical stacking layout with separators
- Individual pane toggle controls
- Error boundary for each pane (failures don't crash others)
- Debug info panel in development mode
- Theme-compliant UI using shadcn/ui components

---

### useChartCursorSync

**Location**: `src/hooks/useChartCursorSync.ts`

**Purpose**: Manages cursor synchronization across multiple chart instances.

**API**:
```typescript
interface UseChartCursorSyncReturn {
  registerChart: (paneId: string, chart: IChartApi) => void;
  unregisterChart: (paneId: string) => void;
  handleCrosshairMove: (sourcePaneId: string, param: MouseEventParams) => void;
  currentCrosshair: { time: number; price?: number } | null;
}
```

**How It Works**:
1. Charts register themselves via `registerChart()`
2. When cursor moves, chart calls `handleCrosshairMove()`
3. Hook updates `currentCrosshair` state
4. Hook propagates position to all OTHER charts (excluding source)
5. Charts unregister on cleanup via `unregisterChart()`

**Performance**:
- All callbacks memoized with `useCallback`
- Registry uses `useRef` to avoid re-renders
- Sync only occurs when crosshair is active

---

### types.ts

**Location**: `src/components/chart/types.ts`

**Purpose**: Shared TypeScript interfaces for multi-pane chart system.

**Key Types**:
```typescript
interface MultiPaneChartProps {
  panes: PaneConfig[];
  syncCrosshair?: boolean;
  syncTimeRange?: boolean;
  onPaneToggle?: (paneId: string, enabled: boolean) => void;
}

interface PaneConfig {
  id: string;
  label: string;
  symbol: string;
  resolution: string;
  barsCount: number;
  indicators: IndicatorConfig[];
  height: number;
  enabled: boolean;
}
```

---

## Usage Examples

### Basic Example with 2 Panes

```tsx
import { MultiPaneChart } from '@/components/chart/MultiPaneChart';
import { createVolumeIndicator, createCVDIndicator } from '@/types/chartIndicators';

export default function MyChartPage() {
  const panes = [
    {
      id: 'main',
      label: 'Price + Volume',
      symbol: 'NSE:RELIANCE',
      resolution: '1D',
      barsCount: 300,
      indicators: [createVolumeIndicator(true)],
      height: 500,
      enabled: true,
    },
    {
      id: 'cvd',
      label: 'CVD 30S',
      symbol: 'NSE:RELIANCE',
      resolution: '1D',
      barsCount: 300,
      indicators: [createCVDIndicator(true, '3M', '30S')],
      height: 200,
      enabled: true,
    }
  ];

  return <MultiPaneChart panes={panes} syncCrosshair={true} />;
}
```

---

### Example with Toggle Controls

```tsx
import { useState } from 'react';
import { MultiPaneChart } from '@/components/chart/MultiPaneChart';

export default function InteractiveChart() {
  const [panes, setPanes] = useState([
    { id: 'pane1', label: 'Pane 1', enabled: true, /* ... */ },
    { id: 'pane2', label: 'Pane 2', enabled: true, /* ... */ },
  ]);

  const handleToggle = (paneId: string, enabled: boolean) => {
    console.log(`Pane ${paneId} is now ${enabled ? 'enabled' : 'disabled'}`);
  };

  return (
    <MultiPaneChart 
      panes={panes} 
      onPaneToggle={handleToggle}
    />
  );
}
```

---

### Example with Different CVD Timeframes

```tsx
const panes = [
  {
    id: 'main',
    label: 'Primary Chart',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    barsCount: 300,
    indicators: [createVolumeIndicator(true)],
    height: 400,
    enabled: true,
  },
  {
    id: 'cvd-30s',
    label: 'CVD 30 Seconds',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    barsCount: 300,
    indicators: [createCVDIndicator(true, '3M', '30S', 2, 150)],
    height: 200,
    enabled: true,
  },
  {
    id: 'cvd-1m',
    label: 'CVD 1 Minute',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    barsCount: 300,
    indicators: [createCVDIndicator(true, '3M', '1M', 3, 150)],
    height: 200,
    enabled: true,
  },
  {
    id: 'cvd-5m',
    label: 'CVD 5 Minutes',
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    barsCount: 300,
    indicators: [createCVDIndicator(true, '3M', '5M', 4, 150)],
    height: 200,
    enabled: false, // Initially disabled
  }
];

return <MultiPaneChart panes={panes} />;
```

---

## Cursor Synchronization

### How It Works (Step-by-Step)

1. **User Action**: User moves cursor over ChartPane A
2. **Event Emission**: Lightweight Charts fires `subscribeCrosshairMove` event
3. **Upward Propagation**: ChartPane A calls `onCrosshairMove(paneId, MouseEventParams)`
4. **Central Coordinator**: MultiPaneChart receives the event and routes it to `useChartCursorSync.handleCrosshairMove()`
5. **State Update**: Hook updates `currentCrosshair` state with new time/price
6. **Downward Propagation**: Hook calls `setCrosshairPosition()` on all OTHER registered charts (B, C, D...)
7. **Visual Sync**: All charts display synchronized crosshairs at the same time position

### Technical Details

#### setCrosshairPosition API

The sync mechanism relies on Lightweight Charts' `setCrosshairPosition()` method:

```typescript
chart.setCrosshairPosition(
  price: number,    // Price coordinate (can be 0 if not relevant)
  time: Time,       // Time value to position crosshair
  series: any       // Pass null to position on time scale
);
```

**Current Implementation** (`useChartCursorSync.ts:169`):
```typescript
if (chart && typeof chart.setCrosshairPosition === 'function') {
  chart.setCrosshairPosition(price ?? 0, time, null as any);
}
```

**Limitations**:
- `setCrosshairPosition` is only available in Lightweight Charts v4.0+
- Older versions require fallback strategies (not fully implemented)
- Price parameter is required but not always meaningful for time-only sync

#### Circular Update Prevention

To prevent infinite loops, ChartPane uses an `isUpdatingExternally` flag:

```typescript
// ChartPane.tsx:263
isUpdatingExternally.current = true;

// Apply external crosshair position
// ...

setTimeout(() => {
  isUpdatingExternally.current = false;
}, 50);
```

When this flag is true, the pane ignores its own `subscribeCrosshairMove` events (ChartPane.tsx:241).

### Performance Considerations

1. **Debouncing**: Not currently implemented - every cursor move triggers sync
   - **Impact**: High-frequency updates on fast cursor movements
   - **Future**: Consider debouncing with `requestAnimationFrame()`

2. **Registry Lookups**: O(N) where N = number of panes
   - **Current**: Iterates through Map on every cursor move
   - **Acceptable**: For 2-5 panes, performance is fine
   - **Concern**: May degrade with 10+ panes

3. **React Re-renders**: Minimized via:
   - `useRef` for chart registry (no re-renders on register/unregister)
   - `useCallback` for all handler functions
   - Conditional state updates (only when crosshair active)

4. **Memory**: Each chart instance held in memory
   - **Cleanup**: Charts properly unregistered on unmount
   - **Leaks**: None observed in testing

---

## Testing the POC

### Access URL

```
http://localhost:3000/test-multi-pane-chart
```

### What to Test

#### 1. Cursor Sync Across Panes
- **Action**: Move cursor over any chart pane
- **Expected**: Crosshairs on all visible panes move to the same time position
- **Verify**: Time values match across panes in debug panel

#### 2. Toggle Pane Visibility
- **Action**: Click "Disable Pane" button on any pane
- **Expected**: 
  - Pane disappears (replaced with "Pane disabled" placeholder)
  - Badge updates count: "X / Y Panes Visible"
  - Other panes continue functioning
- **Action**: Click "Enable Pane" button
- **Expected**: Pane reappears with chart rendered

#### 3. Different CVD Timeframes Display
- **Action**: Observe CVD panes with 30S and 1M timeframes
- **Expected**: 
  - Both charts load successfully
  - CVD values differ between timeframes
  - Chart labels clearly show timeframe (e.g., "CVD (30S)")

#### 4. Theme Switching
- **Action**: Toggle dark/light mode in app settings
- **Expected**:
  - All charts update colors immediately
  - Text remains readable
  - Grid lines adjust to theme

#### 5. Error Handling
- **Action**: Disconnect internet mid-load (or simulate API failure)
- **Expected**:
  - Failed panes show error state
  - Other panes continue functioning
  - Error message is clear and actionable

### Expected Behavior

✅ **Smooth Synchronization**
- Crosshair movements are instant (no lag)
- All panes stay in sync even with rapid cursor movements
- Sync works across panes with different heights

✅ **Independent Operation**
- Disabling one pane doesn't affect others
- Each pane can have different symbols/resolutions/indicators
- API failures in one pane don't crash others

✅ **Responsive UI**
- Charts resize on window resize
- Panes stack vertically on all screen sizes
- Controls are accessible and intuitive

⚠️ **Known Issues** (see below)

---

## Configuration

### PaneConfig Interface

```typescript
interface PaneConfig {
  // Unique identifier for the pane
  id: string;
  
  // Display label in pane header
  label: string;
  
  // Trading symbol (e.g., 'NSE:RELIANCE', 'NASDAQ:AAPL')
  symbol: string;
  
  // Chart resolution ('1D', '1H', '15', '5', etc.)
  resolution: string;
  
  // Number of historical bars to fetch
  barsCount: number;
  
  // Array of indicator configurations
  indicators: IndicatorConfig[];
  
  // Height of the chart pane in pixels
  height: number;
  
  // Whether the pane is initially visible
  enabled: boolean;
}
```

### How to Add New Panes

1. **Create Pane Configuration**:
```typescript
const newPane: PaneConfig = {
  id: 'my-new-pane',
  label: 'My Custom Chart',
  symbol: 'NSE:RELIANCE',
  resolution: '1D',
  barsCount: 300,
  indicators: [createCVDIndicator(true, '3M', '2M')],
  height: 250,
  enabled: true,
};
```

2. **Add to Panes Array**:
```typescript
const [panes, setPanes] = useState([
  // ... existing panes
  newPane,
]);
```

3. **Pass to MultiPaneChart**:
```tsx
<MultiPaneChart panes={panes} />
```

### How to Configure Indicators

Indicators are configured using helper functions from `types/chartIndicators.ts`:

#### Volume Indicator
```typescript
createVolumeIndicator(
  enabled: boolean,     // true to display
  paneIndex: number,    // pane order (1, 2, 3...)
  paneHeight: number    // height in pixels
)
```

#### CVD Indicator
```typescript
createCVDIndicator(
  enabled: boolean,       // true to display
  anchorPeriod: string,   // '3M', '6M', '1Y', etc.
  timeframe?: string,     // '30S', '1M', '5M', etc.
  paneIndex: number,      // pane order
  paneHeight: number      // height in pixels
)
```

#### Multiple Indicators on One Pane
```typescript
indicators: [
  createVolumeIndicator(true, 1, 100),
  createCVDIndicator(true, '3M', '30S', 2, 120),
]
```

### How to Set Timeframes

**Chart Resolution** (main candlestick timeframe):
```typescript
resolution: '1D'   // Daily
resolution: '1H'   // Hourly
resolution: '15'   // 15 minutes
resolution: '5'    // 5 minutes
```

**CVD Timeframe** (optional - aggregates CVD data):
```typescript
// If omitted, CVD matches chart resolution
createCVDIndicator(true, '3M', undefined)

// With custom timeframe
createCVDIndicator(true, '3M', '30S')  // 30-second CVD bars
createCVDIndicator(true, '3M', '1M')   // 1-minute CVD bars
createCVDIndicator(true, '3M', '5M')   // 5-minute CVD bars
```

**Anchor Period** (historical lookback for CVD calculation):
```typescript
createCVDIndicator(true, '1M', '30S')  // 1 month of history
createCVDIndicator(true, '3M', '30S')  // 3 months (default)
createCVDIndicator(true, '6M', '30S')  // 6 months
createCVDIndicator(true, '1Y', '30S')  // 1 year
```

---

## Known Limitations

### 1. API Makes Multiple Calls (One Per Pane)

**Issue**: Each ChartPane makes an independent API call to `/api/chart-data`, even if multiple panes request the same symbol/resolution.

**Impact**:
- Redundant network requests
- Increased server load
- Slower initial page load

**Current Behavior**:
```
Pane A: GET /api/chart-data?symbol=NSE:RELIANCE&resolution=1D&bars=300&cvd=true&cvdTimeframe=30S
Pane B: GET /api/chart-data?symbol=NSE:RELIANCE&resolution=1D&bars=300&cvd=true&cvdTimeframe=1M
Pane C: GET /api/chart-data?symbol=NSE:RELIANCE&resolution=1D&bars=300
```

**Future Solution**:
- Implement shared data fetching at MultiPaneChart level
- Use `useChartDataCache` hook (already exists: `src/hooks/useChartDataCache.ts`)
- Pass data down to panes as props instead of fetching independently

---

### 2. Time Range Sync Not Yet Implemented

**Issue**: When you zoom or scroll one chart, other charts don't follow.

**Current Behavior**:
- `syncTimeRange` prop exists but has no effect
- Each chart maintains independent zoom/scroll state
- User must manually sync time ranges

**Impact**:
- Reduced usability for detailed analysis
- Hard to compare exact time periods across panes

**Future Solution**:
```typescript
// Pseudocode for time range sync
const handleTimeRangeChange = (paneId, from, to) => {
  chartRegistry.forEach((chart, id) => {
    if (id !== paneId) {
      chart.timeScale().setVisibleRange({ from, to });
    }
  });
};
```

---

### 3. Performance with 3+ Panes Untested

**Issue**: POC tested with 2 panes only. Behavior with 3+ panes unknown.

**Potential Concerns**:
- Memory usage (each chart holds full dataset)
- Cursor sync latency (O(N) propagation)
- Browser rendering performance (multiple canvas elements)

**Recommendations**:
- Test with 3-5 panes before production use
- Monitor browser memory usage
- Consider pagination or lazy-loading for 5+ panes
- Profile cursor sync performance with Chrome DevTools

---

### 4. setCrosshairPosition Not Available in All Lightweight Charts Versions

**Issue**: Fallback strategy incomplete for older versions.

**Current Code** (`useChartCursorSync.ts:174`):
```typescript
else if (chart && typeof chart.timeScale === 'function') {
  // Fallback: Can't directly set crosshair
  console.debug(`Chart ${paneId} does not support setCrosshairPosition`);
}
```

**Impact**:
- No cursor sync on Lightweight Charts < v4.0
- Logs clutter console in development

**Solution**:
- Enforce minimum Lightweight Charts version: v4.0+
- Or implement custom crosshair overlay (complex)

---

### 5. No Keyboard Shortcuts

**Issue**: All interactions are mouse-based.

**Missing Features**:
- `Ctrl+1`, `Ctrl+2` to toggle panes
- `Escape` to reset zoom
- Arrow keys to navigate time

**Future Enhancement**: Implement via `useChartKeybindings` hook (already exists: `src/hooks/useChartKeybindings.ts`)

---

## Next Steps

### Integration Decisions

#### Option A: Integrate into Existing Dashboard
- **Pros**: Users get multi-timeframe CVD in main app
- **Cons**: Increased complexity, potential performance impact
- **Effort**: Medium (1-2 weeks)

#### Option B: Keep as Standalone Tool
- **Pros**: Zero risk to existing features, easy to iterate
- **Cons**: Separate navigation, harder to discover
- **Effort**: Low (documentation only)

#### Option C: Hybrid Approach
- **Pros**: Best of both worlds - optional feature in main app
- **Cons**: Requires feature flag system
- **Effort**: High (3-4 weeks)

**Recommendation**: Start with **Option B**, gather feedback, then consider **Option C** for production.

---

### Potential Optimizations

1. **Shared Data Fetching**
   - Implement `useChartDataCache` at parent level
   - Pass data to panes as props
   - **Impact**: 3-5x faster load times

2. **Virtual Scrolling for Many Panes**
   - Only render visible panes
   - Lazy-load off-screen panes
   - **Impact**: Supports 10+ panes without performance hit

3. **Debounced Cursor Sync**
   - Use `requestAnimationFrame` to batch updates
   - **Impact**: 50% reduction in sync overhead

4. **WebWorker for Data Processing**
   - Offload CVD calculations to background thread
   - **Impact**: Smooth 60fps rendering even with complex indicators

5. **Memoized Indicator Rendering**
   - Cache rendered indicator series
   - Only re-render on data change
   - **Impact**: Faster theme switching and pane toggles

---

### API Improvements Needed

1. **Batch Fetching Endpoint**
   ```typescript
   POST /api/chart-data/batch
   {
     requests: [
       { symbol: 'NSE:RELIANCE', resolution: '1D', cvdTimeframe: '30S' },
       { symbol: 'NSE:RELIANCE', resolution: '1D', cvdTimeframe: '1M' }
     ]
   }
   ```

2. **Server-Side Cursor Sync** (advanced)
   - Real-time updates via WebSocket
   - Sync cursors across different users viewing same chart
   - **Use Case**: Collaborative analysis

3. **CVD Caching**
   - Cache CVD calculations server-side
   - Return cached data for common timeframes
   - **Impact**: 10x faster CVD loading

---

### Additional Features to Consider

1. **Pane Layouts**
   - Vertical split (side-by-side panes)
   - Grid layout (2x2, 3x3)
   - Drag-and-drop reordering

2. **Synchronized Zoom**
   - Implement `syncTimeRange` feature
   - Add "Reset All Zoom" button

3. **Compare Mode**
   - Display multiple symbols in separate panes
   - Sync cursors to compare correlations

4. **Chart Templates**
   - Save/load pane configurations
   - Predefined layouts (e.g., "CVD Multi-Timeframe", "Price + Volume + RSI")

5. **Export/Share**
   - Screenshot all panes as single image
   - Share pane configuration via URL

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Crosshair Not Syncing

**Symptoms**: Moving cursor on one pane doesn't move crosshairs on others

**Causes**:
1. `syncCrosshair` prop set to false
2. Lightweight Charts version < 4.0
3. JavaScript error breaking event propagation

**Solutions**:
1. Check `<MultiPaneChart syncCrosshair={true} />`
2. Verify package.json: `"lightweight-charts": "^4.0.0"`
3. Open browser console, look for errors in `[useChartCursorSync]` logs

---

#### Issue: Pane Shows "Loading chart data..." Forever

**Symptoms**: Spinner never disappears, no chart rendered

**Causes**:
1. Not authenticated (no session cookie)
2. API error (check Network tab)
3. Invalid symbol or resolution

**Solutions**:
1. Visit `/user-authentication` to log in via extension
2. Check browser console for 401/403 errors
3. Verify symbol format: `NSE:RELIANCE`, not `RELIANCE` alone

---

#### Issue: Chart Theme Not Updating

**Symptoms**: Charts stay dark when switching to light mode (or vice versa)

**Causes**:
1. Theme not properly detected by `useTheme()`
2. Chart not re-rendering on theme change

**Solutions**:
1. Check `next-themes` provider wraps the app
2. Verify `isDark` dependency in ChartPane.tsx:230 useEffect

---

#### Issue: Error Boundary Triggered

**Symptoms**: Red error message instead of chart: "Error in [Pane Name]"

**Causes**:
1. API returned invalid data
2. Indicator configuration error
3. Out-of-memory (too many panes)

**Solutions**:
1. Click "Try Again" button (ErrorBoundary.tsx:255)
2. Check indicator config matches IndicatorConfig type
3. Reduce number of enabled panes or lower barsCount

---

### Debug Tips

#### 1. Enable Development Debug Panel

The debug panel is automatically visible in development mode (MultiPaneChart.tsx:200).

**Shows**:
- Current crosshair time and price
- List of enabled panes
- Sync source pane

#### 2. Check Console Logs

Look for logs prefixed with:
- `[MultiPaneChart]` - Pane lifecycle events
- `[useChartCursorSync]` - Sync operations
- `[ChartPane]` - Data fetching and rendering

#### 3. Inspect Network Requests

Open DevTools > Network tab, filter by "chart-data":
- Check request count (should match # of enabled panes)
- Verify response contains `bars` and `cvd` arrays
- Look for 4xx/5xx errors

#### 4. React DevTools

Install React DevTools extension:
- Inspect `MultiPaneChart` component state
- Check `panes` array for enabled/disabled status
- Verify `crosshairPosition` updates on cursor move

---

### Console Logs to Check

#### Normal Operation
```
[MultiPaneChart] Rendering 2 panes
[ChartPane] Fetching data for pane-1: NSE:RELIANCE 1D
[ChartPane] Fetching data for pane-2: NSE:RELIANCE 1D
[ChartPane] Data loaded for pane-1: 300 bars
[ChartPane] Data loaded for pane-2: 300 bars
```

#### Cursor Sync Active
```
[useChartCursorSync] Crosshair move from pane-1
[useChartCursorSync] Syncing to 1 other chart(s)
[useChartCursorSync] Updated chart pane-2
```

#### Error Logs
```
[MultiPaneChart] Error in pane pane-1: Network error
[useChartCursorSync] Chart pane-2 does not support setCrosshairPosition
[ChartPane] API error: 401 Unauthorized
```

---

## File Structure

```
src/components/chart/
├── README.md                    # This file
├── types.ts                     # TypeScript interfaces
├── MultiPaneChart.tsx           # Main orchestrator component
├── ChartPane.tsx                # Individual chart pane
└── ReusableChart.tsx            # Base chart component (legacy)

src/hooks/
├── useChartCursorSync.ts        # Cursor sync hook
├── useChartData.ts              # Data fetching hook
├── useChartDataCache.ts         # Caching hook (not yet used)
└── useChartKeybindings.ts       # Keyboard shortcuts (not yet used)

src/types/
└── chartIndicators.ts           # Indicator type definitions

src/app/test-multi-pane-chart/
└── page.tsx                     # POC test page

src/lib/chart-data/
└── indicatorRenderer.ts         # Indicator rendering logic
```

---

## Related Documentation

- [Lightweight Charts API](https://tradingview.github.io/lightweight-charts/docs)
- [CVD Implementation Details](../../lib/tradingview/README.md)
- [Chart Data API](../../app/api/chart-data/README.md)
- [Indicator Types](../../types/chartIndicators.ts)

---

## License

Internal use only. Part of the MIO TV Scripts project.

---

**Last Updated**: 2025-12-19  
**POC Version**: 1.0  
**Status**: Proof of Concept - Not Production Ready
