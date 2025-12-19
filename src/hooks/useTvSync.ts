import { useState, useEffect, useRef, useMemo } from 'react';
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

interface Watchlist {
    id: string;
    name: string;
}

interface UseTvSyncProps {
    selectedFormulaUrls: string[];
    customUrls: string[];
    grouping: 'Sector' | 'Industry' | 'None';
}

export function useTvSync({ selectedFormulaUrls, customUrls, grouping }: UseTvSyncProps) {
    const [sessionid, sessionLoading, sessionError] = useSessionBridge('tradingview');
    const { tvSessionAvailable } = useSessionAvailability();
    const [watchlistId, setWatchlistId] = useState('');
    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [operationError, setOperationError] = useState<SessionError | null>(null);
    const [error, setError] = useState<SessionError | Error | string | null>(null);
    const [output, setOutput] = useState('');
    const toast = useToast();

    const fetchedRef = useRef<string | null>(null);
    const fetchingRef = useRef(false);

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

    // Fetch watchlists from TradingView
    useEffect(() => {
        if (!sessionid) return;
        if (!tvSessionAvailable) {
            return;
        }
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        async function fetchWatchlists() {
            try {
                setError(null);
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
                    setError(createFetchWatchlistsError(res.status, res.statusText, sessionid || ''));
                    return;
                }

                const { data } = await res.json();
                setWatchlists(Array.isArray(data) ? data.map((w: Watchlist) => ({ id: w.id, name: w.name })) : []);

                if (fetchedRef.current !== sessionid) {
                    toast('Fetched watchlists.', 'success');
                    fetchedRef.current = sessionid;
                }
            } catch (err) {
                setError(
                    createNetworkError(
                        'fetch_tv_watchlists',
                        err instanceof Error ? err.message : 'Unable to connect to TradingView API',
                        { hasSessionId: !!sessionid, sessionIdLength: sessionid?.length || 0 }
                    )
                );
            }
        }

        fetchWatchlists();
    }, [sessionid, tvSessionAvailable, toast]);

    // Fetch MIO symbols from URL
    async function fetchMioSymbols(url: string, signal?: AbortSignal): Promise<string[]> {
        try {
            const res = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal,
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
                return [];
            }

            const { data } = await res.json();
            return parseMioSymbols(data);
        } catch (error) {
            return [];
        }
    }

    // Clean up watchlist
    async function cleanUpWatchlist() {
        try {
            setError(null);
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
                setError(createCleanupError(cleanupRes.status, cleanupRes.statusText, watchlistId));
                return;
            }
            toast('Watchlist cleaned up.', 'success');
        } catch (err) {
            setError(
                createNetworkError(
                    'cleanup_tv_watchlist',
                    err instanceof Error ? err.message : 'Unable to connect to TradingView API',
                    { watchlistId }
                )
            );
        }
    }

    // Append symbols to watchlist
    async function appendToWatchlist(symbols: string[]) {
        try {
            setError(null);
            setOperationError(null);

            // Remove duplicate symbols before sending to TradingView API
            const { unique: uniqueSymbols, duplicateCount } = removeDuplicateSymbols(symbols);

            const payload = uniqueSymbols;

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
                    body: JSON.stringify(payload),
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
                    setError(error);
                } else {
                    setOperationError(error);
                }
                return;
            }
            toast('Symbols appended successfully.', 'success');
        } catch (err) {
            setError(
                createNetworkError(
                    'append_to_tv_watchlist',
                    err instanceof Error ? err.message : 'Unable to connect to TradingView API',
                    { watchlistId, symbolCount: symbols.length }
                )
            );
        }
    }

    // Fetch and group symbols when URLs or grouping changes
    useEffect(() => {
        const abortController = new AbortController();
        let isMounted = true;

        async function updateSymbolsAndOutput() {
            try {
                let allSymbols: string[] = [];
                const validUrls = effectiveUrls;

                if (validUrls.length === 0) {
                    if (isMounted) {
                        setOutput('');
                    }
                    return;
                }

                for (const url of validUrls) {
                    if (!isMounted || abortController.signal.aborted) {
                        return;
                    }

                    try {
                        const mioSymbols = await fetchMioSymbols(url, abortController.signal);
                        allSymbols = allSymbols.concat(mioSymbols);
                    } catch (error) {
                        continue;
                    }
                }

                if (isMounted && !abortController.signal.aborted) {
                    const tvSymbols = allSymbols.map(toTV).filter(Boolean) as string[];
                    setOutput(groupSymbols(tvSymbols, grouping));
                }
            } catch (error) {
                // Error in updateSymbolsAndOutput
            }
        }

        updateSymbolsAndOutput();

        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, [effectiveUrls, grouping]);

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
