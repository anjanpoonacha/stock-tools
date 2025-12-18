# SSE Streaming Testing Guide

## Quick Start

### Prerequisites
- Valid MIO user credentials (userEmail, userPassword)
- At least one formula created in the system
- TradingView session stored via browser extension

### Test Credentials (Provided)
```
Session ID: c21wcqky6leod5cjl2fh6i660sy411jb
Session Sign: v3:bzvfwN6hsScvTRCKRursdZHSjt9p8Yv5UM3R8YVGUSM=
```

## Test Scenarios

### 1. Basic Streaming Flow (Happy Path)

**Goal**: Verify streaming works end-to-end

**Steps**:
1. Start dev server: `pnpm dev`
2. Navigate to: `http://localhost:3000/mio-formulas/results?formulaId=<your-formula-id>`
3. Ensure streaming mode is enabled (⚡ Streaming badge should be active)
4. Observe:
   - Formula results appear immediately (~250ms)
   - Progress bar appears
   - Progress updates as batches load
   - Charts stream in progressively

**Expected Results**:
- ✅ Formula name and stock list appear instantly
- ✅ Progress bar shows "Batch 1/5" → "Batch 2/5" → ... → "Batch 5/5"
- ✅ Chart count increases: "18/88" → "36/88" → ... → "88/88"
- ✅ Total time: ~8-10 seconds
- ✅ No errors in console

### 2. Error Handling

#### Test 2.1: Invalid Formula ID
**Steps**:
1. Navigate to: `http://localhost:3000/mio-formulas/results?formulaId=invalid-id`
2. Observe error handling

**Expected Results**:
- ✅ Error alert: "Formula not found"
- ✅ No crash, graceful error display

#### Test 2.2: Network Timeout
**Steps**:
1. Start stream
2. Throttle network in DevTools (Slow 3G)
3. Observe behavior

**Expected Results**:
- ✅ Stream continues (may be slower)
- ✅ Partial success (some batches may fail)
- ✅ Error messages for failed batches

#### Test 2.3: Missing Credentials
**Steps**:
1. Clear localStorage: `localStorage.clear()`
2. Try to load formula results

**Expected Results**:
- ✅ Error: "Not authenticated. Please log in first."
- ✅ Redirect to login or authentication page

### 3. Caching

#### Test 3.1: First Load (No Cache)
**Steps**:
1. Clear cache: `localStorage.clear()`
2. Load formula results
3. Note time taken

**Expected Results**:
- ✅ Streams from server (~8-10 seconds total)
- ✅ Progress bar visible

#### Test 3.2: Second Load (With Cache)
**Steps**:
1. Load same formula results within 5 minutes
2. Note time taken

**Expected Results**:
- ✅ Instant load (from cache)
- ✅ No streaming, no progress bar
- ✅ Data appears immediately

#### Test 3.3: Refresh (Clear Cache)
**Steps**:
1. Click "Refresh" button
2. Observe behavior

**Expected Results**:
- ✅ Cache cleared
- ✅ Re-streams from server
- ✅ Progress bar reappears

### 4. Mode Switching

#### Test 4.1: Switch to Classic Mode
**Steps**:
1. Load in streaming mode
2. Click ⚡ "Streaming" badge
3. Should switch to "Classic" mode
4. Refresh page

**Expected Results**:
- ✅ Badge changes to "Classic" (no lightning icon)
- ✅ Old prefetch behavior (background loading)
- ✅ Mode persists across page refreshes

#### Test 4.2: Switch Back to Streaming
**Steps**:
1. In classic mode, click "Classic" badge
2. Should switch back to "Streaming"
3. Refresh page

**Expected Results**:
- ✅ Badge changes to "⚡ Streaming"
- ✅ Streaming behavior resumes
- ✅ Mode persists

### 5. Progress Tracking

**Goal**: Verify accurate progress updates

**Steps**:
1. Load formula with ~50+ stocks (100 charts)
2. Watch progress bar

**Expected Results**:
- ✅ Progress starts at 0%
- ✅ Increases incrementally: 18% → 36% → 54% → 72% → 90% → 100%
- ✅ Batch counter updates: "Batch 1/5" → "Batch 2/5" → ...
- ✅ Chart counter updates: "18/100" → "36/100" → ...
- ✅ Percentage matches: (loaded/total) * 100

### 6. Cancellation

**Goal**: Verify graceful cancellation

**Steps**:
1. Start streaming
2. Immediately navigate away (change URL)
3. Check console for errors

**Expected Results**:
- ✅ Stream cancels gracefully
- ✅ No error in console
- ✅ No memory leaks

### 7. Manual SSE Testing

**Goal**: Test SSE endpoint directly

**Steps**:
1. Open `test-sse-stream.html` in browser
2. Fill in credentials:
   - User Email: `<your-email>`
   - User Password: `<your-password>`
   - Formula ID: `<your-formula-id>`
3. Click "Start Stream"
4. Watch events appear

**Expected Results**:
- ✅ Event 1: `[formula-results]` with stock list
- ✅ Event 2-6: `[chart-batch]` with progress
- ✅ Event 7: `[complete]` with timing
- ✅ Progress bar updates
- ✅ No `[error]` events

### 8. Chart View Integration

**Goal**: Verify charts load correctly

**Steps**:
1. Load formula results (streaming mode)
2. Select 5-10 stocks
3. Click "Chart View"
4. Navigate through stocks

**Expected Results**:
- ✅ Charts display correctly (1W and 1D)
- ✅ CVD indicator shows (if enabled)
- ✅ Navigation works (Prev/Next buttons)
- ✅ No loading spinners (data already cached)

