'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { Stock } from '@/types/stock';
import { getFormulaResultsPreferences, updateFormulaResultsPreferences } from '@/lib/utils/userPreferences';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Filter } from 'lucide-react';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

interface ResultsTableProps {
	stocks: Stock[];
	selectedStocks: string[];
	onSelectionChange: (selected: string[]) => void;
	onViewCharts: () => void;
}

type SortField = 'symbol' | 'name' | 'price' | 'sector' | 'industry';
type SortOrder = 'asc' | 'desc';
type GroupBy = 'none' | 'sector' | 'industry';

export default function ResultsTable({
	stocks,
	selectedStocks,
	onSelectionChange,
	onViewCharts,
}: ResultsTableProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Load user preferences
	const userPrefs = getFormulaResultsPreferences();

	// Initialize state with priority: URL params > User preferences > Defaults
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

	// Save user preferences when sort/group settings change
	useEffect(() => {
		updateFormulaResultsPreferences({
			sortBy: sortField,
			sortOrder: sortOrder,
			groupBy: groupBy,
		});
	}, [sortField, sortOrder, groupBy]);

	// Update URL when state changes
	useEffect(() => {
		const params = new URLSearchParams(searchParams.toString());

		params.set('sortBy', sortField);
		params.set('sortOrder', sortOrder);
		params.set('groupBy', groupBy);

		if (sectorFilter !== 'all') {
			params.set('sector', sectorFilter);
		} else {
			params.delete('sector');
		}

		if (industryFilter !== 'all') {
			params.set('industry', industryFilter);
		} else {
			params.delete('industry');
		}

		const newUrl = `${pathname}?${params.toString()}`;
		router.replace(newUrl, { scroll: false });
	}, [sortField, sortOrder, groupBy, sectorFilter, industryFilter, pathname, router, searchParams]);

	// Extract unique sectors and industries
	const sectors = useMemo(() => {
		const unique = new Set(stocks.map(s => s.sector).filter(Boolean));
		return Array.from(unique).sort();
	}, [stocks]);

	const industries = useMemo(() => {
		const unique = new Set(stocks.map(s => s.industry).filter(Boolean));
		return Array.from(unique).sort();
	}, [stocks]);

	// Filter and sort stocks
	const filteredAndSortedStocks = useMemo(() => {
		// Filter
		let filtered = stocks.filter(stock => {
			if (sectorFilter !== 'all' && stock.sector !== sectorFilter) return false;
			if (industryFilter !== 'all' && stock.industry !== industryFilter) return false;
			return true;
		});

		// Sort
		filtered = filtered.sort((a, b) => {
			const aVal = a[sortField];
			const bVal = b[sortField];

			// Handle undefined values
			if (aVal === undefined) return 1;
			if (bVal === undefined) return -1;

			// String comparison
			if (typeof aVal === 'string' && typeof bVal === 'string') {
				return sortOrder === 'asc'
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}

			// Number comparison
			if (typeof aVal === 'number' && typeof bVal === 'number') {
				return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
			}

			return 0;
		});

		return filtered;
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

	const handleSelectAll = (checked: boolean) => {
		if (checked) {
			onSelectionChange(filteredAndSortedStocks.map(s => s.symbol));
		} else {
			onSelectionChange([]);
		}
	};

	const handleSelectStock = (symbol: string, checked: boolean) => {
		if (checked) {
			onSelectionChange([...selectedStocks, symbol]);
		} else {
			onSelectionChange(selectedStocks.filter(s => s !== symbol));
		}
	};

	const isAllSelected = filteredAndSortedStocks.length > 0 && selectedStocks.length === filteredAndSortedStocks.length;
	const isSomeSelected = selectedStocks.length > 0 && selectedStocks.length < filteredAndSortedStocks.length;

	return (
		<Card>
			<CardHeader>
				<div className='flex items-center justify-between'>
					<div>
						<CardTitle>Stock Results ({stocks.length})</CardTitle>
						<CardDescription>
							{selectedStocks.length > 0
								? `${selectedStocks.length} stock${selectedStocks.length !== 1 ? 's' : ''} selected`
								: 'Select stocks to view charts'}
							{filteredAndSortedStocks.length !== stocks.length && ` • ${filteredAndSortedStocks.length} filtered`}
						</CardDescription>
					</div>
					{selectedStocks.length > 0 && (
						<div className='flex gap-2'>
							<Button
								variant='outline'
								size='sm'
								onClick={() => onSelectionChange([])}
							>
								Clear Selection
							</Button>
							<Button size='sm' onClick={onViewCharts}>
								View Charts ({selectedStocks.length})
							</Button>
						</div>
					)}
				</div>

				{/* Filter Bar */}
				<div className='flex items-center gap-2 pt-4 flex-wrap'>
					<Filter className='h-4 w-4 text-muted-foreground' />
					<Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
						<SelectTrigger className='w-[140px] h-8'>
							<SelectValue placeholder='Group by' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='none'>No grouping</SelectItem>
							<SelectItem value='sector'>Group by Sector</SelectItem>
							<SelectItem value='industry'>Group by Industry</SelectItem>
						</SelectContent>
					</Select>

					<Select value={sectorFilter} onValueChange={setSectorFilter}>
						<SelectTrigger className='w-[180px] h-8'>
							<SelectValue placeholder='Filter sector' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All Sectors</SelectItem>
							{sectors.map(sector => (
								<SelectItem key={sector} value={sector || 'unknown'}>{sector}</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={industryFilter} onValueChange={setIndustryFilter}>
						<SelectTrigger className='w-[200px] h-8'>
							<SelectValue placeholder='Filter industry' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All Industries</SelectItem>
							{industries.map(industry => (
								<SelectItem key={industry} value={industry || 'unknown'}>{industry}</SelectItem>
							))}
						</SelectContent>
					</Select>

					{(sectorFilter !== 'all' || industryFilter !== 'all') && (
						<Button
							variant='ghost'
							size='sm'
							onClick={() => {
								setSectorFilter('all');
								setIndustryFilter('all');
							}}
							className='h-8 px-2 text-xs'
						>
							Clear Filters
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<div className='rounded-md border max-h-[600px] overflow-auto'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className='w-[50px]'>
									<Checkbox
										checked={isAllSelected}
										onCheckedChange={handleSelectAll}
										aria-label='Select all'
										className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
									/>
								</TableHead>
								<TableHead>
									<Button
										variant='ghost'
										size='sm'
										onClick={() => handleSort('symbol')}
										className='h-8 px-2'
									>
										Symbol
										<ArrowUpDown className='ml-2 h-4 w-4' />
									</Button>
								</TableHead>
								<TableHead>
									<Button
										variant='ghost'
										size='sm'
										onClick={() => handleSort('name')}
										className='h-8 px-2'
									>
										Name
										<ArrowUpDown className='ml-2 h-4 w-4' />
									</Button>
								</TableHead>
								<TableHead>
									<Button
										variant='ghost'
										size='sm'
										onClick={() => handleSort('sector')}
										className='h-8 px-2'
									>
										Sector
										<ArrowUpDown className='ml-2 h-4 w-4' />
									</Button>
								</TableHead>
								<TableHead>
									<Button
										variant='ghost'
										size='sm'
										onClick={() => handleSort('industry')}
										className='h-8 px-2'
									>
										Industry
										<ArrowUpDown className='ml-2 h-4 w-4' />
									</Button>
								</TableHead>
								<TableHead>
									<Button
										variant='ghost'
										size='sm'
										onClick={() => handleSort('price')}
										className='h-8 px-2'
									>
										Price
										<ArrowUpDown className='ml-2 h-4 w-4' />
									</Button>
								</TableHead>
								<TableHead>Change %</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredAndSortedStocks.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className='text-center text-muted-foreground py-8'>
										No stocks found
									</TableCell>
								</TableRow>
							) : (
								groupedStocks.map(({ group, stocks: groupStocks }) => (
									<React.Fragment key={group || 'no-group'}>
										{group && (
											<TableRow className='bg-muted/50'>
												<TableCell colSpan={7} className='font-semibold py-2'>
													{group} ({groupStocks.length})
												</TableCell>
											</TableRow>
										)}
										{groupStocks.map(stock => (
											<TableRow key={stock.symbol}>
												<TableCell>
													<Checkbox
														checked={selectedStocks.includes(stock.symbol)}
														onCheckedChange={(checked) =>
															handleSelectStock(stock.symbol, checked === true)
														}
														aria-label={`Select ${stock.symbol}`}
													/>
												</TableCell>
												<TableCell className='font-medium'>
													<Badge variant='outline'>{stock.symbol}</Badge>
												</TableCell>
												<TableCell>{stock.name}</TableCell>
												<TableCell className='text-muted-foreground'>
													{stock.sector || '-'}
												</TableCell>
												<TableCell className='text-muted-foreground'>
													{stock.industry || '-'}
												</TableCell>
												<TableCell>
													{stock.price !== undefined ? `₹${stock.price.toFixed(2)}` : '-'}
												</TableCell>
												<TableCell>
													{stock.priceChange !== undefined ? (
														<span
															className={
																stock.priceChange >= 0
																	? 'text-green-600'
																	: 'text-red-600'
															}
														>
															{stock.priceChange >= 0 ? '+' : ''}
															{stock.priceChange.toFixed(2)}%
														</span>
													) : (
														'-'
													)}
												</TableCell>
											</TableRow>
										))}
									</React.Fragment>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
