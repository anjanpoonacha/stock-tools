# SWR Utilities

Shared fetcher functions and cache key factories for SWR hooks with automatic credential management.

## Features

- **Automatic Authentication**: Fetchers automatically load credentials from localStorage
- **Type-Safe**: Full TypeScript support with proper types for all APIs
- **Error Handling**: Consistent error handling with status codes
- **Cache Keys**: Stable, deterministic cache keys for SWR
- **DRY Compliance**: Shared logic prevents code duplication

## Installation

Import utilities from the central export:

```typescript
import { 
  chartDataFetcher, 
  chartDataKey,
  FetcherError 
} from '@/lib/swr';
```

## Usage

### Chart Data

```typescript
import useSWR from 'swr';
import { chartDataFetcher, chartDataKey } from '@/lib/swr';

function MyComponent() {
  const { data, error, isLoading } = useSWR(
    chartDataKey('NSE:RELIANCE', '1D', 300, true, '3M'),
    () => chartDataFetcher({
      symbol: 'NSE:RELIANCE',
      resolution: '1D',
      barsCount: 300,
      cvdEnabled: true,
      cvdAnchorPeriod: '3M'
    })
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{data.bars.length} bars loaded</div>;
}
```

### Formula List (Auto Credentials)

The new `formulaListFetcher` automatically loads credentials:

```typescript
import useSWR from 'swr';
import { formulaListFetcher, formulaListKey } from '@/lib/swr';

function FormulaList() {
  // Key automatically includes user email from localStorage
  const { data, error } = useSWR(
    formulaListKey(), // Returns null if not authenticated
    formulaListFetcher
  );

  return (
    <div>
      {data?.formulas.map(f => <div key={f.id}>{f.name}</div>)}
    </div>
  );
}
```

### Formula Results (Backward Compatible)

Existing implementation (with explicit credentials):

```typescript
import { formulaResultsFetcher, formulaResultsKey } from '@/lib/swr';

const swrKey = formulaResultsKey({
  formulaId: 'formula_123',
  userEmail: credentials.userEmail,
  userPassword: credentials.userPassword,
});

const { data } = useSWR(
  swrKey,
  ([_key, params]) => formulaResultsFetcher(_key, params)
);
```

New implementation (auto credentials):

```typescript
import { formulaResultsAutoFetcher, formulaResultsAutoKey } from '@/lib/swr';

const swrKey = formulaResultsAutoKey('formula_123');
const { data } = useSWR(
  swrKey,
  () => formulaResultsAutoFetcher('formula_123')
);
```

### Watchlists

```typescript
import useSWR from 'swr';
import { watchlistFetcher, watchlistKey } from '@/lib/swr';

function Watchlists() {
  const { data, error } = useSWR(
    watchlistKey(), // Auto includes user email
    watchlistFetcher
  );

  return (
    <div>
      MIO: {data?.platforms.mio.watchlists?.length || 0}
      TV: {data?.platforms.tradingview.watchlists?.length || 0}
    </div>
  );
}
```

## Error Handling

All fetchers throw `FetcherError` with status codes:

```typescript
import { FetcherError } from '@/lib/swr';

const { error } = useSWR(key, fetcher);

if (error instanceof FetcherError) {
  if (error.status === 401) {
    // Not authenticated - redirect to login
  } else if (error.status === 404) {
    // Resource not found
  } else {
    // Other errors
  }
}
```

## Cache Key Utilities

### Key Matching for Invalidation

```typescript
import { mutate } from 'swr';
import { keyMatches } from '@/lib/swr';

// Invalidate all chart data for a symbol
mutate((key) => keyMatches(key, 'chart-data', 'NSE:RELIANCE'));

// Invalidate all formulas
mutate((key) => keyMatches(key, 'formulas'));
```

### Conditional Keys

Keys return `null` when user is not authenticated, preventing unnecessary fetch attempts:

```typescript
const key = formulaListKey(); // null if not logged in
const { data } = useSWR(key, fetcher); // Won't fetch if key is null
```

## API Reference

### Fetchers

| Function | Endpoint | Method | Returns |
|----------|----------|--------|---------|
| `chartDataFetcher` | `/api/chart-data` | POST | `ChartDataResponse` |
| `formulaListFetcher` | `/api/mio-formulas` | GET | `FormulaListResponse` |
| `formulaResultsAutoFetcher` | `/api/formula-results` | POST | `FormulaResultsResponse` |
| `watchlistFetcher` | `/api/watchlists` | POST | `UnifiedWatchlistResponse` |
| `watchlistStatusFetcher` | `/api/watchlists` | GET | Platform status |

### Cache Keys

| Function | Parameters | Returns |
|----------|-----------|---------|
| `chartDataKey` | symbol, resolution, bars, cvd | Array key |
| `simpleChartDataKey` | symbol, resolution, bars | Array key |
| `formulaListKey` | userEmail? | Array key or null |
| `formulaResultsAutoKey` | formulaId, userEmail? | Array key or null |
| `watchlistKey` | userEmail? | Array key or null |
| `platformWatchlistKey` | platform, userEmail? | Array key or null |
| `watchlistStatusKey` | userEmail? | Array key or null |

### Utilities

- `isValidKey(key)` - Check if key is not null
- `keyMatches(key, ...prefixes)` - Match keys by prefix for cache invalidation
- `FetcherError` - Custom error class with HTTP status codes

## Migration Guide

### From Old Pattern to New Pattern

**Before** (manual credential management):
```typescript
const credentials = getStoredCredentials();
const url = `/api/mio-formulas?userEmail=${credentials?.userEmail}&userPassword=${credentials?.userPassword}`;
const { data } = useSWR(url, fetcher);
```

**After** (automatic credential management):
```typescript
const { data } = useSWR(formulaListKey(), formulaListFetcher);
```

### Backward Compatibility

Existing hooks (`useFormulas`, `useFormulaResults`) continue to work without changes. New code should use the auto-credential fetchers for cleaner implementation.

## Security

- Credentials are loaded from localStorage via `getStoredCredentials()`
- Never hardcode credentials in fetchers or keys
- Credentials are passed in request body (POST) or query params (GET) as required by APIs
- All requests use HTTPS in production

## Best Practices

1. **Use array keys**: More reliable than string concatenation
2. **Return null for unauthenticated**: Prevents unnecessary fetches
3. **Handle FetcherError**: Check status codes for proper error handling
4. **Use key matchers**: For efficient cache invalidation
5. **Prefer auto-credential fetchers**: Reduces boilerplate in new code
