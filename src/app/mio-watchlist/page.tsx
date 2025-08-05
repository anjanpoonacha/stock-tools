// src/app/mio-watchlist/page.tsx

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { getInternalSessionId } from '@/lib/useInternalSessionId';
import { UsageGuide } from '@/components/UsageGuide';

type Watchlist = { id: string; name: string };

export default function MioWatchlistPage() {
	const [internalSessionId, setInternalSessionId] = useState<string>('');

	useEffect(() => {
		function updateSessionId() {
			setInternalSessionId(getInternalSessionId());
		}
		updateSessionId();
		window.addEventListener('focus', updateSessionId);
		return () => window.removeEventListener('focus', updateSessionId);
	}, []);

	// Watchlist state
	const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
	const [watchlistsLoading, setWatchlistsLoading] = useState(false);
	const [watchlistsError, setWatchlistsError] = useState<string | null>(null);

	// Form state
	const [mioWlid, setMioWlid] = useState('');
	const [symbols, setSymbols] = useState('');
	const [groupBy, setGroupBy] = useState('');
	const [watchlistName, setWatchlistName] = useState('');
	const [deleteIds, setDeleteIds] = useState<string[]>([]);

	// Result and error state
	const [result, setResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// Fetch all watchlists
	const fetchWatchlists = useCallback(async () => {
		if (!internalSessionId) {
			setWatchlists([]);
			setWatchlistsError('No internal session ID found. Please bridge your session first.');
			return;
		}
		setWatchlistsLoading(true);
		setWatchlistsError(null);
		try {
			const res = await fetch('/api/mio-action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ internalSessionId }),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			setWatchlists(
				(data.watchlists || []).map((w: { id: string | number; name: string }) => ({
					id: String(w.id),
					name: w.name,
				}))
			);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			setWatchlistsError(message || 'Failed to load watchlists.');
			setWatchlists([]);
		} finally {
			setWatchlistsLoading(false);
		}
	}, [internalSessionId]);

	// Fetch watchlists when session changes
	useEffect(() => {
		if (!internalSessionId) {
			setWatchlists([]);
			setWatchlistsError('No internal session ID found. Please bridge your session first.');
			return;
		}
		fetchWatchlists();
	}, [internalSessionId, fetchWatchlists]);

	// Add to watchlist
	const handleAddWatchlist = async () => {
		setLoading(true);
		setError(null);
		setResult(null);
		try {
			const res = await fetch('/api/mio-action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ internalSessionId, mioWlid, symbols }),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			setResult('Watchlist updated successfully.');
			fetchWatchlists();
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message || 'Failed to add to watchlist.');
		} finally {
			setLoading(false);
		}
	};

	// Create new watchlist
	const handleCreateWatchlist = async () => {
		setLoading(true);
		setError(null);
		setResult(null);
		try {
			const res = await fetch('/api/mio-action', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ internalSessionId, name: watchlistName }),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			setResult('Watchlist created successfully.');
			fetchWatchlists();
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message || 'Failed to create watchlist.');
		} finally {
			setLoading(false);
		}
	};

	// Delete selected watchlists
	const handleDeleteWatchlists = async () => {
		setLoading(true);
		setError(null);
		setResult(null);
		try {
			const res = await fetch('/api/mio-action', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ internalSessionId, deleteIds }),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			setResult('Watchlists deleted successfully.');
			fetchWatchlists();
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message || 'Failed to delete watchlists.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='max-w-xl mx-auto py-8'>
			<h1 className='text-2xl font-bold mb-4'>MIO Watchlist Management</h1>
			<UsageGuide
				title="How to manage your MIO watchlists"
				steps={[
					"First, authenticate with MIO using the 'MIO Login' tab",
					"Use 'Add to Watchlist' to add symbols to existing watchlists",
					"Use 'Create New Watchlist' to make new watchlists",
					"Use 'Delete Watchlists' to remove unwanted watchlists",
					"All operations require MIO authentication to work"
				]}
				tips={[
					"Symbols should be in MIO format (e.g., TCS.NS, INFY.BO)",
					"Use comma-separated format for multiple symbols",
					"Group By field helps organize symbols in watchlists",
					"You can select multiple watchlists for bulk deletion"
				]}
				className="mb-4"
			/>
			<Separator className='mb-4' />

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
				<Button onClick={handleAddWatchlist} disabled={loading || !internalSessionId}>
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
				<Button onClick={handleCreateWatchlist} disabled={loading || !internalSessionId}>
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
				<Button onClick={handleDeleteWatchlists} disabled={loading || deleteIds.length === 0 || !internalSessionId}>
					Delete Watchlists
				</Button>
			</div>

			{result && <div className='text-green-600 font-medium mb-2'>{result}</div>}
			{error && <div className='text-red-600 font-medium mb-2'>{error}</div>}
		</div>
	);
}
