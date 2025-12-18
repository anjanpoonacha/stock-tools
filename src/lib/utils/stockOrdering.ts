/**
 * Stock Ordering Utility
 * 
 * Centralized logic for filtering and sorting stocks.
 * Ensures consistent ordering across table view and chart view.
 */

import type { Stock } from '@/types/stock';

export type SortField = 'symbol' | 'name' | 'price' | 'sector' | 'industry';
export type SortOrder = 'asc' | 'desc';

export interface StockOrderingOptions {
	sortField: SortField;
	sortOrder: SortOrder;
	sectorFilter?: string;
	industryFilter?: string;
}

/**
 * Filter and sort stocks using consistent logic
 * 
 * @param stocks - Array of stocks to process
 * @param options - Filtering and sorting options
 * @returns Filtered and sorted array of stocks
 */
export function filterAndSortStocks(
	stocks: Stock[],
	options: StockOrderingOptions
): Stock[] {
	const { sortField, sortOrder, sectorFilter, industryFilter } = options;

	// 1. Filter by sector and industry
	let filtered = stocks.filter(stock => {
		if (sectorFilter && sectorFilter !== 'all' && stock.sector !== sectorFilter) {
			return false;
		}
		if (industryFilter && industryFilter !== 'all' && stock.industry !== industryFilter) {
			return false;
		}
		return true;
	});

	// 2. Sort by specified field and order
	filtered = filtered.sort((a, b) => {
		const aVal = a[sortField];
		const bVal = b[sortField];

		// Handle undefined values (push to end)
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
}
