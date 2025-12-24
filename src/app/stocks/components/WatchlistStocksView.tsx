'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWatchlistIntegration } from '@/hooks/useWatchlistIntegration';
import { useWatchlistStocks } from '@/hooks/useWatchlistStocks';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChartLoadingOverlay } from '@/components/ui/chart-loading-overlay';
import { StockResultsView } from '@/components/stocks/StockResultsView';
import { mioToTv } from '@/lib/utils/exchangeMapper';

interface WatchlistStocksViewProps {
	watchlistId: string | null;
	mioWlid: string | null;
	tvWlid: string | null;
}

export default function WatchlistStocksView({ watchlistId, mioWlid, tvWlid }: WatchlistStocksViewProps) {
	const router = useRouter();

	// Fetch unified watchlists to get the name
	const { watchlists, isLoading: watchlistsLoading } = useWatchlistIntegration({
		currentSymbol: '',
	});

	// Find the selected watchlist
	const selectedWatchlist = useMemo(() => {
		if (!watchlistId) return null;
		return watchlists.find(w => w.id === watchlistId) || null;
	}, [watchlists, watchlistId]);

	// Check if watchlist already has symbols (e.g., from TradingView)
	const watchlistHasSymbols = selectedWatchlist?.symbols && selectedWatchlist.symbols.length > 0;

	// Fetch stocks for selected watchlist only if symbols not already available
	const { stocks: fetchedStocks, isLoading: stocksLoading, error: stocksError, refetch } = useWatchlistStocks(
		watchlistHasSymbols ? undefined : (mioWlid || undefined),
		watchlistHasSymbols ? undefined : (tvWlid || undefined)
	);

	// Use symbols from watchlist data if available, otherwise use fetched stocks
	const stocks = useMemo(() => {
		if (watchlistHasSymbols && selectedWatchlist?.symbols) {
			// Convert symbols to Stock format with TradingView normalization
			return selectedWatchlist.symbols.map(symbol => {
				// Normalize MIO format (WIPRO.NS) to TradingView format (NSE:WIPRO)
				const tvSymbol = mioToTv(symbol);
				
				return {
					symbol: tvSymbol,
					name: symbol, // Keep original for display
					sector: 'Watchlist',
					industry: 'N/A',
				};
			});
		}
		return fetchedStocks;
	}, [watchlistHasSymbols, selectedWatchlist, fetchedStocks]);

	const loading = watchlistsLoading || stocksLoading;

	// Handle back to manager
	const handleBack = () => {
		router.push('/stocks?tab=watchlists');
	};

	// Get platform badges
	const getPlatformBadges = () => {
		if (!selectedWatchlist) return null;
		
		if (selectedWatchlist.platforms.length === 2) {
			return <Badge variant='default'>MIO+TV</Badge>;
		} else if (selectedWatchlist.platforms.includes('mio')) {
			return <Badge variant='secondary'>MIO</Badge>;
		} else {
			return <Badge variant='outline'>TV</Badge>;
		}
	};

	// Loading state
	if (watchlistsLoading) {
		return <ChartLoadingOverlay message='Loading watchlist...' />;
	}

	// Error state
	if (!selectedWatchlist) {
		return (
			<div className='flex items-center justify-center h-full'>
				<Alert variant='destructive'>
					<AlertDescription>Watchlist not found</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<StockResultsView
			stocks={stocks}
			title={selectedWatchlist.name}
			subtitle={`${stocks.length} stocks`}
			badges={getPlatformBadges()}
			loading={loading}
			error={stocksError || undefined}
			onRefresh={refetch}
			onBack={handleBack}
			entityId={watchlistId || mioWlid || tvWlid || 'watchlist'}
			entityType='watchlist'
		/>
	);
}
