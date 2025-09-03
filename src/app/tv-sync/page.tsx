'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Input } from '../../components/ui/input';
import { EditorWithClipboard } from '../../components/EditorWithClipboard';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { useToast } from '../../components/ui/toast';
import allNseStocks from '../../all_nse.json';
import { useSessionBridge } from '../../lib/useSessionBridge';
import { useSessionAvailability } from '../../hooks/useSessionAvailability';
import { UsageGuide } from '../../components/UsageGuide';
import { SessionStatus } from '../../components/SessionStatus';
import { SessionError, SessionErrorType, Platform, ErrorSeverity, RecoveryAction } from '../../lib/sessionErrors';

function parseMioSymbols(raw: string): string[] {
    return raw
        .trim()
        .split(/\s+/)
        .map((item) => item.split('|')[0])
        .filter(Boolean);
}

function toTV(symbol: string): string | null {
    if (symbol.endsWith('.NS')) return `NSE:${symbol.replace('.NS', '')}`;
    return null;
}

// Build a symbol map for fast lookup
const symbolInfoMap: Record<string, { Industry?: string; Sector?: string }> = (() => {
    const map: Record<string, { Industry?: string; Sector?: string }> = {};
    (allNseStocks as Array<{ Symbol: string; Industry?: string; Sector?: string }>).forEach((entry) => {
        if (entry.Symbol) {
            map[entry.Symbol] = {
                Industry: entry.Industry,
                Sector: entry.Sector,
            };
        }
    });
    return map;
})();

function groupSymbols(symbols: string[], groupBy: 'Sector' | 'Industry' | 'None'): string {
    if (groupBy === 'None') {
        return symbols.join(',');
    }
    const grouped: Record<string, string[]> = {};
    for (const symbol of symbols) {
        let lookup = symbol.replace(/^NSE:|^BSE:/, '');
        if (!lookup.endsWith('.NS')) lookup += '.NS';
        const info = symbolInfoMap[lookup] || symbolInfoMap[lookup.replace('.NS', '.BO')];
        const group = info?.[groupBy] || 'Other';
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(symbol);
    }
    return Object.entries(grouped)
        .map(([group, syms]) => `###${group},${syms.join(',')}`)
        .join(',');
}

const DEFAULT_URLS = [
    { label: 'PPC_no_sma', value: 'https://api.marketinout.com/run/screen?key=eed4a72303564710' },
    { label: 'Second Screener', value: 'https://api.marketinout.com/run/screen?key=79505328ba974866' },
];

