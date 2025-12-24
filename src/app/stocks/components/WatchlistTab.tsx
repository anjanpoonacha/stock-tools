'use client';

import { useSearchParams } from 'next/navigation';
import { WatchlistManager } from '@/components/watchlist/WatchlistManager';
import WatchlistStocksView from './WatchlistStocksView';

export default function WatchlistTab() {
	const searchParams = useSearchParams();
	const watchlistId = searchParams.get('watchlistId');
	const mioWlid = searchParams.get('mioWlid');
	const tvWlid = searchParams.get('tvWlid');
	
	// If watchlist is selected, show stocks view
	if (watchlistId || mioWlid || tvWlid) {
		return (
			<WatchlistStocksView 
				watchlistId={watchlistId}
				mioWlid={mioWlid}
				tvWlid={tvWlid}
			/>
		);
	}
	
	// Default: Show watchlist manager
	return <WatchlistManager />;
}
