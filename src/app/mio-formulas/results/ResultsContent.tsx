'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useFormulaResults } from '@/hooks/useFormulaResults';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Table as TableIcon, BarChart3, RefreshCw } from 'lucide-react';
import ResultsTable from '@/components/formula/ResultsTable';
import ChartView from '@/components/formula/ChartView';
import { LocalStorageCache } from '@/lib/utils/cache';

type ViewMode = 'table' | 'chart';

export default function ResultsContent() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const formulaId = searchParams.get('formulaId');

	const { stocks, formulaName, loading, error, refetch } = useFormulaResults(formulaId);

	// Initialize state from URL params
	const [viewMode, setViewMode] = useState<ViewMode>(
		(searchParams.get('view') as ViewMode) || 'table'
	);
	const [selectedStocks, setSelectedStocks] = useState<string[]>(
		searchParams.get('selected')?.split(',').filter(Boolean) || []
	);
	const [currentStockIndex, setCurrentStockIndex] = useState<number>(
		parseInt(searchParams.get('index') || '0', 10)
	);

	// Update URL when state changes
	useEffect(() => {
		if (!formulaId) return;

		const params = new URLSearchParams(searchParams.toString());
		params.set('formulaId', formulaId);
		params.set('view', viewMode);

		if (selectedStocks.length > 0) {
			params.set('selected', selectedStocks.join(','));
		} else {
			params.delete('selected');
		}

		if (viewMode === 'chart' && selectedStocks.length > 0) {
			params.set('index', currentStockIndex.toString());
		} else {
			params.delete('index');
		}

		const newUrl = `${pathname}?${params.toString()}`;
		router.replace(newUrl, { scroll: false });
	}, [viewMode, selectedStocks, currentStockIndex, formulaId, pathname, router, searchParams]);

	// Handle clearing cache and refetching
	const handleRefresh = () => {
		if (formulaId) {
			LocalStorageCache.remove(`formula-results:${formulaId}`);
			refetch();
		}
	};

	// Handle switching to chart view
	const handleViewCharts = () => {
		if (selectedStocks.length === 0) {
			alert('Please select at least one stock to view charts');
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
				<div>
					<h1 className='text-3xl font-bold tracking-tight'>Formula Results</h1>
					<p className='text-muted-foreground'>{formulaName}</p>
				</div>

				{/* View Toggle */}
				<div className='flex gap-2'>
					<Button
						variant='outline'
						size='sm'
						onClick={handleRefresh}
						disabled={loading}
						title='Clear cache and refresh data'
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
						disabled={selectedStocks.length === 0}
					>
						<BarChart3 className='h-4 w-4 mr-2' />
						Chart View
						{selectedStocks.length > 0 && ` (${selectedStocks.length})`}
					</Button>
				</div>
			</div>

			{/* View Content */}
			{viewMode === 'table' ? (
				<ResultsTable
					stocks={stocks}
					selectedStocks={selectedStocks}
					onSelectionChange={setSelectedStocks}
					onViewCharts={handleViewCharts}
				/>
			) : (
				<ChartView
					selectedStocks={selectedStocks}
					currentIndex={currentStockIndex}
					setCurrentIndex={setCurrentStockIndex}
					onBackToTable={handleBackToTable}
				/>
			)}
		</div>
	);
}
