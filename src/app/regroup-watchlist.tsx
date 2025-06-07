'use client';

import { useState } from 'react';
import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import allNseStocks from '../all_nse.json';

// Build a symbol map for fast lookup
const symbolInfoMap: Record<string, { Industry?: string; Sector?: string }> = (() => {
	const map: Record<string, { Industry?: string; Sector?: string }> = {};
	(allNseStocks as any[]).forEach((entry) => {
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
function regroupTVWatchlist(input: string, toGroup: 'Sector' | 'Industry'): string {
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

export default function RegroupWatchlistPage() {
	const [input, setInput] = useState('');
	const [toGroup, setToGroup] = useState<'Sector' | 'Industry'>('Industry');
	const [output, setOutput] = useState('');

	const handleConvert = () => {
		setOutput(regroupTVWatchlist(input, toGroup));
	};

	return (
		<div className='flex items-center justify-center min-h-screen bg-background px-2'>
			<div className='w-full bg-card rounded-xl shadow-lg p-4 flex flex-col gap-4'>
				<h1 className='text-2xl font-bold mb-2 text-center'>Regroup TradingView Watchlist</h1>
				<EditorWithClipboard
					id='tv-input'
					label='TV Watchlist Input'
					value={input}
					onChange={setInput}
					placeholder='Paste your TradingView sectioned/grouped watchlist here...'
					showPaste
					className='min-h-[120px] font-mono text-base shadow-md mb-4'
				/>
				<div className='flex flex-wrap gap-4 items-center'>
					<div>
						<Label htmlFor='to-group'>Group by</Label>
						<Select value={toGroup} onValueChange={(v) => setToGroup(v as any)}>
							<SelectTrigger id='to-group' className='w-32'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='Sector'>Sector</SelectItem>
								<SelectItem value='Industry'>Industry</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<button
						className='bg-primary text-primary-foreground rounded px-4 py-2 font-semibold shadow hover:bg-primary/90 transition'
						onClick={handleConvert}
						type='button'
					>
						Convert
					</button>
				</div>
				<EditorWithClipboard
					id='tv-output'
					label='Regrouped TV Watchlist Output'
					value={output}
					readOnly
					showCopy
					className='min-h-[120px] font-mono text-base bg-muted/50 shadow-inner'
					disabledCopy={!output}
				/>
			</div>
		</div>
	);
}
