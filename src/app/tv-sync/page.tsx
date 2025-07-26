'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '../../components/ui/input';
import { EditorWithClipboard } from '../../components/EditorWithClipboard';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { useToast } from '../../components/ui/toast';
import allNseStocks from '../../all_nse.json';

function parseMioSymbols(raw: string): string[] {
	return raw
		.trim()
		.split(/\s+/)
		.map((item) => item.split('|')[0])
		.filter(Boolean);
}

function toTV(symbol: string): string | null {
	if (symbol.endsWith('.NS')) return `NSE:${symbol.replace('.NS', '')}`;
	return null;
}

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

function groupSymbols(symbols: string[], groupBy: 'Sector' | 'Industry' | 'None'): string {
	if (groupBy === 'None') {
		return symbols.join(',');
	}
	const grouped: Record<string, string[]> = {};
	for (const symbol of symbols) {
		let lookup = symbol.replace(/^NSE:|^BSE:/, '');
		if (!lookup.endsWith('.NS')) lookup += '.NS';
		const info = symbolInfoMap[lookup] || symbolInfoMap[lookup.replace('.NS', '.BO')];
		const group = info?.[groupBy] || 'Other';
		if (!grouped[group]) grouped[group] = [];
		grouped[group].push(symbol);
	}
	return Object.entries(grouped)
		.map(([group, syms]) => `###${group},${syms.join(',')}`)
		.join(',');
}

const DEFAULT_SESSIONID = 'fr3qd6jw5y0vnq1c9s17857d1jsfz2pj';
const DEFAULT_URLS = [
	{ label: 'PPC_no_sma', value: 'https://api.marketinout.com/run/screen?key=eed4a72303564710' },
	{ label: 'Second Screener', value: 'https://api.marketinout.com/run/screen?key=79505328ba974866' },
];

