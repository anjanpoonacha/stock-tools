'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormulaResults } from '@/hooks/useFormulaResults';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Table as TableIcon, BarChart3, RefreshCw } from 'lucide-react';
import ResultsTable from '@/components/formula/ResultsTable';
import ChartView from '@/components/formula/ChartView';
import { LocalStorageCache } from '@/lib/utils/cache';
import { filterAndSortStocks, type SortField, type SortOrder } from '@/lib/utils/stockOrdering';
import { getViewMode, setViewMode as setViewModeStorage, getChartIndex, setChartIndex } from '@/lib/utils/sessionState';

export default function ResultsContent() {
	const searchParams = useSearchParams();
	const formulaId = searchParams.get('formulaId');

	// Use non-streaming hook (formula results only, charts loaded on-demand)
	const { stocks, formulaName, loading, error, refetch } = 
		useFormulaResults(formulaId);
	
	console.log('[ResultsContent] Loaded stocks:', stocks.length);
	console.log('[ResultsContent] Using on-demand chart loading (no pre-fetched data)');

	// Initialize state from localStorage/sessionStorage (NOT URL)
	const [viewMode, setViewMode] = useState<'table' | 'chart'>(() => getViewMode());
	const [currentStockIndex, setCurrentStockIndex] = useState<number>(() => 
		formulaId ? getChartIndex(formulaId) : 0
	);

	// Read sort and filter settings from URL
	const sortField = (searchParams.get('sortBy') as SortField) || 'symbol';
	const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'asc';
	const sectorFilter = searchParams.get('sector') || 'all';
	const industryFilter = searchParams.get('industry') || 'all';

	// Get filtered and sorted stocks using centralized utility
	// This ensures chart view shows stocks in SAME order as table
	const filteredAndSortedStocks = useMemo(() => {
		return filterAndSortStocks(stocks, {
			sortField,
			sortOrder,
			sectorFilter,
			industryFilter,
		});
	}, [stocks, sortField, sortOrder, sectorFilter, industryFilter]);

	// Get array of stock symbols for chart navigation
	const stockSymbols = useMemo(() => {
		return filteredAndSortedStocks.map(s => s.symbol);
	}, [filteredAndSortedStocks]);

	// Persist view mode to localStorage whenever it changes
	useEffect(() => {
		setViewModeStorage(viewMode);
	}, [viewMode]);

	// Persist chart index to sessionStorage whenever it changes
	useEffect(() => {
		if (formulaId && viewMode === 'chart') {
			setChartIndex(formulaId, currentStockIndex);
		}
	}, [formulaId, currentStockIndex, viewMode]);

	// Reset chart index when formula changes or filters change
	useEffect(() => {
		setCurrentStockIndex(0);
	}, [formulaId, sectorFilter, industryFilter]);

	// Validate chart index bounds when stocks change
	useEffect(() => {
		if (currentStockIndex >= stockSymbols.length && stockSymbols.length > 0) {
			setCurrentStockIndex(Math.max(0, stockSymbols.length - 1));
		}
	}, [stockSymbols, currentStockIndex]);

	// Handle clearing cache and refetching
	const handleRefresh = () => {
		if (formulaId) {
			LocalStorageCache.remove(`formula-results:${formulaId}`);
			// Also clear chart data caches
			LocalStorageCache.clearByPrefix(`chart-data:`);
			refetch();
		}
	};

	// Handle switching to chart view
	const handleViewCharts = () => {
		if (filteredAndSortedStocks.length === 0) {
			alert('No stocks to view. Try adjusting your filters.');
			return;
		}
		setCurrentStockIndex(0);
		setViewMode('chart');
	};

	// Handle switching back to table view
	const handleBackToTable = () => {
		setViewMode('table');
	};

	if (!formulaId) {
		return (
			<div className='p-4'>
				<Alert variant='destructive'>
					<AlertDescription>No formula ID provided</AlertDescription>
				</Alert>
			</div>
		);
	}

	if (loading) {
		return (
			<div className='p-4'>
				<div className='flex items-center justify-center min-h-[400px]'>
					<div className='text-center space-y-4'>
						<Loader2 className='h-8 w-8 animate-spin mx-auto text-primary' />
						<p className='text-muted-foreground'>Loading formula results...</p>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='p-4'>
				<Alert variant='destructive'>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<div className='p-4 space-y-4'>
			{/* Header */}
			<div className='flex items-center justify-between'>
				<div className='flex-1'>
					<h1 className='text-3xl font-bold tracking-tight'>Formula Results</h1>
					<p className='text-muted-foreground mt-1'>
						{formulaName} {filteredAndSortedStocks.length > 0 && `• ${filteredAndSortedStocks.length} stocks`}
					</p>
				</div>

				{/* View Toggle */}
				<div className='flex gap-2'>
					<Button
						variant='outline'
						size='sm'
						onClick={handleRefresh}
						disabled={loading}
						title='Clear cache and reload data'
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
					<Button
						variant={viewMode === 'table' ? 'default' : 'outline'}
						size='sm'
						onClick={() => setViewMode('table')}
					>
						<TableIcon className='h-4 w-4 mr-2' />
						Table View
					</Button>
					<Button
						variant={viewMode === 'chart' ? 'default' : 'outline'}
						size='sm'
						onClick={handleViewCharts}
						disabled={filteredAndSortedStocks.length === 0}
					>
						<BarChart3 className='h-4 w-4 mr-2' />
						Chart View
					</Button>
				</div>
			</div>

		{/* View Content */}
		{viewMode === 'table' ? (
			<ResultsTable
				stocks={stocks}
				onViewCharts={handleViewCharts}
			/>
		) : (
			<ChartView
				stockSymbols={stockSymbols}
				currentIndex={currentStockIndex}
				setCurrentIndex={setCurrentStockIndex}
				onBackToTable={handleBackToTable}
			/>
		)}
		</div>
	);
}
