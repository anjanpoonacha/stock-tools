# Reusable Chart Component - Developer Guide

## Overview

The Reusable Chart Component provides a flexible, indicator-based charting system built on lightweight-charts v5. It allows developers to easily add, configure, and combine multiple technical indicators without modifying the core chart component.

## Architecture

### Component Structure

```
src/
├── types/
│   └── chartIndicators.ts           # Indicator type definitions & helpers
├── lib/
│   └── chart-data/
│       └── indicatorRenderer.ts     # Indicator rendering logic
└── components/
    ├── ReusableChart.tsx            # New reusable chart component
    └── TradingViewLiveChart.tsx     # Legacy chart component (maintained)
```

### Key Concepts

1. **Indicator Configuration** - Type-safe config objects define indicator behavior
2. **Indicator Renderer** - Factory pattern for rendering different indicator types
3. **Separation of Concerns** - Chart rendering separate from indicator logic
4. **Backward Compatibility** - Old chart component remains functional

## Quick Start

### Basic Usage

```tsx
import { ReusableChart } from '@/components/ReusableChart';
import { createVolumeIndicator, createSMAIndicator } from '@/types/chartIndicators';

function MyChart() {
  return (
    <ReusableChart
      symbol="NSE:RELIANCE"
      resolution="1D"
      barsCount={300}
      height={600}
      indicators={[
        createVolumeIndicator(true),        // Enable volume
        createSMAIndicator(true, 20),       // 20-period SMA
      ]}
    />
  );
}
```

### Advanced Usage with CVD

```tsx
import { ReusableChart } from '@/components/ReusableChart';
import { 
  createVolumeIndicator, 
  createSMAIndicator,
  createCVDIndicator 
} from '@/types/chartIndicators';

function AdvancedChart() {
  return (
    <ReusableChart
      symbol="NSE:TCS"
      resolution="1D"
      barsCount={500}
      height={800}
      showGrid={true}
      indicators={[
        // Volume in pane 1
        createVolumeIndicator(
          true,      // enabled
          1,         // paneIndex
          100        // paneHeight in pixels
        ),
        
        // SMA overlay on price chart
        createSMAIndicator(
          true,      // enabled
          20,        // period
          '#26a69a'  // color
        ),
        
        // CVD in pane 2
        createCVDIndicator(
          true,      // enabled
          '3M',      // anchorPeriod
          '30S',     // timeframe (optional)
          2,         // paneIndex
          120        // paneHeight
        ),
      ]}
    />
  );
}
```

## Indicator Types

### 1. Volume Indicator

Displays trading volume as histogram in separate pane.

```tsx
import { createVolumeIndicator } from '@/types/chartIndicators';

const volumeConfig = createVolumeIndicator(
  true,  // enabled
  1,     // paneIndex (1 = first indicator pane)
  100    // paneHeight (pixels)
);
```

**Options:**
- `enabled`: Boolean - Whether indicator is active
- `paneIndex`: Number - Which pane to display in (1+)
- `paneHeight`: Number - Height in pixels (minimum 30px)

### 2. SMA (Simple Moving Average)

Overlays moving average line on price chart.

```tsx
import { createSMAIndicator } from '@/types/chartIndicators';

const sma20 = createSMAIndicator(
  true,       // enabled
  20,         // period
  '#26a69a'   // color
);

const sma50 = createSMAIndicator(
  true,
  50,
  '#2962FF'
);
```

**Options:**
- `enabled`: Boolean
- `period`: Number - Number of bars for average calculation
- `color`: String - Line color (hex or rgba)

### 3. CVD (Cumulative Volume Delta)

Displays cumulative buy/sell pressure as candlestick chart.

```tsx
import { createCVDIndicator } from '@/types/chartIndicators';

const cvdConfig = createCVDIndicator(
  true,       // enabled
  '3M',       // anchorPeriod: '1W' | '1M' | '3M' | '6M' | '1Y'
  '30S',      // timeframe: custom bar granularity (optional)
  2,          // paneIndex
  120         // paneHeight
);
```

**Options:**
- `enabled`: Boolean
- `anchorPeriod`: String - Historical lookback period
- `timeframe`: String (optional) - CVD bar resolution (independent of chart)
- `paneIndex`: Number - Which pane (usually 2 if volume is 1)
- `paneHeight`: Number - Height in pixels

