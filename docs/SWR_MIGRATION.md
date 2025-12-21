# SWR Migration Guide

## Overview

### What is SWR?

SWR (stale-while-revalidate) is a React Hooks library for data fetching by Vercel. The name comes from the HTTP cache invalidation strategy `stale-while-revalidate`. SWR returns cached (stale) data first, then sends the fetch request (revalidate), and finally comes back with up-to-date data.

**Key Features:**
- Automatic request deduplication
- Built-in caching and revalidation
- Focus/network reconnection revalidation
- Interval polling
- Optimistic UI updates
- Error retry with exponential backoff
- TypeScript support

### Why We're Using SWR

Our codebase currently has significant complexity in data fetching hooks:
- **Manual state management** with `useState` for data, loading, and errors
- **Complex useEffect** chains with dependency arrays that are hard to maintain
- **Manual deduplication** logic to prevent duplicate requests
- **Inconsistent** loading and error handling patterns across hooks
- **Race conditions** from improper cleanup and mounting checks
- **Boilerplate code** repeated across every data fetching hook

SWR eliminates this complexity and provides:
- ✅ **80% less code** in typical data fetching hooks
- ✅ **Automatic request deduplication** - no more ref-based tracking
- ✅ **Built-in cache** - instant data display on revisits
- ✅ **Standardized patterns** - consistent API across the app
- ✅ **Better performance** - less re-renders and network requests
- ✅ **Zero race conditions** - proper request cancellation built-in

### Migration Strategy

We're following a **parallel migration** approach:

1. ✅ **SWR configuration** is already set up in `src/config/swr.config.ts`
2. 🔄 **Gradual migration** - migrate hooks one at a time
3. ⚠️ **No breaking changes** - maintain existing hook interfaces
4. ✅ **Test thoroughly** - verify behavior matches before migrating
5. 📊 **Monitor performance** - watch for improvements in network activity

**Priority Order:**
1. High-traffic hooks (`useFormulas`, `useChartData`)
2. Hooks with complex deduplication logic
3. Hooks with manual refetch mechanisms
4. Lower-level utility hooks

---

## Before/After Code Examples

### Example 1: useFormulas Migration

#### ❌ Before (Manual Implementation)

```typescript
import { useState, useEffect } from 'react';
import type { MIOFormula } from '@/types/formula';

export interface UseFormulasResult {
  formulas: MIOFormula[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFormulas(): UseFormulasResult {
  const [formulas, setFormulas] = useState<MIOFormula[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFormulas = async () => {
    setLoading(true);
    setError(null);

    try {
      const { getStoredCredentials } = await import('@/lib/auth/authUtils');
      const credentials = getStoredCredentials();
      
      if (!credentials) {
        setFormulas([]);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        userEmail: credentials.userEmail,
        userPassword: credentials.userPassword,
      });

      const res = await fetch(`/api/mio-formulas?${params}`);

      if (!res.ok) {
        throw new Error('Failed to load formulas');
      }

      const data = await res.json();

      const validFormulas = data.formulas.filter(
        (f: MIOFormula) => f.extractionStatus === 'success' && f.apiUrl
      );

      setFormulas(validFormulas);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load formulas';
      setError(errorMessage);
      setFormulas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFormulas();
  }, []);

  return {
    formulas,
    loading,
    error,
    refresh: loadFormulas,
  };
}
```

**Lines of code:** 68  
**Complexity issues:**
- Manual loading state management
- Manual error handling
- No request deduplication
- No caching
- Race condition risk (missing cleanup in useEffect)
- Refresh requires re-implementing entire fetch logic

#### ✅ After (SWR Implementation)

```typescript
import useSWR from 'swr';
import type { MIOFormula } from '@/types/formula';

export interface UseFormulasResult {
  formulas: MIOFormula[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Fetcher function - can be shared across hooks
async function fetchFormulas() {
  const { getStoredCredentials } = await import('@/lib/auth/authUtils');
  const credentials = getStoredCredentials();
  
  if (!credentials) {
    return { formulas: [] };
  }

  const params = new URLSearchParams({
    userEmail: credentials.userEmail,
    userPassword: credentials.userPassword,
  });

  const res = await fetch(`/api/mio-formulas?${params}`);

  if (!res.ok) {
    throw new Error('Failed to load formulas');
  }

  return res.json();
}

export function useFormulas(): UseFormulasResult {
  const { data, error, isLoading, mutate } = useSWR(
    'mio-formulas',
    fetchFormulas
  );

  const validFormulas = data?.formulas.filter(
    (f: MIOFormula) => f.extractionStatus === 'success' && f.apiUrl
  ) ?? [];

  return {
    formulas: validFormulas,
    loading: isLoading,
    error: error?.message ?? null,
    refresh: async () => { await mutate(); },
  };
}
```

