/**
 * ChartView - Formula Results Chart View with 3-Panel Layout
 * 
 * This is the MAIN chart view used in /mio-formulas/results
 * 
 * Layout:
 * - Panel 1 (Left - 320px): Settings and chart controls
 * - Panel 2 (Center - flex-1): Chart area (maximum space, supports single/dual view)
 * - Panel 3 (Right - 320px): Stock list (scrollable)
 * 
 * Features:
 * - Navigate through formula result stocks
 * - Single/Dual chart view mode
 * - CVD indicator with 3 configuration inputs
 * - Multiple resolution options
 * - Keyboard navigation (← → or J K)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { TradingViewLiveChart } from '@/components/TradingViewLiveChart';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowLeft, LayoutGrid, LayoutList, Clock, Grid3x3, TrendingUp, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChartZoomLevel } from '@/lib/chart/types';
import { RESPONSIVE_CHART_HEIGHT, ZOOM_LABELS } from '@/lib/chart/constants';
import { useChartSettings } from '@/hooks/useChartSettings';

interface ChartViewProps {
	stockSymbols: string[];
	currentIndex: number;
	setCurrentIndex: (index: number) => void;
	onBackToTable: () => void;
}

// Resolution configurations - VERIFIED through REAL API testing (Dec 18, 2025)
// Test results: scripts/poc-output/bar-count-real-test-results.json
// All values tested with NSE:RELIANCE, 100% success rate (17/17 tests passed)
const RESOLUTIONS = [
	{ value: '5', label: '5min', barsCount: 1000 },     // ✅ TESTED: 17 days, 888ms
	{ value: '15', label: '15min', barsCount: 2000 },   // ✅ TESTED: 118 days (~4 months), 1862ms
	{ value: '75', label: '75min', barsCount: 1500 },   // Conservative (scaled from 15min)
	{ value: '188', label: '188min', barsCount: 1000 }, // Conservative (scaled from 15min)
	{ value: '1D', label: '1D', barsCount: 2000 },      // ✅ TESTED: 2947 days (~8 years), 1194ms
	{ value: '1W', label: '1W', barsCount: 1500 },      // ✅ TESTED: 10493 days (~29 years), 1166ms
] as const;

const CVD_ANCHOR_PERIODS = [
	{ value: '1M', label: '1 Month' },
	{ value: '3M', label: '3 Months' },
	{ value: '6M', label: '6 Months' },
	{ value: '1Y', label: '1 Year' },
] as const;

const CVD_CUSTOM_PERIODS = [
	{ value: '15S', label: '15 Seconds' },
	{ value: '30S', label: '30 Seconds' },
	{ value: '1', label: '1 Minute' },
	{ value: '5', label: '5 Minutes' },
	{ value: '15', label: '15 Minutes' },
] as const;

export default function ChartView({
	stockSymbols,
	currentIndex,
	setCurrentIndex,
	onBackToTable,
}: ChartViewProps) {
	const currentSymbol = stockSymbols[currentIndex];
	const totalStocks = stockSymbols.length;

	// Chart settings with automatic persistence
	const { settings, updateSetting } = useChartSettings();

	// Local state for search (not persisted)
	const [searchQuery, setSearchQuery] = useState<string>('');

	// Destructure settings for easier access
	const {
		resolution1,
		resolution2,
		zoomLevel1,
		zoomLevel2,
		showCVD,
		cvdAnchorPeriod,
		cvdUseCustomPeriod,
		cvdCustomPeriod,
		showGrid,
		dualViewMode,
	} = settings;
	
	console.log('[ChartView] currentSymbol:', currentSymbol);
	console.log('[ChartView] On-demand loading mode - no pre-fetched data');

	const handlePrev = () => {
		setCurrentIndex(Math.max(0, currentIndex - 1));
	};

	const handleNext = () => {
		setCurrentIndex(Math.min(totalStocks - 1, currentIndex + 1));
	};

	const getResolutionConfig = (resolution: string) => {
		return RESOLUTIONS.find(r => r.value === resolution) || RESOLUTIONS[4];
	};

	// Filter stocks based on search
	const filteredStockSymbols = stockSymbols.filter(symbol =>
		symbol.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Keyboard shortcuts for navigation
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
				return;
			}

			switch (event.key) {
				case 'ArrowLeft':
				case 'j':
					event.preventDefault();
					handlePrev();
					break;
				case 'ArrowRight':
				case 'k':
					event.preventDefault();
					handleNext();
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [currentIndex, totalStocks]);

	if (!currentSymbol) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='text-center text-muted-foreground'>
					<p>No stock selected</p>
					<Button className='mt-4' onClick={onBackToTable}>
						<ArrowLeft className='h-4 w-4 mr-2' />
						Back to Table
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className='h-full w-full flex overflow-hidden bg-background'>
			{/* Panel 1: Compact Toolbar (LEFT - 80px) */}
			<div className='w-[80px] h-full bg-muted/30 border-r border-border flex flex-col items-center py-4 gap-3'>
				{/* View Mode Toggle Button */}
				<Button
					variant={dualViewMode ? 'default' : 'outline'}
					size='icon'
					onClick={() => updateSetting('dualViewMode', !dualViewMode)}
					className='h-10 w-10'
					title={`View Mode: ${dualViewMode ? 'Dual' : 'Single'}`}
				>
					{dualViewMode ? <LayoutGrid className='h-5 w-5' /> : <LayoutList className='h-5 w-5' />}
				</Button>

				<Separator className='w-10' />

				{/* Resolution Popover */}
				<Popover>
					<PopoverTrigger asChild>
						<Button variant='outline' size='icon' className='h-10 w-10 relative' title='Resolution Settings'>
							<Clock className='h-5 w-5' />
							<span className='absolute -bottom-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded px-1 font-mono'>
								{resolution1}
							</span>
						</Button>
					</PopoverTrigger>
					<PopoverContent side='right' className='w-[280px]'>
						<div className='space-y-4'>
							<h3 className='text-sm font-semibold'>Resolution Settings</h3>

							{/* Resolution 1 */}
							<div className='space-y-2'>
								<Label className='text-xs'>{dualViewMode ? 'Resolution 1' : 'Resolution'}</Label>
								<Select value={resolution1} onValueChange={(val) => updateSetting('resolution1', val)}>
									<SelectTrigger className='h-9'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{RESOLUTIONS.map((res) => (
											<SelectItem key={res.value} value={res.value}>{res.label}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Resolution 2 (if dual mode) */}
							{dualViewMode && (
								<div className='space-y-2'>
									<Label className='text-xs'>Resolution 2</Label>
									<Select value={resolution2} onValueChange={(val) => updateSetting('resolution2', val)}>
										<SelectTrigger className='h-9'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{RESOLUTIONS.map((res) => (
												<SelectItem key={res.value} value={res.value}>{res.label}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}

							{/* Zoom Level */}
							<div className='space-y-2'>
								<Label className='text-xs'>{dualViewMode ? 'Zoom Level 1' : 'Zoom Level'}</Label>
								<div className='grid grid-cols-4 gap-1'>
									{Object.values(ChartZoomLevel).map((level) => (
										<Button
											key={level}
											variant={zoomLevel1 === level ? 'default' : 'outline'}
											size='sm'
											onClick={() => updateSetting('zoomLevel1', level)}
											className='h-8 text-xs'
										>
											{ZOOM_LABELS[level]}
										</Button>
									))}
								</div>
							</div>

							{/* Zoom Level 2 (if dual mode) */}
							{dualViewMode && (
								<div className='space-y-2'>
									<Label className='text-xs'>Zoom Level 2</Label>
									<div className='grid grid-cols-4 gap-1'>
										{Object.values(ChartZoomLevel).map((level) => (
											<Button
												key={level}
												variant={zoomLevel2 === level ? 'default' : 'outline'}
												size='sm'
												onClick={() => updateSetting('zoomLevel2', level)}
												className='h-8 text-xs'
											>
												{ZOOM_LABELS[level]}
											</Button>
										))}
									</div>
								</div>
							)}
						</div>
					</PopoverContent>
				</Popover>

				<Separator className='w-10' />

				{/* Grid Toggle Button */}
				<Button
					variant={showGrid ? 'default' : 'outline'}
					size='icon'
					onClick={() => updateSetting('showGrid', !showGrid)}
					className='h-10 w-10'
					title={showGrid ? 'Hide Grid' : 'Show Grid'}
				>
					<Grid3x3 className='h-5 w-5' />
				</Button>

				<Separator className='w-10' />

				{/* CVD Settings Popover */}
				<Popover>
					<PopoverTrigger asChild>
						<Button variant='outline' size='icon' className='h-10 w-10 relative' title='CVD Indicator Settings'>
							<TrendingUp className='h-5 w-5' />
							{showCVD && (
								<span className='absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background' />
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent side='right' className='w-[320px]'>
						<div className='space-y-4'>
							<div className='flex items-center justify-between'>
								<h3 className='text-sm font-semibold'>CVD Indicator</h3>
								<Checkbox
									id='cvd-toggle-popup'
									checked={showCVD}
									onCheckedChange={(checked) => updateSetting('showCVD', checked === true)}
								/>
							</div>

							{showCVD && (
								<div className='space-y-3 pt-2 border-t'>
									{/* Anchor Period */}
									<div className='space-y-2'>
										<Label className='text-xs'>Anchor Period</Label>
										<Select value={cvdAnchorPeriod} onValueChange={(val) => updateSetting('cvdAnchorPeriod', val)}>
											<SelectTrigger className='h-9'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{CVD_ANCHOR_PERIODS.map((period) => (
													<SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									{/* Use Custom Period */}
									<div className='flex items-center gap-2'>
										<Checkbox
											id='cvd-custom-popup'
											checked={cvdUseCustomPeriod}
											onCheckedChange={(checked) => updateSetting('cvdUseCustomPeriod', checked === true)}
										/>
										<Label htmlFor='cvd-custom-popup' className='text-xs cursor-pointer'>
											Use Custom Period
										</Label>
									</div>

									{/* Custom Period */}
									{cvdUseCustomPeriod && (
										<div className='space-y-2'>
											<Label className='text-xs'>Custom Period</Label>
											<Select value={cvdCustomPeriod} onValueChange={(val) => updateSetting('cvdCustomPeriod', val)}>
												<SelectTrigger className='h-9'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{CVD_CUSTOM_PERIODS.map((period) => (
														<SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									)}
								</div>
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>

			{/* Panel 2: Chart Area (CENTER - Maximum Space) */}
			<div className='flex-1 min-w-0 h-full flex flex-col'>
				{/* Thin Header - 50px */}
				<div className='h-[50px] flex items-center justify-between px-6 border-b border-border bg-muted/30 flex-shrink-0'>
					<div className='flex items-center gap-3'>
						<Button
							variant='outline'
							size='sm'
							onClick={onBackToTable}
							className='h-7'
						>
							<ArrowLeft className='h-3 w-3 mr-1' />
							Table
						</Button>
						<Badge variant='default' className='font-mono'>{currentSymbol}</Badge>
						<span className='text-xs text-muted-foreground'>
							{currentIndex + 1} / {totalStocks}
						</span>
					</div>
					<div className='flex items-center gap-2'>
						<Button
							variant='outline'
							size='sm'
							onClick={handlePrev}
							disabled={currentIndex === 0}
							className='h-7 px-2'
							title='Previous stock (← or J)'
						>
							<ChevronLeft className='h-3 w-3' />
						</Button>
						<span className='text-[10px] text-muted-foreground font-mono'>← J / K →</span>
						<Button
							variant='outline'
							size='sm'
							onClick={handleNext}
							disabled={currentIndex === totalStocks - 1}
							className='h-7 px-2'
							title='Next stock (→ or K)'
						>
							<ChevronRight className='h-3 w-3' />
						</Button>
					</div>
				</div>

				{/* Chart Content Area */}
				<div className='flex-1 min-h-0 p-4'>
					<div className={`h-full grid gap-4 ${dualViewMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
						{/* Chart 1 */}
						<div className='h-full bg-background rounded-lg border border-border overflow-hidden'>
							<div className='p-2 border-b border-border bg-muted/30'>
								<p className='text-xs font-medium text-muted-foreground'>
									{getResolutionConfig(resolution1).label}
								</p>
							</div>
							<div className='p-2 h-[calc(100%-2.5rem)] relative'>
								<TradingViewLiveChart
									symbol={currentSymbol}
									resolution={resolution1}
									barsCount={getResolutionConfig(resolution1).barsCount}
									height={RESPONSIVE_CHART_HEIGHT}
									showGrid={showGrid}
									showCVD={showCVD}
									cvdAnchorPeriod={cvdAnchorPeriod}
									cvdTimeframe={cvdUseCustomPeriod ? cvdCustomPeriod : undefined}
									zoomLevel={zoomLevel1}
								/>
							</div>
						</div>

						{/* Chart 2 (only in dual view mode) */}
						{dualViewMode && (
							<div className='h-full bg-background rounded-lg border border-border overflow-hidden'>
								<div className='p-2 border-b border-border bg-muted/30'>
									<p className='text-xs font-medium text-muted-foreground'>
										{getResolutionConfig(resolution2).label}
									</p>
								</div>
								<div className='p-2 h-[calc(100%-2.5rem)] relative'>
									<TradingViewLiveChart
										symbol={currentSymbol}
										resolution={resolution2}
										barsCount={getResolutionConfig(resolution2).barsCount}
										height={RESPONSIVE_CHART_HEIGHT}
										showGrid={showGrid}
										showCVD={showCVD}
										cvdAnchorPeriod={cvdAnchorPeriod}
										cvdTimeframe={cvdUseCustomPeriod ? cvdCustomPeriod : undefined}
										zoomLevel={zoomLevel2}
									/>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Panel 3: Stock List (RIGHT - 320px) */}
			<div className='w-[320px] h-full bg-muted/30 border-l border-border flex flex-col'>
				<div className='p-4 pb-3 flex-shrink-0'>
					<h3 className='text-sm font-semibold mb-3'>Stocks ({totalStocks})</h3>
					{/* Search Box */}
					<div className='relative'>
						<Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
						<Input
							type='text'
							placeholder='Search stocks...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='pl-9 h-9'
						/>
					</div>
				</div>

				{/* Scrollable Stock List */}
				<ScrollArea className='flex-1 min-h-0 px-2'>
					<div className='space-y-1 pb-2'>
						{filteredStockSymbols.map((symbol) => {
							const actualIndex = stockSymbols.indexOf(symbol);
							return (
								<button
									key={symbol}
									onClick={() => setCurrentIndex(actualIndex)}
									className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
										actualIndex === currentIndex
											? 'bg-primary text-primary-foreground'
											: 'hover:bg-muted'
									}`}
								>
									<div className='flex items-center gap-2'>
										<span className='text-[10px] text-muted-foreground'>
											#{actualIndex + 1}
										</span>
										<span className='text-sm font-medium font-mono'>{symbol}</span>
									</div>
								</button>
							);
						})}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}
