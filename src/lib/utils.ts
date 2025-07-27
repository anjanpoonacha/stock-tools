import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// --- Grouping Logic (moved from RegroupBar) ---

import allNseStocks from '../all_nse.json';

export type RegroupOption = 'Industry' | 'Sector' | 'None';

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

export function regroupTVWatchlist(input: string, toGroup: RegroupOption): string {
	if (toGroup === 'None') {
		// Flat list, remove group headers
		return input
			.replace(/###([^,]+),/g, '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
			.join(',');
	}
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

export function downloadTextFile(text: string, filename: string) {
	if (!text) return;
	const blob = new Blob([text], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 0);
}