**Lines of code:** 48 (-29% reduction)  
**Benefits:**
- ✅ Automatic deduplication - multiple components using this hook = 1 request
- ✅ Built-in caching - instant data on mount after first load
- ✅ Automatic revalidation on network reconnect
- ✅ No race conditions - SWR handles cleanup automatically
- ✅ Simpler refresh - just call `mutate()`
- ✅ Exponential backoff retry (configured globally)

---

### Example 2: useChartData Migration

#### ❌ Before (Manual Implementation - Simplified)

```typescript
export function useChartData(params: UseChartDataParams): UseChartDataReturn {
  const [rawData, setRawData] = useState<ChartDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  const { enabled = true } = params;

  // Stabilize params to prevent unnecessary re-fetches
  const stableParams = useMemo(() => ({
    symbol: params.symbol,
    resolution: params.resolution,
    barsCount: params.barsCount,
    apiEndpoint: params.apiEndpoint,
    cvdEnabled: params.cvdEnabled,
    cvdAnchorPeriod: params.cvdAnchorPeriod,
    cvdTimeframe: params.cvdTimeframe,
  }), [/* 7 dependencies */]);

  // Deduplication logic
  const processedData = useMemo(() => {
    if (!rawData?.bars) return rawData;
    
    const seen = new Set<number>();
    const uniqueBars = rawData.bars.filter(bar => {
      if (seen.has(bar.time)) return false;
      seen.add(bar.time);
      return true;
    });
    
    return { ...rawData, bars: uniqueBars };
  }, [rawData]);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchChartData(stableParams);
        if (!mounted) return;
        setRawData(result);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [stableParams, enabled, refetchKey]);

  const refetch = () => setRefetchKey(prev => prev + 1);

  return { data: processedData, loading, error, refetch };
}
```

**Issues:**
- Complex dependency tracking with `useMemo`
- Manual mounting flag for race condition prevention
- Manual refetch key management
- Custom deduplication logic
- 225 lines total

#### ✅ After (SWR Implementation)

```typescript
export function useChartData(params: UseChartDataParams): UseChartDataReturn {
  const { enabled = true } = params;

  // Generate stable cache key from params
  const cacheKey = enabled
    ? ['chart-data', params.symbol, params.resolution, params.barsCount, 
       params.cvdEnabled, params.cvdAnchorPeriod, params.cvdTimeframe]
    : null; // null = don't fetch

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    () => fetchChartData(params),
    {
      revalidateOnFocus: false, // Charts don't need focus revalidation
    }
  );

  // Deduplication still needed (business logic)
  const processedData = useMemo(() => {
    if (!data?.bars) return data;
    
    const seen = new Set<number>();
    const uniqueBars = data.bars.filter(bar => {
      if (seen.has(bar.time)) return false;
      seen.add(bar.time);
      return true;
    });
    
    return { ...data, bars: uniqueBars };
  }, [data]);

  return {
    data: processedData,
    loading: isLoading,
    error: error?.message ?? null,
    refetch: mutate,
  };
}
```

**Benefits:**
- ✅ 40% less code
- ✅ No manual mounting checks
- ✅ No refetch key state
- ✅ Automatic request deduplication
- ✅ Array-based cache key handles multiple params cleanly
- ✅ Conditional fetching with `null` key pattern

---

## Key Pattern Mappings

### 1. State Management

| Before | After |
|--------|-------|
| `const [data, setData] = useState(null)` | `const { data } = useSWR(key, fetcher)` |
| `const [loading, setLoading] = useState(true)` | `const { isLoading } = useSWR(...)` |
| `const [error, setError] = useState(null)` | `const { error } = useSWR(...)` |

### 2. Data Fetching

```typescript
// ❌ Before
useEffect(() => {
  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/data');
      const data = await res.json();
      setData(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }
  load();
}, [dependency]);

// ✅ After
const { data, error, isLoading } = useSWR(
  ['api-data', dependency],
  () => fetch('/api/data').then(r => r.json())
);
```

### 3. Manual Refetch

```typescript
// ❌ Before
const [refetchKey, setRefetchKey] = useState(0);
const refetch = () => setRefetchKey(prev => prev + 1);
// Include refetchKey in useEffect dependencies

// ✅ After
const { mutate } = useSWR(key, fetcher);
const refetch = () => mutate();
```

### 4. Request Deduplication

