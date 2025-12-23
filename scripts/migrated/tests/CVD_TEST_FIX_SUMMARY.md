# CVD Settings Test Fix Summary

## What Was Wrong

The original `test-cvd-settings-combinations.ts` was **missing a critical dimension**: **Chart Timeframe**.

### Original Test (WRONG)
- **3 dimensions**: Anchor Period × Delta Timeframe × Show Delta
- **~144 combinations** (8 anchors × 9 delta TFs × 2 show delta)
- **Ignored chart timeframe** - used fixed `1D` for all tests
- **No constraint validation** - tried invalid combinations like Chart 1D + Delta TF `W`

### Fixed Test (CORRECT)
- **4 dimensions**: **Chart Timeframe** × Anchor Period × Delta Timeframe × Show Delta
- **240 combinations** (properly filtered)
- **Respects constraint**: Delta TF must be < Chart TF
- **Realistic test matrix** based on actual WebSocket traffic

## CVD Parameters Explained

From `tv-switch.json` analysis, CVD has **4 parameters**:

1. **Chart Timeframe** (main resolution): The chart's primary timeframe
   - Examples: `15` (15min), `60` (1H), `1D` (Daily), `188` (3H custom), `1W` (Weekly)
   
2. **CVD Anchor Period** (`in_0`): How far back to anchor CVD calculations
   - Options: `1W`, `1M`, `3M`, `6M`, `12M` (max is `12M`, NOT `1Y`)
   - User preference: `3M`
   
3. **CVD Show Delta** (`in_1`): Whether to show delta values
   - Options: `true`, `false`
   - User tests both
   
4. **CVD Delta Timeframe** (`in_2`): Timeframe for delta calculations
   - Options: `15S`, `30S`, `1`, `5`, `15`, `30`, `60`, `D`, `W`
   - User uses: `15S` and `1`

## Critical Constraint

**CVD delta timeframe CANNOT exceed chart timeframe!**

### Examples of Valid/Invalid Combinations

| Chart TF | Delta TF | Valid? | Reason |
|----------|----------|--------|--------|
| `1D`     | `15S`    | ✅ Yes | 15 seconds < 1 day |
| `1D`     | `1`      | ✅ Yes | 1 minute < 1 day |
| `1D`     | `60`     | ✅ Yes | 1 hour < 1 day |
| `1D`     | `D`      | ❌ No  | Daily = 1 day (NOT less than) |
| `1D`     | `W`      | ❌ No  | Weekly > 1 day |
| `15`     | `1`      | ✅ Yes | 1 minute < 15 minutes |
| `15`     | `15`     | ❌ No  | 15 minutes = 15 minutes (NOT less than) |
| `15`     | `30`     | ❌ No  | 30 minutes > 15 minutes |

### Constraint Implementation

```typescript
function getValidDeltaTimeframes(chartTF: string): string[] {
  const timeframeOrder = ['15S', '30S', '1', '5', '15', '30', '60', 'D', 'W'];
  const chartIndex = timeframeOrder.indexOf(chartTF);
  
  if (chartIndex === -1) {
    return timeframeOrder.slice(0, 7); // Up to 60 min for unknown TFs
  }
  
  // Return all TFs smaller than chart TF
  return timeframeOrder.slice(0, chartIndex);
}
```

## Test Matrix

