'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ManagerTable } from '@/components/manager/ManagerTable';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useWatchlistIntegration } from '@/hooks/useWatchlistIntegration';
import { ChartLoadingOverlay } from '@/components/ui/chart-loading-overlay';
import { Loader2, Plus, BarChart3, Trash2, RefreshCw, Search } from 'lucide-react';
import type { UnifiedWatchlist, Platform } from '@/lib/watchlist-sync/types';

type PlatformFilter = 'all' | 'mio' | 'tv' | 'both';

export function WatchlistManager() {
	const router = useRouter();
	const { watchlists, isLoading, error, refreshWatchlists, sessionStatus } = useWatchlistIntegration({
		currentSymbol: '', // Not needed for manager view
	});

	const [searchQuery, setSearchQuery] = useState('');
	const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

	// Helper to safely format watchlist IDs
	const formatWatchlistId = (id: string | number | null | undefined, maxLength: number = 8): string => {
		if (!id) return '-';
		const idStr = String(id); // Convert to string safely
		return idStr.length > maxLength ? `${idStr.substring(0, maxLength)}...` : idStr;
	};

	// Filter watchlists based on search query and platform filter
	const filteredWatchlists = useMemo(() => {
		let filtered = watchlists;

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(w => w.name.toLowerCase().includes(query));
		}

		// Apply platform filter
		if (platformFilter !== 'all') {
			if (platformFilter === 'both') {
				filtered = filtered.filter(w => w.platforms.length === 2);
			} else {
				filtered = filtered.filter(w => 
					w.platforms.includes(platformFilter as Platform) && w.platforms.length === 1
				);
			}
		}

		return filtered;
	}, [watchlists, searchQuery, platformFilter]);

	// Handle view stocks action
	const handleViewStocks = (watchlist: UnifiedWatchlist) => {
		const params = new URLSearchParams();
		params.set('tab', 'watchlists');
		params.set('watchlistId', watchlist.id);
		if (watchlist.mioId) params.set('mioWlid', String(watchlist.mioId));
		if (watchlist.tvId) params.set('tvWlid', String(watchlist.tvId));
		router.push(`/stocks?${params.toString()}`);
	};

	// Get platform badges for watchlist
	const getPlatformBadges = (watchlist: UnifiedWatchlist) => {
		return (
			<div className='flex gap-1'>
				{watchlist.platforms.includes('mio') && (
					<Badge variant='secondary'>MIO</Badge>
				)}
				{watchlist.platforms.includes('tv') && (
					<Badge variant='outline'>TV</Badge>
				)}
			</div>
		);
	};

	// Show loading state
	if (isLoading && watchlists.length === 0) {
		return (
			<div className='h-full flex items-center justify-center'>
				<ChartLoadingOverlay message='Loading watchlists...' />
			</div>
		);
	}

	// Show error state
	if (error && !isLoading && watchlists.length === 0) {
		return (
			<div className='p-4'>
				<Alert variant='destructive'>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<div className='h-full flex flex-col overflow-hidden'>
			{/* Fixed Header Section */}
			<div className='flex-shrink-0 space-y-4 px-8 pt-8 pb-4'>
				{/* Header */}
				<div className='space-y-2'>
					<h1 className='text-3xl font-bold tracking-tight'>Watchlist Manager</h1>
					<p className='text-muted-foreground'>
						Manage your unified watchlists from MarketInOut and TradingView
					</p>
				</div>

				{/* Session Status */}
				<div className='flex gap-2'>
					<Badge variant={sessionStatus.mio ? 'default' : 'secondary'}>
						MIO: {sessionStatus.mio ? 'Connected' : 'Disconnected'}
					</Badge>
					<Badge variant={sessionStatus.tv ? 'default' : 'secondary'}>
						TV: {sessionStatus.tv ? 'Connected' : 'Disconnected'}
					</Badge>
				</div>

				{/* Error Display */}
				{error && watchlists.length > 0 && (
					<Alert variant='destructive'>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Action Bar */}
				<div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between'>
					<div className='flex flex-1 gap-2 w-full sm:w-auto'>
						{/* Search */}
						<div className='relative flex-1 max-w-sm'>
							<Search className='absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
							<Input
								placeholder='Search watchlists...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className='pl-8'
							/>
						</div>

						{/* Platform Filter */}
						<Select value={platformFilter} onValueChange={(value) => setPlatformFilter(value as PlatformFilter)}>
							<SelectTrigger className='w-[140px]'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All Platforms</SelectItem>
								<SelectItem value='mio'>MIO Only</SelectItem>
								<SelectItem value='tv'>TV Only</SelectItem>
								<SelectItem value='both'>Both Platforms</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className='flex gap-2 w-full sm:w-auto'>
						<Button
							onClick={refreshWatchlists}
							disabled={isLoading}
							variant='outline'
							size='default'
						>
							{isLoading ? (
								<>
									<Loader2 className='h-4 w-4 mr-2 animate-spin' />
									Refreshing...
								</>
							) : (
								<>
									<RefreshCw className='h-4 w-4 mr-2' />
									Refresh
								</>
							)}
						</Button>
						<Button
							onClick={() => router.push('/mio-watchlist')}
							size='default'
						>
							<Plus className='h-4 w-4 mr-2' />
							Create Watchlist
						</Button>
					</div>
				</div>
			</div>

		{/* Scrollable Table Section */}
		<div className='flex-1 min-h-0 px-8 pb-8'>
			{/* Watchlists Table */}
			{watchlists.length === 0 && !isLoading ? (
				<Card>
					<CardHeader>
						<CardTitle>No Watchlists Found</CardTitle>
						<CardDescription>
							Create a watchlist in MarketInOut or TradingView to get started
						</CardDescription>
					</CardHeader>
				</Card>
			) : filteredWatchlists.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>No Results</CardTitle>
						<CardDescription>
							No watchlists match your search criteria
						</CardDescription>
					</CardHeader>
				</Card>
			) : (
				<ManagerTable
					title='Your Watchlists'
					description='View and manage your watchlists from both platforms'
					items={filteredWatchlists}
					columns={[
						{
							key: 'name',
							label: 'Name',
							render: (watchlist: UnifiedWatchlist) => (
								<span className='font-medium'>{watchlist.name}</span>
							),
						},
						{
							key: 'platforms',
							label: 'Platforms',
							render: (watchlist: UnifiedWatchlist) => getPlatformBadges(watchlist),
						},
						{
							key: 'mioId',
							label: 'MIO ID',
							render: (watchlist: UnifiedWatchlist) => (
								watchlist.mioId ? (
									<Badge variant='outline' className='font-mono text-xs'>
										{formatWatchlistId(watchlist.mioId, 12)}
									</Badge>
								) : (
									<span className='text-muted-foreground text-sm'>-</span>
								)
							),
						},
						{
							key: 'tvId',
							label: 'TV ID',
							render: (watchlist: UnifiedWatchlist) => (
								watchlist.tvId ? (
									<Badge variant='outline' className='font-mono text-xs'>
										{formatWatchlistId(watchlist.tvId, 8)}
									</Badge>
								) : (
									<span className='text-muted-foreground text-sm'>-</span>
								)
							),
						},
					]}
					actions={(watchlist: UnifiedWatchlist) => (
						<div className='flex items-center justify-end gap-1'>
							<Button
								size='sm'
								variant='ghost'
								onClick={() => handleViewStocks(watchlist)}
								title='View stocks'
							>
								<BarChart3 className='h-4 w-4' />
							</Button>
							<Button
								size='sm'
								variant='ghost'
								onClick={() => router.push('/mio-watchlist')}
								title='Manage in MIO'
								disabled={!watchlist.mioId}
							>
								<Plus className='h-4 w-4' />
							</Button>
							<Button
								size='sm'
								variant='ghost'
								title='Delete watchlist'
								disabled
							>
								<Trash2 className='h-4 w-4 text-muted-foreground' />
							</Button>
						</div>
					)}
				/>
			)}
		</div>
		</div>
	);
}