```typescript
// ❌ Before (225 lines in useChartData)
const requestRef = useRef<Map<string, Promise>>(new Map());
const cacheKey = JSON.stringify(params);

if (requestRef.current.has(cacheKey)) {
  return requestRef.current.get(cacheKey);
}

const promise = fetchData();
requestRef.current.set(cacheKey, promise);
// ... cleanup logic

// ✅ After
useSWR(['data', params.id], fetcher);
// SWR deduplicates automatically within 2s window
```

### 5. Conditional Fetching

```typescript
// ❌ Before
useEffect(() => {
  if (!shouldFetch) return;
  fetchData();
}, [shouldFetch, ...deps]);

// ✅ After
useSWR(
  shouldFetch ? ['key', dep1, dep2] : null,
  fetcher
);
```

### 6. Loading States

```typescript
// ❌ Before
const [initialLoad, setInitialLoad] = useState(true);
const [refreshing, setRefreshing] = useState(false);

// ✅ After
const { isLoading, isValidating } = useSWR(key, fetcher);
// isLoading = first load
// isValidating = any revalidation (including refetch)
```

---

## Common Patterns

### Pattern 1: Conditional Fetching (Authenticated Requests)

```typescript
export function useUserData() {
  const { isAuthenticated, userEmail } = useAuth();

  // Don't fetch if not authenticated
  const { data, error, isLoading } = useSWR(
    isAuthenticated ? ['user-data', userEmail] : null,
    async () => {
      const credentials = requireCredentials();
      const res = await fetch('/api/user-data', {
        headers: {
          'X-User-Email': credentials.userEmail,
          'X-User-Password': credentials.userPassword,
        },
      });
      return res.json();
    }
  );

  return { data, error, loading: isLoading };
}
```

**Key points:**
- Return `null` as key when fetch shouldn't happen
- Include authentication dependencies in key array
- SWR won't make a request when key is `null`

### Pattern 2: Mutations with Optimistic Updates

```typescript
import useSWRMutation from 'swr/mutation';

export function useUpdateFormula() {
  const { trigger, isMutating } = useSWRMutation(
    'mio-formulas',
    async (key, { arg }: { arg: { id: string; data: Partial<MIOFormula> } }) => {
      const res = await fetch(`/api/mio-formulas/${arg.id}`, {
        method: 'PUT',
        body: JSON.stringify(arg.data),
      });
      return res.json();
    },
    {
      // Optimistic update
      optimisticData: (currentData) => {
        // Update local cache immediately
        return updateLocalCache(currentData, arg);
      },
      // Revalidate after mutation
      revalidate: true,
    }
  );

  return {
    updateFormula: trigger,
    isUpdating: isMutating,
  };
}
```

### Pattern 3: Dependent Fetches

```typescript
export function useFormulaDetails(formulaId: string | null) {
  // First fetch: Get formula metadata
  const { data: formula } = useSWR(
    formulaId ? ['formula', formulaId] : null,
    () => fetchFormula(formulaId!)
  );

  // Second fetch: Only runs when formula is loaded
  const { data: results } = useSWR(
    formula?.apiUrl ? ['formula-results', formula.id] : null,
    () => fetchFormulaResults(formula!.apiUrl)
  );

  return { formula, results };
}
```

### Pattern 4: Polling/Interval Revalidation

```typescript
export function useLiveData(symbol: string) {
  const { data } = useSWR(
    ['live-data', symbol],
    () => fetchLiveData(symbol),
    {
      refreshInterval: 5000, // Poll every 5 seconds
      dedupingInterval: 1000, // Prevent duplicate requests within 1s
    }
  );

  return { data };
}
```

### Pattern 5: Global Cache Invalidation

```typescript
import { mutate } from 'swr';

// Invalidate all formula-related cache entries
export async function invalidateFormulasCache() {
  await mutate(
    (key) => Array.isArray(key) && key[0] === 'mio-formulas',
    undefined,
    { revalidate: true }
  );
}

// Update specific cache entry
export function updateFormulaCache(formulaId: string, newData: MIOFormula) {
  mutate(['formula', formulaId], newData, { revalidate: false });
}
```

### Pattern 6: Custom Cache Key Generation

```typescript
// Helper to generate stable cache keys
function createChartKey(params: ChartParams) {
  return [
    'chart-data',
    params.symbol,
    params.resolution,
    params.barsCount,
    params.cvdEnabled ? 'cvd' : 'no-cvd',
    params.cvdAnchorPeriod,
    params.cvdTimeframe,
  ].filter(Boolean); // Remove null/undefined values
}

export function useChartData(params: ChartParams) {
  const { data } = useSWR(createChartKey(params), () => fetchChart(params));
  return { data };
}
```

