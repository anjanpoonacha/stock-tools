# Cleanup Plan - Non-Critical Migrations

## ✅ Keep (Critical - CVD Related)

These are tested and working:
- `scripts/migrated/tests/test-cvd-integration.ts` ✅
- `scripts/migrated/tests/test-cvd-quick.ts` ✅
- `scripts/migrated/tests/test-cvd-live.ts` (migrated, not tested)
- `scripts/migrated/README.md`
- `scripts/migrated/MIGRATION_REPORT.md`
- `scripts/migrated/CVD_READY.md`

## ❓ Review (User Decision Needed)

Check if you actually use these:
- `scripts/migrated/tradingview/*` (3 files)
- `scripts/migrated/mio/*` (2 files)
- `scripts/migrated/swr/*` (3 files)
- `scripts/migrated/tests/*` (other test files)
- `scripts/migrated/utils/*` (5 files)

## 🗑️ Can Remove (After Verification)

Once CVD POCs are confirmed working, these originals can be removed:
- `scripts/test-cvd-integration.ts` (replaced)
- `scripts/test-cvd-quick.ts` (replaced)
- `scripts/test-cvd-live.ts` (replaced)

## 📝 Action Items

1. ✅ Keep CVD POCs (critical)
2. ❓ Ask user about other migrated scripts
3. ⏳ Remove originals only after user confirms
4. ⏳ Clean up any unused migrations

