'use client';

import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { UsageGuide } from '@/components/UsageGuide';
import { SessionStatus } from '@/components/SessionStatus';
import { SessionError } from '@/lib/sessionErrors';
import { ErrorDisplay } from '@/components/error/ErrorDisplay';
import { FormulaSelectorSection } from '@/components/tv-sync/FormulaSelectorSection';
import { useTvSync } from '@/hooks/useTvSync';
import { useFormulas } from '@/hooks/useFormulas';

function TvSyncPageContent() {
    const [grouping, setGrouping] = useState<'Sector' | 'Industry' | 'None'>('None');
    const { formulas } = useFormulas();

    // Formula multi-select state
    const [selectedFormulaIds, setSelectedFormulaIds] = useState<string[]>([]);

    // Custom URLs state
    const [customUrls, setCustomUrls] = useState<string[]>([]);

    // Compute selected formula URLs
    const selectedFormulaUrls = useMemo(() => {
        return selectedFormulaIds
            .map(id => {
                const formula = formulas.find(f => f.id === id);
                return formula?.apiUrl || '';
            })
            .filter(Boolean);
    }, [selectedFormulaIds, formulas]);

    // Use the custom hook for TV sync logic
    const {
        sessionid,
        sessionLoading,
        sessionError,
        watchlistId,
        watchlists,
        operationError,
        error,
        output,
        setWatchlistId,
        setOperationError,
        cleanUpWatchlist,
        appendToWatchlist,
    } = useTvSync({
        selectedFormulaUrls,
        customUrls,
        grouping,
    });

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

                <FormulaSelectorSection
                    selectedFormulaIds={selectedFormulaIds}
                    onSelectedFormulaIdsChange={setSelectedFormulaIds}
                    customUrls={customUrls}
                    onCustomUrlsChange={setCustomUrls}
                />

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
