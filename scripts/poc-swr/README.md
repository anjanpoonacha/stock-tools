# SWR POC Tests

This directory contains POC (Proof of Concept) test files to validate SWR (Stale-While-Revalidate) integration with existing APIs before full production integration.

## Overview

Following the POC-first development principle, these tests validate SWR behavior with:
- Basic data fetching and caching
- Authenticated API endpoints
- Mutations and optimistic updates

## Prerequisites

1. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Add your credentials:
     ```env
     ADMIN_EMAIL=your-email@example.com
     ADMIN_PASSWORD=your-password
     ```

2. **Sessions Required**
   - **MIO Session**: Required for POC 1 (formulas API)
   - **TradingView Session**: Required for POC 2 (chart data API)
   - Use the browser extension to capture sessions from respective platforms

3. **Development Server**
   - Start Next.js dev server: `pnpm dev`
   - Server must be running on `http://localhost:3000` for POCs to work

## Test Files

### POC 1: Basic SWR Fetch (`poc-1-basic-swr-fetch.ts`)

Tests fundamental SWR fetching behavior with the formulas API.

**What it validates:**
- ✓ Initial fetch from API
- ✓ Cache hit on immediate re-fetch
- ✓ Deduplication of concurrent requests
- ✓ Revalidation behavior outside dedupe window
- ✓ Manual revalidation with `mutate()`

**Run:**
```bash
tsx --env-file=.env scripts/poc-swr/poc-1-basic-swr-fetch.ts
```

**Expected Output:**
```
🧪 POC 1: Basic SWR Fetch Test
============================================================

👤 User: your-email@example.com
🔍 Checking session in KV store...

✅ Session found: abc123...

============================================================
TEST 1: Initial Fetch
============================================================

[timestamp] 🌐 FETCHING: http://localhost:3000/api/mio-formulas
[timestamp] ✅ RESPONSE: 200 (XXXms)
✅ Data received:
  - Total formulas: XX
  - Last updated: YYYY-MM-DD...

============================================================
TEST 2: Cache Hit (Immediate re-fetch)
============================================================

⏱️  Requesting same data immediately...
✅ Second request completed
  - Was loading? false
  - Had immediate data? true

... [additional tests]

🎉 POC 1 Complete!
```

---

### POC 2: SWR with Authentication (`poc-2-swr-with-auth.ts`)

Tests SWR with authenticated POST requests to chart data API.

**What it validates:**
- ✓ POST requests with auth credentials
- ✓ Auth error handling (401/403)
- ✓ Retry logic for transient errors
- ✓ Cache behavior for authenticated data
- ✓ Conditional fetching (null key pattern)

**Run:**
```bash
tsx --env-file=.env scripts/poc-swr/poc-2-swr-with-auth.ts
```

**Expected Output:**
```
🧪 POC 2: SWR with Authentication Test
============================================================

👤 User: your-email@example.com
📈 Symbol: NSE:RELIANCE
🔍 Checking session in KV store...

✅ Session found: xyz789...

============================================================
TEST 1: Authenticated Fetch
============================================================

[timestamp] 🔐 AUTH FETCH: NSE:RELIANCE
[timestamp] 📊 RESPONSE: 200 (XXXms)
✅ Data received:
  - Symbol: NSE:RELIANCE
  - Resolution: 1D
  - Bars: 100
  - First bar: YYYY-MM-DD
  - Last bar: YYYY-MM-DD

... [additional tests]

🎉 POC 2 Complete!
```

---

### POC 3: SWR Mutations (`poc-3-swr-mutation.ts`)

Tests SWR mutations for settings updates with optimistic UI.

**What it validates:**
- ✓ Optimistic updates for instant UI feedback
- ✓ Server mutation confirmation
- ✓ Error rollback to previous state
- ✓ Manual revalidation to verify server state
- ✓ Rapid successive updates handling
- ✓ `useSWRMutation` for explicit mutations

**Run:**
```bash
tsx --env-file=.env scripts/poc-swr/poc-3-swr-mutation.ts
```

**Expected Output:**
```
🧪 POC 3: SWR Mutations Test
============================================================

👤 User: your-email@example.com
🔍 Testing settings mutations...

============================================================
TEST 1: Load Initial Settings
============================================================

[timestamp] 📖 GET: http://localhost:3000/api/kv/settings
[timestamp] ✅ Loaded: Settings found
✅ Settings loaded:
  - Panel layout: Yes
  - Chart settings: Yes
  - Active layout: single

============================================================
TEST 2: Optimistic Update (Success)
============================================================

🔄 Changing active layout: single → horizontal
⏱️  Starting optimistic update...
🚀 Optimistic update started...
✅ Optimistic update applied to cache
[timestamp] 💾 SAVE: http://localhost:3000/api/kv/settings
[timestamp] ✅ Saved successfully
✅ Mutation confirmed by server
✅ Update completed in XXXms
  - New layout: horizontal

... [additional tests]

🎉 POC 3 Complete!
```

## Common Issues & Troubleshooting

### Issue: "No MIO/TradingView session found"

**Solution:**
1. Open the respective platform (marketinout.com or tradingview.com)
2. Login with your credentials
3. Install and use the browser extension to capture the session
4. The extension will automatically save to Vercel KV
5. Re-run the POC test

### Issue: "User email and password are required"

**Solution:**
Check your `.env` file has:
```env
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-password
```

### Issue: "Connection refused" or "ECONNREFUSED"

**Solution:**
1. Start the Next.js development server: `pnpm dev`
2. Ensure it's running on `http://localhost:3000`
3. Re-run the POC test

### Issue: "Unauthorized: Invalid credentials"

**Solution:**
1. Session may have expired
2. Re-capture the session using browser extension
3. Verify credentials in `.env` match the session owner

## Key SWR Concepts Demonstrated

### 1. Automatic Caching
```typescript
const { data } = useSWR(key, fetcher);
// First call: fetches from API
// Second call: returns cached data immediately
```

### 2. Deduplication
```typescript
const { data } = useSWR(key, fetcher, {
  dedupingInterval: 2000, // ms
});
// Multiple requests within 2s are deduplicated
```

### 3. Optimistic Updates
```typescript
await mutate(
  optimisticData,
  {
    optimisticData,    // Show immediately
    rollbackOnError: true,  // Revert on failure
  }
);
```

### 4. Conditional Fetching
```typescript
const { data } = useSWR(
  isReady ? key : null,  // null = don't fetch
  fetcher
);
```

### 5. Error Handling
```typescript
const { data, error } = useSWR(key, fetcher, {
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
});
```

## Next Steps

After validating POCs:

1. **Create Shared Abstractions**
   - Extract common fetcher functions
   - Create reusable SWR hooks (e.g., `useFormulas`, `useChartData`, `useSettings`)
   - Add TypeScript types for all API responses

2. **Integration**
   - Replace existing fetch calls with SWR hooks
   - Add loading states and error boundaries
   - Implement optimistic updates where appropriate

3. **Production Considerations**
   - Configure global SWR settings in `src/config/swr.config.ts`
   - Add SWRConfig provider at app root
   - Set up error reporting integration
   - Configure cache persistence if needed

## Security Notes

- **Never hardcode credentials** in POC files
- Always use `.env` file with `--env-file` flag
- Load credentials dynamically from Vercel KV
- POC files are for local testing only (not deployed)

## References

- [SWR Documentation](https://swr.vercel.app/)
- [Project AGENTS.md](../../AGENTS.md) - POC-first development principle
- [.env.example](../../.env.example) - Environment variable template
