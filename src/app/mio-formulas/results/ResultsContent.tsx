'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormulaResults } from '@/hooks/useFormulaResults';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table as TableIcon, BarChart3, RefreshCw } from 'lucide-react';
import ResultsTable from '@/components/formula/ResultsTable';
import ChartView from '@/components/formula/ChartView';
import { filterAndSortStocks, type SortField, type SortOrder } from '@/lib/utils/stockOrdering';
import { ChartLoadingOverlay } from '@/components/ui/chart-loading-overlay';
import { useViewSettings, useChartIndex } from '@/hooks/useChartSettings';
import type { Stock } from '@/types/stock';

export default function ResultsContent() {
	const searchParams = useSearchParams();
	const formulaId = searchParams.get('formulaId');

	// Use non-streaming hook (formula results only, charts loaded on-demand)
	const { stocks, formulaName, loading, error, refetch } =
		useFormulaResults(formulaId);

	console.log('[ResultsContent] Loaded stocks:', stocks.length);
	console.log('[ResultsContent] Using on-demand chart loading (no pre-fetched data)');

	// View settings with automatic persistence
	const { viewMode, setViewMode } = useViewSettings();

	// Chart index with per-formula session storage
	const { currentIndex: currentStockIndex, setCurrentIndex: setCurrentStockIndex } = useChartIndex(formulaId);

	// Custom symbol state for jumping to symbols not in the list
	const [customSymbol, setCustomSymbol] = useState<string | null>(null);

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
	// Include custom symbol if set
	const stockSymbols = useMemo(() => {
		const baseSymbols = filteredAndSortedStocks.map(s => s.symbol);
		if (customSymbol && !baseSymbols.includes(customSymbol)) {
			return [...baseSymbols, customSymbol];
		}
		return baseSymbols;
	}, [filteredAndSortedStocks, customSymbol]);

	// Include custom stock in stocks array if needed
	const displayStocks = useMemo(() => {
		if (customSymbol && !filteredAndSortedStocks.find(s => s.symbol === customSymbol)) {
			const customStock: Stock = {
				symbol: customSymbol,
				name: customSymbol,
				sector: 'Custom',
				industry: 'Custom Symbol',
			};
			return [...filteredAndSortedStocks, customStock];
		}
		return filteredAndSortedStocks;
	}, [filteredAndSortedStocks, customSymbol]);

	// Reset chart index when filters change
	useEffect(() => {
		setCurrentStockIndex(0);
	}, [sectorFilter, industryFilter, setCurrentStockIndex]);

	// Validate chart index bounds when stocks change
	useEffect(() => {
		if (currentStockIndex >= stockSymbols.length && stockSymbols.length > 0) {
			setCurrentStockIndex(Math.max(0, stockSymbols.length - 1));
		}
	}, [stockSymbols, currentStockIndex, setCurrentStockIndex]);

	// Refresh formula results - no cache to clear
	const handleRefresh = () => {
		if (formulaId) {
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

	// Handle jumping to arbitrary symbol (not in current list)
	const handleSymbolJump = (symbol: string) => {
		// Set custom symbol (will be appended to lists)
		setCustomSymbol(symbol);

		// Navigate to the last index (where custom symbol will be)
		const newIndex = displayStocks.length; // Will be length after custom stock is added
		setCurrentStockIndex(newIndex);
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

	// Show error if occurred
	if (error && !loading) {
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
			{/* Header - Always visible (preserves layout) */}
			<div className='flex-shrink-0 p-4 border-b border-border'>
				<div className='flex items-center justify-between'>
					<div className='flex-1'>
						<h1 className='text-3xl font-bold tracking-tight'>Formula Results</h1>
						<p className='text-muted-foreground mt-1'>
							{loading ? 'Loading...' : (formulaName && filteredAndSortedStocks.length > 0 && `${formulaName} • ${filteredAndSortedStocks.length} stocks`)}
						</p>
					</div>

					{/* View Toggle */}
					<div className='flex gap-2'>
						<Button
							variant='outline'
							size='sm'
							onClick={handleRefresh}
							disabled={loading}
							title='Reload formula results'
						>
							<RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
							Refresh
						</Button>
						<Button
							variant={viewMode === 'table' ? 'default' : 'outline'}
							size='sm'
							onClick={() => setViewMode('table')}
							disabled={loading}
						>
							<TableIcon className='h-4 w-4 mr-2' />
							Table View
						</Button>
						<Button
							variant={viewMode === 'chart' ? 'default' : 'outline'}
							size='sm'
							onClick={handleViewCharts}
							disabled={loading || filteredAndSortedStocks.length === 0}
						>
							<BarChart3 className='h-4 w-4 mr-2' />
							Chart View
						</Button>
					</div>
				</div>
			</div>

			{/* View Content - Takes remaining space with overlay when loading */}
			<div className='flex-1 min-h-0 relative'>
				{loading && <ChartLoadingOverlay message='Loading formula results...' />}
				{!loading && (
					<>
						{viewMode === 'table' ? (
							<ResultsTable
								stocks={stocks}
								onViewCharts={handleViewCharts}
							/>
						) : (
							<ChartView
								stocks={displayStocks}
								stockSymbols={stockSymbols}
								currentIndex={currentStockIndex}
								setCurrentIndex={setCurrentStockIndex}
								onBackToTable={handleBackToTable}
								onSymbolJump={handleSymbolJump}
							/>
						)}
					</>
				)}
			</div>
		</div>
	);
}
