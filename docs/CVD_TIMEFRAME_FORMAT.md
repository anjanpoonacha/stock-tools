# CVD Timeframe Format Specification

## 📋 Overview

This document specifies the correct timeframe format for CVD (Cumulative Volume Delta) indicator settings. The format follows TradingView's resolution syntax.

---

## ✅ Correct Format

### Format Rules

| Time Unit | Format | Examples | Notes |
|-----------|--------|----------|-------|
| **Seconds** | Number + `S` (uppercase) | `15S`, `30S`, `45S` | Must use uppercase S |
| **Minutes** | Number only | `1`, `5`, `15`, `30`, `60`, `75`, `188` | No letter suffix |
| **Hours** | Not directly supported | Use minutes: `60`, `120`, `240` | Convert hours to minutes |
| **Days** | Number + `D` (uppercase) | `1D`, `2D`, `3D` | Must use uppercase D |
| **Weeks** | Number + `W` (uppercase) | `1W`, `2W`, `4W` | Must use uppercase W |
| **Months** | Number + `M` (uppercase) | `1M`, `3M`, `6M`, `12M` | Must use uppercase M |
| **Years** | Number + `Y` (uppercase) | `1Y`, `2Y`, `3Y`, `5Y` | Must use uppercase Y |

---

## 📊 Examples

### ✅ Valid Formats

```typescript
// Seconds (uppercase S)
'15S'   // 15 seconds
'30S'   // 30 seconds
'45S'   // 45 seconds

// Minutes (number only)
'1'     // 1 minute
'5'     // 5 minutes
'15'    // 15 minutes
'30'    // 30 minutes
'60'    // 60 minutes (1 hour)
'75'    // 75 minutes
'188'   // 188 minutes
'240'   // 240 minutes (4 hours)

// Days (uppercase D)
'1D'    // 1 day
'2D'    // 2 days
'3D'    // 3 days
'5D'    // 5 days (1 week)

// Weeks (uppercase W)
'1W'    // 1 week
'2W'    // 2 weeks
'4W'    // 4 weeks (1 month)

// Months (uppercase M)
'1M'    // 1 month
'3M'    // 3 months
'6M'    // 6 months
'12M'   // 12 months (1 year)

// Years (uppercase Y)
'1Y'    // 1 year
'2Y'    // 2 years
'3Y'    // 3 years
'5Y'    // 5 years
```

### ❌ Invalid Formats

```typescript
// Wrong: lowercase letters
'15s'   // Should be '15S'
'1m'    // Should be '1'
'1d'    // Should be '1D'
'1w'    // Should be '1W'
'1y'    // Should be '1Y'

// Wrong: minutes with 'm' suffix
'5m'    // Should be '5'
'15m'   // Should be '15'
'60m'   // Should be '60'

// Wrong: hours with 'h' suffix (not supported)
'1h'    // Should be '60' (60 minutes)
'2h'    // Should be '120' (120 minutes)
'4h'    // Should be '240' (240 minutes)

// Wrong: mixed case
'15s'   // Should be '15S'
'1D'    // Correct (uppercase is required)
```

---

## 🔍 How It's Used

### 1. API Route (`/api/chart-data`)

```typescript
// Query parameter: cvdTimeframe
GET /api/chart-data?symbol=NSE:JUNIPER&cvdTimeframe=30S

// Valid examples:
?cvdTimeframe=15S   // 15 seconds
?cvdTimeframe=5     // 5 minutes
?cvdTimeframe=1D    // 1 day
```

### 2. CVD Configuration

```typescript
// In TradingView WebSocket message
{
  in_0: { v: '3M', f: true, t: 'resolution' },      // Anchor period
  in_1: { v: true, f: true, t: 'bool' },            // Use custom timeframe
  in_2: { v: '30S', f: true, t: 'resolution' },     // Custom timeframe
}
```

### 3. Type Definition

```typescript
export interface CVDConfig {
  anchorPeriod: string;           // e.g., "3M", "1M", "1W"
  useCustomTimeframe: boolean;    // Whether to use custom timeframe
  customTimeframe?: string;       // e.g., "30S", "15S", "5", "1D"
}
```

---

## 🎯 Use Cases

### Scalping (Ultra Short-term)
```typescript
{
  anchorPeriod: '1W',
  useCustomPeriod: true,
  customPeriod: '15S',  // Reset every 15 seconds
}
```

### Day Trading (Short-term)
```typescript
{
  anchorPeriod: '1M',
  useCustomPeriod: true,
  customPeriod: '5',    // Reset every 5 minutes
}
```

### Swing Trading (Medium-term)
```typescript
{
  anchorPeriod: '3M',
  useCustomPeriod: true,
  customPeriod: '1D',   // Reset every day
}
```

