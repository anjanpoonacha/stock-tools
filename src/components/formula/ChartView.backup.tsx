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

import React, { useState, useEffect, useRef } from 'react';
import { TradingViewLiveChart } from '@/components/TradingViewLiveChart';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowLeft, LayoutGrid, LayoutList, Clock, Grid3x3, TrendingUp, Search, LayoutPanelLeft, LayoutPanelTop, Link, Unlink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Group as PanelGroup, Panel, Separator as ResizeHandle } from 'react-resizable-panels';
import { ChartZoomLevel } from '@/lib/chart/types';
import { RESPONSIVE_CHART_HEIGHT, ZOOM_LABELS } from '@/lib/chart/constants';
import { useChartKeybindings } from '@/hooks/useChartKeybindings';
import { useCrossChartSync } from '@/hooks/useCrossChartSync';
import { TimeframeInputOverlay } from '@/components/chart/TimeframeInputOverlay';
import { SymbolSearchOverlay } from '@/components/chart/SymbolSearchOverlay';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useKVSettings } from '@/hooks/useKVSettings';
import { cn } from '@/lib/utils';
import type { Stock } from '@/types/stock';
import type { IChartApi } from 'lightweight-charts';
import type { OHLCVBar } from '@/lib/tradingview/types';

interface ChartViewProps {
	stocks: Stock[];
	stockSymbols: string[];
	currentIndex: number;
	setCurrentIndex: (index: number) => void;
	onBackToTable: () => void;
	onSymbolJump?: (symbol: string) => void; // Optional: for jumping to symbols not in list
}

