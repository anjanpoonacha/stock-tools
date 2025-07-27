// src/app/mio-watchlist/page.tsx

'use client';

import React, { useState } from 'react';
import { MIOService } from '@/lib/MIOService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSessionId } from '@/lib/useSessionId';

export default function MioWatchlistPage() {
	const [aspSessionId, setAspSessionId] = useSessionId('marketinout');
	const [mioWlid, setMioWlid] = useState('');
	const [symbols, setSymbols] = useState('');
	const [groupBy, setGroupBy] = useState('');
	const [watchlistName, setWatchlistName] = useState('');
	const [deleteIds, setDeleteIds] = useState('');
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

	const handleCreateWatchlist = async () => {
		setLoading(true);
		setError(null);
		setResult(null);
		try {
			const res = await MIOService.createWatchlist(aspSessionId, watchlistName);
			setResult('Watchlist created successfully.');
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
			const ids = deleteIds
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean);
			const res = await MIOService.deleteWatchlists(aspSessionId, ids);
			setResult('Watchlists deleted successfully.');
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
				<Input
					className='mb-2'
					value={mioWlid}
					onChange={(e) => setMioWlid(e.target.value)}
					placeholder='MIO Watchlist ID'
				/>
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
				<Input
					className='mb-2'
					value={deleteIds}
					onChange={(e) => setDeleteIds(e.target.value)}
					placeholder='Watchlist IDs to delete (comma separated)'
				/>
				<Button onClick={handleDeleteWatchlists} disabled={loading}>
					Delete Watchlists
				</Button>
			</div>

			{result && <div className='text-green-600 font-medium mb-2'>{result}</div>}
			{error && <div className='text-red-600 font-medium mb-2'>{error}</div>}
		</div>
	);
}
