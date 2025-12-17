'use client';

import React, { useState } from 'react';
import { TradingViewLiveChart } from '@/components/TradingViewLiveChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ChartViewProps {
	selectedStocks: string[];
	currentIndex: number;
	setCurrentIndex: (index: number) => void;
	onBackToTable: () => void;
}

export default function ChartView({
	selectedStocks,
	currentIndex,
	setCurrentIndex,
	onBackToTable,
}: ChartViewProps) {
	const currentSymbol = selectedStocks[currentIndex];
	const totalStocks = selectedStocks.length;
	const [showCVD, setShowCVD] = useState<boolean>(true);

	const handlePrev = () => {
		setCurrentIndex(Math.max(0, currentIndex - 1));
	};

	const handleNext = () => {
		setCurrentIndex(Math.min(totalStocks - 1, currentIndex + 1));
	};

	if (!currentSymbol) {
		return (
			<Card>
				<CardContent className='py-8'>
					<div className='text-center text-muted-foreground'>
						<p>No stock selected</p>
						<Button className='mt-4' onClick={onBackToTable}>
							<ArrowLeft className='h-4 w-4 mr-2' />
							Back to Table
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className='space-y-2'>
			{/* Navigation Header */}
			<Card>
				<CardHeader className='py-2 px-4'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<Button
								variant='outline'
								size='sm'
								onClick={onBackToTable}
								className='h-7'
							>
								<ArrowLeft className='h-3 w-3 mr-1' />
								Back
							</Button>
							<Badge variant='default'>{currentSymbol}</Badge>
							<span className='text-xs text-muted-foreground'>
								{currentIndex + 1} / {totalStocks}
							</span>
						</div>
						<div className='flex items-center gap-3'>
							<div className='flex items-center gap-1.5'>
								<Checkbox
									id='show-cvd'
									checked={showCVD}
									onCheckedChange={(checked) => setShowCVD(checked === true)}
									className='h-3.5 w-3.5'
								/>
								<Label htmlFor='show-cvd' className='text-xs cursor-pointer'>
									CVD
								</Label>
							</div>
							<div className='flex items-center gap-1'>
								<Button
									variant='outline'
									size='sm'
									onClick={handlePrev}
									disabled={currentIndex === 0}
									className='h-7 px-2'
								>
									<ChevronLeft className='h-3 w-3' />
								</Button>
								<Button
									variant='outline'
									size='sm'
									onClick={handleNext}
									disabled={currentIndex === totalStocks - 1}
									className='h-7 px-2'
								>
									<ChevronRight className='h-3 w-3' />
								</Button>
							</div>
						</div>
					</div>
				</CardHeader>
			</Card>

			{/* Dual Charts */}
			<div className='grid grid-cols-1 lg:grid-cols-2 gap-2'>
				{/* Weekly Chart */}
				<Card>
					<CardHeader className='py-1 px-3'>
						<CardTitle className='text-xs font-medium text-muted-foreground'>1W</CardTitle>
					</CardHeader>
					<CardContent className='p-2'>
						<TradingViewLiveChart
							symbol={currentSymbol}
							resolution='1W'
							height={600}
							showCVD={showCVD}
						/>
					</CardContent>
				</Card>

				{/* Daily Chart */}
				<Card>
					<CardHeader className='py-1 px-3'>
						<CardTitle className='text-xs font-medium text-muted-foreground'>1D</CardTitle>
					</CardHeader>
					<CardContent className='p-2'>
						<TradingViewLiveChart
							symbol={currentSymbol}
							resolution='1D'
							height={600}
							showCVD={showCVD}
						/>
					</CardContent>
				</Card>
			</div>

			{/* Selected Stocks List */}
			<Card>
				<CardHeader className='py-2 px-3'>
					<CardTitle className='text-xs font-medium'>Selected ({selectedStocks.length})</CardTitle>
				</CardHeader>
				<CardContent className='p-2'>
					<div className='flex flex-wrap gap-1.5'>
						{selectedStocks.map((symbol, index) => (
							<Badge
								key={symbol}
								variant={index === currentIndex ? 'default' : 'outline'}
								className='cursor-pointer text-xs py-0 h-5'
								onClick={() => setCurrentIndex(index)}
							>
								{symbol}
							</Badge>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