---

## Migration Checklist

### Pre-Migration Steps

- [ ] Read this entire migration guide
- [ ] Review the target hook's current implementation
- [ ] Identify all state variables and their purposes
- [ ] Map existing patterns to SWR equivalents
- [ ] Check if hook has special requirements (polling, mutations, etc.)

### Migration Steps

1. **Extract Fetcher Function**
   - [ ] Move fetch logic outside the hook
   - [ ] Make fetcher pure (no side effects)
   - [ ] Add proper TypeScript types
   - [ ] Handle errors by throwing (let SWR catch)

2. **Replace State Management**
   - [ ] Replace `useState` with `useSWR`
   - [ ] Map `data`, `isLoading`, `error` to existing return interface
   - [ ] Replace manual refetch with `mutate`

3. **Generate Cache Key**
   - [ ] Create stable array-based cache key
   - [ ] Include all fetch dependencies in key
   - [ ] Return `null` for conditional fetching

4. **Configure SWR Options**
   - [ ] Add `revalidateOnFocus: false` for charts/static data
   - [ ] Add `refreshInterval` for polling scenarios
   - [ ] Add custom `dedupingInterval` if needed

5. **Handle Edge Cases**
   - [ ] Add null/undefined guards for data access
   - [ ] Preserve any custom data transformation logic
   - [ ] Handle conditional rendering based on loading state

### Testing Checklist

- [ ] **Initial Load**: Data loads correctly on first mount
- [ ] **Loading States**: `isLoading` shows during initial fetch
- [ ] **Error Handling**: Errors display correctly and retry works
- [ ] **Refetch**: Manual refetch (`mutate()`) works as expected
- [ ] **Deduplication**: Multiple instances don't cause duplicate requests
- [ ] **Conditional Fetching**: Disabled state (`null` key) prevents requests
- [ ] **Cache Behavior**: Revisiting component shows cached data instantly
- [ ] **Dependencies**: Changes to key dependencies trigger refetch
- [ ] **Network Tab**: Verify request count matches expectations
- [ ] **No Regressions**: Existing functionality unchanged

### Rollback Procedure

If issues are discovered post-migration:

1. **Immediate Rollback**
   ```bash
   git revert <commit-hash>
   pnpm dev
   ```

2. **Document Issue**
   - Note what broke and under what conditions
   - Capture console errors and network logs
   - Add to migration guide as known issue

3. **Root Cause Analysis**
   - Compare SWR behavior vs. expected behavior
   - Check cache key stability
   - Review SWR config options
   - Test in isolation

4. **Fix Forward**
   - Apply fix to reverted code
   - Re-test thoroughly
   - Re-apply migration with fix

---

## Common Pitfalls

### Pitfall 1: Unstable Cache Keys

❌ **Problem:**
```typescript
// Object reference changes on every render
const { data } = useSWR({ symbol, resolution }, fetcher);
```

✅ **Solution:**
```typescript
// Use array with stable values
const { data } = useSWR(['chart', symbol, resolution], fetcher);
```

**Why:** SWR uses key equality to determine cache hits. Objects have referential equality, so `{}` !== `{}` even if contents are the same. Arrays are compared by value in SWR.

### Pitfall 2: Missing Conditional Fetching

❌ **Problem:**
```typescript
const { data } = useSWR(
  ['user-data', userEmail],
  () => fetchUserData(userEmail)
);
// Crashes when userEmail is null/undefined
```

✅ **Solution:**
```typescript
const { data } = useSWR(
  userEmail ? ['user-data', userEmail] : null,
  () => fetchUserData(userEmail!)
);
```

### Pitfall 3: Using useSWR for Mutations

❌ **Problem:**
```typescript
// useSWR is for GET requests only
const { data } = useSWR('create-user', () => createUser(newUserData));
```

✅ **Solution:**
```typescript
// Use useSWRMutation for POST/PUT/DELETE
const { trigger } = useSWRMutation('users', (key, { arg }) => createUser(arg));
await trigger(newUserData);
```

### Pitfall 4: Not Handling Loading States

❌ **Problem:**
```typescript
const { data } = useSWR(key, fetcher);
return <div>{data.items.map(...)}</div>; // Crashes during load
```

✅ **Solution:**
```typescript
const { data, isLoading } = useSWR(key, fetcher);
if (isLoading) return <Skeleton />;
if (!data) return null;
return <div>{data.items.map(...)}</div>;
```

