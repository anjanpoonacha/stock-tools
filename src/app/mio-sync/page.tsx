'use client';
import React from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { UsageGuide } from '@/components/UsageGuide';
import { SessionStatus } from '@/components/SessionStatus';
import { ErrorDisplay } from '@/components/error/ErrorDisplay';
import { useMioSync } from '@/hooks/useMioSync';
import { SyncControls } from '@/components/mio-sync/SyncControls';

const MioSyncPageContent: React.FC = () => {
    const {
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
        savedCombinations,
        saveCombination,
        deleteCombination,
        applyCombination,
        handleSubmit,
    } = useMioSync();

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

            <SyncControls
                tvWlid={tvWlid}
                setTvWlid={setTvWlid}
                mioWlid={mioWlid}
                setMioWlid={setMioWlid}
                groupBy={groupBy}
                setGroupBy={setGroupBy}
                symbols={symbols}
                setSymbols={setSymbols}
                watchlists={watchlists}
                mioWatchlists={mioWatchlists}
                loading={loading}
                mioWatchlistsLoading={mioWatchlistsLoading}
                sessionId={sessionId}
                savedCombinations={savedCombinations}
                onSaveCombination={saveCombination}
                onDeleteCombination={deleteCombination}
                onApplyCombination={applyCombination}
                onSubmit={handleSubmit}
            />
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
