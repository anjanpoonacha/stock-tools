import { getStoredCredentials } from '@/lib/auth/authUtils';
import type { Watchlist } from '@/lib/mio/types';
import type { TradingViewWatchlist } from '@/lib/tradingview';
import type { UnifiedWatchlist, Platform, WatchlistSessions, AddStockResult } from './types';
import { normalizeSymbol as normalizeSymbolUtil } from '@/lib/utils/exchangeMapper';

/**
 * Normalize a symbol between MIO and TradingView formats.
 * Uses the centralized exchange mapper for consistent symbol conversion.
 * 
 * @param symbol - The stock symbol to normalize
 * @param platform - The target platform ('mio' or 'tv')
 * @returns The normalized symbol
 * 
 * @example
 * normalizeSymbol('NSE:RELIANCE', 'mio') // Returns: 'RELIANCE.NS'
 * normalizeSymbol('RELIANCE', 'mio')     // Returns: 'RELIANCE.NS' (adds .NS suffix)
 * normalizeSymbol('BSE:TCS', 'mio')      // Returns: 'TCS.BO'
 * normalizeSymbol('RELIANCE.NS', 'tv')   // Returns: 'NSE:RELIANCE'
 * normalizeSymbol('TCS.BO', 'tv')        // Returns: 'BSE:TCS'
 */
export function normalizeSymbol(symbol: string, platform: Platform): string {
  return normalizeSymbolUtil(symbol, platform);
}

/**
 * Merge watchlists from MIO and TradingView by name.
 * Watchlists with the same name (case-insensitive) are combined into a single unified entry.
 * 
 * @param mioWatchlists - Array of MIO watchlists
 * @param tvWatchlists - Array of TradingView watchlists
 * @returns Array of unified watchlists, sorted alphabetically by name
 * 
 * @example
 * const mio = [{ id: '123', name: 'Tech Stocks' }];
 * const tv = [{ id: 'abc', name: 'tech stocks', symbols: ['NSE:TCS'] }];
 * mergeWatchlistsByName(mio, tv);
 * // Returns: [{
 * //   id: 'unified-0',
 * //   name: 'Tech Stocks',
 * //   platforms: ['mio', 'tv'],
 * //   mioId: '123',
 * //   tvId: 'abc'
 * // }]
 */
