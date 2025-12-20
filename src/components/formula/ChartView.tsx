/**
 * ChartView - Formula Results Chart View with True DI System (REFACTORED)
 * 
 * This is the MAIN chart view used in /mio-formulas/results
 * 
 * Layout:
 * - Panel 1 (Left - 5-15%): Compact vertical toolbar with icon buttons
 * - Panel 2 (Center - flex-1): Chart area (supports single/horizontal/vertical layouts)
 * - Panel 3 (Right - 14-40%): Stock list (scrollable)
 * 
 * Features:
 * - Navigate through formula result stocks
 * - 3 layouts: Single, Horizontal (50-50), Vertical (70-30)
 * - Dynamic slot-based rendering
 * - True DI: Indicators injected via config array
 * - Multiple resolution options
 * - Keyboard navigation (↑ ↓)
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { INDICATOR_REGISTRY } from '@/lib/chart/indicatorRegistry';
import { CVDSettings } from '@/components/chart/indicators/CVDSettings';
import { VolumeSettings } from '@/components/chart/indicators/VolumeSettings';
import { cn } from '@/lib/utils';
import type { Stock } from '@/types/stock';
import type { IChartApi } from 'lightweight-charts';
import type { OHLCVBar } from '@/lib/tradingview/types';
import { useWatchlistIntegration } from '@/hooks/useWatchlistIntegration';
import { WatchlistSearchDialog } from '@/components/chart/WatchlistSearchDialog';

interface ChartViewProps {
	stocks: Stock[];
	stockSymbols: string[];
	currentIndex: number;
	setCurrentIndex: (index: number) => void;
	onBackToTable: () => void;
	onSymbolJump?: (symbol: string) => void;
}

// Resolution configurations - VERIFIED through REAL API testing (Dec 18, 2025)
const RESOLUTIONS = [
	{ value: '1', label: '1min', barsCount: 500 },
	{ value: '5', label: '5min', barsCount: 1000 },
	{ value: '15', label: '15min', barsCount: 2000 },
	{ value: '75', label: '75min', barsCount: 1500 },
	{ value: '188', label: '188min', barsCount: 1000 },
	{ value: '1D', label: '1D', barsCount: 2000 },
	{ value: '1W', label: '1W', barsCount: 1500 },
	{ value: '1M', label: '1M', barsCount: 1000 },
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

	// SINGLE CENTRALIZED SETTINGS HOOK - TRUE DI SYSTEM
	const {
		isLoading,
		panelLayout,
		updatePanelLayout,
		getCurrentLayout,
		getSlot,
		updateSlot,
		updateIndicatorInSlot,
		setActiveLayout,
		updateGlobalSetting,
		activeLayout,
		globalSettings,
	} = useKVSettings();

	// Get current layout configuration
	const currentLayout = getCurrentLayout();

	// Chart instance refs for synchronization (support dynamic number of charts)
	const chartRefs = useRef<(IChartApi | null)[]>([]);
	const barsRefs = useRef<OHLCVBar[][]>([]);
	
	// Chart sync readiness tracker - incremented when charts/data load to trigger re-sync
	const [chartSyncVersion, setChartSyncVersion] = useState(0);

	// Local state for search (not persisted)
	const [searchQuery, setSearchQuery] = useState<string>('');

	// Chart focus state - now supports Tab key navigation for any number of charts
	const [focusedChartIndex, setFocusedChartIndex] = useState<number>(0);

	// Timeframe input state
	const [showTimeframeOverlay, setShowTimeframeOverlay] = useState(false);
	const [timeframeBuffer, setTimeframeBuffer] = useState('');

	// Symbol search state
	const [showSymbolSearch, setShowSymbolSearch] = useState(false);
	const [symbolSearchBuffer, setSymbolSearchBuffer] = useState('');

	// Watchlist dialog state
	const [showWatchlistDialog, setShowWatchlistDialog] = useState(false);

	// Watchlist integration
	const {
		watchlists,
		currentWatchlist,
		addToCurrentWatchlist,
		selectWatchlist,
		refreshWatchlists,
		isLoading: watchlistLoading,
		sessionStatus,
	} = useWatchlistIntegration({
		currentSymbol,
		currentStock,
	});

	// Determine if we're in dual view mode (2+ charts)
	const isDualView = currentLayout.slots.length > 1;

	// Navigation handlers
	const handlePrev = useCallback(() => {
		setCurrentIndex(Math.max(0, currentIndex - 1));
	}, [currentIndex, setCurrentIndex]);

	const handleNext = useCallback(() => {
		setCurrentIndex(Math.min(totalStocks - 1, currentIndex + 1));
	}, [currentIndex, totalStocks, setCurrentIndex]);

	// Tab key handler - cycle through charts in dual view
	const handleTabKey = useCallback(() => {
		if (isDualView) {
			setFocusedChartIndex(prev => (prev + 1) % currentLayout.slots.length);
		}
	}, [isDualView, currentLayout.slots.length]);

	const getResolutionConfig = (resolution: string) => {
		const found = RESOLUTIONS.find(r => r.value === resolution);
		if (found) return found;

		return {
			value: resolution,
			label: resolution,
			barsCount: 1000
		};
	};

	// Parse timeframe input to TradingView format
	const parseTimeframe = (input: string): string | null => {
		if (!input) return null;

		const normalized = input.trim();

		if (/^\d+$/.test(normalized)) {
			return normalized;
		}

		const match = normalized.match(/^(\d+)([sSmMdDwW])$/);
		if (match) {
			const [, number, suffix] = match;
			switch (suffix.toLowerCase()) {
				case 's':
					return `${number}S`;
				case 'm':
					return `${number}M`;
				case 'd':
					return `${number}D`;
				case 'w':
					return `${number}W`;
				default:
					return null;
			}
		}

		return null;
	};

	const isValidTimeframe = (input: string): boolean => {
		return parseTimeframe(input) !== null;
	};

	const handleTimeframeInput = (char: string) => {
		setShowTimeframeOverlay(true);
		const newBuffer = timeframeBuffer + char;
		setTimeframeBuffer(newBuffer);
	};

	const handleTimeframeBackspace = () => {
		if (timeframeBuffer.length > 0) {
			setTimeframeBuffer(timeframeBuffer.slice(0, -1));
		} else {
			setShowTimeframeOverlay(false);
		}
	};

	const findMatchingSymbols = (input: string): string[] => {
		if (!input) return [];
		// Search directly in symbol strings (e.g., "TCS" matches "TCS.NS")
		// Don't add prefixes - symbols are already in "SYMBOL.NS" format
		const searchUpper = input.toUpperCase();
		return stockSymbols.filter(symbol =>
			symbol.toUpperCase().includes(searchUpper)
		);
	};

	const handleSymbolInput = (char: string) => {
		if (showTimeframeOverlay && timeframeBuffer) {
			setSymbolSearchBuffer(timeframeBuffer + char);
			setTimeframeBuffer('');
			setShowTimeframeOverlay(false);
			setShowSymbolSearch(true);
		} else {
			setShowSymbolSearch(true);
			setShowTimeframeOverlay(false);
			const newBuffer = symbolSearchBuffer + char;
			setSymbolSearchBuffer(newBuffer);
		}
	};

	const handleSymbolBackspace = () => {
		if (symbolSearchBuffer.length > 0) {
			setSymbolSearchBuffer(symbolSearchBuffer.slice(0, -1));
		} else {
			setShowSymbolSearch(false);
		}
	};

	const jumpToSymbol = useCallback(() => {
		const matches = findMatchingSymbols(symbolSearchBuffer);
		if (matches.length > 0) {
			const targetSymbol = matches[0];
			const targetIndex = stockSymbols.indexOf(targetSymbol);
			if (targetIndex !== -1) {
				setCurrentIndex(targetIndex);
			}
		}
		// Reset symbol search
		setShowSymbolSearch(false);
		setSymbolSearchBuffer('');
	}, [symbolSearchBuffer, stockSymbols, setCurrentIndex]);

	const submitTimeframe = useCallback(() => {
		const parsed = parseTimeframe(timeframeBuffer);
		const currentSlot = getSlot(focusedChartIndex);
		if (parsed && currentSlot) {
			updateSlot(focusedChartIndex, { resolution: parsed });
			setShowTimeframeOverlay(false);
			setTimeframeBuffer('');
		}
	}, [timeframeBuffer, focusedChartIndex, getSlot, updateSlot]);

	// Chart ready callbacks that trigger sync re-initialization
	// IMPORTANT: Only increment version if the chart instance actually changed
	const handleChartReady = useCallback((chart: IChartApi, index: number) => {
		if (chartRefs.current[index] !== chart) {
			chartRefs.current[index] = chart;
			setChartSyncVersion(v => v + 1); // Trigger re-sync
		}
	}, []);

	const handleDataLoaded = useCallback((bars: OHLCVBar[], index: number) => {
		if (barsRefs.current[index] !== bars) {
			barsRefs.current[index] = bars;
			setChartSyncVersion(v => v + 1); // Trigger re-sync
		}
	}, []);

	// Handle panel resize - MUST be before early returns (React Hooks Rule)
	const handleMainPanelResize = useCallback((layout: Record<string, number>) => {
		const toolbar = layout['toolbar-panel'];
		const chart = layout['chart-panel'];
		const stockList = layout['stock-list-panel'];

		// Validate layout values
		if (!toolbar || !chart || !stockList || 
		    toolbar < 0 || chart < 0 || stockList < 0) {
			return;
		}

		const total = toolbar + chart + stockList;
		
		// Ensure total is approximately 100%
		if (Math.abs(total - 100) > 5) {
			return;
		}

		// Update panel layout (threshold check is now in useKVSettings)
		updatePanelLayout({
			'toolbar-panel': toolbar,
			'chart-panel': chart,
			'stock-list-panel': stockList,
		});
	}, [updatePanelLayout]);

	// Keyboard shortcuts - MUST be before early returns (React Hooks Rule)
	const inputMode: 'none' | 'timeframe' | 'symbol' = showTimeframeOverlay 
		? 'timeframe' 
		: showSymbolSearch 
		? 'symbol' 
		: 'none';

	useChartKeybindings({
		onNavigatePrev: handlePrev,
		onNavigateNext: handleNext,
		onTimeframeInput: handleTimeframeInput,
		onTimeframeBackspace: handleTimeframeBackspace,
		onTimeframeSubmit: submitTimeframe,
		onSymbolInput: handleSymbolInput,
		onSymbolBackspace: handleSymbolBackspace,
		onSymbolSubmit: jumpToSymbol,
		onTabKeyPress: handleTabKey,
		onWatchlistSearchOpen: () => setShowWatchlistDialog(true),
		onWatchlistQuickAdd: addToCurrentWatchlist,
		inputMode: showWatchlistDialog ? 'watchlist' : inputMode,
		activeChartIndex: focusedChartIndex,
		enabled: true,
	});

	// Cross-chart synchronization (only for dual view)
	// chartSyncVersion dependency forces re-sync when charts/data load
	useCrossChartSync({
		chart1: chartRefs.current[0],
		chart2: chartRefs.current[1],
		bars1D: barsRefs.current[0],
		bars188m: barsRefs.current[1],
		enabled: isDualView && chartSyncVersion > 0, // Only enable when charts have loaded
		rangeSyncEnabled: globalSettings.rangeSync,
	});

	// Show loading state while fetching settings
	if (isLoading) {
		return (
			<div className='h-full w-full flex items-center justify-center bg-background'>
				<div className='text-muted-foreground'>Loading settings...</div>
			</div>
		);
	}

	// Get focused slot for resolution/zoom controls
	const focusedSlot = getSlot(focusedChartIndex);

	// Filter stock symbols based on search query
	const filteredStockSymbols = searchQuery
		? stockSymbols.filter(symbol => 
			symbol.toLowerCase().includes(searchQuery.toLowerCase())
		  )
		: stockSymbols;

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
				>
					<div className='h-full w-full bg-muted/30 border-r border-border flex flex-col items-center py-4 gap-3'>
						{/* Layout Mode Toggle Buttons */}
						<div className='flex flex-col gap-1'>
							<Button
								variant={activeLayout === 'single' ? 'default' : 'outline'}
								size='icon'
								onClick={() => setActiveLayout('single')}
								className='h-10 w-10'
								title='Single Chart'
							>
								<LayoutList className='h-5 w-5' />
							</Button>
							<Button
								variant={activeLayout === 'horizontal' ? 'default' : 'outline'}
								size='icon'
								onClick={() => setActiveLayout('horizontal')}
								className='h-10 w-10'
								title='Horizontal Layout'
							>
								<LayoutPanelLeft className='h-5 w-5' />
							</Button>
							<Button
								variant={activeLayout === 'vertical' ? 'default' : 'outline'}
								size='icon'
								onClick={() => setActiveLayout('vertical')}
								className='h-10 w-10'
								title='Vertical Layout'
							>
								<LayoutPanelTop className='h-5 w-5' />
							</Button>
						</div>

						<Separator className='w-10' />

						{/* Range Sync Lock/Unlock Button (only in dual view) */}
						{isDualView && (
							<>
								<Button
									variant={globalSettings.rangeSync ? 'default' : 'outline'}
									size='icon'
									onClick={() => updateGlobalSetting('rangeSync', !globalSettings.rangeSync)}
									className='h-10 w-10'
									title={globalSettings.rangeSync ? 'Range Sync: Locked' : 'Range Sync: Unlocked'}
								>
									{globalSettings.rangeSync ? <Link className='h-5 w-5' /> : <Unlink className='h-5 w-5' />}
								</Button>

								<Separator className='w-10' />
							</>
						)}

						{/* Resolution Popover */}
						<Popover>
							<PopoverTrigger asChild>
								<Button variant='outline' size='icon' className='h-10 w-10 relative' title='Resolution Settings'>
									<Clock className='h-5 w-5' />
									{focusedSlot && (
										<span className='absolute -bottom-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded px-1 font-mono'>
											{focusedSlot.resolution}
										</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent side='right' className='w-[280px]'>
								<div className='space-y-4'>
									<h3 className='text-sm font-semibold'>Resolution Settings</h3>

									{currentLayout.slots.map((slot, slotIndex) => (
										<div key={slotIndex} className='space-y-2'>
											<Label className='text-xs'>
												{currentLayout.slots.length > 1 ? `Chart ${slotIndex + 1} Resolution` : 'Resolution'}
												{slotIndex === focusedChartIndex && ' (Focused)'}
											</Label>
											<Select 
												value={slot.resolution} 
												onValueChange={(val) => updateSlot(slotIndex, { resolution: val })}
											>
												<SelectTrigger className='h-9'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{RESOLUTIONS.map((res) => (
														<SelectItem key={res.value} value={res.value}>{res.label}</SelectItem>
													))}
												</SelectContent>
											</Select>

											{/* Zoom Level */}
											<div className='space-y-2 pt-2'>
												<Label className='text-xs'>Zoom Level</Label>
												<div className='grid grid-cols-4 gap-1'>
													{Object.values(ChartZoomLevel).map((level) => (
														<Button
															key={level}
															variant={slot.zoomLevel === level ? 'default' : 'outline'}
															size='sm'
															onClick={() => updateSlot(slotIndex, { zoomLevel: level })}
															className='h-8 text-xs'
														>
															{ZOOM_LABELS[level]}
														</Button>
													))}
												</div>
											</div>
										</div>
									))}
								</div>
							</PopoverContent>
						</Popover>

						<Separator className='w-10' />

						{/* Grid Toggle Button */}
						<Button
							variant={globalSettings.showGrid ? 'default' : 'outline'}
							size='icon'
							onClick={() => updateGlobalSetting('showGrid', !globalSettings.showGrid)}
							className='h-10 w-10'
							title={globalSettings.showGrid ? 'Hide Grid' : 'Show Grid'}
						>
							<Grid3x3 className='h-5 w-5' />
						</Button>

						<Separator className='w-10' />

						{/* Indicator Settings Popover */}
						<Popover>
							<PopoverTrigger asChild>
								<Button variant='outline' size='icon' className='h-10 w-10 relative' title='Indicator Settings'>
									<TrendingUp className='h-5 w-5' />

								</Button>
							</PopoverTrigger>
							<PopoverContent side='right' className='w-[380px] max-h-[600px] overflow-y-auto'>
								<div className='space-y-4'>
									<h3 className='text-sm font-semibold'>Indicator Settings</h3>

									{/* Dynamic Indicator Rendering per Slot */}
									{currentLayout.slots.map((slot, slotIndex) => (
										<div key={slotIndex} className='space-y-3 p-3 border rounded-lg bg-muted/30'>
											<Label className='text-sm font-medium'>
												{currentLayout.slots.length > 1 ? `Chart ${slotIndex + 1} Indicators` : 'Indicators'}
											</Label>
											
											{slot.indicators.map(indicator => {
												const definition = INDICATOR_REGISTRY[indicator.type];
												
												return (
													<div key={indicator.type} className='space-y-2'>
														{/* Toggle checkbox */}
														<div className='flex items-center justify-between'>
															<Label className='text-xs'>{definition.label}</Label>
															<Checkbox
																checked={indicator.enabled}
																onCheckedChange={(checked) => 
																	updateIndicatorInSlot(slotIndex, indicator.type, { enabled: !!checked })
																}
															/>
														</div>
														
														{/* Settings component (injected based on type) */}
														{indicator.enabled && indicator.type === 'cvd' && (
															<CVDSettings
																settings={indicator.settings ?? {}}
																onChange={(newSettings) => 
																	updateIndicatorInSlot(slotIndex, 'cvd', { settings: newSettings })
																}
															/>
														)}
														
														{indicator.enabled && indicator.type === 'volume' && (
															<VolumeSettings
																settings={indicator.settings ?? {}}
																onChange={(newSettings) => 
																	updateIndicatorInSlot(slotIndex, 'volume', { settings: newSettings })
																}
																globalSettings={globalSettings}
																onGlobalChange={(key, value) => updateGlobalSetting(key, value)}
															/>
														)}
													</div>
												);
											})}
										</div>
									))}
								</div>
							</PopoverContent>
						</Popover>
					</div>
				</Panel>

				<ResizeHandle className='w-1 bg-border hover:bg-primary transition-colors cursor-col-resize' />

				{/* Panel 2: Chart Area (CENTER - Maximum Space) */}
				<Panel
					defaultSize={panelLayout['chart-panel']}
					minSize="30%"
					collapsible={false}
					id='chart-panel'
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

						{/* Chart Content Area - Dynamic Slot-Based Rendering */}
						<div className='flex-1 min-h-0 p-4'>
							{currentLayout.slots.length === 1 ? (
								// Single chart view
								<div className='h-full bg-background rounded-lg border overflow-hidden'>
									<div className='p-2 border-b border-border bg-muted/30'>
										<p className='text-xs font-medium text-muted-foreground'>
											{getResolutionConfig(currentLayout.slots[0].resolution).label}
										</p>
									</div>
									<div className='p-2 h-[calc(100%-2.5rem)] relative'>
										<TradingViewLiveChart
											symbol={currentSymbol}
											resolution={currentLayout.slots[0].resolution}
											barsCount={getResolutionConfig(currentLayout.slots[0].resolution).barsCount}
											height={RESPONSIVE_CHART_HEIGHT}
											zoomLevel={(currentLayout.slots[0].zoomLevel || ChartZoomLevel.MAX) as ChartZoomLevel}
											indicators={currentLayout.slots[0].indicators}
											global={globalSettings}
											onChartReady={(chart) => handleChartReady(chart, 0)}
											onDataLoaded={(bars) => handleDataLoaded(bars, 0)}
										/>
									</div>
								</div>
							) : (
								// Multi-chart view (horizontal or vertical)
								<PanelGroup
									orientation={currentLayout.mode}
									className='h-full w-full'
									id='dual-chart-group'
								>
									{currentLayout.slots.map((slot, slotIndex) => (
										<Panel 
											key={slotIndex}
											defaultSize={currentLayout.slotSizes?.[slotIndex] || 50}
											minSize="20%"
										>
											<div
												className={cn(
													'h-full bg-background rounded-lg border overflow-hidden transition-all cursor-pointer',
													focusedChartIndex === slotIndex
														? 'border-primary ring-2 ring-primary/20'
														: 'border-border'
												)}
												onClick={() => setFocusedChartIndex(slotIndex)}
												role='button'
												tabIndex={0}
												aria-label={`Chart ${slotIndex + 1} - ${getResolutionConfig(slot.resolution).label}${focusedChartIndex === slotIndex ? ' (focused)' : ''}`}
											>
												<div className='p-2 border-b border-border bg-muted/30'>
													<p className='text-xs font-medium text-muted-foreground'>
														{getResolutionConfig(slot.resolution).label}
														{focusedChartIndex === slotIndex && (
															<span className='ml-2 text-[10px] text-primary'>● Focused</span>
														)}
													</p>
												</div>
												<div className='p-2 h-[calc(100%-2.5rem)] relative'>
													<TradingViewLiveChart
														symbol={currentSymbol}
														resolution={slot.resolution}
														barsCount={getResolutionConfig(slot.resolution).barsCount}
														height={RESPONSIVE_CHART_HEIGHT}
														zoomLevel={(slot.zoomLevel || ChartZoomLevel.MAX) as ChartZoomLevel}
														indicators={slot.indicators}
														global={globalSettings}
														onChartReady={(chart) => handleChartReady(chart, slotIndex)}
														onDataLoaded={(bars) => handleDataLoaded(bars, slotIndex)}
													/>
												</div>
											</div>
										</Panel>
									))}
								</PanelGroup>
							)}
						</div>
					</div>
				</Panel>

				<ResizeHandle className='w-1 bg-border hover:bg-primary transition-colors cursor-col-resize' />

				{/* Panel 3: Stock List (RIGHT) */}
				<Panel
					defaultSize={panelLayout['stock-list-panel']}
					minSize="14%"
					maxSize="40%"
					collapsible={false}
					id='stock-list-panel'
				>
					<div className='h-full w-full bg-muted/30 border-l border-border flex flex-col'>
						{/* Current Watchlist Indicator */}
						{currentWatchlist && (
							<div className='p-2 border-b border-border bg-primary/10'>
								<div className='flex items-center gap-2'>
									<span className='text-xs font-medium'>
										🎯 {currentWatchlist.name}
									</span>
									<Badge variant='outline' className='text-[10px]'>
										{currentWatchlist.platforms.join(' + ').toUpperCase()}
									</Badge>
								</div>
							</div>
						)}

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
					dualViewMode={isDualView}
					onSubmit={() => {
						const parsed = parseTimeframe(timeframeBuffer);
						if (parsed && focusedSlot) {
							updateSlot(focusedChartIndex, { resolution: parsed });
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

			{/* Watchlist Search Dialog */}
			{showWatchlistDialog && (
				<WatchlistSearchDialog
					open={showWatchlistDialog}
					onClose={() => setShowWatchlistDialog(false)}
					onSelect={async (watchlist) => {
						await selectWatchlist(watchlist.id);
						setShowWatchlistDialog(false);
					}}
					watchlists={watchlists}
					currentWatchlist={currentWatchlist}
					currentStock={currentStock || { symbol: currentSymbol, name: currentSymbol }}
					refreshWatchlists={refreshWatchlists}
				/>
			)}
		</div>
	);
}