### Position Trading (Long-term)
```typescript
{
  anchorPeriod: '1Y',
  useCustomPeriod: false,  // Use anchor period only
}
```

---

## 💻 Implementation

### Constants File

```typescript
// src/lib/chart/constants.ts
export const CVD_CUSTOM_PERIODS = [
  { value: '15S', label: '15 Seconds' },
  { value: '30S', label: '30 Seconds' },
  { value: '1', label: '1 Minute' },
  { value: '5', label: '5 Minutes' },
  { value: '15', label: '15 Minutes' },
  { value: '75', label: '75 Minutes' },
  { value: '188', label: '188 Minutes' },
  { value: '1D', label: '1 Day' },
] as const;
```

### Component Usage

```tsx
// src/components/chart/indicators/CVDSettings.tsx
<Input
  placeholder="e.g., 30S, 5, 60, 1D"
  // User can type any valid format
/>

<p className="text-xs text-muted-foreground">
  Seconds: 15S, 30S | Minutes: 1, 5, 15, 60 | Days/Weeks/Months: 1D, 1W, 1M, 3M, 1Y
</p>
```

---

## 🧪 Validation

### Client-Side Validation (Optional)

```typescript
function isValidCVDTimeframe(value: string): boolean {
  // Seconds: 1S to 999S
  if (/^\d{1,3}S$/.test(value)) return true;
  
  // Minutes: 1 to 9999
  if (/^\d{1,4}$/.test(value)) return true;
  
  // Days: 1D to 365D
  if (/^\d{1,3}D$/.test(value)) return true;
  
  // Weeks: 1W to 52W
  if (/^\d{1,2}W$/.test(value)) return true;
  
  // Months: 1M to 60M
  if (/^\d{1,2}M$/.test(value)) return true;
  
  // Years: 1Y to 10Y
  if (/^\d{1,2}Y$/.test(value)) return true;
  
  return false;
}

// Examples
isValidCVDTimeframe('15S');   // ✅ true
isValidCVDTimeframe('5');     // ✅ true
isValidCVDTimeframe('1D');    // ✅ true
isValidCVDTimeframe('15s');   // ❌ false (lowercase)
isValidCVDTimeframe('5m');    // ❌ false (minutes shouldn't have suffix)
isValidCVDTimeframe('1h');    // ❌ false (hours not supported)
```

---

## 📚 Reference Sources

1. **API Documentation**: `src/app/api/chart-data/route.ts:26`
   ```typescript
   // cvdTimeframe: CVD custom timeframe ('15S', '30S', '1', '5', etc.) - optional
   ```

2. **Type Definition**: `src/lib/tradingview/types.ts:136`
   ```typescript
   customTimeframe?: string;  // e.g., "30S", "15S" (when useCustomTimeframe=true)
   ```

3. **Historical Client**: `src/lib/tradingview/historicalDataClient.ts`
   ```typescript
   in_2: { v: this.cvdTimeframe || '', f: true, t: 'resolution' }
   ```

4. **Storage Example**: `src/lib/storage/types.ts`
   ```typescript
   cvdCustomPeriod: '30S',
   ```

---

## ⚠️ Common Mistakes

| Mistake | Correct | Reason |
|---------|---------|--------|
| `15s` | `15S` | Seconds must use uppercase S |
| `5m` | `5` | Minutes should be number only |
| `1h` | `60` | Hours not supported, use minutes |
| `1d` | `1D` | Days must use uppercase D |
| `1w` | `1W` | Weeks must use uppercase W |
| `1y` | `1Y` | Years must use uppercase Y |

---

## 🔄 Conversion Table

| Human Readable | Correct Format | Notes |
|----------------|----------------|-------|
| 15 seconds | `15S` | Uppercase S required |
| 30 seconds | `30S` | Uppercase S required |
| 1 minute | `1` | Number only |
| 5 minutes | `5` | Number only |
| 1 hour | `60` | Convert to minutes |
| 2 hours | `120` | Convert to minutes |
| 4 hours | `240` | Convert to minutes |
| 1 day | `1D` | Uppercase D required |
| 1 week | `1W` or `5D` | Both valid |
| 1 month | `1M` | Uppercase M required |
| 1 year | `1Y` or `12M` | Both valid |

---

## 🎓 Summary

**Golden Rules:**
1. ✅ **Seconds**: Use uppercase `S` (e.g., `15S`, `30S`)
2. ✅ **Minutes**: Use number only (e.g., `1`, `5`, `15`, `60`)
3. ✅ **Days/Weeks/Months/Years**: Use uppercase letters (e.g., `1D`, `1W`, `1M`, `1Y`)
4. ❌ **Never** use lowercase letters
5. ❌ **Never** use 'm' suffix for minutes
6. ❌ **Never** use 'h' for hours (convert to minutes)

**When in doubt**: Check `src/lib/chart/constants.ts` for the predefined valid formats.
