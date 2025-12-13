import { useState, useEffect } from 'react';
import { RegroupOption, regroupTVWatchlist } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useSessionBridge } from '@/lib/useSessionBridge';
import { useSessionAvailability } from '@/hooks/useSessionAvailability';
import { SessionError, SessionErrorType, Platform, ErrorSeverity, RecoveryAction } from '@/lib/sessionErrors';

export interface SavedCombination {
    tvWlid: string;
    mioWlid: string;
    groupBy: RegroupOption;
}

export interface Watchlist {
    id: string;
    name: string;
}

export interface UseMioSyncReturn {
    tvWlid: string;
    setTvWlid: (wlid: string) => void;
    mioWlid: string;
    setMioWlid: (wlid: string) => void;
    groupBy: RegroupOption;
    setGroupBy: (option: RegroupOption) => void;
    symbols: string;
    setSymbols: (symbols: string) => void;
    watchlists: Watchlist[];
    mioWatchlists: Watchlist[];
    loading: boolean;
    sessionLoading: boolean;
    mioWatchlistsLoading: boolean;
    mioWatchlistsError: Error | string | null;
    operationError: SessionError | null;
    setOperationError: (error: SessionError | null) => void;
    sessionId: string | null;
    mioSessionAvailable: boolean;
    sessionAvailabilityLoading: boolean;
    savedCombinations: SavedCombination[];
    saveCombination: (combo: SavedCombination) => void;
    deleteCombination: (index: number) => void;
    applyCombination: (combo: SavedCombination) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
}

// Helper to create session errors with common recovery actions
const createSessionError = (
    type: SessionErrorType,
    title: string,
    message: string,
    operation: string,
    platform: Platform,
    additionalData?: Record<string, unknown>
): SessionError => {
    const recoveryActions: Partial<Record<SessionErrorType, Array<{
        action: RecoveryAction;
        description: string;
        priority: number;
        automated: boolean;
        estimatedTime: string;
    }>>> = {
        [SessionErrorType.SESSION_EXPIRED]: [
            { action: RecoveryAction.REFRESH_SESSION, description: `Verify your ${platform} session`, priority: 1, automated: false, estimatedTime: '2 minutes' },
            { action: RecoveryAction.RETRY, description: 'Try the operation again', priority: 2, automated: false, estimatedTime: '1 minute' },
        ],
        [SessionErrorType.NETWORK_ERROR]: [
            { action: RecoveryAction.CHECK_NETWORK, description: 'Check your internet connection', priority: 1, automated: false, estimatedTime: '1 minute' },
            { action: RecoveryAction.WAIT_AND_RETRY, description: 'Try again in a few moments', priority: 2, automated: false, estimatedTime: '2 minutes' },
        ],
        [SessionErrorType.OPERATION_FAILED]: [
            { action: RecoveryAction.RETRY, description: 'Try the operation again', priority: 1, automated: false, estimatedTime: '1 minute' },
        ],
    };

    return new SessionError(type, title, message, {
        operation,
        platform,
        timestamp: new Date(),
        additionalData,
    }, ErrorSeverity.ERROR, recoveryActions[type] || []);
};