export function mergeWatchlistsByName(
  mioWatchlists: Watchlist[],
  tvWatchlists: TradingViewWatchlist[]
): UnifiedWatchlist[] {
  // Create a map keyed by lowercase name for case-insensitive matching
  const watchlistMap = new Map<string, UnifiedWatchlist>();

  // Process MIO watchlists
  for (const mioList of mioWatchlists) {
    const key = mioList.name.toLowerCase();
    const existing = watchlistMap.get(key);

    if (existing) {
      // Already exists (shouldn't happen in MIO, but handle it)
      existing.platforms.push('mio');
      existing.mioId = mioList.id;
    } else {
      watchlistMap.set(key, {
        id: crypto.randomUUID(),
        name: mioList.name,
        platforms: ['mio'],
        mioId: mioList.id,
      });
    }
  }

  // Process TradingView watchlists
  for (const tvList of tvWatchlists) {
    const key = tvList.name.toLowerCase();
    const existing = watchlistMap.get(key);

    if (existing) {
      // Merge with existing MIO watchlist
      existing.platforms.push('tv');
      existing.tvId = tvList.id;
    } else {
      // New TV-only watchlist
      watchlistMap.set(key, {
        id: crypto.randomUUID(),
        name: tvList.name,
        platforms: ['tv'],
        tvId: tvList.id,
      });
    }
  }

  // Convert map to array and sort alphabetically
  return Array.from(watchlistMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * Fetch and merge watchlists from both MIO and TradingView platforms.
 * Handles partial failures gracefully - if one platform fails, continues with the other.
 * 
 * @param sessions - Session information for both platforms
 * @returns Promise that resolves to array of unified watchlists
 * 
 * @example
 * const sessions = {
 *   mio: { internalSessionId: 'session123' },
 *   tv: { sessionId: 'sessionid=abc...' }
 * };
 * const watchlists = await fetchUnifiedWatchlists(sessions);
 */
export async function fetchUnifiedWatchlists(
  sessions: WatchlistSessions
): Promise<UnifiedWatchlist[]> {
  try {
    console.log('[fetchUnifiedWatchlists] Called with sessions:', {
      hasMio: !!sessions.mio?.internalSessionId,
      hasTv: !!sessions.tv?.sessionId,
    });

    // Prepare fetch promises for both platforms
    const promises: Promise<Watchlist[] | TradingViewWatchlist[]>[] = [];
    const platformOrder: ('mio' | 'tv')[] = [];

    // Fetch from MIO if session exists
    if (sessions.mio?.internalSessionId) {
      console.log('[fetchUnifiedWatchlists] Fetching MIO watchlists with internalSessionId:', sessions.mio.internalSessionId);
      // Use API route instead of direct service call to avoid session lookup issues
      promises.push(
        (async () => {
          const credentials = getStoredCredentials();
          
          if (!credentials) {
            throw new Error('Authentication required. Please log in first.');
          }
          
          const res = await fetch('/api/mio-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: credentials.userEmail,
              userPassword: credentials.userPassword,
            }),
          });
          
          // Parse response body
          const data = await res.json();
          
          // Check HTTP status
          if (!res.ok) {
            throw new Error(data.error || `Failed to fetch MIO watchlists: ${res.status}`);
          }
          
          // Check MIOResponse structure (defensive - backend should handle this)
          if (data.result && !data.result.success) {
            const errorMsg = data.result.error?.message || 'Operation failed';
            throw new Error(`MIO operation failed: ${errorMsg}`);
          }
          
          return Array.isArray(data.watchlists) ? data.watchlists : [];
        })()
      );
      platformOrder.push('mio');
    }

    // Fetch from TradingView if session exists
    if (sessions.tv?.sessionId) {
      console.log('[fetchUnifiedWatchlists] Fetching TV watchlists...');
      const tvSessionId = sessions.tv.sessionId;
      // Use proxy to avoid CORS issues (same pattern as useTvSync)
      promises.push(
        (async () => {
          const res = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: 'https://www.tradingview.com/api/v1/symbols_list/all/',
              method: 'GET',
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
                Cookie: `sessionid=${tvSessionId}`,
                Accept: 'application/json',
              },
            }),
          });

          if (!res.ok) {
            throw new Error(`Failed to fetch TV watchlists: ${res.status}`);
          }

          const { data } = await res.json();
          return Array.isArray(data) ? data : [];
        })()
      );
      platformOrder.push('tv');
    }

    // If no sessions provided, return empty array
    if (promises.length === 0) {
      console.log('[fetchUnifiedWatchlists] No sessions available, returning empty array');
      return [];
    }

    // Execute all fetches in parallel with Promise.allSettled
    const results = await Promise.allSettled(promises);

    // Extract successful results
    let mioWatchlists: Watchlist[] = [];
    let tvWatchlists: TradingViewWatchlist[] = [];

    results.forEach((result, index) => {
      const platform = platformOrder[index];

      if (result.status === 'fulfilled') {
        if (platform === 'mio') {
          mioWatchlists = result.value as Watchlist[];
          console.log(`[fetchUnifiedWatchlists] MIO returned ${mioWatchlists.length} watchlists`);
        } else {
          tvWatchlists = result.value as TradingViewWatchlist[];
          console.log(`[fetchUnifiedWatchlists] TV returned ${tvWatchlists.length} watchlists`);
        }
      } else {
        // Log error but continue with other platform
        console.error(`[fetchUnifiedWatchlists] Failed to fetch ${platform} watchlists:`, result.reason);
      }
    });

    // Return empty array if both failed
    if (mioWatchlists.length === 0 && tvWatchlists.length === 0) {
      console.log('[fetchUnifiedWatchlists] Both platforms returned 0 watchlists');
      return [];
    }

    // Merge and return watchlists
    const merged = mergeWatchlistsByName(mioWatchlists, tvWatchlists);
    console.log(`[fetchUnifiedWatchlists] Merged into ${merged.length} unified watchlists`);
    return merged;
  } catch (error) {
    console.error('Error in fetchUnifiedWatchlists:', error);
    return [];
  }
}

