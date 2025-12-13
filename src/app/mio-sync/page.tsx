'use client';
import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { regroupTVWatchlist, RegroupOption } from '@/lib/utils';
import { useSessionBridge } from '@/lib/useSessionBridge';
import { useSessionAvailability } from '@/hooks/useSessionAvailability';
import { Badge } from '@/components/ui/badge';
import { XCircle } from 'lucide-react';
import { UsageGuide } from '@/components/UsageGuide';
import { SessionStatus } from '@/components/SessionStatus';
import { SessionError, SessionErrorType, Platform, ErrorSeverity, RecoveryAction } from '@/lib/sessionErrors';
// Error categorization will be used when adding error handling logic
// import { categorizeHttpError, extractTradingViewError, extractMarketInOutError } from '@/lib/errorCategorization';
import { ErrorDisplay } from '@/components/error/ErrorDisplay';

const MioSyncPageContent: React.FC = () => {
    const [tvWlid, setTvWlid] = useState('');
    const [mioWlid, setMioWlid] = useState('');
    const [mioWatchlists, setMioWatchlists] = useState<{ id: string; name: string }[]>([]);
    const [savedCombinations, setSavedCombinations] = useState<
        { tvWlid: string; mioWlid: string; groupBy: RegroupOption }[]
    >([]);
    const [mioWatchlistsLoading, setMioWatchlistsLoading] = useState(false);
    const [mioWatchlistsError, setMioWatchlistsError] = useState<Error | string | null>(null);
    const [sessionId, sessionLoading] = useSessionBridge('tradingview');
    // Separate error states: session errors vs operation errors
    const [operationError, setOperationError] = useState<SessionError | null>(null);
    const { mioSessionAvailable, loading: sessionAvailabilityLoading } = useSessionAvailability();
    const [symbols, setSymbols] = useState('');
    const regroupOptions: { value: RegroupOption; label: string }[] = [
        { value: 'Industry', label: 'Industry' },
        { value: 'Sector', label: 'Sector' },
        { value: 'None', label: 'None' },
    ];
    const [groupBy, setGroupBy] = useState<RegroupOption>('None');
    const [loading, setLoading] = useState(false);
    const [watchlists, setWatchlists] = useState<{ id: string; name: string }[]>([]);
    const showToast = useToast();

    React.useEffect(() => {
        // Restore all saved combinations from localStorage
        const stored = localStorage.getItem('mioSyncCombinations');
        if (stored) {
            try {
                const combos = JSON.parse(stored);
                if (Array.isArray(combos)) {
                    setSavedCombinations(combos);
                    // Optionally, auto-apply the first combination
                    if (combos.length > 0) {
                        setTvWlid(combos[0].tvWlid);
                        setMioWlid(combos[0].mioWlid);
                        setGroupBy(combos[0].groupBy);
                    }
                }
            } catch {}
        }
    }, []);

    React.useEffect(() => {
        // Only fetch MIO watchlists if session availability check is complete and MIO session is available
        if (sessionAvailabilityLoading) {
            // Still checking session availability
            setMioWatchlistsLoading(true);
            return;
        }

        if (!mioSessionAvailable) {
            // No MIO session available - don't make API call
            setMioWatchlistsLoading(false);
            setMioWatchlistsError('No MarketInOut session found. Please use the browser extension to capture sessions from marketinout.com');
            console.log('[SYNC] Skipping MIO watchlists fetch - no session available');
            return;
        }

        // MIO session is available - proceed with fetching watchlists
        setMioWatchlistsLoading(true);
        setMioWatchlistsError(null);

        console.log('[SYNC] Fetching MIO watchlists - session available');

        // Get stored credentials from localStorage (set by AuthContext)
        const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');

        if (!storedCredentials) {
            setMioWatchlistsError('Authentication required. Please log in first.');
            setMioWatchlistsLoading(false);
            return;
        }

        let credentials;
        try {
            credentials = JSON.parse(storedCredentials);
        } catch {
            setMioWatchlistsError('Invalid authentication data. Please log in again.');
            setMioWatchlistsLoading(false);
            return;
        }

        fetch('/api/mio-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userEmail: credentials.userEmail,
                userPassword: credentials.userPassword,
            }),
        })
            .then((res) => res.json())
            .then((data: { error?: string; watchlists?: { id: string | number; name: string }[] }) => {
                if (data.error) throw new Error(data.error);
                setMioWatchlists(
                    (data.watchlists || []).map((w: { id: string | number; name: string }) => ({
                        id: String(w.id),
                        name: w.name,
                    }))
                );
            })
            .catch((err) => {
                const message = err.message || 'Unable to fetch watchlists from MarketInOut';
                setMioWatchlistsError(message);
            })
            .finally(() => setMioWatchlistsLoading(false));
    }, [mioSessionAvailable, sessionAvailabilityLoading]);

    React.useEffect(() => {
        // Inline fetchWatchlists to avoid dependency warning
        if (!sessionId) return;
        setLoading(true);
        (async () => {
            try {
                const res = await fetch('/api/tradingview-watchlists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionid: sessionId }),
                });
                const data: { error?: string; watchlists?: { id: string | number; name: string }[] } = await res.json();
                if (data.error) throw new Error(data.error);
                setWatchlists(
                    (data.watchlists || []).map((w: { id: string | number; name: string }) => ({
                        id: String(w.id),
                        name: w.name,
                    }))
                );
                showToast('Fetched TradingView watchlists.', 'success');
            } catch (err) {
                const fetchError = new SessionError(
                    SessionErrorType.SESSION_EXPIRED,
                    'Failed to fetch TradingView watchlists',
                    err instanceof Error ? err.message : 'Unable to connect to TradingView',
                    {
                        operation: 'fetch_tv_watchlists',
                        platform: Platform.TRADINGVIEW,
                        timestamp: new Date(),
                        additionalData: { sessionId: sessionId?.slice(0, 8) + '...' },
                    },
                    ErrorSeverity.ERROR,
                    [
                        {
                            action: RecoveryAction.REFRESH_SESSION,
                            description: 'Verify your TradingView session ID is correct',
                            priority: 1,
                            automated: false,
                            estimatedTime: '2 minutes',
                        },
                    ]
                );
                setOperationError(fetchError);
            } finally {
                setLoading(false);
            }
        })();
    }, [sessionId, showToast]);

    React.useEffect(() => {
        if (!tvWlid || !sessionId) return;
        const fetchSymbols = async () => {
            try {
                const res = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: `https://www.tradingview.com/api/v1/symbols_list/custom/${tvWlid}/`,
                        method: 'GET',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
                            Cookie: `sessionid=${sessionId}`,
                            Accept: 'application/json',
                        },
                    }),
                });
                if (!res.ok) {
                    const sessionError = new SessionError(
                        SessionErrorType.SESSION_EXPIRED,
                        'Failed to fetch watchlist symbols',
                        `HTTP ${res.status}: Unable to fetch symbols from TradingView watchlist`,
                        {
                            operation: 'fetch_watchlist_symbols',
                            platform: Platform.TRADINGVIEW,
                            timestamp: new Date(),
                            additionalData: { watchlistId: tvWlid, httpStatus: res.status },
                        },
                        ErrorSeverity.ERROR,
                        [
                            {
                                action: RecoveryAction.REFRESH_SESSION,
                                description: 'Verify your TradingView session ID is still valid',
                                priority: 1,
                                automated: false,
                                estimatedTime: '2 minutes',
                            },
                            {
                                action: RecoveryAction.RETRY,
                                description: 'Ensure the watchlist exists and is accessible',
                                priority: 2,
                                automated: false,
                                estimatedTime: '1 minute',
                            },
                        ]
                    );
                    showToast(sessionError.getDisplayMessage(), 'error');
                    setSymbols('');
                    return;
                }
                const { data }: { data: { symbols?: string[] } } = await res.json();
                // Debug: Show raw API response if no symbols
                if (!data?.symbols || !Array.isArray(data.symbols) || data.symbols.length === 0) {
                    console.error('No symbols returned. Raw response:', data);
                    const sessionError = new SessionError(
                        SessionErrorType.SESSION_EXPIRED,
                        'No symbols found in watchlist',
                        'The selected TradingView watchlist appears to be empty or inaccessible',
                        {
                            operation: 'parse_watchlist_symbols',
                            platform: Platform.TRADINGVIEW,
                            timestamp: new Date(),
                            additionalData: { watchlistId: tvWlid, responseData: JSON.stringify(data).slice(0, 200) },
                        },
                        ErrorSeverity.WARNING,
                        [
                            {
                                action: RecoveryAction.RETRY,
                                description: 'Verify the watchlist contains symbols in TradingView',
                                priority: 1,
                                automated: false,
                                estimatedTime: '2 minutes',
                            },
                            {
                                action: RecoveryAction.RETRY,
                                description: 'Select a different watchlist with symbols',
                                priority: 2,
                                automated: false,
                                estimatedTime: '1 minute',
                            },
                        ]
                    );
                    showToast(sessionError.getDisplayMessage(), 'error');
                    setSymbols('');
                    return;
                }
                try {
                    const tvSymbols = Array.isArray(data.symbols) ? data.symbols : [];
                    const mioSymbols = tvSymbols
                        .map((s) => {
                            if (typeof s !== 'string') {
                                console.error('Invalid symbol entry:', s);
                                return '';
                            }
                            if (s.startsWith('NSE:')) return s.replace('NSE:', '') + '.NS';
                            if (s.startsWith('BSE:')) return s.replace('BSE:', '') + '.BO';
                            return s;
                        })
                        .filter(Boolean)
                        .join(',');
                    setSymbols(mioSymbols);
                } catch (err) {
                    const sessionError = new SessionError(
                        SessionErrorType.SESSION_EXPIRED,
                        'Error processing symbols',
                        err instanceof Error ? err.message : 'Failed to convert symbols from TradingView to MIO format',
                        {
                            operation: 'convert_symbols',
                            platform: Platform.TRADINGVIEW,
                            timestamp: new Date(),
                            additionalData: { watchlistId: tvWlid },
                        },
                        ErrorSeverity.ERROR,
                        [
                            {
                                action: RecoveryAction.RETRY,
                                description: 'Try fetching the watchlist symbols again',
                                priority: 1,
                                automated: false,
                                estimatedTime: '1 minute',
                            },
                        ]
                    );
                    showToast(sessionError.getDisplayMessage(), 'error');
                    setSymbols('');
                }
            } catch (err) {
                const sessionError = new SessionError(
                    SessionErrorType.NETWORK_ERROR,
                    'Network error fetching symbols',
                    err instanceof Error ? err.message : 'Unable to connect to TradingView API',
                    {
                        operation: 'fetch_watchlist_symbols',
                        platform: Platform.TRADINGVIEW,
                        timestamp: new Date(),
                        additionalData: { watchlistId: tvWlid },
                    },
                    ErrorSeverity.ERROR,
                    [
                        {
                            action: RecoveryAction.CHECK_NETWORK,
                            description: 'Check your internet connection',
                            priority: 1,
                            automated: false,
                            estimatedTime: '1 minute',
                        },
                        {
                            action: RecoveryAction.WAIT_AND_RETRY,
                            description: 'Try again in a few moments',
                            priority: 2,
                            automated: false,
                            estimatedTime: '2 minutes',
                        },
                    ]
                );
                showToast(sessionError.getDisplayMessage(), 'error');
                setSymbols('');
            }
        };
        fetchSymbols();
    }, [tvWlid, sessionId, showToast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Get stored credentials from localStorage (set by AuthContext)
            const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');

            if (!storedCredentials) {
                throw new Error('Authentication required. Please log in first.');
            }

            let credentials;
            try {
                credentials = JSON.parse(storedCredentials);
            } catch {
                throw new Error('Invalid authentication data. Please log in again.');
            }

            const res = await fetch('/api/mio-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mioWlid,
                    symbols: regroupTVWatchlist(symbols, groupBy),
                    userEmail: credentials.userEmail,
                    userPassword: credentials.userPassword,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const sessionError = new SessionError(
                    res.status === 401 ? SessionErrorType.SESSION_EXPIRED : SessionErrorType.OPERATION_FAILED,
                    'Failed to sync watchlist to MIO',
                    errorData.error || `HTTP ${res.status}: Unable to sync watchlist to MarketInOut`,
                    {
                        operation: 'sync_to_mio',
                        platform: Platform.MARKETINOUT,
                        timestamp: new Date(),
                        additionalData: {
                            mioWatchlistId: mioWlid,
                            symbolCount: symbols.split(',').length,
                            httpStatus: res.status,
                        },
                    },
                    ErrorSeverity.ERROR,
                    [
                        {
                            action: RecoveryAction.REFRESH_SESSION,
                            description: 'Verify your MIO session is still active',
                            priority: 1,
                            automated: false,
                            estimatedTime: '2 minutes',
                        },
                        {
                            action: RecoveryAction.RETRY,
                            description: 'Try the sync operation again',
                            priority: 2,
                            automated: false,
                            estimatedTime: '1 minute',
                        },
                    ]
                );
                throw sessionError;
            }

            showToast('Watchlist synced to MarketInOut.', 'success');
        } catch (err) {
            if (err instanceof SessionError) {
                showToast(err.getDisplayMessage(), 'error');
            } else {
                const sessionError = new SessionError(
                    SessionErrorType.NETWORK_ERROR,
                    'Network error during sync',
                    err instanceof Error ? err.message : 'Unable to connect to server',
                    {
                        operation: 'sync_to_mio',
                        platform: Platform.MARKETINOUT,
                        timestamp: new Date(),
                        additionalData: { mioWatchlistId: mioWlid },
                    },
                    ErrorSeverity.ERROR,
                    [
                        {
                            action: RecoveryAction.CHECK_NETWORK,
                            description: 'Check your internet connection',
                            priority: 1,
                            automated: false,
                            estimatedTime: '1 minute',
                        },
                        {
                            action: RecoveryAction.RETRY,
                            description: 'Try the sync operation again',
                            priority: 2,
                            automated: false,
                            estimatedTime: '2 minutes',
                        },
                    ]
                );
                showToast(sessionError.getDisplayMessage(), 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='max-w-xl mx-auto py-8'>
            <h1 className='text-2xl font-bold mb-4'>MIO Sync</h1>

            <UsageGuide
                title='How to sync TradingView watchlists to MIO'
                steps={[
                    'Install the browser extension from the extension folder',
                    'Visit marketinout.com and log in to capture your MIO session',
                    'Visit TradingView and log in to automatically capture your session',
                    'Return to this page and select a TradingView watchlist as the source',
                    'Choose a MIO watchlist as the destination',
                    "Select grouping option and click 'Sync to MarketInOut'",
                ]}
                tips={[
                    'Both MIO and TradingView sessions are handled automatically',
                    'Symbols are automatically converted from TradingView to MIO format',
                    'Save combinations for quick reuse of common sync operations',
                    'Grouping organizes symbols by sector/industry in MIO',
                    'If you get session errors, just visit the respective websites again',
                ]}
                className='mb-6'
            />

            <div className='space-y-4 mb-6'>
                {/* Session connectivity status - authentication layer */}
                <SessionStatus
                    platform='TradingView'
                    sessionId={sessionId}
                    loading={sessionLoading}
                    error={null}
                />
                <SessionStatus
                    platform='MarketInOut'
                    sessionId={mioWatchlists.length > 0 ? 'connected' : null}
                    loading={mioWatchlistsLoading}
                    error={
                        mioWatchlistsError
                            ? typeof mioWatchlistsError === 'string'
                                ? mioWatchlistsError
                                : mioWatchlistsError.message
                            : null
                    }
                />
                
                {/* Operation errors - application layer */}
                {operationError && (
                    <ErrorDisplay
                        error={operationError}
                        onDismiss={() => setOperationError(null)}
                    />
                )}
            </div>

            <form onSubmit={handleSubmit} className='space-y-6'>
                <div>
                    <Label htmlFor='wlid' className='text-sm font-medium'>
                        TradingView Watchlist
                    </Label>
                    <Select
                        value={tvWlid}
                        onValueChange={setTvWlid}
                        disabled={!sessionId || loading || watchlists.length === 0}
                    >
                        <SelectTrigger id='wlid' className='w-full mt-2'>
                            <SelectValue placeholder='Select a TradingView watchlist' />
                        </SelectTrigger>
                        <SelectContent>
                            {watchlists.map((w) => (
                                <SelectItem key={w.id} value={String(w.id)}>
                                    {w.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor='mio-wlid' className='text-sm font-medium'>
                        MIO Watchlist
                    </Label>
                    <div className='mt-2'>
                        {mioWatchlistsLoading ? (
                            <div className='flex items-center justify-center py-4'>
                                <div className='text-sm text-gray-500'>Loading MIO watchlists...</div>
                            </div>
                        ) : (
                            <Select value={mioWlid} onValueChange={setMioWlid} disabled={mioWatchlists.length === 0}>
                                <SelectTrigger id='mio-wlid' className='w-full'>
                                    <SelectValue
                                        placeholder={
                                            mioWatchlists.length === 0
                                                ? 'No MIO watchlists available'
                                                : 'Select a MIO watchlist'
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {mioWatchlists.map((w) => (
                                        <SelectItem key={w.id} value={w.id}>
                                            {w.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                <div>
                    <Label htmlFor='groupBy' className='text-sm font-medium'>
                        Group by
                    </Label>
                    <Select value={groupBy} onValueChange={(v) => setGroupBy(v as RegroupOption)}>
                        <SelectTrigger id='groupBy' className='w-full mt-2'>
                            <SelectValue placeholder='Select grouping option' />
                        </SelectTrigger>
                        <SelectContent>
                            {regroupOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <EditorWithClipboard
                        id='symbols-editor'
                        label='Stock Symbols (MIO format)'
                        value={regroupTVWatchlist(symbols, groupBy)}
                        onChange={setSymbols}
                        placeholder='Paste or type symbols here...'
                        className='w-full font-mono text-sm'
                    />
                </div>

                <Button type='submit' disabled={loading || !symbols || !sessionId || !mioWlid} className='w-full'>
                    {loading ? 'Syncing...' : 'Sync to MarketInOut'}
                </Button>
                <Button
                    type='button'
                    variant='outline'
                    className='w-full'
                    onClick={() => {
                        if (!tvWlid || !mioWlid || !groupBy) {
                            showToast('Please select all combination options before saving.', 'error');
                            return;
                        }
                        const combo = { tvWlid, mioWlid, groupBy };
                        // Prevent duplicates
                        const updated = [
                            ...savedCombinations.filter(
                                (c) =>
                                    !(
                                        c.tvWlid === combo.tvWlid &&
                                        c.mioWlid === combo.mioWlid &&
                                        c.groupBy === combo.groupBy
                                    )
                            ),
                            combo,
                        ];
                        setSavedCombinations(updated);
                        localStorage.setItem('mioSyncCombinations', JSON.stringify(updated));
                        showToast('Combination saved locally.', 'success');
                    }}
                >
                    Save Combination
                </Button>

                {savedCombinations.length > 0 && (
                    <div>
                        <Label className='text-sm font-medium'>Saved Combinations</Label>
                        <div className='flex flex-wrap gap-2 mt-2'>
                            {savedCombinations.map((combo, idx) => {
                                const tvName = watchlists.find((w) => w.id === combo.tvWlid)?.name || combo.tvWlid;
                                const mioName =
                                    mioWatchlists.find((w) => w.id === combo.mioWlid)?.name || combo.mioWlid;
                                return (
                                    <Badge
                                        key={idx}
                                        className='cursor-pointer hover:bg-gray-100 flex items-center gap-2 px-3 py-1'
                                        onClick={() => {
                                            setTvWlid(combo.tvWlid);
                                            setMioWlid(combo.mioWlid);
                                            setGroupBy(combo.groupBy);
                                            showToast('Combination applied.', 'success');
                                        }}
                                    >
                                        <span className='text-xs'>
                                            {tvName} → {mioName} ({combo.groupBy})
                                        </span>
                                        <XCircle
                                            className='h-3 w-3 cursor-pointer hover:text-red-500'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const updated = savedCombinations.filter((_, i) => i !== idx);
                                                setSavedCombinations(updated);
                                                localStorage.setItem('mioSyncCombinations', JSON.stringify(updated));
                                                showToast('Combination deleted.', 'success');
                                            }}
                                        />
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

const MioSyncPage: React.FC = () => {
    return (
        <DashboardLayout showHero={false} showSidebar={true}>
            <AuthGuard>
                <MioSyncPageContent />
            </AuthGuard>
        </DashboardLayout>
    );
};

export default MioSyncPage;
