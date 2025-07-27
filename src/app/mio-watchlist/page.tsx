// src/app/mio-watchlist/page.tsx

'use client';

import React, { useState } from 'react';
import { MIOService } from '@/lib/MIOService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useSessionId } from '@/lib/useSessionId';

export default function MioWatchlistPage() {
	const [aspSessionId, setAspSessionId] = useSessionId('marketinout');
	const [mioWlid, setMioWlid] = useState('');
	const [watchlists, setWatchlists] = useState<{ id: string; name: string }[]>([]);
	const [watchlistsLoading, setWatchlistsLoading] = useState(false);
	const [watchlistsError, setWatchlistsError] = useState<string | null>(null);
	const [symbols, setSymbols] = useState('');
	const [groupBy, setGroupBy] = useState('');
	const [watchlistName, setWatchlistName] = useState('');
	const [deleteIds, setDeleteIds] = useState<string[]>([]);
	const [result, setResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleAddWatchlist = async () => {
		setLoading(true);
		setError(null);
		setResult(null);
		try {
			const res = await MIOService.addWatchlist({
				aspSessionId,
				mioWlid,
				symbols,
				groupBy,
			});
			setResult('Watchlist updated successfully.');
		} catch (e: any) {
			setError(e.message);
		}
		setLoading(false);
	};

	const fetchWatchlists = React.useCallback(() => {
		if (!aspSessionId) return;
		setWatchlistsLoading(true);
		setWatchlistsError(null);
		fetch('/api/mio-watchlists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ aspSessionId }),
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.error) throw new Error(data.error);
				setWatchlists((data.watchlists || []).map((w: any) => ({ id: String(w.id), name: w.name })));
			})
			.catch((err) => setWatchlistsError(err.message))
			.finally(() => setWatchlistsLoading(false));
	}, [aspSessionId]);

	React.useEffect(() => {
		fetchWatchlists();
	}, [fetchWatchlists]);

	const handleCreateWatchlist = async () => {
		setLoading(true);
		setError(null);
		setResult(null);
		try {
			const res = await MIOService.createWatchlist(aspSessionId, watchlistName);
			setResult('Watchlist created successfully.');
			fetchWatchlists();
		} catch (e: any) {
			setError(e.message);
		}
		setLoading(false);
	};

	const handleDeleteWatchlists = async () => {
		setLoading(true);
		setError(null);
		setResult(null);
		try {
			const res = await MIOService.deleteWatchlists(aspSessionId, deleteIds);
			setResult('Watchlists deleted successfully.');
			fetchWatchlists();
		} catch (e: any) {
			setError(e.message);
		}
		setLoading(false);
	};

	return (
		<div className='max-w-xl mx-auto py-8'>
			<h1 className='text-2xl font-bold mb-4'>MIO Watchlist Management</h1>
			<Separator className='mb-4' />

			<div className='mb-6'>
				<label className='block mb-1 font-medium'>ASP Session ID</label>
				<Input
					value={aspSessionId}
					onChange={(e) => setAspSessionId(e.target.value)}
					placeholder='Enter ASP Session ID'
				/>
			</div>

			<div className='mb-6'>
				<h2 className='font-semibold mb-2'>Add to Watchlist</h2>
				{watchlistsLoading ? (
					<div className='mb-2 text-sm text-gray-500'>Loading watchlists...</div>
				) : watchlistsError ? (
					<div className='mb-2 text-sm text-red-600'>Failed to load watchlists: {watchlistsError}</div>
				) : watchlists.length === 0 ? (
					<div className='mb-2 text-sm text-gray-500'>No watchlists found.</div>
				) : (
					<div className='mb-2'>
						<label className='block mb-1 font-medium'>MIO Watchlist</label>
						<Select value={mioWlid} onValueChange={setMioWlid} disabled={watchlists.length === 0}>
							<SelectTrigger className='w-full'>
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
				)}
				<Input
					className='mb-2'
					value={symbols}
					onChange={(e) => setSymbols(e.target.value)}
					placeholder='Symbols (comma separated)'
				/>
				<Input className='mb-2' value={groupBy} onChange={(e) => setGroupBy(e.target.value)} placeholder='Group By' />
				<Button onClick={handleAddWatchlist} disabled={loading}>
					Add to Watchlist
				</Button>
			</div>

			<Separator className='mb-4' />

			<div className='mb-6'>
				<h2 className='font-semibold mb-2'>Create New Watchlist</h2>
				<Input
					className='mb-2'
					value={watchlistName}
					onChange={(e) => setWatchlistName(e.target.value)}
					placeholder='New Watchlist Name'
				/>
				<Button onClick={handleCreateWatchlist} disabled={loading}>
					Create Watchlist
				</Button>
			</div>

			<Separator className='mb-4' />

			<div className='mb-6'>
				<h2 className='font-semibold mb-2'>Delete Watchlists</h2>
				<MultiSelect
					options={watchlists.map((w) => ({ label: w.name, value: w.id }))}
					onValueChange={setDeleteIds}
					value={deleteIds}
					placeholder='Select watchlists to delete'
					className='mb-2'
				/>
				<Button onClick={handleDeleteWatchlists} disabled={loading || deleteIds.length === 0}>
					Delete Watchlists
				</Button>
			</div>

			{result && <div className='text-green-600 font-medium mb-2'>{result}</div>}
			{error && <div className='text-red-600 font-medium mb-2'>{error}</div>}
		</div>
	);
}
