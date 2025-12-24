# POC: CVD Indicator Without Creating OHLCV Series - Results

**Date:** December 23, 2025  
**POC Script:** `scripts/poc-tradingview/poc-test-cvd-without-series.ts`  
**Test Symbol:** NSE:BSOFT  
**Resolution:** 188 minutes  
**CVD Config:** Anchor=3M, Timeframe=30S

---

## Objective

Validate if TradingView's CVD (Cumulative Volume Delta) indicator can work **WITHOUT** fetching OHLCV bars (i.e., skipping the `createSeries()` call).

### Current Implementation Flow
```
resolveSymbol() → createSeries() → createStudy('cvd_1')
                      ↓
                 Fetches OHLCV bars
                 (can be expensive)
```

### Question
Is the series ID reference ('sds_1' at line 575 in `baseWebSocketClient.ts`) required by TradingView protocol, or can CVD operate independently?

---

## Test Scenarios

### Scenario A: With Series Reference
- Create chart session ✓
- Resolve symbol ✓
- **SKIP** `createSeries()` ✗
- Call `createStudy()` with series reference 'sds_1'
- Wait for CVD data

### Scenario B: Without Series Reference  
- Create chart session ✓
- Resolve symbol ✓
- **SKIP** `createSeries()` ✗
- Call `createStudy()` with **empty** series reference
- Wait for CVD data

---

## Results

### Scenario A: WITH_SERIES_REF
```json
{
  "scenario": "WITH_SERIES_REF",
  "success": false,
  "cvdDataReceived": false,
  "cvdDataPointCount": 0,
  "errorOccurred": false,
  "protocolMessages": {
    "sent": 5,
    "received": 3
  },
  "notes": [
    "Starting POC flow",
    "Chart session created successfully",
    "Symbol resolved successfully",
    "Deliberately skipped createSeries() call",
    "Created CVD with series reference \"sds_1\"",
    "CVD did not return data without series creation"
  ]
}
```

**TradingView Server Response:**
```
critical_error: "unknown parent id"
method: create_study
```

### Scenario B: WITHOUT_SERIES_REF
```json
{
  "scenario": "WITHOUT_SERIES_REF",
  "success": false,
  "cvdDataReceived": false,
  "cvdDataPointCount": 0,
  "errorOccurred": false,
  "protocolMessages": {
    "sent": 5,
    "received": 3
  },
  "notes": [
    "Starting POC flow",
    "Chart session created successfully",
    "Symbol resolved successfully",
    "Deliberately skipped createSeries() call",
    "Created CVD with empty series reference",
    "CVD did not return data without series creation"
  ]
}
```

**TradingView Server Response:**
```
critical_error: "unknown parent id"
method: create_study
```

---

## Conclusion

❌ **CVD REQUIRES `createSeries()` - Protocol Constraint**

### Key Findings

1. **Both scenarios failed** with `critical_error: "unknown parent id"`
2. TradingView server **requires** a valid parent series before creating studies
3. The series reference is **not optional** - it's a protocol requirement
4. CVD **cannot** operate independently of OHLCV data

### Protocol Requirements

The TradingView WebSocket protocol enforces the following hierarchy:
```
Chart Session
  └─ Symbol Resolution
      └─ Series (OHLCV bars) ← REQUIRED PARENT
          └─ Study (CVD indicator)
```

**Critical Error Reason:**  
When `create_study` is called without a valid parent series, the server responds with:
```
"unknown parent id"
```

This confirms that the series ID ('sds_1') in the `create_study` message **MUST** reference an existing series created via `createSeries()`.

---

## Implications for Optimization

### Cannot Skip OHLCV Fetch
The current implementation flow **MUST be maintained**:

1. `resolveSymbol()` - Get symbol metadata
2. `createSeries()` - Fetch OHLCV bars (creates parent series)
3. `createStudy()` - Add CVD indicator (requires parent)

### No Performance Optimization Available
- Cannot skip OHLCV bar fetching for CVD-only requests
- Must fetch base chart data even if only indicator values are needed
- This is a TradingView protocol constraint, not an implementation choice

### Alternative Optimization Strategies
Since we cannot skip the series creation, consider:

1. **Minimize bar count** - Request only minimum required bars for CVD calculation
2. **Resolution optimization** - Use larger timeframes when possible
3. **Caching strategy** - Cache base OHLCV data to avoid repeated fetches
4. **Connection pooling** - Reuse WebSocket connections across multiple symbols

---

## Code Reference

**Current Implementation:**  
`src/lib/tradingview/baseWebSocketClient.ts:571-578`

```typescript
protected async createStudy(
    studyId: string,
    studyName: string,
    config: StudyConfig
): Promise<void> {
    // ...
    this.send(createMessage('create_study', [
        this.chartSessionId,
        studyId,
        'st1',
        'sds_1',  // ← Series reference - REQUIRED by protocol
        studyName,
        config
    ]));
}
```

**POC Validation:**  
`scripts/poc-tradingview/poc-test-cvd-without-series.ts`

---

## Recommendations

1. ✅ **Keep current implementation** - No changes needed
2. ✅ **Document protocol requirement** - Add comments explaining why createSeries() cannot be skipped
3. ✅ **Focus on other optimizations** - Connection pooling, caching, data-driven waits
4. ❌ **Do not attempt to skip createSeries()** - Will result in protocol errors

---

## Test Artifacts

- **Results File:** `scripts/poc-output/poc-cvd-without-series.json`
- **Messages Log:** `scripts/poc-output/poc-cvd-without-series.log`
- **POC Script:** `scripts/poc-tradingview/poc-test-cvd-without-series.ts`

---

## References

- TradingView WebSocket Protocol
- `baseWebSocketClient.ts` - Base client implementation
- `CVD_CONSTANTS.ts` - CVD indicator configuration
- Existing POC scripts: `poc-3-websocket-client.ts`

---

**Test Completed:** December 23, 2025  
**Conclusion:** Protocol constraint validated - OHLCV series creation is mandatory for CVD indicator.
