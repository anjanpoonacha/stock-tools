# Chart Caching and Connection Pool Usage Fix

**Date**: December 21, 2025
**Status**: Implemented

## Problems Fixed

### 1. No Chart Data Caching (HIGH IMPACT)
- **Issue**: Repeated requests for the same chart data refetched everything from TradingView API
- **Impact**: 5-8 seconds for every request, even for identical requests
- **User Experience**: Slow chart switching, high API load

### 2. Connection Pool Not Used (HIGH IMPACT)
- **Issue**: Persistent connection pool was acquired but bypassed by `getChartData()`
- **Impact**: New WebSocket connections created for each request instead of reusing pool
- **Root Cause**: `chartDataService.ts` created its own connection pool instead of using the persistent one

## Solutions Implemented

### 1. In-Memory Chart Data Cache
**File**: `src/lib/cache/chartDataCache.ts` (NEW)

Features:
- 5-minute TTL (Time To Live)
- Automatic stale entry cleanup
- Cache statistics for monitoring
- Simple Map-based implementation

API:
```typescript
getCachedChartData(key: string): ChartDataResponse | null
setCachedChartData(key: string, data: ChartDataResponse): void
clearChartDataCache(): void
getCacheStats(): { size: number; keys: string[] }
```

Cache Key Format: `{symbol}:{resolution}:{barsCount}:{cvdEnabled}`
Example: `NSE:RELIANCE:1D:300:false`

### 2. Connection Pool Parameter Injection
**Files Modified**:
- `src/lib/chart-data/chartDataService.ts`
- `src/app/api/chart-data/route.ts`

Changes:
1. `fetchHistoricalDataPooled()` now accepts optional `connectionPool` parameter
2. `getChartData()` now accepts optional `connectionPool` parameter
3. Route handler passes persistent pool to service layer

Flow:
```
Route Handler
  ├─> Acquire persistent connection pool
  ├─> Check cache first
  ├─> Pass pool to getChartData()
  └─> Cache successful response
```

## Implementation Details

### Cache Layer (route.ts)
```typescript
// 1. Check cache first
const cacheKey = `${symbol}:${resolution}:${barsCount}:${cvdEnabled}`;
const cached = getCachedChartData(cacheKey);

if (cached) {
  console.log(`[Chart API] Cache HIT for ${cacheKey}`);
  return NextResponse.json(cached, { status: 200 });
}

// 2. Get persistent pool
const pool = persistentManager.getConnectionPool();

// 3. Pass pool to service
const result = await getChartData(params, undefined, pool);

// 4. Cache successful responses
if (result.success && result.data) {
  setCachedChartData(cacheKey, response);
}
```

### Service Layer (chartDataService.ts)
```typescript
export async function getChartData(
  params: {...},
  config?: Partial<ChartDataServiceConfig>,
  connectionPool?: WebSocketConnectionPool  // NEW PARAMETER
): Promise<ChartDataServiceResult> {
  // ...
  const dataResult = await fetchHistoricalDataPooled(
    symbol,
    resolution,
    barsCount,
    jwtToken,
    cvdOptions,
    connectionPool  // PASS POOL TO DATA FETCHER
  );
}
```

## Expected Outcomes

### Performance Improvements
1. **70-90% faster for repeat requests**
   - First request: 5-8s (API fetch)
   - Cached request: <500ms (memory read)

2. **Reduced TradingView API load**
   - Cache hit rate: Expected 60-80% for typical usage
   - API calls reduced by same percentage

3. **Consistent <3s response times**
   - Cache hits: <500ms
   - Pool reuse: 2-3s (vs 5-8s with new connections)
   - First-time fetch: 5-8s (one-time cost)

### Monitoring
Cache statistics available via `getCacheStats()`:
```typescript
{
  size: 10,  // Number of cached entries
  keys: [    // List of cache keys
    'NSE:RELIANCE:1D:300:false',
    'NSE:INFY:1D:300:false',
    ...
  ]
}
```

Console logs:
```
[Chart API] Cache HIT for NSE:RELIANCE:1D:300:false
[Chart API] Cache MISS for NSE:INFY:1D:300:false
```

## Testing

### Manual Testing
1. Load chart for a symbol (first request - should be slow)
2. Switch to another chart
3. Switch back to original symbol (should be fast - cache hit)
4. Wait 6 minutes
5. Load same chart again (should be slow - cache expired)

### Unit Tests
File: `src/lib/cache/chartDataCache.test.ts`

Tests:
- ✅ Non-existent keys return null
- ✅ Store and retrieve cached data
- ✅ Expired entries return null
- ✅ Clear all cached data
- ✅ Cache statistics

## Cache Management

### TTL Configuration
Current: 5 minutes (`CACHE_TTL = 5 * 60 * 1000`)

To change:
```typescript
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
```

### Manual Cache Clear
```typescript
import { clearChartDataCache } from '@/lib/cache/chartDataCache';

// Clear all cached chart data
clearChartDataCache();
```

### Memory Considerations
- Each cached entry: ~100-500 KB (depending on bars count)
- Max realistic cache size: ~50 entries = ~25 MB
- Automatic cleanup on expiry prevents unbounded growth

## Future Enhancements

### Potential Improvements
1. **LRU (Least Recently Used) eviction**
   - Limit cache size to N entries
   - Evict oldest unused entries

2. **Persistent cache (Redis/KV)**
   - Survive server restarts
   - Share cache across instances

3. **Cache warming**
   - Pre-fetch popular symbols
   - Background refresh before expiry

4. **Smart invalidation**
   - Market close: Invalidate today's data
   - Real-time updates: Invalidate affected symbols

5. **Cache metrics endpoint**
   - Hit rate tracking
   - Performance monitoring
   - Cache effectiveness analytics

## Files Changed

### New Files
- `src/lib/cache/chartDataCache.ts` - Cache implementation
- `src/lib/cache/chartDataCache.test.ts` - Unit tests
- `docs/CHART_CACHING_AND_POOL_USAGE.md` - This document

### Modified Files
- `src/lib/chart-data/chartDataService.ts` - Added connectionPool parameter
- `src/app/api/chart-data/route.ts` - Added caching and pool usage

## Rollback Plan

If issues arise:

1. **Disable caching**:
   ```typescript
   // In route.ts, comment out cache check
   // const cached = getCachedChartData(cacheKey);
   // if (cached) { return NextResponse.json(cached); }
   ```

2. **Disable pool injection**:
   ```typescript
   // In route.ts, pass undefined for pool
   const result = await getChartData(params, undefined, undefined);
   ```

3. **Full rollback**:
   - Revert changes to route.ts
   - Revert changes to chartDataService.ts
   - Delete chartDataCache.ts

## Notes

- Cache is in-memory, so it will be cleared on server restart
- Cache key does NOT include user credentials (all users share cache)
- CVD state is included in cache key to prevent incorrect data
- Connection pool is acquired once per request, reused for all data fetches
