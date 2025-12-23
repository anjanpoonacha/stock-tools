# TradingView Combinations Test

## Overview

Comprehensive test suite that validates **ALL** combinations of TradingView parameters to discover what works and what doesn't with real API data.

## Test Coverage

### Test Matrix: **35+ Combinations**

Tests include:

#### 📊 Resolutions
- **Daily (1D)**: 100, 300, 500, 1000, 2000, 5000, 10000 bars
- **Weekly (1W)**: 100, 300, 500, 1000 bars
- **Monthly (1M)**: 100, 300, 500 bars
- **15-minute**: 100, 300, 500, 1000 bars
- **30-minute**: 100, 300, 500 bars
- **60-minute/1H**: 100, 300, 500, 1000 bars
- **Custom 188 (3H)**: 100, 300, 500 bars *(from tv-switch.json)*

#### 🎯 CVD Tests
- Daily with CVD (300 bars)
- Weekly with CVD (300 bars)
- 15-minute with CVD (300 bars)

#### 📈 Multiple Symbols
- NSE:RELIANCE (primary)
- NSE:TCS
- NSE:INFY

#### 🔥 Extreme Tests
- 5000 bars (Daily)
- 10000 bars (Daily)

## Usage

```bash
# Run the comprehensive test
tsx --env-file=.env scripts/migrated/tests/test-tradingview-combinations.ts <userEmail> <userPassword>

# Example
tsx --env-file=.env scripts/migrated/tests/test-tradingview-combinations.ts user@example.com mypassword
```

## What It Tests

For each combination, the test validates:

✅ **Connection Success**: Can we connect and authenticate?  
✅ **Data Received**: Did we get bars back?  
✅ **Bar Accuracy**: Requested vs Received count  
✅ **Data Quality**: No nulls, NaN, or invalid values  
✅ **Performance**: Load time for each combination  
✅ **CVD Data**: When enabled, is CVD data present?  
✅ **Date Range**: Time span covered by bars  

## Output

### Console Output

The test provides real-time progress and comprehensive results:

```
🚀 TRADINGVIEW COMBINATIONS TEST SUITE
   Total combinations: 35
   User: user@example.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Test 1/35: 1d-100
   Daily, 100 bars (~3 months)
   ✅ PASS (2456ms) - 100/100 bars

📊 Test 2/35: 1d-300
   Daily, 300 bars (~1 year)
   ✅ PASS (3123ms) - 300/300 bars
   
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Passed:  28/35 (80.0%)
❌ Failed:  7/35 (20.0%)
⏱️  Duration: 87.3s

🎯 Analysis by Resolution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Daily          : 6/8 (75%) | Avg: 2891ms, 487 bars
✅ Weekly         : 4/4 (100%) | Avg: 2345ms, 325 bars
✅ Monthly        : 3/3 (100%) | Avg: 1987ms, 298 bars
⚠️  15min         : 3/4 (75%) | Avg: 3456ms, 412 bars
✅ 30min          : 3/3 (100%) | Avg: 2678ms, 325 bars
✅ 60min/1H       : 4/4 (100%) | Avg: 2901ms, 498 bars
❌ 3H (188)       : 0/3 (0%) | Avg: 0ms, 0 bars

📊 Analysis by Bar Count
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅   100 bars: 8/8 (100%)
✅   300 bars: 12/13 (92%)
✅   500 bars: 6/7 (86%)
⚠️   1000 bars: 4/5 (80%)
❌  2000 bars: 0/1 (0%)
❌  5000 bars: 0/1 (0%)
❌ 10000 bars: 0/1 (0%)

💡 CVD Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CVD Tests: 3/3 passed
Avg CVD Data Points: 287

❌ Failure Reasons
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  • Connection timeout: 4 times
  • No bars returned: 2 times
  • Invalid resolution: 1 times

🎯 RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ OPTIMAL CONFIGURATIONS (Best Performance)

  • Daily (1D), 300 bars
  • Weekly (1W), 300 bars
  • 30min (30), 300 bars
  • 60min/1H (60), 500 bars

✅ SAFE CONFIGURATIONS (Reliable)

  • Daily (1D), 500 bars
  • Daily (1D), 1000 bars
  • Weekly (1W), 500 bars
  • Monthly (1M), 300 bars

⚠️  RISKY CONFIGURATIONS (May Fail)

  • Daily (1D), 5000 bars - EXTREME
  • Daily (1D), 10000 bars - EXTREME
  • 3H (188), 300 bars - Custom resolution

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Most combinations work well!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 Full results saved to: tradingview-combinations-test-results.json
```

### JSON Output

Saved to: `scripts/poc-output/tradingview-combinations-test/tradingview-combinations-test-results.json`