export const useMioSync = (): UseMioSyncReturn => {
    const [tvWlid, setTvWlid] = useState('');
    const [mioWlid, setMioWlid] = useState('');
    const [mioWatchlists, setMioWatchlists] = useState<Watchlist[]>([]);
    const [savedCombinations, setSavedCombinations] = useState<SavedCombination[]>([]);
    const [mioWatchlistsLoading, setMioWatchlistsLoading] = useState(false);
    const [mioWatchlistsError, setMioWatchlistsError] = useState<Error | string | null>(null);
    const [sessionId, sessionLoading] = useSessionBridge('tradingview');
    const [operationError, setOperationError] = useState<SessionError | null>(null);
    const { mioSessionAvailable, loading: sessionAvailabilityLoading } = useSessionAvailability();
    const [symbols, setSymbols] = useState('');
    const [groupBy, setGroupBy] = useState<RegroupOption>('None');
    const [loading, setLoading] = useState(false);
    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const showToast = useToast();

    // Restore saved combinations from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('mioSyncCombinations');
        if (stored) {
            try {
                const combos = JSON.parse(stored);
                if (Array.isArray(combos)) {
                    setSavedCombinations(combos);
                    if (combos.length > 0) {
                        setTvWlid(combos[0].tvWlid);
                        setMioWlid(combos[0].mioWlid);
                        setGroupBy(combos[0].groupBy);
                    }
                }
            } catch {}
        }
    }, []);

    // Fetch MIO watchlists
    useEffect(() => {
        if (sessionAvailabilityLoading) {
            setMioWatchlistsLoading(true);
            return;
        }

        if (!mioSessionAvailable) {
            setMioWatchlistsLoading(false);
            setMioWatchlistsError('No MarketInOut session found. Please use the browser extension to capture sessions from marketinout.com');
            return;
        }

        setMioWatchlistsLoading(true);
        setMioWatchlistsError(null);

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
                    (data.watchlists || []).map((w) => ({
                        id: String(w.id),
                        name: w.name,
                    }))
                );
            })
            .catch((err) => setMioWatchlistsError(err.message || 'Unable to fetch watchlists from MarketInOut'))
            .finally(() => setMioWatchlistsLoading(false));
    }, [mioSessionAvailable, sessionAvailabilityLoading]);

    // Fetch TradingView watchlists
    useEffect(() => {
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
                setWatchlists((data.watchlists || []).map((w) => ({ id: String(w.id), name: w.name })));
                showToast('Fetched TradingView watchlists.', 'success');
            } catch (err) {
                const error = createSessionError(
                    SessionErrorType.SESSION_EXPIRED,
                    'Failed to fetch TradingView watchlists',
                    err instanceof Error ? err.message : 'Unable to connect to TradingView',
                    'fetch_tv_watchlists',
                    Platform.TRADINGVIEW,
                    { sessionId: sessionId?.slice(0, 8) + '...' }
                );
                setOperationError(error);
            } finally {
                setLoading(false);
            }
        })();
    }, [sessionId, showToast]);

    // Fetch symbols from selected TradingView watchlist
    useEffect(() => {
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
                    const error = createSessionError(
                        SessionErrorType.SESSION_EXPIRED,
                        'Failed to fetch watchlist symbols',
                        `HTTP ${res.status}: Unable to fetch symbols from TradingView watchlist`,
                        'fetch_watchlist_symbols',
                        Platform.TRADINGVIEW,
                        { watchlistId: tvWlid, httpStatus: res.status }
                    );
                    showToast(error.getDisplayMessage(), 'error');
                    setSymbols('');
                    return;
                }

                const { data }: { data: { symbols?: string[] } } = await res.json();
                if (!data?.symbols || !Array.isArray(data.symbols) || data.symbols.length === 0) {
                    showToast('No symbols found in watchlist', 'error');
                    setSymbols('');
                    return;
                }

                const tvSymbols = Array.isArray(data.symbols) ? data.symbols : [];
                const mioSymbols = tvSymbols
                    .map((s) => {
                        if (typeof s !== 'string') return '';
                        if (s.startsWith('NSE:')) return s.replace('NSE:', '') + '.NS';
                        if (s.startsWith('BSE:')) return s.replace('BSE:', '') + '.BO';
                        return s;
                    })
                    .filter(Boolean)
                    .join(',');
                setSymbols(mioSymbols);
            } catch (err) {
                const error = createSessionError(
                    SessionErrorType.NETWORK_ERROR,
                    'Network error fetching symbols',
                    err instanceof Error ? err.message : 'Unable to connect to TradingView API',
                    'fetch_watchlist_symbols',
                    Platform.TRADINGVIEW,
                    { watchlistId: tvWlid }
                );
                showToast(error.getDisplayMessage(), 'error');
                setSymbols('');
            }
        };
        fetchSymbols();
    }, [tvWlid, sessionId, showToast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');
            if (!storedCredentials) throw new Error('Authentication required. Please log in first.');

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
                const error = createSessionError(
                    res.status === 401 ? SessionErrorType.SESSION_EXPIRED : SessionErrorType.OPERATION_FAILED,
                    'Failed to sync watchlist to MIO',
                    errorData.error || `HTTP ${res.status}: Unable to sync watchlist to MarketInOut`,
                    'sync_to_mio',
                    Platform.MARKETINOUT,
                    { mioWatchlistId: mioWlid, symbolCount: symbols.split(',').length, httpStatus: res.status }
                );
                throw error;
            }

            showToast('Watchlist synced to MarketInOut.', 'success');
        } catch (err) {
            if (err instanceof SessionError) {
                showToast(err.getDisplayMessage(), 'error');
            } else {
                const error = createSessionError(
                    SessionErrorType.NETWORK_ERROR,
                    'Network error during sync',
                    err instanceof Error ? err.message : 'Unable to connect to server',
                    'sync_to_mio',
                    Platform.MARKETINOUT,
                    { mioWatchlistId: mioWlid }
                );
                showToast(error.getDisplayMessage(), 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const saveCombination = (combo: SavedCombination) => {
        const updated = [
            ...savedCombinations.filter(
                (c) => !(c.tvWlid === combo.tvWlid && c.mioWlid === combo.mioWlid && c.groupBy === combo.groupBy)
            ),
            combo,
        ];
        setSavedCombinations(updated);
        localStorage.setItem('mioSyncCombinations', JSON.stringify(updated));
        showToast('Combination saved locally.', 'success');
    };

    const deleteCombination = (index: number) => {
        const updated = savedCombinations.filter((_, i) => i !== index);
        setSavedCombinations(updated);
        localStorage.setItem('mioSyncCombinations', JSON.stringify(updated));
        showToast('Combination deleted.', 'success');
    };

    const applyCombination = (combo: SavedCombination) => {
        setTvWlid(combo.tvWlid);
        setMioWlid(combo.mioWlid);
        setGroupBy(combo.groupBy);
        showToast('Combination applied.', 'success');
    };

    return {
        tvWlid,
        setTvWlid,
        mioWlid,
        setMioWlid,
        groupBy,
        setGroupBy,
        symbols,
        setSymbols,
        watchlists,
        mioWatchlists,
        loading,
        sessionLoading,
        mioWatchlistsLoading,
        mioWatchlistsError,
        operationError,
        setOperationError,
        sessionId,
        mioSessionAvailable,
        sessionAvailabilityLoading,
        savedCombinations,
        saveCombination,
        deleteCombination,
        applyCombination,
        handleSubmit,
    };
};