## Performance Benchmarks

### Target Metrics
- **Formula results**: < 500ms (target: 250ms)
- **First batch**: < 3s (target: 2s)
- **Total time**: 8-10s (88 charts)
- **Average per chart**: ~100ms

### How to Measure
1. Open Chrome DevTools → Network tab
2. Look for `/api/formula-results-with-charts` request
3. Check timing:
   - **TTFB** (Time to First Byte): Should be ~250ms
   - **Total duration**: Should be 8-10s

### Console Logs
Watch for these log messages:
```
[SSE] Fetching stock results from: <mio-url>
[SSE] Parsed 44 stocks from MIO response
[SSE] Sent formula results (44 stocks)
[SSE] Authenticated successfully
[BatchChartFetcher] Starting batch fetch: 44 symbols × 2 resolutions = 88 charts
[SSE] Sent batch 1/5 (20%)
[SSE] Sent batch 2/5 (40%)
...
[SSE] Stream complete: 88 charts in 8200ms
```

## Debugging Tips

### Common Issues

#### Issue 1: Stream Never Starts
**Symptoms**: Loading spinner forever, no events
**Causes**:
- Invalid credentials
- Formula ID doesn't exist
- Network blocked

**Debug**:
1. Check Network tab for `/api/formula-results-with-charts`
2. Look for 4xx/5xx errors
3. Check response body for error message

#### Issue 2: Stream Starts But Hangs
**Symptoms**: Formula loads, but no chart batches
**Causes**:
- TradingView session expired
- JWT token invalid
- Connection pool error

**Debug**:
1. Check console for errors
2. Look for `[SSE] Authenticated successfully` log
3. Check if batches are being fetched (backend logs)

#### Issue 3: Progress Bar Stuck
**Symptoms**: Progress bar doesn't update
**Causes**:
- SSE events not being parsed
- Frontend hook not handling events

**Debug**:
1. Check Network tab → View raw SSE events
2. Check console for parsing errors
3. Verify event format matches expected structure

#### Issue 4: Charts Don't Display
**Symptoms**: Progress completes, but charts are blank
**Causes**:
- Chart data not cached properly
- ChartView not loading cached data

**Debug**:
1. Check localStorage for cached data
2. Verify `chartData` object in hook state
3. Check ChartView is receiving correct props

### Useful Console Commands

```javascript
// Check streaming mode
localStorage.getItem('streaming-mode-enabled')

// Clear all caches
localStorage.clear()

// Check cached formula results
JSON.parse(localStorage.getItem('formula-results-with-charts:<formula-id>'))

// Check cached batches
Object.keys(localStorage).filter(k => k.startsWith('chart-data-batch:'))

// Monitor hook state (in React DevTools)
// Find ResultsContent component → Check hooks → Look for "useFormulaResultsWithCharts"
```

## Automated Testing (Future)

### Integration Tests
```typescript
// tests/sse-streaming.test.ts
describe('SSE Streaming', () => {
  test('should stream formula results', async () => {
    const response = await fetch('/api/formula-results-with-charts', {
      method: 'POST',
      body: JSON.stringify({ userEmail, userPassword, formulaId })
    });
    
    const reader = response.body.getReader();
    const events = [];
    
    // Read all events
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      events.push(parseSSEEvent(value));
    }
    
    // Assertions
    expect(events[0].type).toBe('formula-results');
    expect(events[events.length - 1].type).toBe('complete');
  });
});
```

### Performance Tests
```typescript
// tests/performance.test.ts
describe('Streaming Performance', () => {
  test('should load formula results within 500ms', async () => {
    const start = Date.now();
    const events = await streamFormulaResults(formulaId);
    const firstEvent = events.find(e => e.type === 'formula-results');
    const ttfr = firstEvent.timestamp - start;
    
    expect(ttfr).toBeLessThan(500);
  });
});
```

## Success Criteria Checklist

- [ ] ✅ Formula results appear in < 500ms
- [ ] ✅ Progress bar shows accurate updates
- [ ] ✅ All batches stream successfully
- [ ] ✅ Error handling works (invalid ID, network issues)
- [ ] ✅ Caching works (instant on refresh < 5min)
- [ ] ✅ Mode switching works (streaming ↔ classic)
- [ ] ✅ Cancellation works (no memory leaks)
- [ ] ✅ Build passes without errors
- [ ] ✅ No console errors during streaming
- [ ] ✅ Charts display correctly after streaming

## Report Template

After testing, please provide:

### Test Results
```
Date: YYYY-MM-DD
Tester: Your Name
Environment: Dev / Staging / Production

Test 1: Basic Streaming Flow
Result: ✅ Pass / ❌ Fail
Notes: ...

Test 2: Error Handling
Result: ✅ Pass / ❌ Fail
Notes: ...

...

Performance Metrics:
- Time to first result: XXXms
- Total streaming time: XXXXms
- Charts loaded: XX/XX
- Errors: 0
```

### Issues Found
```
1. [ISSUE-001] Progress bar doesn't update
   Severity: High
   Steps to reproduce: ...
   Expected: ...
   Actual: ...

2. [ISSUE-002] ...
```

## Next Steps After Testing

1. ✅ Verify all tests pass
2. ✅ Document any issues found
3. ✅ Fix critical bugs
4. ✅ Optimize performance if needed
5. ✅ Deploy to staging
6. ✅ User acceptance testing
7. ✅ Deploy to production
