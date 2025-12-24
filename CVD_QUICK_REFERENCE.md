# CVD Quick Reference Card

Quick reference for CVD (Cumulative Volume Delta) integration in production code.

## 🚀 Quick Start

### Import Types
```typescript
import type { CVDAnchorPeriod, CVDDeltaTimeframe } from '@/lib/tradingview/cvdTypes';
```

### Import Validation
```typescript
import { 
  getValidDeltaTimeframes, 
  validateCVDSettings 
} from '@/lib/tradingview/cvdValidation';
```

## 📋 Valid Values

### Anchor Periods
```typescript
'1W' | '1M' | '3M' | '6M' | '12M'
```
**Default**: `'3M'`

### Delta Timeframes
```typescript
'15S' | '30S' | '1' | '5' | '15' | '30' | '60' | 'D' | 'W'
```

## 🔒 Critical Constraint

**Delta timeframe MUST be < Chart timeframe**

```typescript
// ✅ Valid
{ chart: '1D', delta: '1' }   // 1min < 1day
{ chart: '60', delta: '15' }  // 15min < 60min

// ❌ Invalid
{ chart: '1D', delta: 'W' }   // 1week > 1day
{ chart: '15', delta: '60' }  // 60min > 15min
```

## 💻 Usage Examples

### Get Valid Options
```typescript
const validDeltas = getValidDeltaTimeframes('1D');
// Returns: ['15S', '30S', '1', '5', '15', '30', '60']
```

### Validate Settings
```typescript
const result = validateCVDSettings('1D', '3M', 'W');
if (!result.valid) {
  console.error(result.error);
  // Error: Delta timeframe "W" must be less than chart timeframe "1D"
}
```

### Create CVD Config
```typescript
import { createCVDIndicator } from '@/types/chartIndicators';

const cvdConfig = createCVDIndicator(
  true,      // enabled
  '3M',      // anchorPeriod
  '1',       // timeframe
  2,         // paneIndex
  120        // paneHeight
);
```

### In React Component
```typescript
import { useMemo } from 'react';
import { getValidDeltaTimeframes } from '@/lib/tradingview/cvdValidation';

function CVDSettings({ chartResolution }: { chartResolution: string }) {
  const validDeltas = useMemo(
    () => getValidDeltaTimeframes(chartResolution),
    [chartResolution]
  );
  
  return (
    <select>
      {validDeltas.map(tf => (
        <option key={tf} value={tf}>{tf}</option>
      ))}
    </select>
  );
}
```

### API Call
```typescript
const response = await fetch('/api/chart-data', {
  method: 'POST',
  body: JSON.stringify({
    symbol: 'NSE:RELIANCE',
    resolution: '1D',
    barsCount: 300,
    cvdEnabled: true,
    cvdAnchorPeriod: '3M',
    cvdTimeframe: '1'
  })
});

// If validation fails:
// Response: 400 Bad Request
// Body: { error: "CVD validation failed: ..." }
```

## 🎯 Optimal Settings

Based on 240-combination test (100% success):

### Daily Charts
```typescript
{
  chartResolution: '1D',
  cvdAnchorPeriod: '3M',
  cvdTimeframe: '1'  // 1 minute
}
```

### Intraday Charts
```typescript
{
  chartResolution: '15',
  cvdAnchorPeriod: '3M',
  cvdTimeframe: '15S'  // 15 seconds
}
```

## 🐛 Troubleshooting

### Issue: "CVD validation failed"
**Solution**: Check that delta timeframe < chart timeframe

### Issue: Empty dropdown in UI
**Solution**: Chart resolution may be too small (e.g., 1-minute)

### Issue: Type error on `anchorPeriod`
**Solution**: Use `CVDAnchorPeriod` type, ensure value is one of: 1W, 1M, 3M, 6M, 12M

## 📚 Full Documentation

- [CVD Settings Guide](./docs/CVD_SETTINGS_GUIDE.md) - Comprehensive user guide with 240 tested combinations

## 🔗 Source Files

- Types: `src/lib/tradingview/cvdTypes.ts`
- Validation: `src/lib/tradingview/cvdValidation.ts`
- UI Component: `src/components/chart/indicators/CVDSettings.tsx`
- API Route: `src/app/api/chart-data/route.ts`

---

**Integration Date**: December 23, 2024  
**Test Coverage**: 240 combinations (100% success)
