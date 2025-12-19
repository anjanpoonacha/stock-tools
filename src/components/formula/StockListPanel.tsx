/**
 * StockListPanel - Right-side panel showing scrollable stock list with search
 *
 * Features:
 * - Search input to filter stocks
 * - Scrollable list with shadcn ScrollArea
 * - Active stock highlighting
 * - Index numbers for each stock
 */

'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StockListPanelProps {
	stockSymbols: string[];
	currentIndex: number;
	onSelectStock: (index: number) => void;
	totalStocks: number;
}

export function StockListPanel({ stockSymbols, currentIndex, onSelectStock, totalStocks }: StockListPanelProps) {
	const [searchQuery, setSearchQuery] = useState<string>('');

	// Filter stocks based on search
	const filteredStockSymbols = stockSymbols.filter((symbol) =>
		symbol.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div className='h-full w-full bg-muted/30 border-l border-border flex flex-col'>
			<div className='p-2 pb-2 flex-shrink-0'>
				<h3 className='text-xs font-semibold mb-2'>Stocks ({totalStocks})</h3>
				{/* Search Box */}
				<div className='relative'>
					<Search className='absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground' />
					<Input
						type='text'
						placeholder='Search...'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className='pl-7 h-7 text-xs'
					/>
				</div>
			</div>

			{/* Scrollable Stock List */}
			<ScrollArea className='flex-1 min-h-0 px-1'>
				<div className='space-y-0.5 pb-2'>
					{filteredStockSymbols.map((symbol) => {
						const actualIndex = stockSymbols.indexOf(symbol);
						return (
							<button
								key={symbol}
								onClick={() => onSelectStock(actualIndex)}
								className={`w-full text-left px-2 py-1.5 rounded-md transition-colors ${
									actualIndex === currentIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
								}`}
							>
								<div className='flex items-center gap-1.5'>
									<span className='text-[9px] text-muted-foreground'>#{actualIndex + 1}</span>
									<span className='text-xs font-medium font-mono'>{symbol}</span>
								</div>
							</button>
						);
					})}
				</div>
			</ScrollArea>
		</div>
	);
}
