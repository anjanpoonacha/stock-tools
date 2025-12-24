'use client';

import React, { useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FormulaTab from './components/FormulaTab';
import WatchlistTab from './components/WatchlistTab';

export default function StocksContent() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	const activeTab = searchParams.get('tab') || 'formulas';

	const handleTabChange = useCallback(
		(newTab: string) => {
			const params = new URLSearchParams(searchParams.toString());
			params.set('tab', newTab);

			// Clear tab-specific params when switching
			if (newTab === 'formulas') {
				params.delete('mioWlid');
				params.delete('tvWlid');
				params.delete('watchlistId');
			} else if (newTab === 'watchlists') {
				params.delete('formulaId');
			}

			router.replace(`${pathname}?${params.toString()}`);
		},
		[searchParams, router, pathname]
	);

	return (
		<div className='h-full flex flex-col overflow-hidden'>
			<Tabs
				value={activeTab}
				onValueChange={handleTabChange}
				className='h-full flex flex-col overflow-hidden'
			>
				{/* Tab selector */}
				<div className='flex-shrink-0 border-b border-border'>
					<TabsList className='w-full justify-start rounded-none h-12 bg-transparent p-0'>
						<TabsTrigger
							value='formulas'
							className='rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 h-full'
						>
							MIO Formulas
						</TabsTrigger>
						<TabsTrigger
							value='watchlists'
							className='rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 h-full'
						>
							Watchlists
						</TabsTrigger>
					</TabsList>
				</div>

				{/* Tab content */}
				<div className='flex-1 min-h-0 overflow-hidden'>
					<TabsContent value='formulas' className='h-full m-0'>
						<FormulaTab />
					</TabsContent>
					<TabsContent value='watchlists' className='h-full m-0'>
						<WatchlistTab />
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