export default function TvSyncPage() {
	const [grouping, setGrouping] = useState<'Sector' | 'Industry' | 'None'>('None');
	const [symbols, setSymbols] = useState<string[]>([]);
	const [output, setOutput] = useState('');
	const [sessionid, setSessionid] = useState(DEFAULT_SESSIONID);
	const [watchlistId, setWatchlistId] = useState('');
	const [watchlists, setWatchlists] = useState<{ id: string; name: string }[]>([]);
	const [urls, setUrls] = useState([DEFAULT_URLS[0].value]);
	const [loading, setLoading] = useState(false);
	const toast = useToast();

	useEffect(() => {
		if (!sessionid) return;
		async function fetchWatchlists() {
			toast('Fetching TradingView watchlists...');
			const res = await fetch('/api/proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: 'https://www.tradingview.com/api/v1/symbols_list/all/',
					method: 'GET',
					headers: {
						'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
						Cookie: `sessionid=${sessionid}`,
						Accept: 'application/json',
					},
				}),
			});
			if (!res.ok) {
				toast('Failed to fetch watchlists', 'error');
				return;
			}
			const { data } = await res.json();
			setWatchlists(Array.isArray(data) ? data.map((w: any) => ({ id: w.id, name: w.name })) : []);
			toast('Fetched watchlists.', 'success');
		}
		fetchWatchlists();
	}, [sessionid]);

	const handleUrlChange = (i: number, value: string) => {
		const next = [...urls];
		next[i] = value;
		setUrls(next);
	};

	const addUrl = () => setUrls([...urls, '']);
	const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i));

	async function fetchMioSymbols(url: string): Promise<string[]> {
		const res = await fetch('/api/proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url,
				method: 'GET',
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
					Accept: 'text/plain',
				},
			}),
		});
		if (!res.ok) {
			toast(`Failed to fetch: ${url}`, 'error');
			return [];
		}
		const { data } = await res.json();
		/* Remove noisy toast for raw API response */
		// toast(`Raw API response from ${url}: ${data}`);
		return parseMioSymbols(data);
	}

	async function cleanUpWatchlist() {
		toast('Cleaning up watchlist...');
		const cleanupRes = await fetch('/api/proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url: `https://www.tradingview.com/api/v1/symbols_list/custom/${watchlistId}/replace/?unsafe=true`,
				method: 'POST',
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
					'Content-Type': 'application/json',
					Cookie: `sessionid=${sessionid}`,
					Origin: 'https://www.tradingview.com',
				},
				body: JSON.stringify([]),
			}),
		});
		if (!cleanupRes.ok) {
			const { error, data } = await cleanupRes.json().catch(() => ({}));
			toast(`Failed to clean up watchlist: ${error || data || cleanupRes.statusText}`, 'error');
			return;
		}
		toast('Watchlist cleaned up.', 'success');
	}

	async function appendToWatchlist(symbols: string[]) {
		// Always send a flat array of symbols to TradingView append API
		const payload = output;
		toast(`Appending symbols to TradingView: ${JSON.stringify(payload)}`);
		const res = await fetch('/api/proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url: `https://www.tradingview.com/api/v1/symbols_list/custom/${watchlistId}/append/`,
				method: 'POST',
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
					'Content-Type': 'application/json',
					Cookie: `sessionid=${sessionid}`,
					Origin: 'https://www.tradingview.com',
				},
				body: JSON.stringify(payload),
			}),
		});
		const respText = await res.text();
		toast(`TradingView response: ${respText}`);
		if (!res.ok) {
			toast(`Failed to append symbols: ${respText}`, 'error');
			return;
		}
		toast('Symbols appended successfully.', 'success');
	}

	// Fetch and group symbols when URLs or grouping changes
	useEffect(() => {
		async function updateSymbolsAndOutput() {
			let allSymbols: string[] = [];
			for (const url of urls.filter((u) => u.trim())) {
				const mioSymbols = await fetchMioSymbols(url);
				allSymbols = allSymbols.concat(mioSymbols);
			}
			const tvSymbols = allSymbols.map(toTV).filter(Boolean) as string[];
			setSymbols(tvSymbols);
			setOutput(groupSymbols(tvSymbols, grouping));
		}
		updateSymbolsAndOutput();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [urls, grouping]);

	return (
		<div className='font-sans max-w-xl mx-auto my-8'>
			<h2 className='text-xl font-bold mb-4'>TradingView Screener Sync</h2>
			<div className='mb-4'>
				<Label htmlFor='sessionid'>TradingView sessionid:</Label>
				<Input
					id='sessionid'
					value={sessionid}
					onChange={(e) => setSessionid(e.target.value)}
					className='w-full mt-1'
				/>
			</div>
			<div className='mb-4'>
				<Label htmlFor='watchlist'>TradingView Watchlist:</Label>
				<Select value={watchlistId} onValueChange={setWatchlistId}>
					<SelectTrigger className='w-full mt-1' id='watchlist'>
						<SelectValue placeholder='Select a watchlist' />
					</SelectTrigger>
					<SelectContent>
						{watchlists.map((w) => (
							<SelectItem key={w.id} value={w.id}>
								{w.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className='mb-4 flex gap-4 items-center'>
				<div>
					<Label htmlFor='grouping'>Group by</Label>
					<Select value={grouping} onValueChange={(v) => setGrouping(v as 'Sector' | 'Industry' | 'None')}>
						<SelectTrigger id='grouping' className='w-32 mt-1'>
							<SelectValue placeholder='Select group' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='Sector'>Sector</SelectItem>
							<SelectItem value='Industry'>Industry</SelectItem>
							<SelectItem value='None'>None</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
			<div className='mb-4'>
				<Label>Symbols to Add</Label>
				<EditorWithClipboard
					id='output-editor'
					label=''
					value={output}
					readOnly
					showCopy
					className='min-h-[120px] font-mono text-base shadow-md mb-2'
				/>
			</div>
			<div className='mb-4'>
				<Label>Screener URLs:</Label>
				{urls.map((url, i) => (
					<div key={i} className='flex items-center mb-1 gap-2'>
						<Select value={url} onValueChange={(val) => handleUrlChange(i, val)}>
							<SelectTrigger className='flex-1 min-w-0'>
								<SelectValue placeholder='Custom URL' />
							</SelectTrigger>
							<SelectContent>
								{DEFAULT_URLS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Input
							value={url}
							onChange={(e) => handleUrlChange(i, e.target.value)}
							className='flex-2 min-w-0'
							placeholder='Paste or edit API URL'
						/>
						<Button
							type='button'
							variant='destructive'
							onClick={() => removeUrl(i)}
							disabled={urls.length === 1}
							className='ml-2'
						>
							-
						</Button>
					</div>
				))}
				<Button type='button' onClick={addUrl} className='mt-2'>
					Add URL
				</Button>
			</div>
			<div className='flex gap-2 mb-4'>
				<Button onClick={() => appendToWatchlist(symbols)} disabled={loading || !watchlistId} className='flex-1'>
					{loading ? 'Syncing...' : 'Sync'}
				</Button>
				<Button variant='secondary' onClick={cleanUpWatchlist} disabled={loading || !watchlistId} className='flex-1'>
					Clean Up Watchlist
				</Button>
			</div>
			{/* Logs removed */}
		</div>
	);
}
