# HTML Structure Monitoring

Monitor MIO's HTML structure to detect breaking changes before they impact our 100% extraction parsers.

## Quick Start

```bash
# Create baseline (first time)
pnpm run check-structure

# Check for changes (run periodically)
pnpm run check-structure

# Quick extraction count check
pnpm run count-mio

# Run structure validation tests
pnpm test src/lib/mio/parsers/__tests__/html-structure-validation.test.ts
```

## Three Protection Layers

### 1. Structure Validation Tests
- **29 automated tests** validating HTML structure
- Checks CSS classes, table structure, element counts
- Runs with every test suite

### 2. Structure Monitor
- Creates baseline signature of HTML structure
- Detects changes with specific thresholds
- Provides actionable warnings

### 3. Quick Count
- Fast extraction count verification
- Expected: 226 indicators, 76 samples, 107 docs

## When Structure Changes

If MIO changes their HTML:

1. **Structure tests fail** with specific errors
2. **Monitor shows warnings** about what changed
3. **Extraction count drops** (e.g., 226 → 0)
4. **Update parsers** to match new structure

## Files

- Tests: `src/lib/mio/parsers/__tests__/html-structure-validation.test.ts`
- Monitor: `scripts/check-html-structure.ts`
- Counter: `scripts/count-from-html.ts`
- Baseline: `output/structure-baseline.json` (git-ignored)

See full documentation in this directory for detailed usage.