**Anchor Period Values:**
- `'1W'` - 1 Week
- `'1M'` - 1 Month
- `'3M'` - 3 Months (recommended)
- `'6M'` - 6 Months
- `'1Y'` - 1 Year

**Timeframe Values:**
- `undefined` - Use chart resolution
- `'15S'` - 15 seconds
- `'30S'` - 30 seconds
- `'1'` - 1 minute
- `'5'` - 5 minutes
- `'15'` - 15 minutes

### 4. EMA (Exponential Moving Average)

*Coming soon* - Similar to SMA but with exponential weighting.

```tsx
import { createEMAIndicator } from '@/types/chartIndicators';

const ema12 = createEMAIndicator(
  true,       // enabled
  12,         // period
  '#2962FF'   // color
);
```

### 5. RSI (Relative Strength Index)

*Coming soon* - Momentum oscillator in separate pane.

```tsx
import { createRSIIndicator } from '@/types/chartIndicators';

const rsiConfig = createRSIIndicator(
  true,   // enabled
  14,     // period
  3,      // paneIndex
  100     // paneHeight
);
```

## Component Props

### ReusableChart Props

```typescript
interface ReusableChartProps {
  /** Trading symbol (e.g., 'NSE:RELIANCE', 'NASDAQ:AAPL') */
  symbol?: string;
  
  /** Chart resolution (e.g., '1D', '1H', '15') */
  resolution?: string;
  
  /** Number of bars to fetch */
  barsCount?: number;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Show grid lines */
  showGrid?: boolean;
  
  /** Array of indicator configurations */
  indicators?: IndicatorConfig[];
  
  /** Custom API endpoint (defaults to /api/chart-data) */
  apiEndpoint?: string;
  
  /** Callback when chart is ready */
  onChartReady?: (chart: IChartApi) => void;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: ChartDataResponse) => void;
}
```

### Default Values

- `symbol`: `'NSE:JUNIPER'`
- `resolution`: `'1D'`
- `barsCount`: `300`
- `height`: `500`
- `showGrid`: `true`
- `indicators`: `[]` (empty array)
- `apiEndpoint`: `'/api/chart-data'`

## Dynamic Indicator Management

### Using React State

```tsx
import { useState, useMemo } from 'react';
import { ReusableChart } from '@/components/ReusableChart';
import { createVolumeIndicator, createSMAIndicator, createCVDIndicator } from '@/types/chartIndicators';

function DynamicChart() {
  const [showVolume, setShowVolume] = useState(true);
  const [showSMA, setShowSMA] = useState(true);
  const [showCVD, setShowCVD] = useState(false);
  const [cvdPeriod, setCvdPeriod] = useState('3M');
  
  // Rebuild indicators when state changes
  const indicators = useMemo(() => {
    const configs = [];
    
    if (showVolume) {
      configs.push(createVolumeIndicator(true, 1, 100));
    }
    
    if (showSMA) {
      configs.push(createSMAIndicator(true, 20));
    }
    
    if (showCVD) {
      configs.push(createCVDIndicator(true, cvdPeriod, undefined, 2, 120));
    }
    
    return configs;
  }, [showVolume, showSMA, showCVD, cvdPeriod]);
  
  return (
    <div>
      {/* Controls */}
      <div>
        <label>
          <input 
            type="checkbox" 
            checked={showVolume} 
            onChange={(e) => setShowVolume(e.target.checked)} 
          />
          Volume
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={showSMA} 
            onChange={(e) => setShowSMA(e.target.checked)} 
          />
          SMA(20)
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={showCVD} 
            onChange={(e) => setShowCVD(e.target.checked)} 
          />
          CVD
        </label>
        
        {showCVD && (
          <select value={cvdPeriod} onChange={(e) => setCvdPeriod(e.target.value)}>
            <option value="1M">1 Month</option>
            <option value="3M">3 Months</option>
            <option value="6M">6 Months</option>
            <option value="1Y">1 Year</option>
          </select>
        )}
      </div>
      
      {/* Chart */}
      <ReusableChart
        symbol="NSE:RELIANCE"
        resolution="1D"
        indicators={indicators}
      />
    </div>
  );
}
```

## Extending with Custom Indicators

### Step 1: Define Indicator Type

Add to `src/types/chartIndicators.ts`:

```typescript
export interface MyCustomIndicatorConfig extends BaseIndicatorConfig {
  type: 'my-custom';
  displayMode: 'pane'; // or 'overlay'
  options: {
    param1: number;
    param2: string;
  };
}

// Update union type
export type IndicatorConfig = 
  | CVDIndicatorConfig
  | VolumeIndicatorConfig
  | SMAIndicatorConfig
  | MyCustomIndicatorConfig; // Add here

// Helper function
export function createMyCustomIndicator(
  enabled: boolean,
  param1: number,
  param2: string,
  paneIndex?: number
): MyCustomIndicatorConfig {
  return {
    id: 'my-custom',
    type: 'my-custom',
    name: 'My Custom Indicator',
    enabled,
    displayMode: 'pane',
    paneIndex,
    options: { param1, param2 },
  };
}
```

### Step 2: Implement Renderer

Add to `src/lib/chart-data/indicatorRenderer.ts`:

```typescript
function renderMyCustom(
  chart: IChartApi,
  config: MyCustomIndicatorConfig,
  bars: OHLCVBar[]
): IndicatorRenderResult {
  // Process data
  const data = bars.map(bar => ({
    time: bar.time,
    value: bar.close * config.options.param1, // Example calculation
  }));
  
  // Create series
  const series = chart.addSeries(LineSeries, {
    color: '#FF6B6B',
    lineWidth: 2,
    title: config.name,
  });
  
  series.setData(data as any);
  
  // Move to pane if needed
  if (config.paneIndex !== undefined) {
    series.moveToPane(config.paneIndex);
  }
  
  return { config, series, paneIndex: config.paneIndex };
}

// Add to switch statement in IndicatorRenderer.renderIndicator()
case 'my-custom':
  result = renderMyCustom(this.chart, config, this.bars);
  break;
```

### Step 3: Use Your Indicator

```tsx
import { createMyCustomIndicator } from '@/types/chartIndicators';

<ReusableChart
  symbol="NSE:TCS"
  indicators={[
    createMyCustomIndicator(true, 1.5, 'config-value', 3)
  ]}
/>
```

## Pane Management

### Pane Numbering

- **Pane 0**: Main price chart (candlesticks) - always exists
- **Pane 1+**: Indicator panes - created as needed

### Pane Configuration

```typescript
// Volume in pane 1
createVolumeIndicator(true, 1, 100),

// CVD in pane 2  
createCVDIndicator(true, '3M', undefined, 2, 120),

// RSI in pane 3 (when implemented)
createRSIIndicator(true, 14, 3, 100),
```

### Pane Behavior

- Panes are created automatically when series are moved to them
- Empty panes are automatically removed
- Pane heights can be set programmatically
- Users can manually resize panes by dragging separators
- Minimum pane height is 30px (enforced by library)

## Best Practices

### 1. Use Memoization

Always wrap indicator configs in `useMemo` to prevent unnecessary re-renders:

```tsx
const indicators = useMemo(() => [
  createVolumeIndicator(enabled, 1, 100),
  createSMAIndicator(enabled, period),
], [enabled, period]);
```

### 2. Assign Consistent Pane Indexes

Keep indicator pane assignments predictable:

```tsx
// GOOD: Fixed pane assignments
const indicators = [
  createVolumeIndicator(showVol, 1, 100),     // Always pane 1
  createCVDIndicator(showCVD, '3M', '', 2, 120), // Always pane 2
  createRSIIndicator(showRSI, 14, 3, 100),    // Always pane 3
];

// BAD: Dynamic pane assignments
const paneIdx = showVol ? 2 : 1; // Confusing when toggling
createCVDIndicator(true, '3M', '', paneIdx, 120);
```

### 3. Set Reasonable Pane Heights

- **Volume**: 80-120px
- **CVD**: 100-150px
- **RSI/MACD**: 80-120px
- **Bollinger Bands**: Overlay (no pane)

### 4. Limit Indicator Count

Keep chart readable by limiting active indicators:
- **3-5 indicators**: Optimal
- **6+ indicators**: Can become cluttered
- Consider using tabs/views for different indicator sets

### 5. Handle Loading States

The chart handles auth and data loading automatically:

```tsx
<ReusableChart
  symbol="NSE:RELIANCE"
  indicators={indicators}
  onDataLoaded={(data) => {
    console.log(`Loaded ${data.bars.length} bars`);
  }}
  onChartReady={(chart) => {
    console.log('Chart ready, panes:', chart.panes().length);
  }}
/>
```

## Migration Guide

### From TradingViewLiveChart to ReusableChart

**Before:**
```tsx
<TradingViewLiveChart
  symbol="NSE:RELIANCE"
  resolution="1D"
  showSMA={true}
  showVolume={true}
  showCVD={true}
  cvdAnchorPeriod="3M"
  cvdTimeframe="30S"
/>
```

**After:**
```tsx
<ReusableChart
  symbol="NSE:RELIANCE"
  resolution="1D"
  indicators={[
    createSMAIndicator(true, 20),
    createVolumeIndicator(true, 1, 100),
    createCVDIndicator(true, '3M', '30S', 2, 120),
  ]}
/>
```

### Backward Compatibility

The old `TradingViewLiveChart` component remains available and functional. You can switch between implementations:

```tsx
const [useNewChart, setUseNewChart] = useState(false);

{useNewChart ? (
  <ReusableChart symbol={symbol} indicators={indicators} />
) : (
  <TradingViewLiveChart 
    symbol={symbol} 
    showSMA={true} 
    showVolume={true} 
  />
)}
```

## Troubleshooting

### Indicators Not Appearing

1. **Check enabled flag**
   ```typescript
   createVolumeIndicator(true, 1, 100) // Must be true
   ```

2. **Verify pane indexes**
   - Pane 0 is main chart
   - Indicators need paneIndex ≥ 1

3. **Check indicator data**
   - CVD requires backend API support
   - Volume/SMA calculated from OHLCV bars

### Panes Not Separating

1. **Set explicit heights**
   ```typescript
   createVolumeIndicator(true, 1, 100) // 100px height
   ```

2. **Use different pane indexes**
   - Volume: pane 1
   - CVD: pane 2
   - Don't use same paneIndex for multiple indicators

### Performance Issues

1. **Limit bar count**
   ```tsx
   <ReusableChart barsCount={300} /> // Not 10000
   ```

2. **Use memoization**
   ```tsx
   const indicators = useMemo(() => [...], [deps]);
   ```

3. **Reduce active indicators**
   - Max 5 indicators simultaneously
   - Disable unused indicators

## Examples

### Example 1: Day Trading Setup

```tsx
<ReusableChart
  symbol="NSE:NIFTY50"
  resolution="5" // 5-minute bars
  barsCount={200}
  height={800}
  indicators={[
    createVolumeIndicator(true, 1, 80),
    createSMAIndicator(true, 9, '#26a69a'),   // Fast SMA
    createSMAIndicator(true, 21, '#2962FF'),  // Slow SMA
    createCVDIndicator(true, '1W', '30S', 2, 120),
  ]}
/>
```

### Example 2: Swing Trading Setup

```tsx
<ReusableChart
  symbol="NSE:RELIANCE"
  resolution="1D"
  barsCount={500}
  height={700}
  indicators={[
    createVolumeIndicator(true, 1, 100),
    createSMAIndicator(true, 20, '#26a69a'),  // 20-day SMA
    createSMAIndicator(true, 50, '#2962FF'),  // 50-day SMA
    createSMAIndicator(true, 200, '#FF6B6B'), // 200-day SMA
  ]}
/>
```

### Example 3: Minimal Setup

```tsx
<ReusableChart
  symbol="NSE:TCS"
  resolution="1D"
  indicators={[
    createVolumeIndicator(true, 1, 80),
  ]}
/>
```

## API Reference

See TypeScript definitions:
- `src/types/chartIndicators.ts` - All indicator types and helpers
- `src/lib/chart-data/indicatorRenderer.ts` - Rendering logic
- `src/components/ReusableChart.tsx` - Component implementation

## Contributing

To add a new indicator:

1. Define type in `chartIndicators.ts`
2. Add helper function (e.g., `createMyIndicator()`)
3. Implement renderer in `indicatorRenderer.ts`
4. Add to switch statement in `IndicatorRenderer.renderIndicator()`
5. Update this documentation
6. Add tests (future)

---

**Status**: ✅ **PRODUCTION READY**

**Version**: 1.0.0

**Last Updated**: December 17, 2025