/**
 * Add a stock symbol to a unified watchlist on applicable platforms.
 * Automatically normalizes the symbol for each platform and handles parallel execution.
 * 
 * @param symbol - The stock symbol to add (can be in any format)
 * @param watchlist - The unified watchlist to add the stock to
 * @param sessions - Session information for both platforms
 * @returns Promise that resolves to AddStockResult with per-platform status
 * 
 * @example
 * const result = await addStockToWatchlist(
 *   'RELIANCE',
 *   { id: '1', name: 'My List', platforms: ['mio', 'tv'], mioId: '123', tvId: 'abc' },
 *   { mio: { internalSessionId: 'session123' }, tv: { sessionId: 'sessionid=...' } }
 * );
 * // Returns: { success: true, platforms: { mio: { success: true }, tv: { success: true } } }
 */
export async function addStockToWatchlist(
  symbol: string,
  watchlist: UnifiedWatchlist,
  sessions: WatchlistSessions
): Promise<AddStockResult> {
  const result: AddStockResult = {
    success: false,
    platforms: {},
  };

  try {
    // Prepare promises for each platform
    const promises: Promise<{ platform: Platform; success: boolean; error?: string }>[] = [];

    // Add to MIO if watchlist exists on MIO
    if (watchlist.platforms.includes('mio') && watchlist.mioId && sessions.mio?.internalSessionId) {
      promises.push(
        (async () => {
          try {
            const credentials = getStoredCredentials();
            
            if (!credentials) {
              throw new Error('Authentication required. Please log in first.');
            }

            const normalizedSymbol = normalizeSymbol(symbol, 'mio');
            
            // Use optimized single-stock endpoint (67% faster than bulk)
            const res = await fetch('/api/mio-action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'addSingle',
                mioWlid: watchlist.mioId!,
                symbol: normalizedSymbol,
                userEmail: credentials.userEmail,
                userPassword: credentials.userPassword,
              }),
            });
            
            // Parse response body
            const data = await res.json();
            
            // Check HTTP status
            if (!res.ok) {
              throw new Error(data.error || `Failed to add to MIO watchlist: ${res.status}`);
            }
            
            // Check MIOResponse structure (defensive - backend should handle this)
            if (data.result && !data.result.success) {
              const errorMsg = data.result.error?.message || 'Operation failed';
              throw new Error(`MIO operation failed: ${errorMsg}`);
            }
            
            return { platform: 'mio' as Platform, success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to add ${symbol} to MIO watchlist:`, error);
            return { platform: 'mio' as Platform, success: false, error: errorMessage };
          }
        })()
      );
    }

    // Add to TradingView if watchlist exists on TV
    if (watchlist.platforms.includes('tv') && watchlist.tvId && sessions.tv?.sessionId) {
      promises.push(
        (async () => {
          try {
            const normalizedSymbol = normalizeSymbol(symbol, 'tv');
            
            // Use proxy API to avoid CORS issues
            const res = await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: `https://www.tradingview.com/api/v1/symbols_list/custom/${watchlist.tvId}/append/`,
                method: 'POST',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
                  Cookie: `sessionid=${sessions.tv!.sessionId}`,
                  'Content-Type': 'application/json',
                  'Origin': 'https://www.tradingview.com',
                },
                body: [normalizedSymbol], // Don't stringify - proxy will do it
              }),
            });
            
            if (!res.ok) {
              throw new Error(`Failed to add to TV watchlist: ${res.status}`);
            }
            
            return { platform: 'tv' as Platform, success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to add ${symbol} to TV watchlist:`, error);
            return { platform: 'tv' as Platform, success: false, error: errorMessage };
          }
        })()
      );
    }

    // If no platforms to add to, return early
    if (promises.length === 0) {
      return result;
    }

    // Execute all additions in parallel with Promise.allSettled
    const results = await Promise.allSettled(promises);

    // Process results
    let anySuccess = false;

    results.forEach((promiseResult) => {
      if (promiseResult.status === 'fulfilled') {
        const { platform, success, error } = promiseResult.value;
        
        if (platform === 'mio') {
          result.platforms.mio = { success, error };
        } else {
          result.platforms.tv = { success, error };
        }

        if (success) {
          anySuccess = true;
        }
      } else {
        // Promise rejected unexpectedly
        console.error('Unexpected promise rejection:', promiseResult.reason);
      }
    });

    result.success = anySuccess;
    return result;
  } catch (error) {
    console.error('Error in addStockToWatchlist:', error);
    return result;
  }
}
