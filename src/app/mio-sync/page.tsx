'use client';
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { regroupTVWatchlist, RegroupOption } from '@/lib/utils';

const fetchWatchlistSymbols = async (watchlistId: string, sessionId: string) => {
	const res = await fetch('/api/proxy', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			url: `https://www.tradingview.com/api/v1/symbols_list/custom/${watchlistId}/`,
			method: 'GET',
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
				Cookie: `sessionid=${sessionId}`,
				Accept: 'application/json',
			},
		}),
	});
	if (!res.ok) throw new Error('Failed to fetch watchlist symbols');
	const { data } = await res.json();
	return Array.isArray(data?.symbols) ? data.symbols.map((s: any) => s.s) : [];
};

const convertToMioFormat = (symbols: string[]) => {
	return symbols
		.map((s) => {
			if (s.startsWith('NSE:')) return s.replace('NSE:', '') + '.NS';
			if (s.startsWith('BSE:')) return s.replace('BSE:', '') + '.BO';
			return s;
		})
		.join(',');
};

const MioSyncPage: React.FC = () => {
	const [tvWlid, setTvWlid] = useState('');
	const [mioWlid, setMioWlid] = useState('');
	const [customWlids, setCustomWlids] = useState<{ id: string; name: string }[]>(() => {
		if (typeof window !== 'undefined') {
			try {
				return JSON.parse(localStorage.getItem('mio_customWlids') || '[]');
			} catch {
				return [];
			}
		}
		return [];
	});
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [newWlid, setNewWlid] = useState('');
	const [newWlidName, setNewWlidName] = useState('');
	const [aspSessionId, setAspSessionId] = useState(() =>
		typeof window !== 'undefined' ? localStorage.getItem('mio_aspSessionId') || '' : ''
	);
	const [sessionId, setSessionId] = useState(() =>
		typeof window !== 'undefined' ? localStorage.getItem('mio_tvSessionId') || '' : ''
	);
	const [symbols, setSymbols] = useState('');
	const regroupOptions: { value: RegroupOption; label: string }[] = [
		{ value: 'Industry', label: 'Industry' },
		{ value: 'Sector', label: 'Sector' },
		{ value: 'None', label: 'None' },
	];
	const [groupBy, setGroupBy] = useState<RegroupOption>('None');
	const [response, setResponse] = useState('');
	const [loading, setLoading] = useState(false);
	const [watchlists, setWatchlists] = useState<{ id: string; name: string }[]>([]);
	const showToast = useToast();

	// Persist session IDs
	React.useEffect(() => {
		if (aspSessionId) localStorage.setItem('mio_aspSessionId', aspSessionId);
	}, [aspSessionId]);
	React.useEffect(() => {
		if (sessionId) localStorage.setItem('mio_tvSessionId', sessionId);
	}, [sessionId]);

	React.useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('mio_customWlids', JSON.stringify(customWlids));
		}
	}, [customWlids]);

	const fetchWatchlists = async () => {
		if (!sessionId) {
			showToast('TradingView sessionid required', 'error');
			return;
		}
		setLoading(true);
		try {
			const res = await fetch('/api/tradingview-watchlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionid: sessionId }),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			setWatchlists((data.watchlists || []).map((w: any) => ({ id: String(w.id), name: w.name })));
			showToast('Fetched TradingView watchlists.', 'success');
		} catch (err) {
			showToast('Failed to fetch watchlists from TradingView.', 'error');
		} finally {
			setLoading(false);
		}
	};

	React.useEffect(() => {
		fetchWatchlists();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionId]);

	React.useEffect(() => {
		if (!tvWlid || !sessionId) return;
		const fetchSymbols = async () => {
			try {
				const res = await fetch('/api/proxy', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						url: `https://www.tradingview.com/api/v1/symbols_list/custom/${tvWlid}/`,
						method: 'GET',
						headers: {
							'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
							Cookie: `sessionid=${sessionId}`,
							Accept: 'application/json',
						},
					}),
				});
				if (!res.ok) {
					showToast('Failed to fetch watchlist symbols. Check session ID.', 'error');
					setSymbols('');
					return;
				}
				const { data, status } = await res.json();
				// Debug: Show raw API response if no symbols
				if (!data?.symbols || !Array.isArray(data.symbols) || data.symbols.length === 0) {
					console.error('No symbols returned. Raw response:', data);
					showToast(`No symbols returned. Raw response: ${JSON.stringify(data).slice(0, 200)}`, 'error');
					setSymbols('');
					return;
				}
				try {
					const tvSymbols = Array.isArray(data.symbols) ? data.symbols : [];
					const mioSymbols = tvSymbols
						.map((s: string) => {
							if (typeof s !== 'string') {
								console.error('Invalid symbol entry:', s);
								return '';
							}
							if (s.startsWith('NSE:')) return s.replace('NSE:', '') + '.NS';
							if (s.startsWith('BSE:')) return s.replace('BSE:', '') + '.BO';
							return s;
						})
						.filter(Boolean)
						.join(',');
					setSymbols(mioSymbols);
				} catch (err) {
					console.error('Error processing symbols:', err, data?.symbols);
					showToast('Error processing symbols. See console for details.', 'error');
					setSymbols('');
				}
			} catch (err: any) {
				console.error('Error fetching symbols:', err);
				showToast('Error fetching symbols: ' + (err?.message || 'Unknown error'), 'error');
				setSymbols('');
			}
		};
		fetchSymbols();
	}, [tvWlid, sessionId]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setResponse('');
		try {
			const formData = new URLSearchParams({
				mode: 'add',
				wlid: mioWlid,
				overwrite: '0',
				name: '',
				stock_list: regroupTVWatchlist(symbols, groupBy),
			}).toString();
			const res = await fetch('/api/proxy', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: JSON.stringify({
					url: 'https://www.marketinout.com/wl/watch_list.php',
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Cookie: `ASPSESSIONIDCECTBSAC=${aspSessionId}`,
					},
					body: formData,
				}),
			});
			const text = await res.text();
			setResponse(text);
			if (res.ok) {
				showToast('Watchlist synced to MarketInOut.', 'success');
			} else {
				showToast('Failed to sync. Please check your credentials.', 'error');
			}
		} catch (err) {
			showToast('Network or server error.', 'error');
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className='space-y-8 max-w-md mx-auto mt-16 p-6 rounded-lg shadow-md'>
			<div className='space-y-2'>
				<Label htmlFor='sessionId'>TradingView sessionid</Label>
				<Input
					id='sessionId'
					value={sessionId}
					onChange={(e) => setSessionId(e.target.value)}
					required
					className='w-full'
				/>
			</div>
			<div className='space-y-2'>
				<Label htmlFor='wlid'>TradingView Watchlist</Label>
				<Select value={tvWlid} onValueChange={setTvWlid} disabled={!sessionId || loading || watchlists.length === 0}>
					<SelectTrigger id='wlid' className='w-full'>
						<SelectValue placeholder='Select a TradingView watchlist' />
					</SelectTrigger>
					<SelectContent>
						{watchlists.map((w) => (
							<SelectItem key={w.id} value={String(w.id)}>
								{w.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className='space-y-2'>
				<Label htmlFor='mio-wlid'>MIO Watchlist</Label>
				<div className='flex items-center gap-2'>
					<Select value={mioWlid} onValueChange={setMioWlid} disabled={customWlids.length === 0}>
						<SelectTrigger id='mio-wlid' className='w-full'>
							<SelectValue placeholder='Select a MIO watchlist' />
						</SelectTrigger>
						<SelectContent>
							{customWlids.map((w) => (
								<SelectItem key={w.id} value={w.id}>
									{w.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
						<DialogTrigger asChild>
							<Button type='button' variant='outline' size='sm' className='ml-2'>
								+ Add
							</Button>
						</DialogTrigger>
						<DialogContent>
							<div className='space-y-4'>
								<Label htmlFor='newWlidName'>Name</Label>
								<Input id='newWlidName' value={newWlidName} onChange={(e) => setNewWlidName(e.target.value)} />
								<Label htmlFor='newWlid'>WLID</Label>
								<Input id='newWlid' value={newWlid} onChange={(e) => setNewWlid(e.target.value)} />
								<Button
									type='button'
									onClick={() => {
										if (newWlid && newWlidName) {
											setCustomWlids((prev) => [...prev, { id: newWlid, name: newWlidName }]);
											setNewWlid('');
											setNewWlidName('');
											setShowAddDialog(false);
										}
									}}
									disabled={!newWlid || !newWlidName}
								>
									Add
								</Button>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>
			<div className='space-y-2'>
				<Label htmlFor='groupBy'>Group by</Label>
				<Select value={groupBy} onValueChange={(v) => setGroupBy(v as RegroupOption)}>
					<SelectTrigger id='groupBy' className='w-full'>
						<SelectValue placeholder='Group by' />
					</SelectTrigger>
					<SelectContent>
						{regroupOptions.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className='space-y-2'>
				<Label htmlFor='symbols'>Stock Symbols (MIO format)</Label>
				<EditorWithClipboard
					id='symbols-editor'
					label=''
					value={regroupTVWatchlist(symbols, groupBy)}
					onChange={setSymbols}
					placeholder='Paste or type symbols here...'
					className='w-full font-mono text-sm p-2 border rounded'
				/>
			</div>
			<div className='space-y-2'>
				<Label htmlFor='aspSessionId'>MarketInOut ASPSESSIONID Value</Label>
				<Input
					id='aspSessionId'
					value={aspSessionId}
					onChange={(e) => setAspSessionId(e.target.value)}
					required
					className='w-full'
				/>
			</div>
			<Button
				type='submit'
				disabled={loading || !symbols || !aspSessionId || !sessionId || !mioWlid}
				className='w-full'
			>
				{loading ? 'Syncing...' : 'Sync to MarketInOut'}
			</Button>
			{/* {response && (
				<div className='mt-8'>
					<Label>Result</Label>
					<div className='p-4 border rounded bg-gray-50'>{response}</div>
				</div>
			)} */}
		</form>
	);
};

export default MioSyncPage;
