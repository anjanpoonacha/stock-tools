# CVD (Cumulative Volume Delta) Indicator Implementation

## Overview

Successfully implemented support for TradingView's Cumulative Volume Delta (CVD) indicator in the WebSocket client.

## Implementation Date

December 17, 2025

## Components Added

### 1. CVD Constants (`src/lib/tradingview/cvd-constants.ts`)

Contains:
- **Encrypted Pine Script Text** (17,666 characters)
  - Required by TradingView's WebSocket API
  - Proprietary encrypted format
  - Cannot be generated, must be captured from HAR files
- **Pine Features** - Feature flags for CVD indicator
- **Pine Metadata** - pineId and version

### 2. Type Definitions (`src/lib/tradingview/types.ts`)

Added types for study/indicator support:
- `StudyInput` - Configuration parameter
- `StudyConfig` - Indicator configuration
- `StudyBar` - Single data point
- `StudyData` - Full indicator data container
- `CVDConfig` - Type-safe CVD configuration helper

### 3. BaseWebSocketClient Extensions (`src/lib/tradingview/baseWebSocketClient.ts`)

New methods:
- `createStudy()` - Request indicator from TradingView
- `getStudies()` - Get all indicators
- `getStudy()` - Get specific indicator by ID
- `handleStudyLoading()` - Handle study loading confirmation
- Enhanced `handleDataUpdate()` - Extract both OHLCV and study data

### 4. POC Client Update (`scripts/poc-tradingview/poc-3-websocket-client.ts`)

Added CVD support:
- Configurable CVD parameters (anchor period, timeframe)
- `buildCVDConfig()` method using encrypted text constants
- CVD data extraction and reporting

## Usage

### Basic Usage (Chart Resolution)

```typescript
const client = new TradingViewWebSocketClient({
  jwtToken,
  symbol: 'NSE:JUNIPER',
  resolution: '1D',
  barsCount: 300,
  cvdEnabled: true,
  cvdAnchorPeriod: '3M',  // 3 months lookback
  // cvdTimeframe: undefined  // Use chart resolution
});

await client.connect();
await client.authenticate();
await client.fetchBars();

const result = client.getResult();
const cvdData = result.indicators?.cvd;
```

### Custom Timeframe (30-second bars)

```typescript
const client = new TradingViewWebSocketClient({
  jwtToken,
  symbol: 'NSE:JUNIPER',
  resolution: '1D',
  barsCount: 300,
  cvdEnabled: true,
  cvdAnchorPeriod: '3M',
  cvdTimeframe: '30S',  // 30-second CVD bars
});
```

### 15-second bars

```typescript
cvdTimeframe: '15S'
```

## CVD Data Structure

Each CVD data point contains 7 values:

```typescript
{
  time: 1734407100,  // Unix timestamp
  values: [
    -2464596,  // CVD Open
    -2355382,  // CVD High
    -2464596,  // CVD Low
    -2381495,  // CVD Close
    0,         // Additional metric 1
    0,         // Additional metric 2
    0          // Additional metric 3
  ]
}
```

## Test Results

**Test Run: December 17, 2025**

```
Symbol: NSE:JUNIPER
Resolution: 1D
OHLCV Bars: 300
CVD Data Points: 400
Anchor Period: 3M
Timeframe: 30S

✅ Successfully retrieved CVD data
✅ Values are realistic (negative millions for cumulative delta)
⚠️ Early dates show placeholder values (1e+100)
```

## Configuration Options

### Anchor Period (`cvdAnchorPeriod`)

Determines historical lookback:
- `"1W"` - 1 week
- `"1M"` - 1 month
- `"3M"` - 3 months (default)
- `"6M"` - 6 months
- `"1Y"` - 1 year

### Custom Timeframe (`cvdTimeframe`)

When specified, CVD uses independent resolution:
- `"15S"` - 15-second bars
- `"30S"` - 30-second bars
- `"1"` - 1-minute bars
- `"5"` - 5-minute bars
- Leave undefined to use chart resolution

## Encrypted Text Maintenance

The encrypted Pine script text may need updates if TradingView modifies the CVD indicator.

### Extracting New Encrypted Text

1. Open TradingView in Chrome with DevTools (Network tab)
2. Add CVD indicator to a chart
3. Export HAR file: Right-click → "Save all as HAR"
4. Search for `create_study` message with `pineId: "STD;Cumulative%1Volume%1Delta"`
5. Extract the `text` field
6. Update `CVD_ENCRYPTED_TEXT` in `cvd-constants.ts`

### Example HAR Extraction

```python
import json

with open('trading-chart.har', 'r') as f:
    data = json.load(f)

for entry in data['log']['entries']:
    for msg in entry.get('_webSocketMessages', []):
        if 'Cumulative' in msg.get('data', ''):
            # Parse and extract text field
            ...
```

## Limitations

1. **Encrypted Text Dependency**
   - Cannot generate encrypted text ourselves
   - Must capture from TradingView
   - May break if TradingView updates encryption

2. **Placeholder Values**
   - Early dates may show `1e+100` (no data available)
   - This is normal TradingView behavior

3. **TradingView Account Required**
   - Need valid JWT token
   - Token expires after some time

## Future Improvements

1. **Add More Indicators**
   - RSI, MACD, Bollinger Bands
   - Use same encrypted text approach

2. **Auto-Update Mechanism**
   - Detect when encrypted text is outdated
   - Guide user to extract new version

3. **Production API Integration**
   - Add CVD support to `/api/chart-data` endpoint
   - Make parameters configurable via query params

4. **Data Validation**
   - Filter out placeholder values (`1e+100`)
   - Add data quality checks

## References

- HAR File: `trading-chart-3.har`
- POC Validation: `scripts/poc-tradingview/POC_VALIDATION_REPORT.md`
- Type Definitions: `src/lib/tradingview/types.ts`
- Constants: `src/lib/tradingview/cvd-constants.ts`
