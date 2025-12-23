import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSessionAvailability } from '@/hooks/useSessionAvailability';
import { useSessionBridge } from '@/lib/useSessionBridge';
import { useToast } from '@/components/ui/toast';
import { fetchUnifiedWatchlists, addStockToWatchlist } from '@/lib/watchlist-sync/unifiedWatchlistService';
import type { UnifiedWatchlist, WatchlistSessions } from '@/lib/watchlist-sync/types';
import type { Stock } from '@/types/stock';
import { getSwrDedupingInterval, isClientCacheEnabled } from '@/lib/cache/cacheConfig';

interface UseWatchlistIntegrationProps {
  currentSymbol: string;
  currentStock?: Stock;
}

interface UseWatchlistIntegrationReturn {
  watchlists: UnifiedWatchlist[];
  currentWatchlist: UnifiedWatchlist | null;
  isLoading: boolean;
  error: string | null;
  selectWatchlist: (id: string) => Promise<void>;
  addToCurrentWatchlist: () => Promise<void>;
  searchWatchlists: (query: string) => UnifiedWatchlist[];
  refreshWatchlists: () => Promise<void>;
  sessionStatus: {
    mio: boolean;
    tv: boolean;
  };
}

const CURRENT_WATCHLIST_KEY = 'chart-current-watchlist';

// SWR key generator - returns null if no sessions (conditional fetching)
const watchlistKey = (sessions: WatchlistSessions | null) =>
  sessions && (sessions.mio || sessions.tv) ? (['watchlists', sessions] as const) : null;

// SWR fetcher for unified watchlists
const watchlistFetcher = async ([_key, sessions]: readonly [string, WatchlistSessions]) => {
  const result = await fetchUnifiedWatchlists(sessions);
  // If there are errors, store them for the hook to handle
  if (result.errors) {
    // Attach errors to the result so the hook can access them
    (result.watchlists as any).__fetchErrors = result.errors;
  }
  return result.watchlists;
};

/**
 * Hook to manage unified watchlist integration (SWR version).
 * Replaces manual state management with automatic cache management and conditional fetching.
 */