function TvSyncPageContent() {
    const [grouping, setGrouping] = useState<'Sector' | 'Industry' | 'None'>('None');
    const [output, setOutput] = useState('');
    const [sessionid, sessionLoading, sessionError] = useSessionBridge('tradingview');
    const { tvSessionAvailable } = useSessionAvailability();
    const [watchlistId, setWatchlistId] = useState('');
    const [watchlists, setWatchlists] = useState<{ id: string; name: string }[]>([]);
    const [urls, setUrls] = useState([DEFAULT_URLS[0].value]);
    const [error, setError] = useState<SessionError | Error | string | null>(null);
    const toast = useToast();

    const fetchedRef = React.useRef<string | null>(null);
    const fetchingRef = React.useRef(false);

    useEffect(() => {
        if (!sessionid) return;
        if (!tvSessionAvailable) {
            console.log('[TV-SYNC] Skipping TradingView watchlists fetch - no session available');
            return;
        }
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        async function fetchWatchlists() {
            try {
                setError(null);
                /* Removed toast: Fetching TradingView watchlists... */
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
                    const sessionError = new SessionError(
                        SessionErrorType.SESSION_EXPIRED,
                        'Failed to fetch TradingView watchlists',
                        `HTTP ${res.status}: ${res.statusText}`,
                        {
                            operation: 'fetch_tv_watchlists',
                            platform: Platform.TRADINGVIEW,
                            timestamp: new Date(),
                            additionalData: {
                                status: res.status,
                                statusText: res.statusText,
                                hasSessionId: !!sessionid,
                                sessionIdLength: sessionid?.length || 0,
                            },
                        },
                        ErrorSeverity.ERROR,
                        [
                            {
                                action: RecoveryAction.UPDATE_CREDENTIALS,
                                description: 'Verify your TradingView session cookie is correct and not expired',
                                priority: 1,
                                automated: false,
                                estimatedTime: '3 minutes',
                            },
                            {
                                action: RecoveryAction.REFRESH_SESSION,
                                description: 'Log out and log back into TradingView to get a fresh session',
                                priority: 2,
                                automated: false,
                                estimatedTime: '5 minutes',
                            },
                        ]
                    );
                    setError(sessionError);
                    return;
                }
                type Watchlist = { id: string; name: string };
                const { data } = await res.json();
                setWatchlists(Array.isArray(data) ? data.map((w: Watchlist) => ({ id: w.id, name: w.name })) : []);
                if (fetchedRef.current !== sessionid) {
                    toast('Fetched watchlists.', 'success');
                    fetchedRef.current = sessionid;
                }
            } catch (err) {
                const sessionError = new SessionError(
                    SessionErrorType.NETWORK_ERROR,
                    'Network error fetching TradingView watchlists',
                    err instanceof Error ? err.message : 'Unable to connect to TradingView API',
                    {
                        operation: 'fetch_tv_watchlists',
                        platform: Platform.TRADINGVIEW,
                        timestamp: new Date(),
                        additionalData: {
                            hasSessionId: !!sessionid,
                            sessionIdLength: sessionid?.length || 0,
                        },
                    },
                    ErrorSeverity.ERROR,
                    [
                        {
                            action: RecoveryAction.CHECK_NETWORK,
                            description: 'Check your internet connection and try again',
                            priority: 1,
                            automated: false,
                            estimatedTime: '1 minute',
                        },
                        {
                            action: RecoveryAction.RETRY,
                            description: 'Wait a moment and try fetching watchlists again',
                            priority: 2,
                            automated: false,
                            estimatedTime: '30 seconds',
                        },
                    ]
                );
                setError(sessionError);
            }
        }
        fetchWatchlists();
    }, [sessionid, tvSessionAvailable, toast]);

    const handleUrlChange = (i: number, value: string) => {
        const next = [...urls];
        next[i] = value;
        setUrls(next);
    };

    const addUrl = () => setUrls([...urls, '']);
    const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i));

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
                console.log(`Failed to fetch symbols from ${url}: ${res.status} ${res.statusText}`);
                return [];
            }

            const { data } = await res.json();
            return parseMioSymbols(data);
        } catch (error) {
            // Handle network errors, abort errors, etc.
            if (error instanceof Error && error.name === 'AbortError') {
                console.log(`Request aborted for ${url}`);
            } else {
                console.log(`Network error fetching symbols from ${url}:`, error);
            }
            return [];
        }
    }

    async function cleanUpWatchlist() {
        try {
            setError(null);
            /* Removed toast: Cleaning up watchlist... */
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
                const sessionError = new SessionError(
                    SessionErrorType.OPERATION_FAILED,
                    'Failed to clean up TradingView watchlist',
                    `HTTP ${cleanupRes.status}: ${cleanupRes.statusText}`,
                    {
                        operation: 'cleanup_tv_watchlist',
                        platform: Platform.TRADINGVIEW,
                        timestamp: new Date(),
                        additionalData: {
                            watchlistId,
                            status: cleanupRes.status,
                            statusText: cleanupRes.statusText,
                        },
                    },
                    ErrorSeverity.ERROR,
                    [
                        {
                            action: RecoveryAction.RE_AUTHENTICATE,
                            description: 'Verify you have permission to modify this watchlist',
                            priority: 1,
                            automated: false,
                            estimatedTime: '1 minute',
                        },
                        {
                            action: RecoveryAction.REFRESH_SESSION,
                            description: 'Your session may have expired - refresh and try again',
                            priority: 2,
                            automated: false,
                            estimatedTime: '3 minutes',
                        },
                    ]
                );
                setError(sessionError);
                return;
            }
            toast('Watchlist cleaned up.', 'success');
        } catch (err) {
            const sessionError = new SessionError(
                SessionErrorType.NETWORK_ERROR,
                'Network error cleaning up watchlist',
                err instanceof Error ? err.message : 'Unable to connect to TradingView API',
                {
                    operation: 'cleanup_tv_watchlist',
                    platform: Platform.TRADINGVIEW,
                    timestamp: new Date(),
                    additionalData: { watchlistId },
                },
                ErrorSeverity.ERROR,
                [
                    {
                        action: RecoveryAction.CHECK_NETWORK,
                        description: 'Check your internet connection and try again',
                        priority: 1,
                        automated: false,
                        estimatedTime: '1 minute',
                    },
                ]
            );
            setError(sessionError);
        }
    }

    async function appendToWatchlist(symbols: string[]) {
        try {
            setError(null);
            // Always send a flat array of symbols to TradingView append API
            console.log({ symbols });
            const payload = output;
            /* Removed toast: Appending symbols to TradingView */
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
            /* Removed toast: TradingView response */
            if (!res.ok) {
                const sessionError = new SessionError(
                    SessionErrorType.OPERATION_FAILED,
                    'Failed to append symbols to TradingView watchlist',
                    `HTTP ${res.status}: ${res.statusText}`,
                    {
                        operation: 'append_to_tv_watchlist',
                        platform: Platform.TRADINGVIEW,
                        timestamp: new Date(),
                        additionalData: {
                            watchlistId,
                            symbolCount: symbols.length,
                            status: res.status,
                            statusText: res.statusText,
                        },
                    },
                    ErrorSeverity.ERROR,
                    [
                        {
                            action: RecoveryAction.RE_AUTHENTICATE,
                            description: 'Verify you have permission to modify this watchlist',
                            priority: 1,
                            automated: false,
                            estimatedTime: '1 minute',
                        },
                        {
                            action: RecoveryAction.RETRY,
                            description: 'Ensure symbols are in correct TradingView format (e.g., NSE:RELIANCE)',
                            priority: 2,
                            automated: false,
                            estimatedTime: '2 minutes',
                        },
                        {
                            action: RecoveryAction.REFRESH_SESSION,
                            description: 'Your session may have expired - refresh and try again',
                            priority: 3,
                            automated: false,
                            estimatedTime: '3 minutes',
                        },
                    ]
                );
                setError(sessionError);
                return;
            }
            toast('Symbols appended successfully.', 'success');
        } catch (err) {
            const sessionError = new SessionError(
                SessionErrorType.NETWORK_ERROR,
                'Network error appending symbols to watchlist',
                err instanceof Error ? err.message : 'Unable to connect to TradingView API',
                {
                    operation: 'append_to_tv_watchlist',
                    platform: Platform.TRADINGVIEW,
                    timestamp: new Date(),
                    additionalData: {
                        watchlistId,
                        symbolCount: symbols.length,
                    },
                },
                ErrorSeverity.ERROR,
                [
                    {
                        action: RecoveryAction.CHECK_NETWORK,
                        description: 'Check your internet connection and try again',
                        priority: 1,
                        automated: false,
                        estimatedTime: '1 minute',
                    },
                ]
            );
            setError(sessionError);
        }
    }

    // Fetch and group symbols when URLs or grouping changes
    useEffect(() => {
        const abortController = new AbortController();
        let isMounted = true;

        async function updateSymbolsAndOutput() {
            try {
                let allSymbols: string[] = [];
                const validUrls = urls.filter((u) => u.trim());

                // Don't make API calls if no valid URLs
                if (validUrls.length === 0) {
                    if (isMounted) {
                        setOutput('');
                    }
                    return;
                }

                for (const url of validUrls) {
                    // Check if component is still mounted and request not aborted
                    if (!isMounted || abortController.signal.aborted) {
                        return;
                    }

                    try {
                        const mioSymbols = await fetchMioSymbols(url, abortController.signal);
                        allSymbols = allSymbols.concat(mioSymbols);
                    } catch (error) {
                        console.log(`Failed to fetch symbols from ${url}:`, error);
                        // Continue with other URLs instead of failing completely
                        continue;
                    }
                }

                if (isMounted && !abortController.signal.aborted) {
                    const tvSymbols = allSymbols.map(toTV).filter(Boolean) as string[];
                    setOutput(groupSymbols(tvSymbols, grouping));
                }
            } catch (error) {
                console.log('Error in updateSymbolsAndOutput:', error);
                // Don't update state on error to prevent infinite loops
            }
        }

        updateSymbolsAndOutput();

        // Cleanup function
        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, [urls, grouping]);

    return (
        <div className='font-sans max-w-xl mx-auto py-8'>
            <h1 className='text-2xl font-bold mb-4'>TradingView Screener Sync</h1>

            <UsageGuide
                title='How to sync MIO screeners to TradingView'
                steps={[
                    'Install the browser extension from the extension folder',
                    'Visit TradingView and log in to your account',
                    'The extension will automatically capture your session',
                    'Return to this page and select a TradingView watchlist to sync to',
                    'Choose screener URLs (or use the default ones provided)',
                    'Select grouping option (Sector, Industry, or None)',
                    "Click 'Sync' to add symbols to your TradingView watchlist",
                ]}
                tips={[
                    'Screener URLs should be MIO API endpoints that return symbol lists',
                    "Use 'Clean Up Watchlist' to clear existing symbols before syncing",
                    'Grouping creates organized sections in your watchlist',
                    'Multiple screener URLs will be combined into one sync',
                    'If you get session errors, just visit TradingView website again',
                ]}
                className='mb-6'
            />

            <SessionStatus
                platform='TradingView'
                sessionId={sessionid}
                loading={sessionLoading}
                error={
                    error
                        ? error instanceof Error
                            ? error.message
                            : typeof error === 'string'
                            ? error
                            : 'Unknown error'
                        : sessionError
                }
                className='mb-6'
            />
            <div className='space-y-6'>
                <div>
                    <Label htmlFor='watchlist' className='text-sm font-medium'>
                        TradingView Watchlist
                    </Label>
                    <Select value={watchlistId} onValueChange={setWatchlistId}>
                        <SelectTrigger className='w-full mt-2' id='watchlist'>
                            <SelectValue placeholder='Select a watchlist' />
                        </SelectTrigger>
                        <SelectContent>
                            {watchlists.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                    {w.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor='grouping' className='text-sm font-medium'>
                        Group by
                    </Label>
                    <Select value={grouping} onValueChange={(v) => setGrouping(v as 'Sector' | 'Industry' | 'None')}>
                        <SelectTrigger id='grouping' className='w-full mt-2'>
                            <SelectValue placeholder='Select grouping option' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='Sector'>Sector</SelectItem>
                            <SelectItem value='Industry'>Industry</SelectItem>
                            <SelectItem value='None'>None</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className='text-sm font-medium'>Screener URLs</Label>
                    <div className='mt-2 space-y-3'>
                        {urls.map((url, i) => (
                            <div key={i} className='flex items-center gap-2'>
                                <Select value={url} onValueChange={(val) => handleUrlChange(i, val)}>
                                    <SelectTrigger className='w-48'>
                                        <SelectValue placeholder='Select preset' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DEFAULT_URLS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    value={url}
                                    onChange={(e) => handleUrlChange(i, e.target.value)}
                                    className='flex-1'
                                    placeholder='Paste or edit API URL'
                                />
                                <Button
                                    type='button'
                                    variant='destructive'
                                    size='sm'
                                    onClick={() => removeUrl(i)}
                                    disabled={urls.length === 1}
                                >
                                    Remove
                                </Button>
                            </div>
                        ))}
                        <Button type='button' variant='outline' onClick={addUrl} className='w-full'>
                            Add Another URL
                        </Button>
                    </div>
                </div>

                <div>
                    <Label className='text-sm font-medium'>Symbols to Add</Label>
                    <EditorWithClipboard
                        id='output-editor'
                        label=''
                        value={output}
                        readOnly
                        showCopy
                        className='min-h-[120px] font-mono text-sm mt-2'
                    />
                </div>

                <div className='flex gap-3'>
                    <Button
                        onClick={() => appendToWatchlist(output.split(',').filter(Boolean))}
                        disabled={!watchlistId || !sessionid}
                        className='flex-1'
                    >
                        Sync to Watchlist
                    </Button>
                    <Button
                        variant='outline'
                        onClick={cleanUpWatchlist}
                        disabled={!watchlistId || !sessionid}
                        className='flex-1'
                    >
                        Clean Up First
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function TvSyncPage() {
    return (
        <DashboardLayout showHero={false} showSidebar={true}>
            <AuthGuard>
                <TvSyncPageContent />
            </AuthGuard>
        </DashboardLayout>
    );
}
