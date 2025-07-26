'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import allNseStocks from '../all_nse.json';

// Build a symbol map for fast lookup
const symbolInfoMap: Record<string, { Industry?: string; Sector?: string }> = (() => {
	const map: Record<string, { Industry?: string; Sector?: string }> = {};
	(allNseStocks as Array<{ Symbol: string; Industry?: string; Sector?: string }>).forEach((entry) => {
		if (entry.Symbol) {
			map[entry.Symbol] = {
				Industry: entry.Industry,
				Sector: entry.Sector,
			};
		}
	});
	return map;
})();

// Regroup a TradingView watchlist string from one grouping to another (e.g., Sector -> Industry)
export function regroupTVWatchlist(input: string, toGroup: 'Sector' | 'Industry'): string {
	// Parse the input into groups
	const groupRegex = /###([^,]+),([^#]*)/g;
	let match;
	const symbolList: { symbol: string; group: string }[] = [];
	while ((match = groupRegex.exec(input))) {
		const group = match[1].trim();
		const symbols = match[2]
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		for (const symbol of symbols) {
			symbolList.push({ symbol, group });
		}
	}
	// If no groups found, treat as flat list
	if (symbolList.length === 0) {
		const flatSymbols = input
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		for (const symbol of flatSymbols) {
			symbolList.push({ symbol, group: '' });
		}
	}
	// Map each symbol to its new group using all_nse.json
	const regrouped: Record<string, string[]> = {};
	for (const { symbol } of symbolList) {
		// Remove NSE:/BSE: prefix for lookup
		let lookup = symbol.replace(/^NSE:|^BSE:/, '');
		if (!lookup.endsWith('.NS')) lookup += '.NS'; // Try .NS if not present
		const info = symbolInfoMap[lookup] || symbolInfoMap[lookup.replace('.NS', '.BO')];
		const newGroup = info?.[toGroup] || 'Other';
		if (!regrouped[newGroup]) regrouped[newGroup] = [];
		regrouped[newGroup].push(symbol);
	}
	// Build the output string
	return Object.entries(regrouped)
		.map(([group, symbols]) => `###${group},${symbols.join(',')}`)
		.join(',');
}

type RegroupOption = 'Industry' | 'Sector' | 'None';

export function RegroupBar({ value, onRegroup }: { value: string; onRegroup: (output: string) => void }) {
	const [groupBy, setGroupBy] = useState<RegroupOption>('None');

	const handleRegroup = () => {
		if (groupBy === 'None') {
			const flat = value
				.replace(/###([^,]+),/g, '')
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
				.join(',');
			onRegroup(flat);
		} else {
			onRegroup(regroupTVWatchlist(value, groupBy));
		}
	};

	return (
		<div className='flex flex-wrap gap-2 items-center my-2'>
			<Label htmlFor='group-by'>Group by</Label>
			<Select value={groupBy} onValueChange={(v) => setGroupBy(v as RegroupOption)}>
				<SelectTrigger id='group-by' className='w-32'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value='Industry'>Industry</SelectItem>
					<SelectItem value='Sector'>Sector</SelectItem>
					<SelectItem value='None'>None</SelectItem>
				</SelectContent>
			</Select>
			<button
				className='bg-primary text-primary-foreground rounded px-4 py-2 font-semibold shadow hover:bg-primary/90 transition'
				onClick={handleRegroup}
				type='button'
			>
				Regroup
			</button>
		</div>
	);
}
