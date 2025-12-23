# Migrated POC Scripts (Framework-Based)

This directory contains POC scripts that have been migrated to use the **POC Framework** (`scripts/framework/`).

## 🎯 Purpose

Migrated scripts use the framework to eliminate code duplication and follow consistent patterns:
- ✅ Extend `BasePOC` for structure
- ✅ Use `SessionProvider` for sessions (no hardcoding)
- ✅ Use `MIOHttpClient` / `TVHttpClient` for API calls
- ✅ Use `OutputManager` for logging and file output

## 📁 Directory Structure

```
scripts/migrated/
├── tradingview/    # TradingView POC scripts (migrated)
├── mio/            # MarketInOut POC scripts (migrated)
├── swr/            # SWR POC scripts (migrated)
├── tests/          # Test scripts (migrated)
└── README.md       # This file
```

## 🔄 Migration Process

1. **Copy script** to appropriate folder with same name
2. **Refactor** to use framework patterns
3. **Test** that it works identically to original
4. **Compare** code reduction (should be 40-60% less code)
5. **Verify** functionality is identical
6. **Remove** original script (only after verification)

## ✅ Migration Checklist

For each migrated script:
- [ ] Extends `BasePOC<TConfig, TOutput>`
- [ ] Uses `SessionProvider` (no hardcoded sessions)
- [ ] Uses framework HTTP clients
- [ ] Uses `OutputManager` for logging
- [ ] No code duplication with other scripts
- [ ] Tested and working identically to original
- [ ] Code reduction documented

## 📊 Migration Status

### Tests
| Original Script | Migrated Location | Status | LOC Change | Notes |
|----------------|-------------------|--------|------------|-------|
| test-cvd-integration.ts | tests/test-cvd-integration.ts | ✅ Migrated | TBD | Comprehensive CVD test |

### SWR POCs
| Original Script | Migrated Location | Status | LOC Change | Notes |
|----------------|-------------------|--------|------------|-------|
| poc-1-basic-swr-fetch.ts | swr/poc-1-basic-swr-fetch.ts | ✅ Migrated | +150% | Structure + logging |
| poc-2-swr-with-auth.ts | swr/poc-2-swr-with-auth.ts | ✅ Migrated | +126% | Structure + logging |
| poc-3-swr-mutation.ts | swr/poc-3-swr-mutation.ts | ✅ Migrated | +108% | Structure + logging |

### TradingView POCs
| Original Script | Migrated Location | Status | LOC Change | Notes |
|----------------|-------------------|--------|------------|-------|
| poc-1-get-user-id.ts | tradingview/poc-1-get-user-id.ts | 🔄 Pending | - | Simple POC |
| poc-2-get-jwt-token.ts | tradingview/poc-2-get-jwt-token.ts | 🔄 Pending | - | Depends on POC 1 |
| poc-3-websocket-client.ts | tradingview/poc-3-websocket-client.ts | 🔄 Pending | - | Complex WebSocket |

## 🎯 Expected Benefits

After migration:
- **40-60% code reduction** per script (for MIO/TV POCs)
- **+100-150% code increase** for SWR POCs (adds structure, testing, logging)
- **Zero hardcoded sessions** (all from KV)
- **Consistent error handling** across all POCs
- **Reusable patterns** (copy-paste migration template)
- **Easier maintenance** (fix once in framework)

### Note on SWR POCs

SWR POC migrations **increase** code size because:
- They test React hooks in Node.js (unique pattern)
- Framework adds comprehensive testing infrastructure
- Enhanced logging and error handling
- Structured test result tracking and JSON output
- **Value is in consistency and maintainability, not LOC reduction**

## 📝 Example: Before vs After

### Before (Original POC - ~100 lines)
```typescript
// Manual session fetching (10 lines)
// Manual HTTP client setup (20 lines)
// Manual error handling (15 lines)
// Manual output management (10 lines)
// Main logic (30 lines)
// Cleanup (5 lines)
```

### After (Framework-based - ~40 lines)
```typescript
import { BasePOC, SessionProvider, TVHttpClient } from '../framework';

class MyPOC extends BasePOC<Config, Result> {
  protected async setup() { /* 5-10 lines */ }
  protected async execute() { /* 20-30 lines */ }
  protected async cleanup() { /* 2-5 lines */ }
}
```

## 🚀 How to Use Migrated Scripts

Same as originals, just use the new path:

```bash
# Old way
tsx scripts/test-cvd-integration.ts user@example.com password

# New way (migrated)
tsx scripts/migrated/tests/test-cvd-integration.ts user@example.com password
```

Output should be identical!

## ⚠️ Important Notes

1. **Old scripts remain** until migration verified
2. **No breaking changes** - same command-line interface
3. **Same output format** - compatible with existing workflows
4. **Progressive migration** - one script at a time

## 📖 Migration Guide

See `scripts/framework/README.md` for:
- Framework documentation
- Migration patterns
- Best practices
- Troubleshooting

---

**Status:** Active migration in progress  
**Last Updated:** December 23, 2025
