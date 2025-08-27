// src/app/mio-watchlist/page.tsx

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { UsageGuide } from '@/components/UsageGuide';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { API_ENDPOINTS, UI_CONSTANTS, SUCCESS_MESSAGES } from '@/lib/constants';

interface Watchlist {
    id: string;
    name: string;
}

interface APIResponse {
    watchlists?: Array<{ id: string | number; name: string }>;
    error?: string;
}

export default function MioWatchlistPage() {
    // Watchlist state
    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [watchlistsLoading, setWatchlistsLoading] = useState(false);
    const [watchlistsError, setWatchlistsError] = useState<Error | string | null>(null);

    // Form state
    const [mioWlid, setMioWlid] = useState('');
    const [symbols, setSymbols] = useState('');
    const [groupBy, setGroupBy] = useState('');
    const [watchlistName, setWatchlistName] = useState('');
    const [deleteIds, setDeleteIds] = useState<string[]>([]);

    // Result and error state
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<Error | string | null>(null);
    const [loading, setLoading] = useState(false);

    /**
     * Extracts error message from unknown error type
     */
    const getErrorMessage = (error: unknown, fallback: string): string => {
        return error instanceof Error ? error.message : fallback;
    };

    /**
     * Makes API request with standardized error handling
     */
    const makeAPIRequest = async (method: string, body: object): Promise<APIResponse> => {
        const response = await fetch(API_ENDPOINTS.MIO_ACTION, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data: APIResponse = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        return data;
    };

    /**
     * Transforms API watchlist data to component format
     */
    const transformWatchlistData = (apiWatchlists: Array<{ id: string | number; name: string }>): Watchlist[] => {
        return apiWatchlists.map((watchlist) => ({
            id: String(watchlist.id),
            name: watchlist.name,
        }));
    };

    /**
     * Fetches all watchlists from the API
     */
    const fetchWatchlists = useCallback(async () => {
        setWatchlistsLoading(true);
        setWatchlistsError(null);

        try {
            const data = await makeAPIRequest('POST', {});
            const transformedWatchlists = transformWatchlistData(data.watchlists || []);
            setWatchlists(transformedWatchlists);
        } catch (error) {
            const message = getErrorMessage(error, 'Unable to fetch watchlists from MarketInOut');
            setWatchlistsError(message);
            setWatchlists([]);
        } finally {
            setWatchlistsLoading(false);
        }
    }, []);

    /**
     * Handles operation state management
     */
    const handleOperationStart = () => {
        setLoading(true);
        setError(null);
        setResult(null);
    };

    /**
     * Handles operation completion
     */
    const handleOperationComplete = (successMessage: string) => {
        setResult(successMessage);
        fetchWatchlists();
        setLoading(false);
    };

    /**
     * Handles operation error
     */
    const handleOperationError = (error: unknown, fallbackMessage: string) => {
        const message = getErrorMessage(error, fallbackMessage);
        setError(message);
        setLoading(false);
    };

    // Fetch watchlists on component mount
    useEffect(() => {
        fetchWatchlists();
    }, [fetchWatchlists]);

    /**
     * Adds symbols to selected watchlist
     */
    const handleAddWatchlist = async () => {
        handleOperationStart();

        try {
            await makeAPIRequest('POST', { mioWlid, symbols });
            handleOperationComplete(SUCCESS_MESSAGES.WATCHLIST_UPDATED);
        } catch (error) {
            handleOperationError(error, 'Unable to add symbols to MIO watchlist');
        }
    };

    /**
     * Creates a new watchlist
     */
    const handleCreateWatchlist = async () => {
        handleOperationStart();

        try {
            await makeAPIRequest('PUT', { name: watchlistName });
            handleOperationComplete(SUCCESS_MESSAGES.WATCHLIST_CREATED);
        } catch (error) {
            handleOperationError(error, 'Unable to create watchlist in MarketInOut');
        }
    };

    /**
     * Deletes selected watchlists
     */
    const handleDeleteWatchlists = async () => {
        handleOperationStart();

        try {
            await makeAPIRequest('DELETE', { deleteIds });
            handleOperationComplete(SUCCESS_MESSAGES.WATCHLISTS_DELETED);
        } catch (error) {
            handleOperationError(error, 'Unable to delete watchlists from MarketInOut');
        }
    };

    return (
        <div className='max-w-xl mx-auto py-8'>
            <h1 className='text-2xl font-bold mb-4'>MIO Watchlist Management</h1>
            <UsageGuide
                title='How to manage your MIO watchlists'
                steps={[
                    'Install the browser extension from the extension folder',
                    'Visit marketinout.com and log in to your account',
                    'The extension will automatically capture your session',
                    'Return to this page - everything will work automatically!',
                    'Use the tools below to manage your watchlists',
                ]}
                tips={[
                    'Symbols should be in MIO format (e.g., TCS.NS, INFY.BO)',
                    'Use comma-separated format for multiple symbols',
                    'Group By field helps organize symbols in watchlists',
                    'If you get session errors, just visit MIO website again',
                ]}
                className='mb-4'
            />
            <Separator className='mb-4' />

            <div className='mb-6'>
                <h2 className='font-semibold mb-2'>Add to Watchlist</h2>
                {watchlistsLoading ? (
                    <div className='mb-2 text-sm text-gray-500'>{UI_CONSTANTS.LOADING_TEXT}</div>
                ) : watchlistsError ? (
                    <div className='mb-2'>
                        <ErrorDisplay error={watchlistsError} />
                    </div>
                ) : watchlists.length === 0 ? (
                    <div className='mb-2 text-sm text-gray-500'>{UI_CONSTANTS.NO_WATCHLISTS_FOUND}</div>
                ) : (
                    <div className='mb-2'>
                        <label className='block mb-1 font-medium'>MIO Watchlist</label>
                        <Select value={mioWlid} onValueChange={setMioWlid} disabled={watchlists.length === 0}>
                            <SelectTrigger className='w-full'>
                                <SelectValue placeholder={UI_CONSTANTS.PLACEHOLDER_SELECT_WATCHLIST} />
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
                )}
                <Input
                    className='mb-2'
                    value={symbols}
                    onChange={(e) => setSymbols(e.target.value)}
                    placeholder={UI_CONSTANTS.PLACEHOLDER_SYMBOLS}
                />
                <Input
                    className='mb-2'
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    placeholder={UI_CONSTANTS.PLACEHOLDER_GROUP_BY}
                />
                <Button onClick={handleAddWatchlist} disabled={loading}>
                    Add to Watchlist
                </Button>
            </div>

            <Separator className='mb-4' />

            <div className='mb-6'>
                <h2 className='font-semibold mb-2'>Create New Watchlist</h2>
                <Input
                    className='mb-2'
                    value={watchlistName}
                    onChange={(e) => setWatchlistName(e.target.value)}
                    placeholder={UI_CONSTANTS.PLACEHOLDER_WATCHLIST_NAME}
                />
                <Button onClick={handleCreateWatchlist} disabled={loading}>
                    Create Watchlist
                </Button>
            </div>

            <Separator className='mb-4' />

            <div className='mb-6'>
                <h2 className='font-semibold mb-2'>Delete Watchlists</h2>
                <MultiSelect
                    options={watchlists.map((w) => ({ label: w.name, value: w.id }))}
                    onValueChange={setDeleteIds}
                    value={deleteIds}
                    placeholder={UI_CONSTANTS.PLACEHOLDER_SELECT_WATCHLISTS_DELETE}
                    className='mb-2'
                />
                <Button onClick={handleDeleteWatchlists} disabled={loading || deleteIds.length === 0}>
                    Delete Watchlists
                </Button>
            </div>

            {result && <div className='text-green-600 font-medium mb-2'>{result}</div>}
            {error && (
                <div className='mb-2'>
                    <ErrorDisplay error={error} />
                </div>
            )}
        </div>
    );
}
