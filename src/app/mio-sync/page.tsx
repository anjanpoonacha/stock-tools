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
import { MIOService } from '@/lib/MIOService';
import { useSessionId } from '@/lib/useSessionId';
import { Badge } from '@/components/ui/badge';
import { XCircle } from 'lucide-react';

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
	const [mioWatchlists, setMioWatchlists] = useState<{ id: string; name: string }[]>([]);
	const [combination, setCombination] = useState<{ tvWlid: string; mioWlid: string; groupBy: RegroupOption } | null>(
		null
	);
	const [savedCombinations, setSavedCombinations] = useState<
		{ tvWlid: string; mioWlid: string; groupBy: RegroupOption }[]
	>([]);
	const [mioWatchlistsLoading, setMioWatchlistsLoading] = useState(false);
	const [mioWatchlistsError, setMioWatchlistsError] = useState<string | null>(null);
	const [aspSessionId, setAspSessionId] = useSessionId('marketinout');
	const [sessionId, setSessionId] = useSessionId('tradingview');
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

	/* Session IDs are now managed by useSessionId hook */

	React.useEffect(() => {
		// Restore all saved combinations from localStorage
		const stored = localStorage.getItem('mioSyncCombinations');
		if (stored) {
			try {
				const combos = JSON.parse(stored);
				if (Array.isArray(combos)) {
					setSavedCombinations(combos);
					// Optionally, auto-apply the first combination
					if (combos.length > 0) {
						setTvWlid(combos[0].tvWlid);
						setMioWlid(combos[0].mioWlid);
						setGroupBy(combos[0].groupBy);
						setCombination(combos[0]);
					}
				}
			} catch {}
		}
	}, []);

	React.useEffect(() => {
		if (!aspSessionId) return;
		setMioWatchlistsLoading(true);
		setMioWatchlistsError(null);
		fetch('/api/mio-watchlists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ aspSessionId }),
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.error) throw new Error(data.error);
				setMioWatchlists((data.watchlists || []).map((w: any) => ({ id: String(w.id), name: w.name })));
			})
			.catch((err) => setMioWatchlistsError(err.message))
			.finally(() => setMioWatchlistsLoading(false));
	}, [aspSessionId]);

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
			const text = await MIOService.addWatchlist({
				aspSessionId,
				mioWlid,
				symbols: regroupTVWatchlist(symbols, groupBy),
				groupBy,
			});
			setResponse(text);
			showToast('Watchlist synced to MarketInOut.', 'success');
		} catch (err) {
			showToast('Network or server error.', 'error');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
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
						{mioWatchlistsLoading ? (
							<div className='text-sm text-gray-500'>Loading MIO watchlists...</div>
						) : mioWatchlistsError ? (
							<div className='text-sm text-red-600'>Failed to load: {mioWatchlistsError}</div>
						) : mioWatchlists.length === 0 ? (
							<div className='text-sm text-gray-500'>No MIO watchlists found.</div>
						) : (
							<Select value={mioWlid} onValueChange={setMioWlid} disabled={mioWatchlists.length === 0}>
								<SelectTrigger id='mio-wlid' className='w-full'>
									<SelectValue placeholder='Select a MIO watchlist' />
								</SelectTrigger>
								<SelectContent>
									{mioWatchlists.map((w) => (
										<SelectItem key={w.id} value={w.id}>
											{w.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
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
					<EditorWithClipboard
						id='symbols-editor'
						label='Stock Symbols (MIO format)'
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
				{savedCombinations.length > 0 && (
					<div className='flex flex-wrap gap-2 mb-4'>
						{savedCombinations.map((combo, idx) => {
							const tvName = watchlists.find((w) => w.id === combo.tvWlid)?.name || combo.tvWlid;
							const mioName = mioWatchlists.find((w) => w.id === combo.mioWlid)?.name || combo.mioWlid;
							return (
								<span key={idx} className='flex items-center'>
									<Badge className='m-1 border-foreground/10 text-foreground bg-card hover:bg-card/80 flex flex-row items-start gap-1 px-2 py-1 rounded-md transition min-w-[0]'>
										<div
											className='cursor-pointer w-full break-words'
											onClick={() => {
												setTvWlid(combo.tvWlid);
												setMioWlid(combo.mioWlid);
												setGroupBy(combo.groupBy);
												setCombination(combo);
												showToast('Combination applied.', 'success');
											}}
											tabIndex={0}
											role='button'
											aria-label='Apply combination'
											onKeyDown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													setTvWlid(combo.tvWlid);
													setMioWlid(combo.mioWlid);
													setGroupBy(combo.groupBy);
													setCombination(combo);
													showToast('Combination applied.', 'success');
												}
											}}
										>
											{tvName} / {mioName} / {combo.groupBy}
										</div>
										<div className='flex w-full'>
											<XCircle
												className='h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive'
												onClick={(e) => {
													e.stopPropagation();
													const updated = savedCombinations.filter((_, i) => i !== idx);
													setSavedCombinations(updated);
													localStorage.setItem('mioSyncCombinations', JSON.stringify(updated));
													showToast('Combination deleted.', 'success');
												}}
												tabIndex={0}
												role='button'
												aria-label='Delete combination'
												onKeyDown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.stopPropagation();
														const updated = savedCombinations.filter((_, i) => i !== idx);
														setSavedCombinations(updated);
														localStorage.setItem('mioSyncCombinations', JSON.stringify(updated));
														showToast('Combination deleted.', 'success');
													}
												}}
											/>
										</div>
									</Badge>
								</span>
							);
						})}
					</div>
				)}
				<div className='flex gap-2 mt-2'>
					<Button
						type='button'
						variant='secondary'
						className='flex-1'
						onClick={() => {
							if (!tvWlid || !mioWlid || !groupBy) {
								showToast('Please select all combination options before saving.', 'error');
								return;
							}
							const combo = { tvWlid, mioWlid, groupBy };
							// Prevent duplicates
							const updated = [
								...savedCombinations.filter(
									(c) => !(c.tvWlid === combo.tvWlid && c.mioWlid === combo.mioWlid && c.groupBy === combo.groupBy)
								),
								combo,
							];
							setSavedCombinations(updated);
							localStorage.setItem('mioSyncCombinations', JSON.stringify(updated));
							setCombination(combo);
							showToast('Combination saved locally.', 'success');
						}}
					>
						Save Combination
					</Button>
				</div>
				{/* {response && (
				<div className='mt-8'>
					<Label>Result</Label>
					<div className='p-4 border rounded bg-gray-50'>{response}</div>
				</div>
			)} */}
			</form>
		</div>
	);
};

export default MioSyncPage;