export function useWatchlistIntegration({
  currentSymbol,
}: UseWatchlistIntegrationProps): UseWatchlistIntegrationReturn {
  const [mioSessionId, mioLoading] = useSessionBridge('marketinout');
  const [tvSessionId, tvLoading] = useSessionBridge('tradingview');
  const { mioSessionAvailable, tvSessionAvailable } = useSessionAvailability();
  const toast = useToast();

  const [currentWatchlistId, setCurrentWatchlistId] = useState<string | null>(() => {
    const storedId = typeof window !== 'undefined' ? localStorage.getItem(CURRENT_WATCHLIST_KEY) : null;
    console.log('[useWatchlistIntegration] Initialized with stored watchlist ID:', storedId);
    return storedId;
  });

  // Build sessions object - null until loading completes
  const sessions: WatchlistSessions | null = useMemo(() => {
    if (mioLoading || tvLoading || (!mioSessionId && !tvSessionId)) return null;
    const sessionObj: WatchlistSessions = {};
    if (mioSessionId) sessionObj.mio = { internalSessionId: mioSessionId };
    if (tvSessionId) sessionObj.tv = { sessionId: tvSessionId };
    return sessionObj;
  }, [mioSessionId, tvSessionId, mioLoading, tvLoading]);

  // SWR: Fetch watchlists with conditional fetching
  const { data: watchlists = [], error: swrError, isLoading, mutate: refreshWatchlists } = useSWR(
    watchlistKey(sessions),
    watchlistFetcher,
    { 
      revalidateOnFocus: false, 
      dedupingInterval: getSwrDedupingInterval(5000), 
      keepPreviousData: isClientCacheEnabled() 
    }
  );

  // SWR Mutation: Add stock to watchlist
  const { trigger: addStockMutation, isMutating } = useSWRMutation(
    watchlistKey(sessions),
    async (_key, { arg }: { arg: { symbol: string; watchlistIdOverride?: string } }) => {
      const { symbol, watchlistIdOverride } = arg;
      const targetWatchlistId = watchlistIdOverride || currentWatchlistId;
      if (!targetWatchlistId) throw new Error('No watchlist selected');
      if (!sessions) throw new Error('No active sessions');
      const watchlist = watchlists.find((w) => w.id === targetWatchlistId);
      if (!watchlist) throw new Error('Watchlist not found');
      const result = await addStockToWatchlist(symbol, watchlist, sessions);
      return { result, watchlist, symbol };
    },
    { throwOnError: false }
  );

  // Add current stock to watchlist
  const addToCurrentWatchlist = useCallback(
    async (watchlistIdOverride?: string): Promise<void> => {
      try {
        // Early validation: Check if watchlist exists
        const targetWatchlistId = watchlistIdOverride || currentWatchlistId;
        if (!targetWatchlistId) {
          toast('⚠️ No watchlist selected. Press ; (semicolon) to select a watchlist first.', 'info');
          return;
        }

        const watchlist = watchlists.find((w) => w.id === targetWatchlistId);
        if (!watchlist) {
          // Watchlist ID is stale - clear it and prompt user to reselect
          setCurrentWatchlistId(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(CURRENT_WATCHLIST_KEY);
          }
          toast('⚠️ Selected watchlist not found. Press ; (semicolon) to select a watchlist.', 'info');
          return;
        }

        const data = await addStockMutation({ symbol: currentSymbol, watchlistIdOverride });
        if (!data) return toast('Failed to add stock', 'error');

        const { result, symbol } = data;
        const mioSuccess = result.platforms.mio?.success ?? false;
        const tvSuccess = result.platforms.tv?.success ?? false;

        if (mioSuccess && tvSuccess) {
          toast(`✓ ${symbol} added to ${watchlist.name}`, 'success');
        } else if (mioSuccess) {
          toast(`⚠️ ${symbol} added to ${watchlist.name} (MIO only)\nTV session expired.`, 'info');
        } else if (tvSuccess) {
          toast(`⚠️ ${symbol} added to ${watchlist.name} (TV only)\nMIO session expired.`, 'info');
        } else {
          toast(`✗ Failed to add ${symbol} to ${watchlist.name}\nCheck your sessions.`, 'error');
        }
      } catch (err) {
        console.error('addToCurrentWatchlist error:', err);
        toast(err instanceof Error ? err.message : 'Failed to add stock', 'error');
      }
    },
    [currentSymbol, addStockMutation, toast, currentWatchlistId, watchlists]
  );

  // Select watchlist and add stock to it
  const selectWatchlist = useCallback(
    async (id: string): Promise<void> => {
      try {
        const watchlist = watchlists.find((w) => w.id === id);
        if (!watchlist) return toast('Watchlist not found', 'error');

        setCurrentWatchlistId(id);
        if (typeof window !== 'undefined') localStorage.setItem(CURRENT_WATCHLIST_KEY, id);
        await addToCurrentWatchlist(id);
        toast(`Selected "${watchlist.name}"`, 'success');
      } catch (err) {
        console.error('selectWatchlist error:', err);
        toast(err instanceof Error ? err.message : 'Failed to select watchlist', 'error');
      }
    },
    [watchlists, addToCurrentWatchlist, toast]
  );

  // Search watchlists by name
  const searchWatchlists = useCallback(
    (query: string): UnifiedWatchlist[] =>
      !query.trim() ? watchlists : watchlists.filter((w) => w.name.toLowerCase().includes(query.toLowerCase())),
    [watchlists]
  );

  // Manual refresh with error handling
  const handleRefreshWatchlists = useCallback(async (): Promise<void> => {
    try {
      await refreshWatchlists();
    } catch (err) {
      console.error('refreshWatchlists error:', err);
      toast(err instanceof Error ? err.message : 'Failed to refresh watchlists', 'error');
    }
  }, [refreshWatchlists, toast]);

  // Auto-recover watchlist selection if ID format changed
  // This handles the case where watchlist IDs were regenerated after a fetch
  useEffect(() => {
    if (!currentWatchlistId || watchlists.length === 0) return;

    // Try to find by exact ID match first
    const exactMatch = watchlists.find((w) => w.id === currentWatchlistId);
    if (exactMatch) return;

    // If no exact match, try to recover by extracting platform IDs from the stored ID
    // Old format might be: "unified-{mioId}-{tvId}", "mio-{mioId}", or "tv-{tvId}"
    const match = currentWatchlistId.match(/^(?:unified|mio|tv)-(.+?)(?:-(.+))?$/);
    if (!match) {
      console.log('[useWatchlistIntegration] Could not parse stored watchlist ID:', currentWatchlistId);
      return;
    }

    const [, id1, id2] = match;

    // Try to find by platform IDs
    const recovered = watchlists.find((w) => {
      // Check if MIO ID matches
      if (w.mioId && (w.mioId === id1 || w.mioId === id2)) return true;
      // Check if TV ID matches
      if (w.tvId && (w.tvId === id1 || w.tvId === id2)) return true;
      return false;
    });

    if (recovered) {
      console.log('[useWatchlistIntegration] Recovered watchlist selection:', {
        oldId: currentWatchlistId,
        newId: recovered.id,
        name: recovered.name,
      });
      // Update to the new stable ID
      setCurrentWatchlistId(recovered.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CURRENT_WATCHLIST_KEY, recovered.id);
      }
    }
  }, [currentWatchlistId, watchlists]);

  // Derived values
  const currentWatchlist = useMemo(
    () => (currentWatchlistId ? watchlists.find((w) => w.id === currentWatchlistId) ?? null : null),
    [currentWatchlistId, watchlists]
  );

  const sessionStatus = useMemo(
    () => ({ mio: mioSessionAvailable, tv: tvSessionAvailable }),
    [mioSessionAvailable, tvSessionAvailable]
  );

  const error = swrError ? (swrError instanceof Error ? swrError.message : 'Failed to fetch watchlists') : null;

  // Show toast notifications for SWR errors
  useEffect(() => {
    if (error) toast(error, 'error');
  }, [error, toast]);

  // Show toast notifications for platform-specific fetch errors
  useEffect(() => {
    const fetchErrors = (watchlists as any).__fetchErrors;
    if (fetchErrors) {
      if (fetchErrors.mio) {
        toast(fetchErrors.mio, 'error');
      }
      if (fetchErrors.tv) {
        toast(fetchErrors.tv, 'error');
      }
      // Clean up the errors after showing them
      delete (watchlists as any).__fetchErrors;
    }
  }, [watchlists, toast]);

  return {
    watchlists,
    currentWatchlist,
    isLoading: isLoading || isMutating,
    error,
    selectWatchlist,
    addToCurrentWatchlist,
    searchWatchlists,
    refreshWatchlists: handleRefreshWatchlists,
    sessionStatus,
  };
}
