'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { regroupTVWatchlist } from '@/app/regroup-watchlist';

type RegroupOption = 'Industry' | 'Sector' | 'None';

export function RegroupBar({ value, onRegroup }: { value: string; onRegroup: (output: string) => void }) {
	const [groupBy, setGroupBy] = useState<RegroupOption>('None');

	const handleRegroup = () => {
		if (groupBy === 'None') {
			const flat = value
				.replace(/###([^,]+),/g, '')
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
				.join(',');
			onRegroup(flat);
		} else {
			onRegroup(regroupTVWatchlist(value, groupBy));
		}
	};

	return (
		<div className='flex flex-wrap gap-2 items-center my-2'>
			<Label htmlFor='group-by'>Group by</Label>
			<Select value={groupBy} onValueChange={(v) => setGroupBy(v as RegroupOption)}>
				<SelectTrigger id='group-by' className='w-32'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value='Industry'>Industry</SelectItem>
					<SelectItem value='Sector'>Sector</SelectItem>
					<SelectItem value='None'>None</SelectItem>
				</SelectContent>
			</Select>
			<button
				className='bg-primary text-primary-foreground rounded px-4 py-2 font-semibold shadow hover:bg-primary/90 transition'
				onClick={handleRegroup}
				type='button'
			>
				Regroup
			</button>
		</div>
	);
}
