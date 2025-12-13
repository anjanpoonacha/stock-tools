'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Input } from '../../components/ui/input';
import { EditorWithClipboard } from '../../components/EditorWithClipboard';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { useToast } from '../../components/ui/toast';
import allNseStocks from '../../all_nse.json';
import { useSessionBridge } from '../../lib/useSessionBridge';
import { useSessionAvailability } from '../../hooks/useSessionAvailability';
import { UsageGuide } from '../../components/UsageGuide';
import { SessionStatus } from '../../components/SessionStatus';
import { SessionError, SessionErrorType, Platform, ErrorSeverity, RecoveryAction } from '../../lib/sessionErrors';
import { categorizeHttpError, extractTradingViewError } from '../../lib/errorCategorization';
import { ErrorDisplay } from '../../components/error/ErrorDisplay';
import { useUserScreenerUrls } from '../../hooks/useUserScreenerUrls';
import { ScreenerUrlDialog } from '../../components/ScreenerUrlDialog';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { UserScreenerUrl } from '../api/screener-urls/route';
import { Plus, Edit, Trash2, X, ChevronRight, ChevronDown, Zap, Loader2 } from 'lucide-react';
import { useFormulas } from '../../hooks/useFormulas';
import { MultiSelect } from '../../components/ui/multi-select';
import { Alert, AlertDescription } from '../../components/ui/alert';
// MIOFormula type removed - not used in this component

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
    // Separate error states: session errors vs operation errors
    const [operationError, setOperationError] = useState<SessionError | null>(null);
    const [error, setError] = useState<SessionError | Error | string | null>(null);
    const toast = useToast();

    // Formula multi-select state
    const { formulas, loading: formulasLoading, error: formulasError } = useFormulas();
    const [selectedFormulaIds, setSelectedFormulaIds] = useState<string[]>([]);

    // Custom URLs state (collapsed by default)
    const [customUrlsExpanded, setCustomUrlsExpanded] = useState(false);
    const [customUrls, setCustomUrls] = useState<string[]>([]);

    // User screener URLs management
    const { urls: userUrls, error: userUrlsError, addUrl: addUserUrl, updateUrl: updateUserUrl, deleteUrl: deleteUserUrl } = useUserScreenerUrls();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingUrl, setEditingUrl] = useState<UserScreenerUrl | null>(null);
    
    // Confirmation dialog state
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [urlToDelete, setUrlToDelete] = useState<UserScreenerUrl | null>(null);

    const fetchedRef = React.useRef<string | null>(null);
    const fetchingRef = React.useRef(false);

    // Compute effective URLs from selected formulas + custom URLs
    const effectiveUrls = useMemo(() => {
        const urlsToFetch: string[] = [];

        // Get URLs from selected formulas
        if (selectedFormulaIds.length > 0) {
            selectedFormulaIds.forEach(id => {
                const formula = formulas.find(f => f.id === id);
                if (formula?.apiUrl) {
                    urlsToFetch.push(formula.apiUrl);
                }
            });
        }

        // Add valid custom URLs
        customUrls.forEach(url => {
            if (url.trim()) {
                urlsToFetch.push(url);
            }
        });

        return urlsToFetch;
    }, [selectedFormulaIds, formulas, customUrls]);

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

    // Custom URL handlers
    const handleCustomUrlChange = (index: number, value: string) => {
        const newUrls = [...customUrls];
        newUrls[index] = value;
        setCustomUrls(newUrls);
    };

    const addCustomUrl = () => {
        setCustomUrls([...customUrls, '']);
    };

    const removeCustomUrl = (index: number) => {
        setCustomUrls(customUrls.filter((_, i) => i !== index));
    };

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
            setOperationError(null);
            
            // Remove duplicate symbols before sending to TradingView API
            const uniqueSymbols = [...new Set(symbols)];
            const duplicateCount = symbols.length - uniqueSymbols.length;
            
            if (duplicateCount > 0) {
                console.log(`Removed ${duplicateCount} duplicate symbol(s) before sending to TradingView`);
            }
            
            // Always send a flat array of symbols to TradingView append API
            console.log({ symbols: uniqueSymbols, originalCount: symbols.length, uniqueCount: uniqueSymbols.length });
            const payload = uniqueSymbols;
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
                // Parse the response body to get detailed error
                let detailedError = res.statusText;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let errorData: any = null;

                try {
                    const responseData = await res.json();
                    errorData = responseData.data || responseData;

                    // Extract TradingView error details using helper
                    detailedError = extractTradingViewError(errorData);
                } catch (parseError) {
                    // If parsing fails, use statusText
                    console.error('Failed to parse error response:', parseError);
                }

                // Categorize error to separate session errors from operation errors
                const category = categorizeHttpError(res.status, detailedError);
                
                const error = new SessionError(
                    category.errorType,
                    category.isSessionError 
                        ? 'Session authentication failed' 
                        : `Failed to append symbols: ${detailedError}`,
                    `HTTP ${res.status}: ${detailedError}`,
                    {
                        operation: 'append_to_tv_watchlist',
                        platform: Platform.TRADINGVIEW,
                        timestamp: new Date(),
                        additionalData: {
                            watchlistId,
                            symbolCount: symbols.length,
                            status: res.status,
                            statusText: res.statusText,
                            apiError: errorData,
                        },
                    },
                    category.isSessionError ? ErrorSeverity.ERROR : ErrorSeverity.WARNING,
                    category.isSessionError ? [
                        {
                            action: RecoveryAction.RE_AUTHENTICATE,
                            description: 'Verify your TradingView session is valid',
                            priority: 1,
                            automated: false,
                            estimatedTime: '1 minute',
                        },
                        {
                            action: RecoveryAction.REFRESH_SESSION,
                            description: 'Refresh your session and try again',
                            priority: 2,
                            automated: false,
                            estimatedTime: '2 minutes',
                        },
                    ] : [
                        {
                            action: RecoveryAction.RETRY,
                            description: 'Check data format and try again',
                            priority: 1,
                            automated: false,
                            estimatedTime: '1 minute',
                        },
                        {
                            action: RecoveryAction.CHECK_NETWORK,
                            description: 'Ensure symbols are in correct TradingView format (e.g., NSE:RELIANCE)',
                            priority: 2,
                            automated: false,
                            estimatedTime: '2 minutes',
                        },
                    ]
                );
                
                // Route to appropriate error state based on categorization
                if (category.isSessionError) {
                    setError(error);
                } else {
                    setOperationError(error);
                }
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

    // Handle adding/editing user URLs
    const handleSaveUrl = async (name: string, url: string): Promise<boolean> => {
        try {
            let success = false;

            if (editingUrl) {
                // Update existing URL
                success = await updateUserUrl(editingUrl.id, name, url);
                if (success) {
                    // Update custom URLs if the edited URL is being used
                    const updatedUrls = customUrls.map(u => u === editingUrl.url ? url : u);
                    setCustomUrls(updatedUrls);
                    toast('Screener URL updated successfully.', 'success');
                }
            } else {
                // Add new URL
                success = await addUserUrl(name, url);
                if (success) {
                    toast('Screener URL added successfully.', 'success');
                }
            }

            return success;
        } catch (error) {
            console.error('Error saving URL:', error);
            toast('Failed to save screener URL.', 'error');
            return false;
        }
    };

    // Fetch and group symbols when URLs or grouping changes
    useEffect(() => {
        const abortController = new AbortController();
        let isMounted = true;

        async function updateSymbolsAndOutput() {
            try {
                let allSymbols: string[] = [];
                const validUrls = effectiveUrls;

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
    }, [effectiveUrls, grouping]);

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

            {/* Session connectivity status - authentication layer */}
            <SessionStatus
                platform='TradingView'
                sessionId={sessionid}
                loading={sessionLoading}
                error={
                    error
                        ? error instanceof SessionError
                            ? error.userMessage
                            : error instanceof Error
                            ? error.message
                            : typeof error === 'string'
                            ? error
                            : 'Unknown error'
                        : sessionError
                }
                className='mb-6'
            />

            {/* Operation errors - application layer */}
            {operationError && (
                <ErrorDisplay
                    error={operationError}
                    onDismiss={() => setOperationError(null)}
                    className='mb-6'
                />
            )}
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
                    <Label className='text-base font-semibold'>Screener Sources</Label>
                    <p className='text-sm text-muted-foreground mt-1 mb-4'>
                        Select formulas from MIO or add custom URLs
                    </p>

                    {/* SECTION 1: Formula Multi-Select */}
                    <div className='mb-6 space-y-2'>
                        <div className='flex items-center gap-2'>
                            <Zap className='h-4 w-4 text-primary' />
                            <Label className='text-sm font-medium'>MIO Formulas</Label>
                            {formulas.length > 0 && (
                                <Badge variant='secondary' className='text-xs'>
                                    {formulas.length} available
                                </Badge>
                            )}
                        </div>

                        {formulasLoading ? (
                            <div className='flex items-center gap-2 p-3 border rounded-lg bg-muted/20'>
                                <Loader2 className='h-4 w-4 animate-spin' />
                                <span className='text-sm text-muted-foreground'>Loading formulas...</span>
                            </div>
                        ) : formulasError ? (
                            <Alert variant='destructive'>
                                <AlertDescription>{formulasError}</AlertDescription>
                            </Alert>
                        ) : formulas.length === 0 ? (
                            <Alert>
                                <AlertDescription>
                                    No formulas found. Visit the{' '}
                                    <a href='/mio-formulas' className='underline font-medium'>
                                        Formula Manager
                                    </a>{' '}
                                    to extract your formulas from MIO.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <MultiSelect
                                options={formulas.map(f => ({
                                    label: f.name,
                                    value: f.id,
                                }))}
                                onValueChange={setSelectedFormulaIds}
                                defaultValue={selectedFormulaIds}
                                placeholder='Select one or more formulas...'
                                className='w-full'
                                maxCount={3}
                            />
                        )}
                    </div>

                    {/* SECTION 2: Custom URLs (Collapsible) */}
                    <div>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => setCustomUrlsExpanded(!customUrlsExpanded)}
                            className='flex items-center gap-2 p-0 h-auto mb-3'
                        >
                            {customUrlsExpanded ? (
                                <ChevronDown className='h-4 w-4' />
                            ) : (
                                <ChevronRight className='h-4 w-4' />
                            )}
                            <span className='text-sm font-medium'>
                                Custom URLs {customUrls.length > 0 && `(${customUrls.length})`}
                            </span>
                        </Button>

                        {customUrlsExpanded && (
                            <div className='space-y-4 pl-6 border-l-2'>
                                <div className='flex items-center justify-between'>
                                    <p className='text-sm text-muted-foreground'>
                                        Add custom screener URLs for advanced use cases
                                    </p>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() => {
                                            setEditingUrl(null);
                                            setDialogOpen(true);
                                        }}
                                        className='flex items-center gap-2'
                                    >
                                        <Plus className='h-4 w-4' />
                                        Save URL
                                    </Button>
                                </div>

                                {/* Show user URLs error if any */}
                                {userUrlsError && (
                                    <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
                                        <p className='text-sm text-red-600'>{userUrlsError}</p>
                                    </div>
                                )}

                                {customUrls.length === 0 ? (
                                    <div className='text-center p-4 border rounded-lg border-dashed'>
                                        <p className='text-sm text-muted-foreground mb-2'>No custom URLs added</p>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={addCustomUrl}
                                        >
                                            <Plus className='h-4 w-4 mr-2' />
                                            Add First Custom URL
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {customUrls.map((url, i) => {
                                            const userUrl = userUrls.find(u => u.url === url);

                                            return (
                                                <div key={i} className='flex items-center gap-2'>
                                                    <Select value={url} onValueChange={(val) => handleCustomUrlChange(i, val)}>
                                                        <SelectTrigger className='w-48'>
                                                            <SelectValue placeholder='Select URL' />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {/* Preset URLs */}
                                                            {DEFAULT_URLS.map((opt) => (
                                                                <SelectItem key={opt.value} value={opt.value}>
                                                                    {opt.label} (Preset)
                                                                </SelectItem>
                                                            ))}
                                                            {/* User URLs */}
                                                            {userUrls.map((userUrl) => (
                                                                <SelectItem key={userUrl.id} value={userUrl.url}>
                                                                    {userUrl.name} (Custom)
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        value={url}
                                                        onChange={(e) => handleCustomUrlChange(i, e.target.value)}
                                                        className='flex-1'
                                                        placeholder='Paste or edit API URL'
                                                    />

                                                    {/* Edit button for user URLs */}
                                                    {userUrl && (
                                                        <Button
                                                            type='button'
                                                            variant='outline'
                                                            size='sm'
                                                            onClick={() => {
                                                                setEditingUrl(userUrl);
                                                                setDialogOpen(true);
                                                            }}
                                                            className='flex items-center gap-1'
                                                        >
                                                            <Edit className='h-3 w-3' />
                                                        </Button>
                                                    )}

                                                    {/* Delete button for user URLs */}
                                                    {userUrl && (
                                                        <Button
                                                            type='button'
                                                            variant='outline'
                                                            size='sm'
                                                            onClick={() => {
                                                                setUrlToDelete(userUrl);
                                                                setConfirmDialogOpen(true);
                                                            }}
                                                            className='flex items-center gap-1 text-red-600 hover:text-red-700'
                                                        >
                                                            <Trash2 className='h-3 w-3' />
                                                        </Button>
                                                    )}

                                                    {/* Remove from current selection */}
                                                    {customUrls.length > 1 && (
                                                        <Button
                                                            type='button'
                                                            variant='ghost'
                                                            size='icon'
                                                            onClick={() => removeCustomUrl(i)}
                                                        >
                                                            <X className='h-4 w-4' />
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={addCustomUrl}
                                        >
                                            <Plus className='h-4 w-4 mr-2' />
                                            Add Another URL
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
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

            {/* Screener URL Dialog */}
            <ScreenerUrlDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSave={handleSaveUrl}
                editingUrl={editingUrl}
            />

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                title="Delete Screener URL"
                description={`Are you sure you want to delete "${urlToDelete?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                onConfirm={async () => {
                    if (urlToDelete) {
                        const success = await deleteUserUrl(urlToDelete.id);
                        if (success) {
                            // Remove from custom URLs if it's being used
                            const updatedUrls = customUrls.filter(u => u !== urlToDelete.url);
                            setCustomUrls(updatedUrls);
                            toast('Screener URL deleted successfully.', 'success');
                        } else {
                            toast('Failed to delete screener URL.', 'error');
                        }
                        setUrlToDelete(null);
                        setConfirmDialogOpen(false);
                    }
                }}
            />
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