### Chart Timeframes (4 options)
- `15` - 15 minutes
- `60` - 60 minutes / 1 hour
- `1D` - Daily (user's preference from `tv-switch.json`)
- `1W` - Weekly

### Anchor Periods (5 options)
- `1W` - 1 week
- `1M` - 1 month
- `3M` - 3 months (user's preference)
- `6M` - 6 months
- `12M` - 12 months (max, NOT `1Y`)

### Delta Timeframes (varies per chart TF)
- For `15`: `15S`, `30S`, `1`, `5` (4 options)
- For `60`: `15S`, `30S`, `1`, `5`, `15`, `30` (6 options)
- For `1D`: `15S`, `30S`, `1`, `5`, `15`, `30`, `60` (7 options)
- For `1W`: `15S`, `30S`, `1`, `5`, `15`, `30`, `60` (7 options - could add `D` but excluded for symmetry)

### Show Delta (2 options)
- `true` - Show delta ON
- `false` - Show delta OFF

## Total Combinations

```
Chart 15:  4 delta TFs × 5 anchors × 2 show delta = 40 combos
Chart 60:  6 delta TFs × 5 anchors × 2 show delta = 60 combos
Chart 1D:  7 delta TFs × 5 anchors × 2 show delta = 70 combos
Chart 1W:  7 delta TFs × 5 anchors × 2 show delta = 70 combos

TOTAL: 240 combinations
```

**Estimated time**: ~6 minutes (1.5s per combo with rate limiting)

## Real Usage from tv-switch.json

From the user's actual WebSocket traffic:

### Chart 1 (Daily Chart)
```json
{
  "create_series": ["cs_QXnNRYcE53lP", "sds_1", "s1", "sds_sym_1", "1D", 300, ""],
  "CVD": {
    "in_0": { "v": "3M" },      // Anchor: 3 months
    "in_1": { "v": false },     // Show delta: OFF
    "in_2": { "v": "1" }        // Delta TF: 1 minute
  }
}
```

**Combination**: `Chart: 1D, Anchor: 3M, Delta TF: 1, Show Delta: OFF`

### Chart 2 (3-Hour Chart)
```json
{
  "create_series": ["cs_eYVYkYUnFKTM", "sds_2", "s1", "sds_sym_2", "188", 300, ""],
  "CVD": {
    "in_0": { "v": "3M" },      // Anchor: 3 months
    "in_1": { "v": true },      // Show delta: ON
    "in_2": { "v": "15S" }      // Delta TF: 15 seconds
  }
}
```

**Combination**: `Chart: 188 (3H), Anchor: 3M, Delta TF: 15S, Show Delta: ON`

**Pattern**: User runs 2 charts simultaneously with **different timeframes** but same anchor period (`3M`).

## What the Test Will Discover

The test will systematically validate:

1. **Which chart timeframes work best with CVD**
   - Do some timeframes fail more than others?
   - How does bar count affect CVD data quality?

2. **Which anchor periods are most reliable**
   - Does `3M` (user's preference) work best?
   - Do longer periods (`6M`, `12M`) provide more data?

3. **Which delta timeframes are optimal**
   - Are intraday deltas (`15S`, `1min`) more reliable?
   - Do longer deltas (`60min`) work better?

4. **Does "Show Delta" affect reliability**
   - Are there more failures with delta ON vs OFF?

5. **What are the optimal combinations**
   - Which settings provide fastest response + most CVD data?
   - Which combinations should be avoided?

## Usage

```bash
tsx --env-file=.env scripts/migrated/tests/test-cvd-settings-combinations.ts anjan 1234
```

## Expected Output

The test will generate:
- Per-combination results (success/fail, CVD data points, duration)
- Analysis by each dimension (chart TF, anchor, delta TF, show delta)
- Failure analysis (which combinations fail and why)
- Recommendations (working/optimal/failing combinations)
- Full JSON output saved to file

Example summary:
```
✅ Chart 1D:   65/70 (93%) | Avg CVD points: 250
✅ Chart 60:   58/60 (97%) | Avg CVD points: 180
⚠️  Chart 15:   32/40 (80%) | Avg CVD points: 120
❌ Chart 1W:   45/70 (64%) | Avg CVD points: 80

✅ Anchor 3M:  180/240 (75%) | Avg CVD points: 220
✅ Anchor 6M:  175/240 (73%) | Avg CVD points: 240
```

## Key Learnings

1. **ALWAYS test with chart timeframe as a dimension** - it's not optional!
2. **Respect the constraint**: Delta TF must be < Chart TF
3. **Use `12M`, NOT `1Y`** for max anchor period (TradingView convention)
4. **Filter combinations before testing** to avoid invalid tests
5. **Analyze by all 4 dimensions** to understand patterns

## Files Changed

- `scripts/migrated/tests/test-cvd-settings-combinations.ts` - Fixed to include 4 dimensions
- Added chart timeframe parameter to CVD combinations
- Implemented constraint filtering (delta TF < chart TF)
- Updated analysis to include chart timeframe dimension
- Fixed anchor period max to `12M` (not `1Y`)