```json
{
  "summary": {
    "total": 35,
    "passed": 28,
    "failed": 7,
    "duration": 87321,
    "successRate": 80.0
  },
  "results": [
    {
      "combination": {
        "id": "1d-100",
        "symbol": "NSE:RELIANCE",
        "resolution": "1D",
        "resolutionLabel": "Daily",
        "barCount": 100,
        "cvdEnabled": false,
        "description": "Daily, 100 bars (~3 months)"
      },
      "success": true,
      "duration": 2456,
      "barsRequested": 100,
      "barsReceived": 100,
      "barsDifference": 0,
      "accuracyPercent": 100.0,
      "firstBarDate": "2024-09-23",
      "lastBarDate": "2024-12-22",
      "dateRangeDays": 90,
      "hasCVD": false
    }
    // ... more results
  ],
  "analysis": {
    "byResolution": { /* ... */ },
    "byBarCount": { /* ... */ },
    "withCVD": { /* ... */ },
    "failureReasons": { /* ... */ }
  },
  "recommendations": {
    "optimal": [ /* ... */ ],
    "safe": [ /* ... */ ],
    "risky": [ /* ... */ ]
  }
}
```

## Key Features

### 1. **Based on Real Data**
- Uses actual WebSocket messages from `tv-switch.json`
- Tests resolution "188" (3H) seen in real traffic
- Validates against actual TradingView API behavior

### 2. **Comprehensive Metrics**
Each test tracks:
- Success/failure status
- Bars requested vs received
- Accuracy percentage
- Load time (ms)
- Date range covered
- CVD data availability
- Error classification

### 3. **Smart Analysis**
- Groups results by resolution
- Groups results by bar count
- Identifies optimal configurations
- Classifies safe vs risky combinations
- Categorizes failure reasons

### 4. **Rate Limiting**
- 1.5 second delay between tests
- Prevents API throttling
- Ensures reliable results

### 5. **Error Classification**
Failures are categorized as:
- `timeout`: Request took too long
- `connection`: Network/socket issues
- `no_data`: No bars returned
- `invalid_data`: Nulls or NaN values
- `unknown`: Other errors

## Expected Runtime

**~2-3 minutes** for all 35 combinations

- Each test: ~2-5 seconds
- Rate limiting: 1.5s between tests
- Authentication: ~2 seconds (one-time)

## What You'll Learn

After running this test, you'll know:

1. ✅ **Which resolutions work reliably** (Daily, Weekly, etc.)
2. ✅ **Maximum safe bar counts** per resolution
3. ✅ **CVD compatibility** (which resolutions support CVD)
4. ✅ **Performance characteristics** (load times)
5. ✅ **Edge cases that fail** (extreme bar counts, custom resolutions)
6. ✅ **Optimal configurations** for production use

## Use Cases

### Development
- Validate API changes don't break existing configurations
- Test new resolution support
- Benchmark performance improvements

### Production Planning
- Choose optimal bar counts for different timeframes
- Understand failure modes
- Plan caching strategies based on load times

### Troubleshooting
- Identify which combinations cause issues
- Understand error patterns
- Validate session/authentication setup

## Comparison with Other Tests

| Test | Focus | Duration | Results |
|------|-------|----------|---------|
| `test-cvd-integration.ts` | Single flow validation | ~30s | Pass/Fail |
| `test-tradingview-combinations.ts` | **All combinations** | **~3min** | **Comprehensive matrix** |
| `poc-bar-count-real-test.ts` | Bar counts only | ~2min | Bar counts per resolution |

## Next Steps

After running this test:

1. **Review Recommendations**: Use "Optimal" configurations in production
2. **Avoid Risky Combos**: Don't use combinations that failed
3. **Update Constants**: Set safe maximums in code based on results
4. **Document Limits**: Add findings to API documentation
5. **Monitor Production**: Track which combinations users request

## Troubleshooting

### All Tests Fail
- Check `.env` file has correct KV credentials
- Verify TradingView session in KV is valid
- Check network connectivity

### Some Tests Fail
- Normal! Extreme values (5000, 10000 bars) may timeout
- Custom resolutions (188) may not be supported for all symbols
- Review failure reasons in output

### CVD Tests Fail
- Ensure `sessionid_sign` is present in session data
- Check CVD config service is working
- Some resolutions may not support CVD

## Files

- **Test File**: `scripts/migrated/tests/test-tradingview-combinations.ts`
- **Output**: `scripts/poc-output/tradingview-combinations-test/tradingview-combinations-test-results.json`
- **This README**: `scripts/migrated/tests/README_COMBINATIONS_TEST.md`

## Related Files

- `tv-switch.json` - Real WebSocket traffic that inspired this test
- `test-cvd-integration.ts` - Template for this test
- `poc-bar-count-real-test.ts` - Original bar count testing POC

---

**Created**: 2024-12-23  
**Purpose**: Discover what TradingView parameter combinations work  
**Approach**: Test everything, report everything, recommend the best
