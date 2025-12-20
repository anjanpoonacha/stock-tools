import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

/**
 * Hook to manage unified watchlist integration across MIO and TradingView platforms.
 * Provides watchlist fetching, selection, search, and stock addition capabilities.
 * 
 * @param props - Current symbol and optional stock data
 * @returns Watchlist state and management functions
 * 
 * @example
 * const {
 *   watchlists,
 *   currentWatchlist,
 *   selectWatchlist,
 *   addToCurrentWatchlist
 * } = useWatchlistIntegration({
 *   currentSymbol: 'RELIANCE',
 *   currentStock: { symbol: 'RELIANCE', name: 'Reliance Industries' }
 * });
 */
export function useWatchlistIntegration({
  currentSymbol,
}: UseWatchlistIntegrationProps): UseWatchlistIntegrationReturn {
  // State management
  const [watchlists, setWatchlists] = useState<UnifiedWatchlist[]>([]);
  const [currentWatchlistId, setCurrentWatchlistId] = useState<string | null>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CURRENT_WATCHLIST_KEY);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks - use same pattern as useTvSync
  const [mioSessionId, mioLoading] = useSessionBridge('marketinout');
  const [tvSessionId, tvLoading] = useSessionBridge('tradingview');
  const { mioSessionAvailable, tvSessionAvailable } = useSessionAvailability();
  const toast = useToast();

  // Debug logging for session state
  console.log('[useWatchlistIntegration] Session state:', {
    mioSessionId: mioSessionId ? '✓' : '✗',
    tvSessionId: tvSessionId ? '✓' : '✗',
    mioLoading,
    tvLoading,
    mioAvailable: mioSessionAvailable,
    tvAvailable: tvSessionAvailable,
  });

  // Build sessions object from session bridge
  const sessions: WatchlistSessions = useMemo(() => {
    const sessionObj: WatchlistSessions = {};
    
    if (mioSessionId) {
      sessionObj.mio = { internalSessionId: mioSessionId };
    }
    
    if (tvSessionId) {
      sessionObj.tv = { sessionId: tvSessionId };
    }
    
    return sessionObj;
  }, [mioSessionId, tvSessionId]);

  // Store sessions in ref to stabilize refreshWatchlists callback
  const sessionsRef = useRef<WatchlistSessions>(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  /**
   * Refresh watchlists from both platforms.
   * Uses sessionsRef.current to avoid circular dependencies.
   */
  const refreshWatchlists = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch watchlists using ref to avoid dependency cycles
      const fetchedWatchlists = await fetchUnifiedWatchlists(sessionsRef.current);
      setWatchlists(fetchedWatchlists);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch watchlists';
      console.error('refreshWatchlists error:', err);
      setError(errorMessage);
      toast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [toast]); // ✅ No sessions dependency - stable callback!

  /**
   * Add current stock to a watchlist (or currently selected if no ID provided).
   * Uses sessionsRef.current to avoid circular dependencies.
   */
  const addToCurrentWatchlist = useCallback(async (watchlistIdOverride?: string): Promise<void> => {
    try {
      // Use override or current watchlist ID
      const targetWatchlistId = watchlistIdOverride || currentWatchlistId;
      
      // Validate watchlist exists
      if (!targetWatchlistId) {
        toast('No watchlist selected', 'error');
        return;
      }

      // Find watchlist
      const watchlist = watchlists.find((w) => w.id === targetWatchlistId);
      if (!watchlist) {
        toast('Watchlist not found', 'error');
        return;
      }

      // Add stock to watchlist using ref to avoid dependency cycles
      const result = await addStockToWatchlist(currentSymbol, watchlist, sessionsRef.current);

      // Handle result with appropriate toasts
      const mioSuccess = result.platforms.mio?.success ?? false;
      const tvSuccess = result.platforms.tv?.success ?? false;

      if (mioSuccess && tvSuccess) {
        // Both succeeded
        toast(`✓ ${currentSymbol} added to ${watchlist.name}`, 'success');
      } else if (mioSuccess && !tvSuccess) {
        // MIO only
        toast(
          `⚠️ ${currentSymbol} added to ${watchlist.name} (MIO only)\nTV session expired.`,
          'info'
        );
      } else if (!mioSuccess && tvSuccess) {
        // TV only
        toast(
          `⚠️ ${currentSymbol} added to ${watchlist.name} (TV only)\nMIO session expired.`,
          'info'
        );
      } else {
        // Both failed
        toast(
          `✗ Failed to add ${currentSymbol} to ${watchlist.name}\nCheck your sessions.`,
          'error'
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add stock';
      console.error('addToCurrentWatchlist error:', err);
      toast(errorMessage, 'error');
    }
  }, [currentWatchlistId, watchlists, currentSymbol, toast]); // ✅ No sessions dependency!

  /**
   * Select a watchlist and add the current stock to it.
   */
  const selectWatchlist = useCallback(async (id: string): Promise<void> => {
    try {
      const watchlist = watchlists.find((w) => w.id === id);
      if (!watchlist) {
        toast('Watchlist not found', 'error');
        return;
      }

      // Update state and localStorage
      setCurrentWatchlistId(id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CURRENT_WATCHLIST_KEY, id);
      }

      // Add current stock to the selected watchlist (pass ID directly to avoid state timing issues)
      await addToCurrentWatchlist(id);

      toast(`Selected "${watchlist.name}"`, 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select watchlist';
      console.error('selectWatchlist error:', err);
      toast(errorMessage, 'error');
    }
  }, [watchlists, addToCurrentWatchlist, toast]);

  /**
   * Search watchlists by name (case-insensitive).
   */
  const searchWatchlists = useCallback((query: string): UnifiedWatchlist[] => {
    if (!query.trim()) {
      return watchlists;
    }

    const lowerQuery = query.toLowerCase();
    return watchlists.filter((w) => w.name.toLowerCase().includes(lowerQuery));
  }, [watchlists]);

  // Initial fetch when sessions are loaded and available
  useEffect(() => {
    // Wait for session loading to complete
    if (mioLoading || tvLoading) {
      console.log('[useWatchlistIntegration] Waiting for sessions to load...');
      return;
    }

    // Only fetch if at least one session ID is available
    if (mioSessionId || tvSessionId) {
      console.log('[useWatchlistIntegration] Sessions loaded, fetching watchlists...');
      refreshWatchlists();
    } else {
      console.log('[useWatchlistIntegration] No sessions available after loading');
    }
  }, [mioSessionId, tvSessionId, mioLoading, tvLoading, refreshWatchlists]);

  // Derived values
  const currentWatchlist = useMemo(() => {
    if (!currentWatchlistId) {
      return null;
    }
    return watchlists.find((w) => w.id === currentWatchlistId) ?? null;
  }, [currentWatchlistId, watchlists]);

  const sessionStatus = useMemo(
    () => ({
      mio: mioSessionAvailable,
      tv: tvSessionAvailable,
    }),
    [mioSessionAvailable, tvSessionAvailable]
  );

  return {
    watchlists,
    currentWatchlist,
    isLoading,
    error,
    selectWatchlist,
    addToCurrentWatchlist,
    searchWatchlists,
    refreshWatchlists,
    sessionStatus,
  };
}
