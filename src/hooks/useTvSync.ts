import { useState, useMemo } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSessionBridge } from '@/lib/useSessionBridge';
import { useSessionAvailability } from '@/hooks/useSessionAvailability';
import { useToast } from '@/components/ui/toast';
import { SessionError } from '@/lib/sessionErrors';
import { categorizeHttpError, extractTradingViewError } from '@/lib/errorCategorization';
import { parseMioSymbols, toTV, groupSymbols, removeDuplicateSymbols } from '@/lib/tv-sync/symbolUtils';
import {
    createFetchWatchlistsError,
    createNetworkError,
    createCleanupError,
    createAppendError
} from '@/lib/tv-sync/errorHelpers';
import { getSwrDedupingInterval } from '@/lib/cache/cacheConfig';
interface Watchlist {
    id: string;
    name: string;
}

interface UseTvSyncProps {
    selectedFormulaUrls: string[];
    customUrls: string[];
    grouping: 'Sector' | 'Industry' | 'None';
}

/**
 * SWR-based hook for TradingView watchlist synchronization
 * Migrated from manual state management to leverage SWR's automatic caching,
 * deduplication, and request management.
 */
export function useTvSync({ selectedFormulaUrls, customUrls, grouping }: UseTvSyncProps) {
    const [sessionid, sessionLoading, sessionError] = useSessionBridge('tradingview');
    const { tvSessionAvailable } = useSessionAvailability();
    const [watchlistId, setWatchlistId] = useState('');
    const [operationError, setOperationError] = useState<SessionError | null>(null);
    const [output, setOutput] = useState('');
    const toast = useToast();

    // Compute effective URLs from selected formulas + custom URLs
    const effectiveUrls = useMemo(() => {
        const urlsToFetch: string[] = [];

        // Add formula URLs
        selectedFormulaUrls.forEach(url => {
            if (url) urlsToFetch.push(url);
        });

        // Add valid custom URLs
        customUrls.forEach(url => {
            if (url.trim()) {
                urlsToFetch.push(url);
            }
        });

        return urlsToFetch;
    }, [selectedFormulaUrls, customUrls]);

    // ============================================================================
    // SWR: Fetch TradingView watchlists
    // ============================================================================
    
    const shouldFetchWatchlists = Boolean(sessionid && tvSessionAvailable);

    const {
        data: watchlistsData,
        error: watchlistsError,
    } = useSWR(
        shouldFetchWatchlists ? ['tv-watchlists', sessionid] : null,
        async () => {
            const res = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://www.tradingview.com/api/v1/symbols_list/all/',
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
                        Cookie: `sessionid=${sessionid}`,
                        Accept: 'application/json',
                    },
                }),
            });

            if (!res.ok) {
                throw createFetchWatchlistsError(res.status, res.statusText, sessionid || '');
            }

            const { data } = await res.json();
            return Array.isArray(data) ? data.map((w: Watchlist) => ({ id: w.id, name: w.name })) : [];
        },
        {
            onSuccess: () => {
                toast('Fetched watchlists.', 'success');
            },
            onError: (err) => {
                console.error('Failed to fetch watchlists:', err);
            },
            // Don't refetch on window focus for watchlists
            revalidateOnFocus: false,
        }
    );

    const watchlists = watchlistsData || [];
    const error = watchlistsError || sessionError;

    // ============================================================================
    // SWR: Fetch MIO symbols from URLs
    // ============================================================================

    const shouldFetchSymbols = effectiveUrls.length > 0;

    const {
        data: symbolsData,
    } = useSWR(
        shouldFetchSymbols ? ['mio-symbols', effectiveUrls] : null,
        async () => {
            let allSymbols: string[] = [];

            for (const url of effectiveUrls) {
                try {
                    const res = await fetch('/api/proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url,
                            method: 'GET',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
                                Accept: 'text/plain',
                            },
                        }),
                    });

                    if (!res.ok) {
                        continue; // Skip failed URLs
                    }

                    const { data } = await res.json();
                    const symbols = parseMioSymbols(data);
                    allSymbols = allSymbols.concat(symbols);
                } catch (error) {
                    // Skip failed URLs silently
                    continue;
                }
            }

            const tvSymbols = allSymbols.map(toTV).filter(Boolean) as string[];
            return groupSymbols(tvSymbols, grouping);
        },
        {
            // Revalidate when URLs or grouping changes
            revalidateOnFocus: false,
            dedupingInterval: getSwrDedupingInterval(2000), // Prevent duplicate requests within 2s (when caching enabled)
        }
    );

    // Update output when symbols data changes
    useMemo(() => {
        if (symbolsData !== undefined) {
            setOutput(symbolsData);
        } else if (!shouldFetchSymbols) {
            setOutput('');
        }
    }, [symbolsData, shouldFetchSymbols]);

    // ============================================================================
    // SWR Mutation: Append symbols to watchlist
    // ============================================================================

    const { trigger: triggerAppend } = useSWRMutation(
        ['tv-append', watchlistId],
        async (_key, { arg }: { arg: string[] }) => {
            const symbols = arg;
            const { unique: uniqueSymbols } = removeDuplicateSymbols(symbols);

            const res = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: `https://www.tradingview.com/api/v1/symbols_list/custom/${watchlistId}/append/`,
                    method: 'POST',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
                        'Content-Type': 'application/json',
                        Cookie: `sessionid=${sessionid}`,
                        Origin: 'https://www.tradingview.com',
                    },
                    body: JSON.stringify(uniqueSymbols),
                }),
            });

            if (!res.ok) {
                let detailedError = res.statusText;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let errorData: any = null;

                try {
                    const responseData = await res.json();
                    errorData = responseData.data || responseData;
                    detailedError = extractTradingViewError(errorData);
                } catch (parseError) {
                    // Failed to parse error response
                }

                const category = categorizeHttpError(res.status, detailedError);
                const error = createAppendError(
                    category.isSessionError,
                    category.errorType,
                    res.status,
                    detailedError,
                    watchlistId,
                    symbols.length,
                    errorData
                );

                if (category.isSessionError) {
                    throw error; // Will be caught by SWR's error handling
                } else {
                    setOperationError(error);
                    throw error;
                }
            }

            return { success: true };
        },
        {
            onSuccess: () => {
                toast('Symbols appended successfully.', 'success');
            },
            onError: (err) => {
                if (err instanceof Error && !(err instanceof SessionError)) {
                    // Network error
                    console.error('Failed to append symbols:', err);
                }
            },
        }
    );

    // ============================================================================
    // SWR Mutation: Clean up watchlist
    // ============================================================================

    const { trigger: triggerCleanup } = useSWRMutation(
        ['tv-cleanup', watchlistId],
        async () => {
            const cleanupRes = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: `https://www.tradingview.com/api/v1/symbols_list/custom/${watchlistId}/replace/?unsafe=true`,
                    method: 'POST',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
                        'Content-Type': 'application/json',
                        Cookie: `sessionid=${sessionid}`,
                        Origin: 'https://www.tradingview.com',
                    },
                    body: JSON.stringify([]),
                }),
            });

            if (!cleanupRes.ok) {
                throw createCleanupError(cleanupRes.status, cleanupRes.statusText, watchlistId);
            }

            return { success: true };
        },
        {
            onSuccess: () => {
                toast('Watchlist cleaned up.', 'success');
            },
            onError: (err) => {
                console.error('Failed to cleanup watchlist:', err);
            },
        }
    );

    // ============================================================================
    // Public API - matches original interface
    // ============================================================================

    async function appendToWatchlist(symbols: string[]) {
        try {
            setOperationError(null);
            await triggerAppend(symbols);
        } catch (err) {
            // Error already handled by mutation's onError
            if (err instanceof SessionError) {
                throw err; // Re-throw SessionErrors for caller
            } else if (err instanceof Error) {
                throw createNetworkError(
                    'append_to_tv_watchlist',
                    err.message,
                    { watchlistId, symbolCount: symbols.length }
                );
            }
        }
    }

    async function cleanUpWatchlist() {
        try {
            await triggerCleanup();
        } catch (err) {
            if (err instanceof Error) {
                throw createNetworkError(
                    'cleanup_tv_watchlist',
                    err.message,
                    { watchlistId }
                );
            }
        }
    }

    return {
        // State
        sessionid,
        sessionLoading,
        sessionError,
        watchlistId,
        watchlists,
        operationError,
        error,
        output,

        // Actions
        setWatchlistId,
        setOperationError,
        cleanUpWatchlist,
        appendToWatchlist,
    };
}
