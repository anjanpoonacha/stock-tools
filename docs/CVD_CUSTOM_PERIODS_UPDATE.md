# CVD Custom Periods Update

## 🎯 Overview

Enhanced the CVD (Cumulative Volume Delta) indicator settings to support:
1. **Predefined short-term periods** (15s, 30s, 1m, 5m, 15m, 75m, 188m, 1D)
2. **User manual input** for any custom timeframe

---

## 📊 Changes Made

### 1. Updated CVD_CUSTOM_PERIODS Constant

**File:** `src/lib/chart/constants.ts`

**Before:**
```typescript
export const CVD_CUSTOM_PERIODS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} Month${i + 1 > 1 ? 's' : ''}`,
})) as const;
// Output: 1 Month, 2 Months, ..., 12 Months
```

**After:**
```typescript
export const CVD_CUSTOM_PERIODS = [
  { value: '15s', label: '15 Seconds' },
  { value: '30s', label: '30 Seconds' },
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '75m', label: '75 Minutes' },
  { value: '188m', label: '188 Minutes' },
  { value: '1D', label: '1 Day' },
] as const;
```

### 2. Enhanced CVDSettings Component

**File:** `src/components/chart/indicators/CVDSettings.tsx`

**New Features:**
- ✅ **Custom Period Dropdown** - Select from 8 predefined periods
- ✅ **Manual Input Toggle** - Checkbox to enable user input
- ✅ **Text Input Field** - Enter any custom timeframe
- ✅ **Format Guidance** - Helper text showing valid formats

**New Settings Fields:**
```typescript
{
  anchorPeriod: '3M',          // Existing: Anchor period
  useCustomPeriod: false,      // Existing: Enable custom period
  customPeriod: '15s',         // Updated: Selected custom period
  useManualInput: false,       // NEW: Enable manual input
  manualPeriod: '',            // NEW: User-entered period
}
```

### 3. Updated Indicator Registry

**File:** `src/lib/chart/indicatorRegistry.ts`

Added new default settings fields:
```typescript
defaultSettings: {
  anchorPeriod: '3M',
  useCustomPeriod: false,
  customPeriod: '15s',        // Updated default
  useManualInput: false,      // NEW
  manualPeriod: '',           // NEW
}
```

---

## 🎨 UI Layout

### CVD Settings Hierarchy

```
CVD Indicator Settings
└── Anchor Period: [Dropdown: 3M, 6M, 1Y, 2Y, 3Y, 5Y]
    └── ☑ Use Custom Period
        └── Custom Period: [Dropdown: 15s, 30s, 1m, 5m, 15m, 75m, 188m, 1D]
            └── ☑ Custom Value
                └── Enter Period: [Text Input: e.g., 30s, 5m, 2h, 1D]
                    └── Format: 15s, 30s, 1m, 5m, 1h, 1D, 1W, 1M, 1Y
