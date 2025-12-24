'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { Stock } from '@/types/stock';
import { getFormulaResultsPreferences, updateFormulaResultsPreferences } from '@/lib/utils/userPreferences';
import { filterAndSortStocks, type SortField, type SortOrder } from '@/lib/utils/stockOrdering';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Filter, BarChart3 } from 'lucide-react';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

interface ResultsTableProps {
	stocks: Stock[];
	onViewCharts: () => void;
}

type GroupBy = 'none' | 'sector' | 'industry';

export default function ResultsTable({
	stocks,
	onViewCharts,
}: ResultsTableProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Load user preferences
	const userPrefs = getFormulaResultsPreferences();

	// Initialize state from URL or user preferences
	const [sortField, setSortField] = useState<SortField>(
		(searchParams.get('sortBy') as SortField) || userPrefs.sortBy || 'symbol'
	);
	const [sortOrder, setSortOrder] = useState<SortOrder>(
		(searchParams.get('sortOrder') as SortOrder) || userPrefs.sortOrder || 'asc'
	);
	const [groupBy, setGroupBy] = useState<GroupBy>(
		(searchParams.get('groupBy') as GroupBy) || userPrefs.groupBy || 'none'
	);
	const [sectorFilter, setSectorFilter] = useState<string>(
		searchParams.get('sector') || 'all'
	);
	const [industryFilter, setIndustryFilter] = useState<string>(
		searchParams.get('industry') || 'all'
	);

	// Update URL when sort/filter changes
	useEffect(() => {
		const params = new URLSearchParams(searchParams.toString());
		
		params.set('sortBy', sortField);
		params.set('sortOrder', sortOrder);
		params.set('groupBy', groupBy);
		
		if (sectorFilter === 'all') {
			params.delete('sector');
		} else {
			params.set('sector', sectorFilter);
		}
		
		if (industryFilter === 'all') {
			params.delete('industry');
		} else {
			params.set('industry', industryFilter);
		}
		
		const newUrl = `${pathname}?${params.toString()}`;
		
		// Guard: Only update URL if it actually changed to prevent unnecessary re-renders
		const currentUrl = `${pathname}?${searchParams.toString()}`;
		if (newUrl !== currentUrl) {
			router.replace(newUrl, { scroll: false });
		}
		
		// Save to user preferences
		updateFormulaResultsPreferences({ sortBy: sortField, sortOrder, groupBy });
		
		// NOTE: searchParams is intentionally excluded from dependencies to prevent infinite loops.
		// searchParams is read once during mount (state initialization lines 47-61).
		// This effect should only run when state values change, not when URL changes externally.
		// In production, router.replace() creates new searchParams instances, causing infinite loops.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sortField, sortOrder, groupBy, sectorFilter, industryFilter, pathname, router]);

	// Extract unique sectors and industries
	const sectors = useMemo(() => {
		const unique = new Set(stocks.map(s => s.sector).filter(Boolean));
		return Array.from(unique).sort();
	}, [stocks]);

	const industries = useMemo(() => {
		const unique = new Set(stocks.map(s => s.industry).filter(Boolean));
		return Array.from(unique).sort();
	}, [stocks]);

	// Filter and sort stocks using centralized utility
	const filteredAndSortedStocks = useMemo(() => {
		return filterAndSortStocks(stocks, {
			sortField,
			sortOrder,
			sectorFilter,
			industryFilter,
		});
	}, [stocks, sortField, sortOrder, sectorFilter, industryFilter]);

	// Group stocks
	const groupedStocks = useMemo(() => {
		if (groupBy === 'none') {
			return [{ group: null, stocks: filteredAndSortedStocks }];
		}

		const groups: Record<string, Stock[]> = {};
		filteredAndSortedStocks.forEach(stock => {
			const groupKey = groupBy === 'sector' ? (stock.sector || 'Other') : (stock.industry || 'Other');
			if (!groups[groupKey]) groups[groupKey] = [];
			groups[groupKey].push(stock);
		});

		return Object.entries(groups)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([group, stocks]) => ({ group, stocks }));
	}, [filteredAndSortedStocks, groupBy]);

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
		} else {
			setSortField(field);
			setSortOrder('asc');
		}
	};

	if (stocks.length === 0) {
		return (
			<Card>
				<CardContent className='py-8'>
					<div className='text-center text-muted-foreground'>
						<p>No stocks found</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className='h-full flex flex-col overflow-hidden'>
			{/* Filters and Controls - Fixed at top */}
			<Card className='flex-shrink-0 m-4 mb-2'>
				<CardHeader className='py-3'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-4'>
							<div className='flex items-center gap-2'>
								<Filter className='h-4 w-4 text-muted-foreground' />
								<span className='text-sm font-medium'>Filters:</span>
							</div>
							
							<Select value={sectorFilter} onValueChange={setSectorFilter}>
								<SelectTrigger className='h-8 w-[180px]'>
									<SelectValue placeholder='All Sectors' />
								</SelectTrigger>
								<SelectContent>
							<SelectItem value='all'>All Sectors</SelectItem>
							{sectors.map(sector => (
								<SelectItem key={sector || 'unknown'} value={sector || 'unknown'}>
									{sector}
								</SelectItem>
							))}
								</SelectContent>
							</Select>
							
							<Select value={industryFilter} onValueChange={setIndustryFilter}>
								<SelectTrigger className='h-8 w-[180px]'>
									<SelectValue placeholder='All Industries' />
								</SelectTrigger>
								<SelectContent>
							<SelectItem value='all'>All Industries</SelectItem>
							{industries.map(industry => (
								<SelectItem key={industry || 'unknown'} value={industry || 'unknown'}>
									{industry}
								</SelectItem>
							))}
								</SelectContent>
							</Select>
							
							<Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
								<SelectTrigger className='h-8 w-[140px]'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>No Grouping</SelectItem>
									<SelectItem value='sector'>Group by Sector</SelectItem>
									<SelectItem value='industry'>Group by Industry</SelectItem>
								</SelectContent>
							</Select>
						</div>
						
						<Button
							onClick={onViewCharts}
							size='sm'
							disabled={filteredAndSortedStocks.length === 0}
						>
							<BarChart3 className='h-4 w-4 mr-2' />
							View Charts ({filteredAndSortedStocks.length})
						</Button>
					</div>
				</CardHeader>
			</Card>

			{/* Scrollable Table Area */}
			<div className='flex-1 min-h-0 overflow-y-auto px-4'>
				<div className='space-y-4 pb-4'>
				{groupedStocks.map((group, groupIndex) => (
					<Card key={groupIndex}>
						{group.group && (
							<CardHeader className='py-2 px-4'>
								<CardTitle className='text-base'>{group.group}</CardTitle>
								<CardDescription className='text-xs'>
									{group.stocks.length} stocks
								</CardDescription>
							</CardHeader>
						)}
						<CardContent className='p-0'>
							<div className='overflow-x-auto'>
								<Table>
									<TableHeader className='sticky top-0 z-10 bg-background'>
										<TableRow className='border-b-2'>
											<TableHead className='w-[40px] text-center bg-background'>#</TableHead>
											<TableHead className='bg-background'>
												<Button
													variant='ghost'
													size='sm'
													className='h-8 px-2'
													onClick={() => handleSort('symbol')}
												>
													Symbol
													<ArrowUpDown className='ml-2 h-3 w-3' />
												</Button>
											</TableHead>
											<TableHead className='bg-background'>
												<Button
													variant='ghost'
													size='sm'
													className='h-8 px-2'
													onClick={() => handleSort('name')}
												>
													Name
													<ArrowUpDown className='ml-2 h-3 w-3' />
												</Button>
											</TableHead>
											<TableHead className='bg-background'>
												<Button
													variant='ghost'
													size='sm'
													className='h-8 px-2'
													onClick={() => handleSort('price')}
												>
													Price
													<ArrowUpDown className='ml-2 h-3 w-3' />
												</Button>
											</TableHead>
											<TableHead className='bg-background'>
												<Button
													variant='ghost'
													size='sm'
													className='h-8 px-2'
													onClick={() => handleSort('sector')}
												>
													Sector
													<ArrowUpDown className='ml-2 h-3 w-3' />
												</Button>
											</TableHead>
											<TableHead className='bg-background'>
												<Button
													variant='ghost'
													size='sm'
													className='h-8 px-2'
													onClick={() => handleSort('industry')}
												>
													Industry
													<ArrowUpDown className='ml-2 h-3 w-3' />
												</Button>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{group.stocks.map((stock, index) => (
											<TableRow key={stock.symbol}>
												<TableCell className='text-center text-muted-foreground text-xs'>
													{index + 1}
												</TableCell>
												<TableCell className='font-mono text-sm'>
													<Badge variant='outline'>{stock.symbol}</Badge>
												</TableCell>
												<TableCell>{stock.name}</TableCell>
												<TableCell className='font-mono'>
													{stock.price ? `₹${stock.price.toFixed(2)}` : 'N/A'}
												</TableCell>
												<TableCell>
													<Badge variant='secondary' className='text-xs'>
														{stock.sector || 'N/A'}
													</Badge>
												</TableCell>
												<TableCell>
													<Badge variant='outline' className='text-xs'>
														{stock.industry || 'N/A'}
													</Badge>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>
				))}

				{/* Summary Footer */}
				{filteredAndSortedStocks.length > 0 && (
					<div className='flex justify-between items-center text-sm text-muted-foreground py-4'>
						<span>
							Showing {filteredAndSortedStocks.length} of {stocks.length} stocks
						</span>
						<span>
							Sorted by {sortField} ({sortOrder})
						</span>
					</div>
				)}
				</div>
			</div>
		</div>
	);
}
