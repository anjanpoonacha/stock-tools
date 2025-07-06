'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Watchlist = {
	id: number;
	name: string;
	symbols: string[];
};

export default function ShortlistFetcher() {
	const [cookie, setCookie] = useState('');
	const [loading, setLoading] = useState(false);
	const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [error, setError] = useState('');
	const [url, setUrl] = useState('https://www.tradingview.com/api/v1/symbols_list/all/');

	const handleFetch = async () => {
		setLoading(true);
		setError('');
		setWatchlists([]);
		setSelectedId(null);
		try {
			const res = await fetch('/api/tv-shortlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url, cookie }),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			// data.symbols is now an array of symbols for "Shortlist" only
			// But we want to support all watchlists, so expect data.watchlists
			const lists: Watchlist[] =
				data.watchlists || ([{ id: 134340368, name: 'Shortlist', symbols: data.symbols }] as Watchlist[]);
			setWatchlists(lists);
			if (lists.length > 0) setSelectedId(lists[0].id);
		} catch (e: any) {
			setError(e.message || 'Unknown error');
		} finally {
			setLoading(false);
		}
	};

	const selected = watchlists.find((w) => w.id === selectedId);

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
					<Label htmlFor='watchlist-select'>Select Watchlist</Label>
					<Select value={selectedId?.toString() ?? ''} onValueChange={(v) => setSelectedId(Number(v))}>
						<SelectTrigger id='watchlist-select' className='w-full'>
							<SelectValue placeholder='Choose a watchlist' />
						</SelectTrigger>
						<SelectContent>
							{watchlists.map((w) => (
								<SelectItem key={w.id} value={w.id.toString()}>
									{w.name || `Watchlist ${w.id}`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{selected && (
						<>
							<Label>Symbols (comma separated)</Label>
							<EditorWithClipboard
								id='shortlist-output'
								label=''
								value={selected.symbols.join(', ')}
								readOnly
								showCopy
								className='font-mono text-sm mt-1'
								disabledCopy={selected.symbols.length === 0}
							/>
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
					<li>Paste it above and click "Fetch Watchlists".</li>
				</ol>
				<span className='block mt-2 text-yellow-700'>Never share your session cookie with untrusted parties.</span>
			</div>
		</div>
	);
}
