'use client';

import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { RegroupBar } from '@/components/RegroupBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { useState } from 'react';
import { useSessionBridge } from '@/lib/useSessionBridge';
import { UsageGuide } from '@/components/UsageGuide';
import { ErrorDisplay } from '@/components/error';
import { SessionStatus } from '@/components/SessionStatus';
import { SessionError, SessionErrorType, Platform, ErrorSeverity, RecoveryAction } from '@/lib/sessionErrors';

type Watchlist = {
    id: number;
    name: string;
    symbols: string[];
};

export default function ShortlistFetcherClient() {
    const [cookie, sessionLoading, sessionError] = useSessionBridge('tradingview');
    const [loading, setLoading] = useState(false);
    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [error, setError] = useState<SessionError | Error | string | null>(null);
    const [url, setUrl] = useState('https://www.tradingview.com/api/v1/symbols_list/all/');
    const [regrouped, setRegrouped] = useState('');

    const handleFetch = async () => {
        setLoading(true);
        setError(null);
        setWatchlists([]);
        setSelectedIds([]);
        try {
            // Get stored credentials from localStorage (set by AuthContext)
            const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');

            if (!storedCredentials) {
                throw new Error('Authentication required. Please log in first.');
            }

            let credentials;
            try {
                credentials = JSON.parse(storedCredentials);
            } catch (error) {
                throw new Error('Invalid authentication data. Please log in again.');
            }

            if (!cookie) {
                throw new Error('TradingView session not available. Please visit TradingView first.');
            }

            const res = await fetch('/api/tv-shortlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    sessionid: cookie,
                    userEmail: credentials.userEmail,
                    userPassword: credentials.userPassword,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const lists: Watchlist[] = data.watchlists || [];
            setWatchlists(lists);

            const shortlist = lists.find((w) => w.name?.toLowerCase() === 'shortlist');
            if (shortlist) setSelectedIds([shortlist.id]);
            else setSelectedIds(lists.map((w) => w.id));
        } catch (e) {
            const sessionError = new SessionError(
                SessionErrorType.SESSION_EXPIRED,
                'Failed to fetch TradingView watchlists',
                e instanceof Error ? e.message : 'Unable to connect to TradingView API',
                {
                    operation: 'fetch_tv_shortlists',
                    platform: Platform.TRADINGVIEW,
                    timestamp: new Date(),
                    additionalData: {
                        url,
                        hasSessionId: !!cookie,
                        sessionIdLength: cookie?.length || 0,
                    },
                },
                ErrorSeverity.ERROR,
                [
                    {
                        action: RecoveryAction.REFRESH_SESSION,
                        description: 'Verify your TradingView session cookie is correct and not expired',
                        priority: 1,
                        automated: false,
                        estimatedTime: '3 minutes',
                    },
                    {
                        action: RecoveryAction.RE_AUTHENTICATE,
                        description: 'Log out and log back into TradingView to get a fresh session',
                        priority: 2,
                        automated: false,
                        estimatedTime: '5 minutes',
                    },
                    {
                        action: RecoveryAction.CHECK_NETWORK,
                        description: 'Verify the API URL is correct and accessible',
                        priority: 3,
                        automated: false,
                        estimatedTime: '1 minute',
                    },
                ]
            );
            setError(sessionError);
        } finally {
            setLoading(false);
        }
    };

    const selectedWatchlists = watchlists.filter((w) => selectedIds.includes(w.id));
    const allSymbols = selectedWatchlists.flatMap((w) => w.symbols).join(', ');

    return (
        <div className='max-w-xl mx-auto py-8'>
            <h1 className='text-2xl font-bold mb-4'>TradingView Shortlist Fetcher</h1>

            <UsageGuide
                title='How to fetch your TradingView watchlists'
                steps={[
                    'Install the browser extension from the extension folder',
                    'Visit TradingView and log in to your account',
                    'The extension will automatically capture your session',
                    'Return to this page and click "Fetch Watchlists"',
                    'Select which watchlists to combine and copy the symbols',
                ]}
                tips={[
                    'Use the regroup feature to organize symbols by sector/industry',
                    "'Shortlist' watchlist is auto-selected if found",
                    'You can combine multiple watchlists into one symbol list',
                    'If you get session errors, just visit TradingView website again',
                ]}
                className='mb-6'
            />

            <SessionStatus
                platform='TradingView'
                sessionId={cookie}
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
                    <Label htmlFor='url' className='text-sm font-medium'>
                        API URL
                    </Label>
                    <Input
                        id='url'
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className='font-mono text-sm mt-2'
                    />
                </div>

                <Button onClick={handleFetch} disabled={loading || !cookie} className='w-full'>
                    {loading ? 'Fetching...' : 'Fetch Watchlists'}
                </Button>

                {watchlists.length > 0 && (
                    <div className='space-y-4'>
                        <div>
                            <Label htmlFor='watchlist-multiselect' className='text-sm font-medium'>
                                Select Watchlists
                            </Label>
                            <MultiSelect
                                id='watchlist-multiselect'
                                options={watchlists.map((w) => ({
                                    label: w.name || `Watchlist ${w.id}`,
                                    value: w.id.toString(),
                                }))}
                                value={selectedIds.map(String)}
                                onValueChange={(ids) => setSelectedIds(ids.map(Number))}
                                placeholder='Choose one or more watchlists'
                                className='mt-2'
                            />
                        </div>

                        <div>
                            <Label className='text-sm font-medium'>All Selected Symbols</Label>
                            <EditorWithClipboard
                                id='shortlist-output'
                                label=''
                                value={allSymbols}
                                readOnly
                                showCopy
                                className='font-mono text-sm mt-2'
                                disabledCopy={allSymbols.length === 0}
                            />
                        </div>

                        {allSymbols && (
                            <div className='space-y-4'>
                                <RegroupBar value={allSymbols} onRegroup={setRegrouped} />
                                {regrouped && (
                                    <div>
                                        <Label className='text-sm font-medium'>Regrouped Output</Label>
                                        <EditorWithClipboard
                                            id='regrouped-output'
                                            label=''
                                            value={regrouped}
                                            readOnly
                                            showCopy
                                            className='min-h-[80px] font-mono text-sm bg-gray-50 mt-2'
                                            disabledCopy={!regrouped}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
