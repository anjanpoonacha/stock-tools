# Reusable Chart - Quick Start

## 30-Second Quick Start

```tsx
import { ReusableChart } from '@/components/ReusableChart';
import { createVolumeIndicator, createSMAIndicator } from '@/types/chartIndicators';

<ReusableChart
  symbol="NSE:RELIANCE"
  indicators={[
    createVolumeIndicator(true),
    createSMAIndicator(true, 20),
  ]}
/>
```

## Available Indicators

### Volume
```tsx
createVolumeIndicator(
  true,  // enabled
  1,     // paneIndex
  100    // paneHeight (px)
)
```

### SMA (Simple Moving Average)
```tsx
createSMAIndicator(
  true,       // enabled
  20,         // period
  '#26a69a'   // color
)
```

### CVD (Cumulative Volume Delta)
```tsx
createCVDIndicator(
  true,       // enabled
  '3M',       // anchorPeriod: '1W'|'1M'|'3M'|'6M'|'1Y'
  '30S',      // timeframe: '15S'|'30S'|'1'|'5'|'15' (optional)
  2,          // paneIndex
  120         // paneHeight (px)
)
```

## Common Patterns

### Multiple SMAs
```tsx
<ReusableChart
  symbol="NSE:TCS"
  indicators={[
    createSMAIndicator(true, 20, '#26a69a'),
    createSMAIndicator(true, 50, '#2962FF'),
    createSMAIndicator(true, 200, '#FF6B6B'),
  ]}
/>
```

### Complete Setup
```tsx
<ReusableChart
  symbol="NSE:RELIANCE"
  resolution="1D"
  barsCount={300}
  height={800}
  indicators={[
    createVolumeIndicator(true, 1, 100),
    createSMAIndicator(true, 20),
    createCVDIndicator(true, '3M', '30S', 2, 120),
  ]}
/>
```

### Dynamic Indicators
```tsx
const indicators = useMemo(() => {
  const configs = [];
  
  if (showVolume) {
    configs.push(createVolumeIndicator(true, 1, 100));
  }
  
  if (showSMA) {
    configs.push(createSMAIndicator(true, 20));
  }
  
  return configs;
}, [showVolume, showSMA]);

<ReusableChart symbol="NSE:TCS" indicators={indicators} />
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `symbol` | string | `'NSE:JUNIPER'` | Trading symbol |
| `resolution` | string | `'1D'` | Chart timeframe |
| `barsCount` | number | `300` | Number of bars |
| `height` | number | `500` | Chart height (px) |
| `showGrid` | boolean | `true` | Show grid lines |
| `indicators` | IndicatorConfig[] | `[]` | Indicator configs |

## Pane Layout

```
┌─────────────────────────────┐
│ Pane 0: Price (Candles+SMA) │ ← Overlay indicators
├─────────────────────────────┤
│ Pane 1: Volume (100px)      │ ← First indicator pane
├─────────────────────────────┤
│ Pane 2: CVD (120px)         │ ← Second indicator pane
└─────────────────────────────┘
```

## Need More?

- **Full Guide**: [`REUSABLE_CHART_GUIDE.md`](./REUSABLE_CHART_GUIDE.md)
- **Implementation**: [`REUSABLE_CHART_IMPLEMENTATION.md`](./REUSABLE_CHART_IMPLEMENTATION.md)
- **Types**: `src/types/chartIndicators.ts`
- **Component**: `src/components/ReusableChart.tsx`