```

### Visual Example

```
┌─────────────────────────────────────┐
│ CVD Indicator Settings              │
├─────────────────────────────────────┤
│ Anchor Period                       │
│ ┌─────────────────────────────────┐ │
│ │ 3 Months                     ▼  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ☑ Use Custom Period                │
│                                     │
│   Custom Period                     │
│   ┌─────────────────────────────┐  │
│   │ 15 Seconds               ▼  │  │
│   └─────────────────────────────┘  │
│                                     │
│   ☑ Custom Value                   │
│                                     │
│     Enter Period                    │
│     ┌─────────────────────────┐    │
│     │ 30s                     │    │
│     └─────────────────────────┘    │
│     Format: 15s, 30s, 1m, 5m...    │
└─────────────────────────────────────┘
```

---

## 📝 Supported Timeframe Formats

### Predefined Dropdown Options
- `15s` - 15 Seconds
- `30s` - 30 Seconds
- `1m` - 1 Minute
- `5m` - 5 Minutes
- `15m` - 15 Minutes
- `75m` - 75 Minutes
- `188m` - 188 Minutes
- `1D` - 1 Day

### Manual Input Formats (Examples)
Users can type any valid TradingView timeframe:

**Seconds:**
- `15s`, `30s`, `45s`, `60s`

**Minutes:**
- `1m`, `5m`, `15m`, `30m`, `60m`, `75m`, `188m`

**Hours:**
- `1h`, `2h`, `4h`, `8h`, `12h`

**Days:**
- `1D`, `2D`, `3D`, `5D`

**Weeks:**
- `1W`, `2W`, `4W`

**Months:**
- `1M`, `3M`, `6M`, `12M`

**Years:**
- `1Y`, `2Y`, `3Y`, `5Y`

---

## 🔍 Logic Flow

### How CVD Period is Determined

```typescript
function getEffectiveCVDPeriod(settings) {
  // 1. If custom period is disabled, use anchor period
  if (!settings.useCustomPeriod) {
    return settings.anchorPeriod;  // e.g., '3M'
  }
  
  // 2. If manual input is enabled, use manual period
  if (settings.useManualInput && settings.manualPeriod) {
    return settings.manualPeriod;  // e.g., '30s'
  }
  
  // 3. Otherwise, use selected custom period
  return settings.customPeriod;  // e.g., '15s'
}
```

**Examples:**

| useCustomPeriod | useManualInput | manualPeriod | customPeriod | Result |
|-----------------|----------------|--------------|--------------|--------|
| `false` | - | - | - | `anchorPeriod` (3M) |
| `true` | `false` | - | `15s` | `15s` |
| `true` | `true` | `30s` | `15s` | `30s` (manual wins) |
| `true` | `true` | `` | `15s` | `15s` (empty manual) |

---

## 🎯 Use Cases

### 1. Day Trader (Short-term)
```
☑ Use Custom Period
  Custom Period: 5 Minutes
  ☐ Custom Value
```
**Result:** CVD resets every 5 minutes

### 2. Scalper (Ultra Short-term)
```
☑ Use Custom Period
  Custom Period: 15 Seconds
  ☐ Custom Value
```
**Result:** CVD resets every 15 seconds

### 3. Custom Strategy
```
☑ Use Custom Period
  Custom Period: 15 Seconds (ignored)
  ☑ Custom Value
    Enter Period: 2h
```
**Result:** CVD resets every 2 hours

### 4. Long-term Investor
```
☐ Use Custom Period
```
**Result:** CVD uses Anchor Period (e.g., 3 Months)

---

## 🚀 Future Enhancements

### Potential Additions
1. **Validation** - Real-time validation of manual input format
2. **Presets** - Save favorite custom periods
3. **Auto-complete** - Suggest valid timeframes as user types
4. **Recent Values** - Show recently used manual periods
5. **Format Converter** - Convert between formats (e.g., 120m → 2h)

### Backend Integration
The manual period value needs to be passed to the CVD calculation API:

```typescript
// In TradingViewLiveChart.tsx
const cvdConfig = indicators.find(i => i.type === 'cvd');
const cvdSettings = cvdConfig?.settings;

// Determine effective period
let cvdTimeframe;
if (cvdSettings.useCustomPeriod) {
  cvdTimeframe = cvdSettings.useManualInput && cvdSettings.manualPeriod
    ? cvdSettings.manualPeriod
    : cvdSettings.customPeriod;
}

// Pass to API
fetchCVDData(symbol, resolution, cvdTimeframe || cvdSettings.anchorPeriod);
```

---

## ✅ Benefits

1. **Flexibility** - Users can use any timeframe they need
2. **Convenience** - Common periods are one-click accessible
3. **Advanced Use** - Manual input for edge cases
4. **User-Friendly** - Clear format guidance
5. **Scalable** - Easy to add more predefined periods

---

## 📋 Files Modified

1. `src/lib/chart/constants.ts` - Updated CVD_CUSTOM_PERIODS
2. `src/components/chart/indicators/CVDSettings.tsx` - Added manual input UI
3. `src/lib/chart/indicatorRegistry.ts` - Updated default settings

---

## 🧪 Testing Checklist

- [ ] Dropdown shows all 8 predefined periods
- [ ] Custom Value checkbox toggles input field
- [ ] Manual input accepts text
- [ ] Helper text displays format guidance
- [ ] Settings persist when toggling indicators
- [ ] Settings save to KV storage
- [ ] Settings load correctly on page refresh
- [ ] Multiple charts can have different manual periods
- [ ] Layout switching preserves manual input values

---

## 📌 Notes

- Manual input validation is currently **client-side only**
- Backend CVD API must support the entered timeframe format
- Invalid timeframes will fail gracefully (backend returns error)
- Empty manual input falls back to dropdown selection