// Resolution configurations - VERIFIED through REAL API testing (Dec 18, 2025)
// Test results: scripts/poc-output/bar-count-real-test-results.json
// All values tested with NSE:RELIANCE, 100% success rate (17/17 tests passed)
const RESOLUTIONS = [
	{ value: '1', label: '1min', barsCount: 500 },      // NEW: 1 minute (keyboard shortcut support)
	{ value: '5', label: '5min', barsCount: 1000 },     // ✅ TESTED: 17 days, 888ms
	{ value: '15', label: '15min', barsCount: 2000 },   // ✅ TESTED: 118 days (~4 months), 1862ms
	{ value: '75', label: '75min', barsCount: 1500 },   // Conservative (scaled from 15min)
	{ value: '188', label: '188min', barsCount: 1000 }, // Conservative (scaled from 15min)
	{ value: '1D', label: '1D', barsCount: 2000 },      // ✅ TESTED: 2947 days (~8 years), 1194ms
	{ value: '1W', label: '1W', barsCount: 1500 },      // ✅ TESTED: 10493 days (~29 years), 1166ms
	{ value: '1M', label: '1M', barsCount: 1000 },      // NEW: 1 Month (keyboard shortcut support)
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
	stocks,
	stockSymbols,
	currentIndex,
	setCurrentIndex,
	onBackToTable,
	onSymbolJump,
}: ChartViewProps) {
	const currentSymbol = stockSymbols[currentIndex];
	const currentStock = stocks[currentIndex];
	const totalStocks = stockSymbols.length;

	// SINGLE CENTRALIZED SETTINGS HOOK - ONLY SOURCE OF TRUTH
	const {
		isLoading,
		isLoaded,
		panelLayout,
		updatePanelLayout,
		chartSettings,
		updateChartSetting,
		layoutMode,
		rangeSync,
		updateLayoutMode,
		updateRangeSync,
	} = useKVSettings();

	// Chart instance refs for synchronization
	const chart1Ref = useRef<IChartApi | null>(null);
	const chart2Ref = useRef<IChartApi | null>(null);

	// Chart bars state for sync
	const [bars1, setBars1] = useState<OHLCVBar[]>([]);
	const [bars2, setBars2] = useState<OHLCVBar[]>([]);

	// Local state for search (not persisted)
	const [searchQuery, setSearchQuery] = useState<string>('');

	// Chart focus state for dual view mode - now supports Tab key navigation
	const [focusedChartIndex, setFocusedChartIndex] = useState<number>(0);

	// Timeframe input state
	const [showTimeframeOverlay, setShowTimeframeOverlay] = useState(false);
	const [timeframeBuffer, setTimeframeBuffer] = useState('');

	// Symbol search state
	const [showSymbolSearch, setShowSymbolSearch] = useState(false);
	const [symbolSearchBuffer, setSymbolSearchBuffer] = useState('');

	// Destructure chart settings for easier access
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
	} = chartSettings;

	console.log('[ChartView] 🎯 Using centralized KV settings hook');
	console.log('[ChartView] currentSymbol:', currentSymbol);
	console.log('[ChartView] Chart settings:', chartSettings);
	console.log('[ChartView] Panel layout:', panelLayout);
	console.log('[ChartView] Layout mode:', layoutMode, '| Range sync:', rangeSync);

	const handlePrev = () => {
		setCurrentIndex(Math.max(0, currentIndex - 1));
	};

	const handleNext = () => {
		setCurrentIndex(Math.min(totalStocks - 1, currentIndex + 1));
	};

	const getResolutionConfig = (resolution: string) => {
		const found = RESOLUTIONS.find(r => r.value === resolution);
		if (found) return found;

		// For custom resolutions, create a config on the fly
		// Default to 1000 bars for most timeframes
		return {
			value: resolution,
			label: resolution,
			barsCount: 1000
		};
	};

	// Parse timeframe input to TradingView format
	// Examples: 1 → "1", 2 → "2", 1s → "1S", 1M → "1M", 1d → "1D", 1w → "1W"
	const parseTimeframe = (input: string): string | null => {
		if (!input) return null;

		const normalized = input.trim();

		// Just a number = minutes
		if (/^\d+$/.test(normalized)) {
			return normalized;
		}

		// Number + suffix
		const match = normalized.match(/^(\d+)([sSmMdDwW])$/);
		if (match) {
			const [, number, suffix] = match;
			// Convert to TradingView format
			switch (suffix.toLowerCase()) {
				case 's':
					return `${number}S`; // Seconds
				case 'm':
					// lowercase m = month (as per user requirement)
					return `${number}M`;
				case 'd':
					return `${number}D`; // Days
				case 'w':
					return `${number}W`; // Weeks
				default:
					return null;
			}
		}

		return null;
	};

	// Check if input is valid timeframe
	const isValidTimeframe = (input: string): boolean => {
		return parseTimeframe(input) !== null;
	};

	// Handle timeframe input from keyboard
	const handleTimeframeInput = (char: string) => {
		setShowTimeframeOverlay(true);

		// Append to buffer
		const newBuffer = timeframeBuffer + char;
		setTimeframeBuffer(newBuffer);
	};

	// Handle backspace in timeframe input
	const handleTimeframeBackspace = () => {
		if (timeframeBuffer.length > 0) {
			// Remove last character
			setTimeframeBuffer(timeframeBuffer.slice(0, -1));
		} else {
			// If buffer is empty, close the overlay
			setShowTimeframeOverlay(false);
		}
	};

	// Parse symbol input and add NSE: prefix if needed
	const parseSymbolInput = (input: string): string => {
		if (!input) return '';

		// Already has exchange prefix
		if (input.includes(':')) {
			return input;
		}

		// Add NSE: prefix by default
		return `NSE:${input}`;
	};

	// Find matching symbols in the stock list
	const findMatchingSymbols = (input: string): string[] => {
		if (!input) return [];

		const parsedInput = parseSymbolInput(input);
		const searchUpper = parsedInput.toUpperCase();

		// Find symbols that contain the search string
		return stockSymbols.filter(symbol =>
			symbol.toUpperCase().includes(searchUpper)
		);
	};

	// Handle symbol input from keyboard
	const handleSymbolInput = (char: string) => {
		// If switching from timeframe mode to symbol mode, transfer the buffer
		if (showTimeframeOverlay && timeframeBuffer) {
			// User typed something like "5" then "P" → wanting "5PAISA"
			// Transfer timeframe buffer to symbol buffer
			setSymbolSearchBuffer(timeframeBuffer + char);
			setTimeframeBuffer('');
			setShowTimeframeOverlay(false);
			setShowSymbolSearch(true);
		} else {
			// Normal symbol input
			setShowSymbolSearch(true);
			setShowTimeframeOverlay(false);

			// Append to buffer
			const newBuffer = symbolSearchBuffer + char;
			setSymbolSearchBuffer(newBuffer);
		}
	};

	// Handle backspace in symbol search
	const handleSymbolBackspace = () => {
		if (symbolSearchBuffer.length > 0) {
			// Remove last character
			setSymbolSearchBuffer(symbolSearchBuffer.slice(0, -1));
		} else {
			// If buffer is empty, close the overlay
			setShowSymbolSearch(false);
		}
	};

	// Jump to matching symbol
	const jumpToSymbol = () => {
		const matches = findMatchingSymbols(symbolSearchBuffer);

		if (matches.length > 0) {
			// Jump to first match in the list
			const targetSymbol = matches[0];
			const targetIndex = stockSymbols.indexOf(targetSymbol);
			if (targetIndex !== -1) {
				setCurrentIndex(targetIndex);
			}

			// Clear and close
			setSymbolSearchBuffer('');
			setShowSymbolSearch(false);
		} else if (symbolSearchBuffer && onSymbolJump) {
			// No matches in list, but user typed a symbol - try to load it
			const parsedSymbol = parseSymbolInput(symbolSearchBuffer);
			onSymbolJump(parsedSymbol);

			// Clear and close
			setSymbolSearchBuffer('');
			setShowSymbolSearch(false);
		}
	};

	// Handle layout mode toggle (centralized hook handles persistence)
	const handleLayoutModeToggle = () => {
		const newMode = layoutMode === 'horizontal' ? 'vertical' : 'horizontal';
		updateLayoutMode(newMode);
	};

	// Handle range sync toggle (centralized hook handles persistence)
	const handleRangeSyncToggle = () => {
		updateRangeSync(!rangeSync);
	};

	// Apply chart synchronization - crosshair always on, range sync controlled by button
	useCrossChartSync({
		chart1: chart1Ref.current,
		chart2: chart2Ref.current,
		bars1D: bars1,
		bars188m: bars2,
		enabled: dualViewMode, // Only sync when in dual view mode
		rangeSyncEnabled: rangeSync,
	});

	// Force chart resize when layout mode or dual view mode changes
	useEffect(() => {
		// Small delay to let DOM update with new layout
		const timer = setTimeout(() => {
			console.log('[Layout Debug] Layout changed - dualViewMode:', dualViewMode, 'layoutMode:', layoutMode);

			// Manually trigger resize on charts if they exist
			// This ensures charts update immediately when layout changes
			if (chart1Ref.current) {
				const container1 = chart1Ref.current.chartElement()?.parentElement;
				if (container1) {
					const { width, height } = container1.getBoundingClientRect();
					chart1Ref.current.applyOptions({
						width: Math.floor(width),
						height: Math.floor(height),
					});
					console.log('[Layout Debug] Resized chart1:', width, 'x', height);
				}
			}

			if (chart2Ref.current) {
				const container2 = chart2Ref.current.chartElement()?.parentElement;
				if (container2) {
					const { width, height } = container2.getBoundingClientRect();
					chart2Ref.current.applyOptions({
						width: Math.floor(width),
						height: Math.floor(height),
					});
					console.log('[Layout Debug] Resized chart2:', width, 'x', height);
				}
			}
		}, 150); // Increased delay to ensure DOM updates complete

		return () => clearTimeout(timer);
	}, [layoutMode, dualViewMode]);

	// Tab key focus switching between charts
	useEffect(() => {
		if (!dualViewMode) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Only handle Tab when not in input overlays
			if (showTimeframeOverlay || showSymbolSearch) return;

			if (e.key === 'Tab' && !e.shiftKey) {
				e.preventDefault();
				// Toggle between chart 0 and 1
				setFocusedChartIndex(prev => prev === 0 ? 1 : 0);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [dualViewMode, showTimeframeOverlay, showSymbolSearch]);

	// Determine current input mode based on which overlay is active
	const inputMode = showTimeframeOverlay ? 'timeframe' : showSymbolSearch ? 'symbol' : 'none';

	// Centralized keyboard shortcuts
	useChartKeybindings({
		onNavigatePrev: handlePrev,
		onNavigateNext: handleNext,
		onTimeframeInput: handleTimeframeInput,
		onTimeframeBackspace: handleTimeframeBackspace,
		onSymbolInput: handleSymbolInput,
		onSymbolBackspace: handleSymbolBackspace,
		inputMode,
		activeChartIndex: focusedChartIndex,
		enabled: true,
	});

	// Filter stocks based on search
	const filteredStockSymbols = stockSymbols.filter(symbol =>
		symbol.toLowerCase().includes(searchQuery.toLowerCase())
	);

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

	// Handle panel resize (centralized hook handles debouncing and persistence)
	const handleMainPanelResize = (layout: Record<string, number>) => {
		const toolbar = layout['toolbar-panel'];
		const chart = layout['chart-panel'];
		const stockList = layout['stock-list-panel'];

		console.log('🎯 [Panel Sizes]', {
			toolbar: `${toolbar?.toFixed(1)}%`,
			chart: `${chart?.toFixed(1)}%`,
			stockList: `${stockList?.toFixed(1)}%`,
			total: `${(toolbar + chart + stockList).toFixed(1)}%`,
			rawLayout: layout
		});

		// Update panel layout (centralized hook handles debouncing and saving)
		updatePanelLayout({
			'toolbar-panel': toolbar,
			'chart-panel': chart,
			'stock-list-panel': stockList,
		});
	};

	// Show loading state while fetching settings
	if (isLoading) {
		return (
			<div className='h-full w-full flex items-center justify-center bg-background'>
				<div className='text-muted-foreground'>Loading settings...</div>
			</div>
		);
	}

	return (
		<div className='h-full w-full flex overflow-hidden bg-background'>
			<PanelGroup
				orientation='horizontal'
				onLayoutChange={handleMainPanelResize}
				id='main-panel-group'
			>
				{/* Panel 1: Compact Toolbar (LEFT) */}
				<Panel
					defaultSize={panelLayout['toolbar-panel']}
					minSize="5%"
					maxSize="15%"
					collapsible={false}
					id='toolbar-panel'
					order={1}
				>
					<div className='h-full w-full bg-muted/30 border-r border-border flex flex-col items-center py-4 gap-3'>
						{/* View Mode Toggle Button */}
						<Button
							variant={dualViewMode ? 'default' : 'outline'}
							size='icon'
							onClick={() => updateChartSetting('dualViewMode', !dualViewMode)}
							className='h-10 w-10'
							title={`View Mode: ${dualViewMode ? 'Dual' : 'Single'}`}
						>
							{dualViewMode ? <LayoutGrid className='h-5 w-5' /> : <LayoutList className='h-5 w-5' />}
						</Button>

						<Separator className='w-10' />

						{/* Layout Mode Toggle (only in dual view) */}
						{dualViewMode && (
							<>
								<Button
									variant='outline'
									size='icon'
									onClick={handleLayoutModeToggle}
									className='h-10 w-10'
									title={`Layout: ${layoutMode === 'horizontal' ? 'Horizontal' : 'Vertical'}`}
								>
									{layoutMode === 'horizontal' ? <LayoutPanelLeft className='h-5 w-5' /> : <LayoutPanelTop className='h-5 w-5' />}
								</Button>

								{/* Range Sync Lock/Unlock Button */}
								<Button
									variant={rangeSync ? 'default' : 'outline'}
									size='icon'
									onClick={handleRangeSyncToggle}
									className='h-10 w-10'
									title={rangeSync ? 'Range Sync: Locked' : 'Range Sync: Unlocked'}
								>
									{rangeSync ? <Link className='h-5 w-5' /> : <Unlink className='h-5 w-5' />}
								</Button>

								<Separator className='w-10' />
							</>
						)}

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
								<Select value={resolution1} onValueChange={(val) => updateChartSetting('resolution1', val)}>
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
									<Select value={resolution2} onValueChange={(val) => updateChartSetting('resolution2', val)}>
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
											onClick={() => updateChartSetting('zoomLevel1', level)}
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
												onClick={() => updateChartSetting('zoomLevel2', level)}
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
					onClick={() => updateChartSetting('showGrid', !showGrid)}
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
									onCheckedChange={(checked) => updateChartSetting('showCVD', checked === true)}
								/>
							</div>

							{showCVD && (
								<div className='space-y-3 pt-2 border-t'>
									{/* Anchor Period */}
									<div className='space-y-2'>
										<Label className='text-xs'>Anchor Period</Label>
										<Select value={cvdAnchorPeriod} onValueChange={(val) => updateChartSetting('cvdAnchorPeriod', val)}>
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
											onCheckedChange={(checked) => updateChartSetting('cvdUseCustomPeriod', checked === true)}
										/>
										<Label htmlFor='cvd-custom-popup' className='text-xs cursor-pointer'>
											Use Custom Period
										</Label>
									</div>

									{/* Custom Period */}
									{cvdUseCustomPeriod && (
										<div className='space-y-2'>
											<Label className='text-xs'>Custom Period</Label>
											<Select value={cvdCustomPeriod} onValueChange={(val) => updateChartSetting('cvdCustomPeriod', val)}>
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
				</Panel>

				<ResizeHandle className='w-1 bg-border hover:bg-primary transition-colors' />

				{/* Panel 2: Chart Area (CENTER - Maximum Space) */}
				<Panel
					defaultSize={panelLayout['chart-panel']}
					minSize="30%"
					collapsible={false}
					id='chart-panel'
					order={2}
				>
					<div className='h-full w-full flex flex-col'>
				{/* Thin Header - 50px */}
				<div className='h-[50px] flex items-center justify-between px-6 border-b border-border bg-muted/30 flex-shrink-0'>
					<div className='flex items-center gap-3 flex-wrap'>
						<Button
							variant='outline'
							size='sm'
							onClick={onBackToTable}
							className='h-7'
						>
							<ArrowLeft className='h-3 w-3 mr-1' />
							Table
						</Button>

						<div className='flex items-center gap-2'>
							<Badge variant='default' className='font-mono'>{currentSymbol}</Badge>
							<span className='text-xs text-muted-foreground'>
								{currentIndex + 1} / {totalStocks}
							</span>
						</div>

						{/* Sector and Industry */}
						{(currentStock?.sector || currentStock?.industry) && (
							<div className='flex items-center gap-2 text-xs text-muted-foreground'>
								<span>•</span>
								{currentStock.sector && (
									<span className='px-2 py-0.5 rounded bg-muted border border-border'>
										{currentStock.sector}
									</span>
								)}
								{currentStock.industry && (
									<span className='px-2 py-0.5 rounded bg-muted border border-border'>
										{currentStock.industry}
									</span>
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
							onClick={handlePrev}
							disabled={currentIndex === 0}
							className='h-7 px-2'
							title='Previous stock (↑)'
						>
							<ChevronLeft className='h-3 w-3' />
						</Button>
						<span className='text-[10px] text-muted-foreground font-mono'>↑ ↓</span>
						<Button
							variant='outline'
							size='sm'
							onClick={handleNext}
							disabled={currentIndex === totalStocks - 1}
							className='h-7 px-2'
							title='Next stock (↓)'
						>
							<ChevronRight className='h-3 w-3' />
						</Button>
					</div>
				</div>

						{/* Chart Content Area */}
						<div className='flex-1 min-h-0 p-4'>
							{dualViewMode ? (
								<PanelGroup
								orientation={layoutMode}
								className='h-full w-full'
								id={`dual-chart-${layoutMode}`}
							>
										{/* Chart 1 */}
										<Panel defaultSize={50} minSize={20} order={1}>
										<div
											className={cn(
												'h-full bg-background rounded-lg border overflow-hidden transition-all cursor-pointer',
												focusedChartIndex === 0
													? 'border-primary ring-2 ring-primary/20'
													: 'border-border'
											)}
											onClick={() => setFocusedChartIndex(0)}
											role='button'
											tabIndex={0}
											aria-label={`Chart 1 - ${getResolutionConfig(resolution1).label}${focusedChartIndex === 0 ? ' (focused)' : ''}`}
										>
											<div className='p-2 border-b border-border bg-muted/30'>
												<p className='text-xs font-medium text-muted-foreground'>
													{getResolutionConfig(resolution1).label}
													{focusedChartIndex === 0 && (
														<span className='ml-2 text-[10px] text-primary'>● Focused</span>
													)}
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
													showVolumeMA={chartSettings.showVolumeMA}
													volumeMALength={chartSettings.volumeMALength}
													onChartReady={(chart) => { chart1Ref.current = chart; }}
													onDataLoaded={(bars) => setBars1(bars)}
												/>
											</div>
										</div>
									</Panel>

									<ResizeHandle className={cn(
										'transition-colors',
										layoutMode === 'horizontal' ? 'w-1 bg-border hover:bg-primary' : 'h-1 bg-border hover:bg-primary'
									)} />

									{/* Chart 2 */}
									<Panel defaultSize={50} minSize={20} order={2}>
										<div
											className={cn(
												'h-full bg-background rounded-lg border overflow-hidden transition-all cursor-pointer',
												focusedChartIndex === 1
													? 'border-primary ring-2 ring-primary/20'
													: 'border-border'
											)}
											onClick={() => setFocusedChartIndex(1)}
											role='button'
											tabIndex={0}
											aria-label={`Chart 2 - ${getResolutionConfig(resolution2).label}${focusedChartIndex === 1 ? ' (focused)' : ''}`}
										>
											<div className='p-2 border-b border-border bg-muted/30'>
												<p className='text-xs font-medium text-muted-foreground'>
													{getResolutionConfig(resolution2).label}
													{focusedChartIndex === 1 && (
														<span className='ml-2 text-[10px] text-primary'>● Focused</span>
													)}
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
													showVolumeMA={chartSettings.showVolumeMA}
													volumeMALength={chartSettings.volumeMALength}
													onChartReady={(chart) => { chart2Ref.current = chart; }}
													onDataLoaded={(bars) => setBars2(bars)}
												/>
											</div>
										</div>
									</Panel>
								</PanelGroup>
							) : (
								// Single chart view
								<div className='h-full bg-background rounded-lg border overflow-hidden'>
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
											showVolumeMA={chartSettings.showVolumeMA}
											volumeMALength={chartSettings.volumeMALength}
											onChartReady={(chart) => { chart1Ref.current = chart; }}
											onDataLoaded={(bars) => setBars1(bars)}
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				</Panel>

				<ResizeHandle className='w-1 bg-border hover:bg-primary transition-colors' />

				{/* Panel 3: Stock List (RIGHT) */}
				<Panel
					defaultSize={panelLayout['stock-list-panel']}
					minSize="14%"
					maxSize="40%"
					collapsible={false}
					id='stock-list-panel'
					order={3}
				>
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
											onClick={() => setCurrentIndex(actualIndex)}
											className={`w-full text-left px-2 py-1.5 rounded-md transition-colors ${
												actualIndex === currentIndex
													? 'bg-primary text-primary-foreground'
													: 'hover:bg-muted'
											}`}
										>
											<div className='flex items-center gap-1.5'>
												<span className='text-[9px] text-muted-foreground'>
													#{actualIndex + 1}
												</span>
												<span className='text-xs font-medium font-mono'>{symbol}</span>
											</div>
										</button>
									);
								})}
							</div>
						</ScrollArea>
					</div>
				</Panel>
			</PanelGroup>

			{/* Timeframe Input Overlay */}
			{showTimeframeOverlay && (
				<TimeframeInputOverlay
					input={timeframeBuffer}
					isValid={isValidTimeframe(timeframeBuffer)}
					activeChartIndex={focusedChartIndex}
					dualViewMode={dualViewMode}
					onSubmit={() => {
						const parsed = parseTimeframe(timeframeBuffer);
						if (parsed) {
							if (focusedChartIndex === 0) {
								updateChartSetting('resolution1', parsed);
							} else {
								updateChartSetting('resolution2', parsed);
							}
							setShowTimeframeOverlay(false);
							setTimeframeBuffer('');
						}
					}}
					onCancel={() => {
						setShowTimeframeOverlay(false);
						setTimeframeBuffer('');
					}}
				/>
			)}

			{/* Symbol Search Overlay */}
			{showSymbolSearch && (
				<SymbolSearchOverlay
					input={symbolSearchBuffer}
					matchingSymbols={findMatchingSymbols(symbolSearchBuffer)}
					currentSymbol={currentSymbol}
					onSubmit={jumpToSymbol}
					onCancel={() => {
						setShowSymbolSearch(false);
						setSymbolSearchBuffer('');
					}}
				/>
			)}
		</div>
	);
}
