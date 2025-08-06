'use client';
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { regroupTVWatchlist, RegroupOption } from '@/lib/utils';
import { getInternalSessionId } from '@/lib/useInternalSessionId';
import { useSessionId } from '@/lib/useSessionId';
import { Badge } from '@/components/ui/badge';
import { XCircle } from 'lucide-react';
import { UsageGuide } from '@/components/UsageGuide';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { SessionError, SessionErrorType, Platform, ErrorSeverity } from '@/lib/sessionErrors';

const MioSyncPage: React.FC = () => {
	const [tvWlid, setTvWlid] = useState('');
	const [mioWlid, setMioWlid] = useState('');
	const [mioWatchlists, setMioWatchlists] = useState<{ id: string; name: string }[]>([]);
	/* Removed unused state: combination */
	const [savedCombinations, setSavedCombinations] = useState<
		{ tvWlid: string; mioWlid: string; groupBy: RegroupOption }[]
	>([]);
	const [mioWatchlistsLoading, setMioWatchlistsLoading] = useState(false);
	const [mioWatchlistsError, setMioWatchlistsError] = useState<SessionError | Error | string | null>(null);
	const [sessionId, setSessionId] = useSessionId('tradingview');
	const [internalSessionId, setInternalSessionId] = useState('');
	const [symbols, setSymbols] = useState('');
	const regroupOptions: { value: RegroupOption; label: string }[] = [
		{ value: 'Industry', label: 'Industry' },
		{ value: 'Sector', label: 'Sector' },
		{ value: 'None', label: 'None' },
	];
	const [groupBy, setGroupBy] = useState<RegroupOption>('None');
	/* Removed unused state: response */
	const [loading, setLoading] = useState(false);
	const [watchlists, setWatchlists] = useState<{ id: string; name: string }[]>([]);
	const showToast = useToast();

	/* Session IDs are now managed by useSessionId hook */

	React.useEffect(() => {
		// Always get the latest internal session ID from localStorage
		setInternalSessionId(getInternalSessionId());
		const handler = () => setInternalSessionId(getInternalSessionId());
		window.addEventListener('focus', handler);
		return () => window.removeEventListener('focus', handler);
	}, []);

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
						// Removed setCombination
					}
				}
			} catch {}
		}
	}, []);

	React.useEffect(() => {
		if (!internalSessionId) return;
		setMioWatchlistsLoading(true);
		setMioWatchlistsError(null);

		// Only call API if internalSessionId is non-empty
		if (internalSessionId && internalSessionId.length > 0) {
			console.log('[SYNC] Fetching watchlists with internalSessionId:', internalSessionId);
			fetch('/api/mio-action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ internalSessionId }),
			})
				.then((res) => res.json())
				.then((data: { error?: string; watchlists?: { id: string | number; name: string }[] }) => {
					if (data.error) throw new Error(data.error);
					setMioWatchlists(
						(data.watchlists || []).map((w: { id: string | number; name: string }) => ({
							id: String(w.id),
							name: w.name,
						}))
					);
				})
				.catch((err) => {
					const sessionError = new SessionError(
						SessionErrorType.SESSION_EXPIRED,
						'Failed to load MIO watchlists',
						err.message || 'Unable to fetch watchlists from MarketInOut',
						{
							operation: 'fetch_mio_watchlists',
							platform: Platform.MARKETINOUT,
							timestamp: new Date(),
							additionalData: { internalSessionId: internalSessionId?.slice(0, 8) + '...' }
						},
						ErrorSeverity.ERROR,
						[
							{
								action: 'check_session',
								description: 'Verify your MIO session is still valid',
								priority: 1,
								automated: false,
								estimatedTime: '2 minutes'
							},
							{
								action: 'reauth_mio',
								description: 'Re-authenticate with MarketInOut',
								priority: 2,
								automated: false,
								estimatedTime: '3 minutes'
							}
						]
					);
					setMioWatchlistsError(sessionError);
				})
				.finally(() => setMioWatchlistsLoading(false));
		}
	}, [internalSessionId]);

	/* fetchWatchlists removed: now inlined in useEffect */

	React.useEffect(() => {
		// Inline fetchWatchlists to avoid dependency warning
		if (!sessionId) return;
		setLoading(true);
		(async () => {
			try {
				const res = await fetch('/api/tradingview-watchlists', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sessionid: sessionId }),
				});
				const data: { error?: string; watchlists?: { id: string | number; name: string }[] } = await res.json();
				if (data.error) throw new Error(data.error);
				setWatchlists(
					(data.watchlists || []).map((w: { id: string | number; name: string }) => ({
						id: String(w.id),
						name: w.name,
					}))
				);
				showToast('Fetched TradingView watchlists.', 'success');
			} catch (err) {
				const sessionError = new SessionError(
					SessionErrorType.SESSION_EXPIRED,
					'Failed to fetch TradingView watchlists',
					err instanceof Error ? err.message : 'Unable to connect to TradingView',
					{
						operation: 'fetch_tv_watchlists',
						platform: Platform.TRADINGVIEW,
						timestamp: new Date(),
						additionalData: { sessionId: sessionId?.slice(0, 8) + '...' }
					},
					ErrorSeverity.ERROR,
					[
						{
							action: 'check_tv_session',
							description: 'Verify your TradingView session ID is correct',
							priority: 1,
							automated: false,
							estimatedTime: '2 minutes'
						}
					]
				);
				setMioWatchlistsError(sessionError);
			} finally {
				setLoading(false);
			}
		})();
	}, [sessionId, showToast]);

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
					const sessionError = new SessionError(
						SessionErrorType.API_ERROR,
						'Failed to fetch watchlist symbols',
						`HTTP ${res.status}: Unable to fetch symbols from TradingView watchlist`,
						{
							operation: 'fetch_watchlist_symbols',
							platform: Platform.TRADINGVIEW,
							timestamp: new Date(),
							additionalData: { watchlistId: tvWlid, httpStatus: res.status }
						},
						ErrorSeverity.ERROR,
						[
							{
								action: 'check_tv_session',
								description: 'Verify your TradingView session ID is still valid',
								priority: 1,
								automated: false,
								estimatedTime: '2 minutes'
							},
							{
								action: 'check_watchlist_access',
								description: 'Ensure the watchlist exists and is accessible',
								priority: 2,
								automated: false,
								estimatedTime: '1 minute'
							}
						]
					);
					showToast(sessionError.getDisplayMessage(), 'error');
					setSymbols('');
					return;
				}
				const { data }: { data: { symbols?: string[] } } = await res.json();
				// Debug: Show raw API response if no symbols
				if (!data?.symbols || !Array.isArray(data.symbols) || data.symbols.length === 0) {
					console.error('No symbols returned. Raw response:', data);
					const sessionError = new SessionError(
						SessionErrorType.DATA_ERROR,
						'No symbols found in watchlist',
						'The selected TradingView watchlist appears to be empty or inaccessible',
						{
							operation: 'parse_watchlist_symbols',
							platform: Platform.TRADINGVIEW,
							timestamp: new Date(),
							additionalData: { watchlistId: tvWlid, responseData: JSON.stringify(data).slice(0, 200) }
						},
						ErrorSeverity.WARNING,
						[
							{
								action: 'check_watchlist_content',
								description: 'Verify the watchlist contains symbols in TradingView',
								priority: 1,
								automated: false,
								estimatedTime: '2 minutes'
							},
							{
								action: 'try_different_watchlist',
								description: 'Select a different watchlist with symbols',
								priority: 2,
								automated: false,
								estimatedTime: '1 minute'
							}
						]
					);
					showToast(sessionError.getDisplayMessage(), 'error');
					setSymbols('');
					return;
				}
				try {
					const tvSymbols = Array.isArray(data.symbols) ? data.symbols : [];
					const mioSymbols = tvSymbols
						.map((s) => {
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
					const sessionError = new SessionError(
						SessionErrorType.DATA_ERROR,
						'Error processing symbols',
						err instanceof Error ? err.message : 'Failed to convert symbols from TradingView to MIO format',
						{
							operation: 'convert_symbols',
							platform: Platform.TRADINGVIEW,
							timestamp: new Date(),
							additionalData: { watchlistId: tvWlid }
						},
						ErrorSeverity.ERROR,
						[
							{
								action: 'retry_conversion',
								description: 'Try fetching the watchlist symbols again',
								priority: 1,
								automated: false,
								estimatedTime: '1 minute'
							}
						]
					);
					showToast(sessionError.getDisplayMessage(), 'error');
					setSymbols('');
				}
			} catch (err) {
				const sessionError = new SessionError(
					SessionErrorType.NETWORK_ERROR,
					'Network error fetching symbols',
					err instanceof Error ? err.message : 'Unable to connect to TradingView API',
					{
						operation: 'fetch_watchlist_symbols',
						platform: Platform.TRADINGVIEW,
						timestamp: new Date(),
						additionalData: { watchlistId: tvWlid }
					},
					ErrorSeverity.ERROR,
					[
						{
							action: 'check_connection',
							description: 'Check your internet connection',
							priority: 1,
							automated: false,
							estimatedTime: '1 minute'
						},
						{
							action: 'retry_fetch',
							description: 'Try again in a few moments',
							priority: 2,
							automated: false,
							estimatedTime: '2 minutes'
						}
					]
				);
				showToast(sessionError.getDisplayMessage(), 'error');
				setSymbols('');
			}
		};
		fetchSymbols();
	}, [tvWlid, sessionId, showToast]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch('/api/mio-action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					internalSessionId,
					mioWlid,
					symbols: regroupTVWatchlist(symbols, groupBy),
				}),
			});
			
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				const sessionError = new SessionError(
					res.status === 401 ? SessionErrorType.SESSION_EXPIRED : SessionErrorType.API_ERROR,
					'Failed to sync watchlist to MIO',
					errorData.error || `HTTP ${res.status}: Unable to sync watchlist to MarketInOut`,
					{
						operation: 'sync_to_mio',
						platform: Platform.MARKETINOUT,
						timestamp: new Date(),
						additionalData: {
							mioWatchlistId: mioWlid,
							symbolCount: symbols.split(',').length,
							httpStatus: res.status
						}
					},
					ErrorSeverity.ERROR,
					[
						{
							action: 'check_mio_session',
							description: 'Verify your MIO session is still active',
							priority: 1,
							automated: false,
							estimatedTime: '2 minutes'
						},
						{
							action: 'retry_sync',
							description: 'Try the sync operation again',
							priority: 2,
							automated: false,
							estimatedTime: '1 minute'
						}
					]
				);
				throw sessionError;
			}
			
			showToast('Watchlist synced to MarketInOut.', 'success');
		} catch (err) {
			if (err instanceof SessionError) {
				showToast(err.getDisplayMessage(), 'error');
			} else {
				const sessionError = new SessionError(
					SessionErrorType.NETWORK_ERROR,
					'Network error during sync',
					err instanceof Error ? err.message : 'Unable to connect to server',
					{
						operation: 'sync_to_mio',
						platform: Platform.MARKETINOUT,
						timestamp: new Date(),
						additionalData: { mioWatchlistId: mioWlid }
					},
					ErrorSeverity.ERROR,
					[
						{
							action: 'check_connection',
							description: 'Check your internet connection',
							priority: 1,
							automated: false,
							estimatedTime: '1 minute'
						},
						{
							action: 'retry_sync',
							description: 'Try the sync operation again',
							priority: 2,
							automated: false,
							estimatedTime: '2 minutes'
						}
					]
				);
				showToast(sessionError.getDisplayMessage(), 'error');
			}
		} finally {
			setLoading(false);
		}
	};

	if (!internalSessionId) {
		return (
			<div className='max-w-md mx-auto mt-16 p-6 rounded-lg shadow-md border border-red-400 bg-red-50 text-red-800'>
				<h2 className='text-xl font-bold mb-4'>MIO Session Required</h2>
				<p>
					You must bridge your MarketInOut session before using this tool.
					<br />
					<a href='/mio-auth' className='underline text-blue-700'>
						Go to MIO Auth
					</a>
				</p>
			</div>
		);
	}

	return (
		<div>
			<div className='max-w-md mx-auto mt-8 mb-4'>
				<UsageGuide
					title="How to sync TradingView watchlists to MIO"
					steps={[
						"First, set up MIO authentication using the 'MIO Login' tab",
						"Enter your TradingView sessionid",
						"Select a TradingView watchlist as the source",
						"Choose a MIO watchlist as the destination",
						"Select grouping option and click 'Sync to MarketInOut'"
					]}
					tips={[
						"You must authenticate with MIO before using this tool",
						"Symbols are automatically converted from TradingView to MIO format",
						"Save combinations for quick reuse of common sync operations",
						"Grouping organizes symbols by sector/industry in MIO"
					]}
				/>
			</div>
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
							<ErrorDisplay error={mioWatchlistsError} />
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
				<Button
					type='submit'
					disabled={loading || !symbols || !internalSessionId || !sessionId || !mioWlid}
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
