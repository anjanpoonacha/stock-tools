import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSessionAvailability } from '@/hooks/useSessionAvailability';
import { useSessionBridge } from '@/lib/useSessionBridge';
import { useToast } from '@/components/ui/toast';
import { fetchUnifiedWatchlists, addStockToWatchlist } from '@/lib/watchlist-sync/unifiedWatchlistService';
import type { UnifiedWatchlist, WatchlistSessions } from '@/lib/watchlist-sync/types';
import type { Stock } from '@/types/stock';

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
const watchlistFetcher = async ([_key, sessions]: readonly [string, WatchlistSessions]) =>
  fetchUnifiedWatchlists(sessions);

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

  const [currentWatchlistId, setCurrentWatchlistId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(CURRENT_WATCHLIST_KEY) : null
  );

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
    { revalidateOnFocus: false, dedupingInterval: 5000, keepPreviousData: true }
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
        const data = await addStockMutation({ symbol: currentSymbol, watchlistIdOverride });
        if (!data) return toast('Failed to add stock', 'error');

        const { result, watchlist, symbol } = data;
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
    [currentSymbol, addStockMutation, toast]
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

  useEffect(() => {
    if (error) toast(error, 'error');
  }, [error, toast]);

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
