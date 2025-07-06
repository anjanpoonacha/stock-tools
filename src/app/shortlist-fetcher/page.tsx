'use client';

import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { RegroupBar } from '@/components/RegroupBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';
// import {  } from '@/components/ui/multiselect'; // You need to add this component or use a library

type Watchlist = {
	id: number;
	name: string;
	symbols: string[];
};

const SESSION_KEY = 'tv_sessionid';

export default function ShortlistFetcher() {
	const [cookie, setCookie] = useState('');
	const [loading, setLoading] = useState(false);
	const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
	const [selectedIds, setSelectedIds] = useState<number[]>([]);
	const [error, setError] = useState('');
	const [url, setUrl] = useState('https://www.tradingview.com/api/v1/symbols_list/all/');
	const [regrouped, setRegrouped] = useState('');

	// Load sessionid from localStorage on mount
	useEffect(() => {
		const stored = localStorage.getItem(SESSION_KEY);
		if (stored) setCookie(stored);
	}, []);

	// Store sessionid in localStorage when changed
	useEffect(() => {
		if (cookie) localStorage.setItem(SESSION_KEY, cookie);
	}, [cookie]);

	const handleFetch = async () => {
		setLoading(true);
		setError('');
		setWatchlists([]);
		setSelectedIds([]);
		try {
			const res = await fetch('/api/tv-shortlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url, cookie }),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			const lists: Watchlist[] = data.watchlists || [];
			setWatchlists(lists);

			// Prefer "Shortlist" by name, else select all by default
			const shortlist = lists.find((w) => w.name?.toLowerCase() === 'shortlist');
			if (shortlist) setSelectedIds([shortlist.id]);
			else setSelectedIds(lists.map((w) => w.id));
		} catch (e) {
			if (e instanceof Error) setError(e.message);
			else setError('Unknown error');
		} finally {
			setLoading(false);
		}
	};

	const selectedWatchlists = watchlists.filter((w) => selectedIds.includes(w.id));
	const allSymbols = selectedWatchlists.flatMap((w) => w.symbols).join(', ');

	return (
		<div className='max-w-md mx-auto p-4 flex flex-col gap-4'>
			<h2 className='text-xl font-bold text-center'>Fetch TradingView Watchlists</h2>
			<Label htmlFor='cookie'>Paste your TradingView session cookie</Label>
			<Textarea
				id='cookie'
				value={cookie}
				onChange={(e) => setCookie(e.target.value)}
				placeholder='sessionid=xxxxxx; othercookie=...'
				className='font-mono text-sm'
				rows={3}
			/>
			<Label htmlFor='url'>API URL</Label>
			<Input id='url' value={url} onChange={(e) => setUrl(e.target.value)} className='font-mono text-xs' />
			<Button onClick={handleFetch} disabled={loading || !cookie} className='w-full'>
				{loading ? 'Fetching...' : 'Fetch Watchlists'}
			</Button>
			{error && <div className='text-red-600 text-sm'>{error}</div>}
			{watchlists.length > 0 && (
				<div className='flex flex-col gap-2'>
					<Label htmlFor='watchlist-multiselect'>Select Watchlists</Label>
					<MultiSelect
						id='watchlist-multiselect'
						options={watchlists.map((w) => ({
							label: w.name || `Watchlist ${w.id}`,
							value: w.id.toString(),
						}))}
						value={selectedIds.map(String)}
						onValueChange={(ids) => setSelectedIds(ids.map(Number))}
						placeholder='Choose one or more watchlists'
					/>
					<Label>All Selected Symbols (comma separated)</Label>
					<EditorWithClipboard
						id='shortlist-output'
						label=''
						value={allSymbols}
						readOnly
						showCopy
						className='font-mono text-sm mt-1'
						disabledCopy={allSymbols.length === 0}
					/>
					{/* RegroupBar integration */}
					{allSymbols && (
						<>
							<RegroupBar value={allSymbols} onRegroup={setRegrouped} />
							{regrouped && (
								<EditorWithClipboard
									id='regrouped-output'
									label='Regrouped Output'
									value={regrouped}
									readOnly
									showCopy
									className='min-h-[80px] font-mono text-base bg-muted/50 shadow-inner mt-2'
									disabledCopy={!regrouped}
								/>
							)}
						</>
					)}
				</div>
			)}
			<div className='text-xs text-muted-foreground mt-2'>
				<b>How to get your TradingView session cookie:</b>
				<ol className='list-decimal ml-5'>
					<li>Log in to tradingview.com in your browser.</li>
					<li>Open DevTools &rarr; Application &rarr; Cookies &rarr; tradingview.com.</li>
					<li>
						Copy the value of <code>sessionid</code> (and any other required cookies).
					</li>
					<li>Paste it above and click &quot;Fetch Watchlists&quot;.</li>
				</ol>
				<span className='block mt-2 text-yellow-700'>Never share your session cookie with untrusted parties.</span>
			</div>
		</div>
	);
}
