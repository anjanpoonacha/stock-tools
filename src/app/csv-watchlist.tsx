'use client';

import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadTextFile } from '@/lib/utils';
import { useMemo, useState } from 'react';

// Helper to parse CSV
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
	const lines = text.trim().split(/\r?\n/).filter(Boolean);
	if (lines.length === 0) return { headers: [], rows: [] };
	const headers = lines[0].split(',').map((h) => h.trim());
	const rows = lines.slice(1).map((line) => line.split(',').map((v) => v.trim()));
	return { headers, rows };
}

// Helper to group rows by a column
function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
	return rows.reduce((acc, row) => {
		const group = String(row[key] || 'Other');
		if (!acc[group]) acc[group] = [];
		acc[group].push(row);
		return acc;
	}, {} as Record<string, T[]>);
}

// Helper to convert symbol to TV format
function toTVSymbol(symbol: string | undefined) {
	if (!symbol) return '';
	if (typeof symbol !== 'string') return '';
	if (symbol.endsWith('.NS')) return 'NSE:' + symbol.replace(/\.NS$/, '');
	if (symbol.endsWith('.BS')) return 'BSE:' + symbol.replace(/\.BS$/, '');
	return symbol;
}

export default function CsvWatchlistPage() {
	const [csv, setCsv] = useState('');
	const [groupByCol, setGroupByCol] = useState<string>('Sector');
	const [sortCol, setSortCol] = useState<string>('Symbol');
	const [error, setError] = useState<string | null>(null);

	const { headers, rows } = useMemo(() => parseCSV(csv), [csv]);
	const rowObjs = useMemo(
		() => rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || '']))),
		[headers, rows]
	);

	// Sort rows
	const sortedRows = useMemo(() => {
		if (!sortCol) return rowObjs;
		return [...rowObjs].sort((a, b) => (a[sortCol] || '').localeCompare(b[sortCol] || ''));
	}, [rowObjs, sortCol]);

	// Group rows
	const grouped = useMemo(
		() => groupBy(sortedRows, (groupByCol as keyof (typeof sortedRows)[0]) ?? 'Sector'),
		[sortedRows, groupByCol]
	);

	// TV Watchlist output
	const tvWatchlist = useMemo(() => {
		try {
			setError(null);
			return Object.entries(grouped)
				.map(
					([group, items]) =>
						`###${group},${items
							.map((row) => toTVSymbol(row.Symbol))
							.filter(Boolean)
							.join(',')}`
				)
				.join('');
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Unknown error';
			setError('Error converting symbols: ' + message);
			return '';
		}
	}, [grouped]);

	const handleDownload = () => {
		downloadTextFile(tvWatchlist, 'tv-watchlist.txt');
	};

	return (
		<div className='flex items-center justify-center min-h-screen bg-background px-2'>
			<div className='w-full bg-card rounded-xl shadow-lg p-4 flex flex-col gap-4'>
				<h1 className='text-2xl font-bold mb-2 text-center'>CSV to TradingView Watchlist</h1>
				{error && <div className='text-red-500 mb-2 text-sm font-mono'>{error}</div>}
				<EditorWithClipboard
					id='csv-input'
					label='CSV Input'
					value={csv}
					onChange={setCsv}
					onPaste={setCsv}
					placeholder='Paste or type your CSV here...'
					showPaste
					className='min-h-[120px] font-mono text-base shadow-md mb-4'
				/>
				<EditorWithClipboard
					id='tv-output'
					label='TV Output'
					value={tvWatchlist}
					readOnly
					showCopy
					showDownload
					onDownload={handleDownload}
					className='min-h-[120px] font-mono text-base bg-muted/50 shadow-inner'
					disabledCopy={!tvWatchlist}
				/>
				{headers.length > 0 && (
					<div className='flex flex-wrap gap-4 items-center mt-4'>
						<div>
							<Label htmlFor='group-by'>Group by</Label>
							<Select value={groupByCol} onValueChange={setGroupByCol}>
								<SelectTrigger id='group-by' className='w-40'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{headers.filter(Boolean).map((h) => (
										<SelectItem key={h} value={h}>
											{h}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label htmlFor='sort-by'>Sort by</Label>
							<Select value={sortCol} onValueChange={setSortCol}>
								<SelectTrigger id='sort-by' className='w-40'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{headers.filter(Boolean).map((h) => (
										<SelectItem key={h} value={h}>
											{h}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				)}
				{headers.length > 0 && (
					<div className='overflow-x-auto rounded border bg-muted mt-2'>
						<Table>
							<TableHeader>
								<TableRow>
									{headers.map((h) => (
										<TableHead key={h}>{h}</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedRows.map((row, i) => (
									<TableRow key={i}>
										{headers.map((h) => (
											<TableCell key={h}>{row[h]}</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}