### Pitfall 5: Forgetting to Throw Errors in Fetcher

❌ **Problem:**
```typescript
const fetcher = async (url: string) => {
  const res = await fetch(url);
  // SWR won't know about errors!
  return res.json();
};
```

✅ **Solution:**
```typescript
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
```

### Pitfall 6: Incorrect Null/Undefined Handling

❌ **Problem:**
```typescript
const { data, isLoading } = useSWR(key, fetcher);
// data is undefined during load, not null!
const items = data?.items ?? null; // Still undefined initially
```

✅ **Solution:**
```typescript
const { data, isLoading } = useSWR(key, fetcher);
const items = data?.items ?? []; // Provide default value
```

---

## Best Practices

### 1. Cache Key Naming Conventions

Use descriptive, namespaced keys:

```typescript
// ✅ Good
useSWR(['mio-formulas', 'list'], fetcher);
useSWR(['chart-data', symbol, resolution], fetcher);
useSWR(['user', userId, 'settings'], fetcher);

// ❌ Bad
useSWR('formulas', fetcher); // Too generic
useSWR(symbol, fetcher); // Not namespaced
useSWR(['data', id], fetcher); // Not descriptive
```

**Pattern:** `[domain/feature, entity, ...dependencies]`

### 2. When to Use `revalidateOnFocus`

```typescript
// Enable for frequently changing data
useSWR('notifications', fetcher, {
  revalidateOnFocus: true, // Check for new notifications
});

// Disable for static or slow-changing data
useSWR(['chart-data', symbol], fetcher, {
  revalidateOnFocus: false, // Chart data doesn't change when window focuses
});
```

**Default:** Our global config has `revalidateOnFocus: false`. Override per-hook as needed.

### 3. Error Handling Patterns

```typescript
// In fetcher: Throw errors with context
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error(`Failed to fetch ${url}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
};

// In component: Display user-friendly messages
const { data, error } = useSWR(key, fetcher);

if (error) {
  return <ErrorMessage>
    {error.status === 401 
      ? 'Please log in to continue'
      : 'Failed to load data. Please try again.'}
  </ErrorMessage>;
}
```

### 4. Cache Invalidation Strategies

```typescript
import { mutate } from 'swr';

// Strategy 1: Invalidate specific key
mutate(['formula', formulaId]);

// Strategy 2: Invalidate pattern (all formulas)
mutate(
  (key) => Array.isArray(key) && key[0] === 'formula',
  undefined,
  { revalidate: true }
);

// Strategy 3: Optimistic update + revalidate
mutate(
  ['formula', formulaId],
  optimisticData,
  { revalidate: true }
);

// Strategy 4: Update multiple related caches
async function onFormulaUpdate(formula: MIOFormula) {
  await Promise.all([
    mutate(['formula', formula.id], formula),
    mutate(['mio-formulas', 'list']),
  ]);
}
```

### 5. Shared Fetcher Functions

Create reusable fetchers in `src/lib/fetchers/`:

```typescript
// src/lib/fetchers/authenticated.ts
export async function authenticatedFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const credentials = requireCredentials();
  
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-User-Email': credentials.userEmail,
      'X-User-Password': credentials.userPassword,
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

// Usage
import { authenticatedFetch } from '@/lib/fetchers/authenticated';

useSWR('api/user-data', () => authenticatedFetch('/api/user-data'));
```

### 6. TypeScript Types

```typescript
import type { SWRResponse } from 'swr';

// Define return types explicitly
interface UseFormulaResult {
  formula: MIOFormula | undefined;
  loading: boolean;
  error: Error | undefined;
  refresh: () => Promise<void>;
}

export function useFormula(id: string): UseFormulaResult {
  const { data, error, isLoading, mutate }: SWRResponse<MIOFormula, Error> = useSWR(
    ['formula', id],
    () => fetchFormula(id)
  );

  return {
    formula: data,
    loading: isLoading,
    error,
    refresh: async () => { await mutate(); },
  };
}
```

---

## Additional Resources

- [SWR Documentation](https://swr.vercel.app/)
- [SWR Examples](https://swr.vercel.app/examples/basic)
- [Global Config Reference](./src/config/swr.config.ts)
- [Migration Status](./todo.md)

---

## Questions or Issues?

If you encounter issues during migration:

1. Review this guide's **Common Pitfalls** section
2. Check the **Testing Checklist** for missed steps
3. Compare your implementation to the **Before/After Examples**
4. Document new patterns/issues in this guide for future migrations

**Remember:** When in doubt, test in isolation first, migrate gradually, and maintain existing interfaces for backward compatibility.
