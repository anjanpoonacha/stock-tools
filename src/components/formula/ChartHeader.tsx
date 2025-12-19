/**
 * ChartHeader - Top navigation bar with stock info and controls
 *
 * Features:
 * - Back to table button
 * - Current symbol badge with position
 * - Sector and industry tags
 * - Theme toggle
 * - Previous/Next navigation buttons
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { Stock } from '@/types/stock';

interface ChartHeaderProps {
	currentSymbol: string;
	currentIndex: number;
	totalStocks: number;
	currentStock?: Stock;
	onBackToTable: () => void;
	onNavigatePrev: () => void;
	onNavigateNext: () => void;
	isFirstStock: boolean;
	isLastStock: boolean;
}

export function ChartHeader({
	currentSymbol,
	currentIndex,
	totalStocks,
	currentStock,
	onBackToTable,
	onNavigatePrev,
	onNavigateNext,
	isFirstStock,
	isLastStock,
}: ChartHeaderProps) {
	return (
		<div className='h-[50px] flex items-center justify-between px-6 border-b border-border bg-muted/30 flex-shrink-0'>
			<div className='flex items-center gap-3 flex-wrap'>
				<Button variant='outline' size='sm' onClick={onBackToTable} className='h-7'>
					<ArrowLeft className='h-3 w-3 mr-1' />
					Table
				</Button>

				<div className='flex items-center gap-2'>
					<Badge variant='default' className='font-mono'>
						{currentSymbol}
					</Badge>
					<span className='text-xs text-muted-foreground'>
						{currentIndex + 1} / {totalStocks}
					</span>
				</div>

				{/* Sector and Industry */}
				{(currentStock?.sector || currentStock?.industry) && (
					<div className='flex items-center gap-2 text-xs text-muted-foreground'>
						<span>•</span>
						{currentStock.sector && (
							<span className='px-2 py-0.5 rounded bg-muted border border-border'>{currentStock.sector}</span>
						)}
						{currentStock.industry && (
							<span className='px-2 py-0.5 rounded bg-muted border border-border'>{currentStock.industry}</span>
						)}
					</div>
				)}
			</div>

			<div className='flex items-center gap-2'>
				{/* Theme Toggle */}
				<ThemeToggle />

				<Separator orientation='vertical' className='h-5' />

				{/* Navigation */}
				<Button
					variant='outline'
					size='sm'
					onClick={onNavigatePrev}
					disabled={isFirstStock}
					className='h-7 px-2'
					title='Previous stock (↑)'
				>
					<ChevronLeft className='h-3 w-3' />
				</Button>
				<span className='text-[10px] text-muted-foreground font-mono'>↑ ↓</span>
				<Button
					variant='outline'
					size='sm'
					onClick={onNavigateNext}
					disabled={isLastStock}
					className='h-7 px-2'
					title='Next stock (↓)'
				>
					<ChevronRight className='h-3 w-3' />
				</Button>
			</div>
		</div>
	);
}
