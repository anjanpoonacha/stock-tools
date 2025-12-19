/**
 * TradingView Live Chart Component - TRUE DEPENDENCY INJECTION
 * 
 * Renders real TradingView chart data using Lightweight Charts library.
 * Fetches historical OHLCV data from the /api/chart-data endpoint.
 * 
 * Features:
 * - Dependency Injection architecture for indicators
 * - No hardcoded indicator knowledge
 * - Indicators injected via indicators[] array
 * - Fully scalable and extensible
 */

'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useTheme } from 'next-themes';
import {
	createChart,
	type IChartApi,
	ColorType,
	CandlestickSeries,
	LineSeries,
	HistogramSeries
} from 'lightweight-charts';
import { useAuth } from '@/contexts/AuthContext';
import type { OHLCVBar, SymbolMetadata, StudyData } from '@/lib/tradingview/types';
import { useChartData } from '@/hooks/useChartData';
import { useChartDimensions } from '@/hooks/useChartDimensions';
import { parseChartHeight, applyZoom } from '@/lib/chart/utils';
import { DEFAULT_CHART_HEIGHT } from '@/lib/chart/constants';
import { ChartLoadingOverlay } from '@/components/ui/chart-loading-overlay';
import { ChartZoomLevel, type ChartHeight } from '@/lib/chart/types';
import { calculateVolumeEMA } from '@/lib/chart/championTrader';
import type { IndicatorConfig, GlobalSettings } from '@/types/chartSettings';

interface TradingViewLiveChartProps {
	symbol?: string;
	resolution?: string;
	zoomLevel?: ChartZoomLevel;
	indicators: IndicatorConfig[];  // DI: Array of indicator configs
	global: GlobalSettings;          // DI: Global settings
	height?: ChartHeight;            // Support both number and '100%'
	barsCount?: number;
	chartData?: {
		bars: OHLCVBar[];
		metadata: Partial<SymbolMetadata>;
		indicators?: {
			cvd?: StudyData;
		};
	};
	isStreaming?: boolean;
	// Callback props
	onChartReady?: (chart: IChartApi) => void;
	onDataLoaded?: (bars: OHLCVBar[]) => void;
}

// Removed - now imported from useChartData hook

interface SMADataPoint {
	time: number;
	value: number;
}

/**
 * Calculate Simple Moving Average (SMA)
 * @param bars - Historical OHLCV bars
 * @param period - Number of periods for SMA calculation
 * @returns Array of SMA data points
 */
function calculateSMA(bars: OHLCVBar[], period: number): SMADataPoint[] {
	const smaData: SMADataPoint[] = [];
	
	for (let i = period - 1; i < bars.length; i++) {
		let sum = 0;
		for (let j = 0; j < period; j++) {
			sum += bars[i - j].close;
		}
		const average = sum / period;
		smaData.push({
			time: bars[i].time,
			value: average
		});
	}
	
	return smaData;
}

/**
 * TradingView Live Chart Component
 * 
 * Displays historical price data using TradingView Lightweight Charts.
 * Data is fetched from TradingView's WebSocket API via our backend.
 * 
 * TRUE DEPENDENCY INJECTION:
 * - No hardcoded knowledge of specific indicators
 * - All indicators injected via indicators[] array
 * - Chart renders whatever is injected
 */
export function TradingViewLiveChart({
	symbol = 'NSE:JUNIPER',
	resolution = '1D',
	zoomLevel = ChartZoomLevel.MAX,
	indicators,
	global,
	height = DEFAULT_CHART_HEIGHT,
	barsCount = 300,
	chartData: providedChartData,
	isStreaming = false,
	onChartReady,
	onDataLoaded
}: TradingViewLiveChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const { authStatus, isLoading: authLoading } = useAuth();
	const { theme, resolvedTheme } = useTheme();

	// Track container dimensions for responsive sizing (currently unused but kept for future responsive features)
	// const containerDimensions = useChartDimensions(chartContainerRef);
	
	// ============================================
	// DI: Extract indicator configs from injected array
	// ============================================
	const priceConfig = indicators.find(i => i.type === 'price');
	const volumeConfig = indicators.find(i => i.type === 'volume');
	const cvdConfig = indicators.find(i => i.type === 'cvd');
	
	// Extract settings with type safety
	const showPrice = priceConfig?.enabled ?? false;
	const showVolume = volumeConfig?.enabled ?? false;
	const showCVD = cvdConfig?.enabled ?? false;
	const cvdAnchorPeriod = (cvdConfig?.settings?.anchorPeriod as string | undefined) || '3M';
	const cvdTimeframe = cvdConfig?.settings?.customPeriod as string | undefined;
	
	// If chartData is provided (from SSE stream), use it directly
	// If streaming is active, wait for data (don't fetch)
	// Otherwise, fetch from API (for standalone usage)
	const { data: fetchedData, loading, error } = useChartData({
		symbol,
		resolution,
		barsCount,
		apiEndpoint: '/api/chart-data',
		cvdEnabled: showCVD, // Respect showCVD - don't fetch CVD if not needed
		cvdAnchorPeriod: cvdAnchorPeriod || '3M',
		cvdTimeframe,
		enabled: !providedChartData && !isStreaming && authStatus?.isAuthenticated && !authLoading
	});
	
	// Use provided data if available, otherwise use fetched data
	const data = providedChartData || fetchedData;
	
	// Determine if dark mode is active
	const isDark = resolvedTheme === 'dark' || theme === 'dark';

	// Memoize deduplicated and sorted bars
	const uniqueBars = useMemo(() => {
		if (!data?.bars) return [];
		// Remove duplicates (keep last bar for each timestamp) and sort
		const uniqueMap = new Map<number, typeof data.bars[0]>();
		for (const bar of data.bars) {
			uniqueMap.set(bar.time, bar);
		}
		return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
	}, [data?.bars]);

	// Call onDataLoaded callback when bars data is loaded
	useEffect(() => {
		if (uniqueBars.length > 0 && onDataLoaded) {
			onDataLoaded(uniqueBars);
		}
	}, [uniqueBars, onDataLoaded]);

	// Memoize SMA calculation to avoid recalculating on every render
	const smaData = useMemo(() => {
		if (!data || uniqueBars.length === 0) return [];
		return calculateSMA(uniqueBars, 20);
	}, [data, uniqueBars]);

	// Memoize volume data to avoid recalculating on every render
	const volumeData = useMemo(() => {
		if (!data || uniqueBars.length === 0) return [];
		
		return uniqueBars.map(bar => ({
			time: bar.time,
			value: bar.volume,
			color: bar.close >= bar.open 
				? (isDark ? 'rgba(38, 166, 154, 0.8)' : 'rgba(38, 166, 154, 0.9)')  // Increased opacity from 0.4/0.5 to 0.8/0.9
				: (isDark ? 'rgba(239, 83, 80, 0.8)' : 'rgba(239, 83, 80, 0.9)')
		}));
	}, [data, uniqueBars, isDark]);

	// Memoize Volume MA (EMA) data - use global settings
	const volumeMAData = useMemo(() => {
		if (!data || uniqueBars.length === 0 || !global.showVolumeMA) return [];
		return calculateVolumeEMA(uniqueBars, global.volumeMALength);
	}, [data, uniqueBars, global.showVolumeMA, global.volumeMALength]);

	// Memoize CVD candlestick data (Cumulative Volume Delta)
	const cvdData = useMemo(() => {
		if (!data?.indicators?.cvd?.values) {
			return [];
		}
		
		// CVD values: [open, high, low, close, ...] - convert to candlestick format
		const filtered = data.indicators.cvd.values
			.filter((d: { values: number[] }) => d.values[3] !== 1e+100); // Filter out placeholder values
		
		// Remove duplicates (keep last value for each timestamp) and sort
		const uniqueMap = new Map<number, {
			time: number;
			open: number;
			high: number;
			low: number;
			close: number;
		}>();
		
		for (const d of filtered) {
			uniqueMap.set(d.time, {
				time: d.time,
				open: d.values[0],  // CVD open
				high: d.values[1],  // CVD high
				low: d.values[2],   // CVD low
				close: d.values[3], // CVD close
			});
		}
		
		// Convert to array and sort by time (ascending)
		return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
	}, [data?.indicators?.cvd]);

	// Data fetching is now handled by useChartData hook with caching

	// Separate effect for chart creation (runs when data is available)
	useEffect(() => {
		if (!data || !chartContainerRef.current) {
			return;
		}

		// Clear any existing chart
		if (chartRef.current) {
			chartRef.current.remove();
			chartRef.current = null;
		}

		// Calculate chart dimensions - use actual container size, not state
		// This prevents re-creation loop when containerDimensions updates
		// Round to prevent sub-pixel overflow (e.g., 280px chart in 279.5px container)
		const chartWidth = Math.floor(chartContainerRef.current.clientWidth) || 800;
		const chartHeight = Math.floor(parseChartHeight(
			height,
			chartContainerRef.current.clientHeight,
			DEFAULT_CHART_HEIGHT
		));

		// Theme-aware colors
		const chartColors = {
			background: isDark ? '#1a1a1a' : '#ffffff',
			textColor: isDark ? '#d1d5db' : '#333333',
			gridColor: isDark ? '#2a2a2a' : '#f0f0f0',
			borderColor: isDark ? '#374151' : '#e0e0e0',
		};

		const chart = createChart(chartContainerRef.current, {
			width: chartWidth,
			height: chartHeight,
			layout: {
				background: { type: ColorType.Solid, color: chartColors.background },
				textColor: chartColors.textColor,
				panes: {
					enableResize: true,
					separatorColor: chartColors.borderColor,
					separatorHoverColor: isDark ? 'rgba(178, 181, 189, 0.3)' : 'rgba(178, 181, 189, 0.2)',
				}
			},
			grid: {
				vertLines: { 
					color: global.showGrid ? chartColors.gridColor : 'transparent'
				},
				horzLines: { 
					color: global.showGrid ? chartColors.gridColor : 'transparent'
				},
			},
			timeScale: {
				timeVisible: true,
				secondsVisible: false,
				borderColor: chartColors.borderColor,
			},
			rightPriceScale: {
				borderColor: chartColors.borderColor,
				visible: true,
			},
		});

		// Theme-aware candlestick colors
		const candleColors = {
			up: '#26a69a',     // Teal
			down: '#ef5350',   // Red
		};

		// ============================================
		// DI: Render Price Indicator (if injected and enabled)
		// ============================================
		let candlestickSeries;
		if (showPrice) {
			candlestickSeries = chart.addSeries(CandlestickSeries, {
				upColor: candleColors.up,
				downColor: candleColors.down,
				borderVisible: false,
				wickUpColor: candleColors.up,
				wickDownColor: candleColors.down,
			});
			
			// Use pre-deduplicated bars from useMemo
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			candlestickSeries.setData(uniqueBars as any);
		}

		// TODO: SMA should be moved to indicator registry in future refactor
		// For now, keeping it as-is to maintain existing functionality
		const showSMA = true; // Default to true for backward compatibility
		if (showPrice && showSMA && smaData.length > 0) {
			const smaSeries = chart.addSeries(LineSeries, {
				color: '#26a69a',  // Green color matching candle up color
				lineWidth: 1,
				priceLineVisible: false,
				lastValueVisible: true,
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			smaSeries.setData(smaData as any);
		}

		// ============================================
		// DI: Render Volume Indicator (if injected and enabled)
		// ============================================
		if (showVolume && volumeData.length > 0) {
			const volumeSeries = chart.addSeries(HistogramSeries, {
				priceFormat: {
					type: 'volume',
				},
				base: 0,  // Ensure bars start from 0
				priceScaleId: 'right',  // Show scale on right side
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			volumeSeries.setData(volumeData as any);
			// Move to pane 1 (creates pane if it doesn't exist)
			volumeSeries.moveToPane(1);

			// Add Volume MA line if enabled (from global settings)
			if (global.showVolumeMA && volumeMAData.length > 0) {
				const volumeMASeries = chart.addSeries(LineSeries, {
					color: isDark ? '#FB923C' : '#F97316',  // Orange/amber color
					lineWidth: 1,
					priceLineVisible: false,
					lastValueVisible: false,  // Hide value in legend (no label requested)
					// No title property - removes label from legend
					priceFormat: {
						type: 'volume',
					},
				});

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				volumeMASeries.setData(volumeMAData as any);
				// Move to same pane as volume (pane 1)
				volumeMASeries.moveToPane(1);
			}
		}

		// ============================================
		// DI: Render CVD Indicator (if injected and enabled)
		// ============================================
		if (showCVD && cvdData.length > 0) {
			const cvdPaneIndex = showVolume ? 2 : 1; // Pane 2 if volume shown, else pane 1
			
			// Format large numbers with K/M/B notation
			const formatCVDValue = (value: number): string => {
				const absValue = Math.abs(value);
				const sign = value < 0 ? '-' : '';
				
				if (absValue >= 1e9) {
					return sign + (absValue / 1e9).toFixed(2) + 'B';
				} else if (absValue >= 1e6) {
					return sign + (absValue / 1e6).toFixed(2) + 'M';
				} else if (absValue >= 1e3) {
					return sign + (absValue / 1e3).toFixed(2) + 'K';
				}
				return sign + absValue.toFixed(0);
			};
			
			const cvdSeries = chart.addSeries(CandlestickSeries, {
				upColor: '#26a69a',        // Teal for positive CVD
				downColor: '#ef5350',      // Red for negative CVD
				borderVisible: false,
				wickUpColor: '#26a69a',
				wickDownColor: '#ef5350',
				priceFormat: {
					type: 'custom',
					formatter: formatCVDValue,
				},
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			cvdSeries.setData(cvdData as any);
			// Move to appropriate pane (creates pane if it doesn't exist)
			cvdSeries.moveToPane(cvdPaneIndex);
		}

		// ============================================
		// DI: Dynamic Pane Sizing (based on injected indicators)
		// ============================================
		// ✅ FIX: Set pane heights using stretch factors (relative sizing)
		// This avoids the synchronous setHeight() timing issue in lightweight-charts v5
		const panes = chart.panes();

		// Handle pane sizing based on what's visible
		if (!showPrice) {
			// Price hidden - hide pane 0
			panes[0].setStretchFactor(0);
			
			if (showVolume && showCVD) {
				// Volume and CVD visible - split 50/50
				if (panes[1]) panes[1].setStretchFactor(1);  // Volume: 1 part (50%)
				if (panes[2]) panes[2].setStretchFactor(1);  // CVD: 1 part (50%)
			} else if (showVolume) {
				// Only volume visible - takes full space
				if (panes[1]) panes[1].setStretchFactor(1);  // Volume: full (100%)
			} else if (showCVD) {
				// Only CVD visible - takes full space
				if (panes[1]) panes[1].setStretchFactor(1);  // CVD: full (100%)
			}
		} else if (showVolume && showCVD) {
			// 3 panes: Price (0), Volume (1), CVD (2)
			// Ratio: 50% : 25% : 25%
			panes[0].setStretchFactor(2);  // Main chart: 2 parts (50%)
			if (panes[1]) panes[1].setStretchFactor(1);  // Volume: 1 part (25%)
			if (panes[2]) panes[2].setStretchFactor(1);  // CVD: 1 part (25%)
		} else if (showVolume) {
			// 2 panes: Price (0), Volume (1)
			// Ratio: 66% : 33%
			panes[0].setStretchFactor(2);  // Main chart: 2 parts (66%)
			if (panes[1]) panes[1].setStretchFactor(1);  // Volume: 1 part (33%)
		} else if (showCVD) {
			// 2 panes: Price (0), CVD (1)
			// Ratio: 66% : 33%
			panes[0].setStretchFactor(2);  // Main chart: 2 parts (66%)
			if (panes[1]) panes[1].setStretchFactor(1);  // CVD: 1 part (33%)
		} else {
			// Only price visible - takes full space
			panes[0].setStretchFactor(1);  // Price: full (100%)
		}

		// Apply zoom level instead of fitContent to prevent flicker
		// fitContent causes a zoom out flash before zoom effect runs
		chartRef.current = chart;

		// Check if at least one indicator is enabled (chart has data to display)
		const hasActiveIndicators = showPrice || showVolume || showCVD;

		// Apply zoom after a small delay to ensure timeScale is fully initialized
		// Only apply zoom if we have bars AND at least one indicator is enabled
		if (uniqueBars.length > 0 && hasActiveIndicators) {
			// Use setTimeout to ensure chart is fully mounted before applying zoom
			setTimeout(() => {
				if (chartRef.current) {
					applyZoom(chart.timeScale(), zoomLevel, uniqueBars, resolution);
				}
			}, 0);
		} else if (hasActiveIndicators) {
			// Fallback to fitContent if no bars but indicators are enabled
			chart.timeScale().fitContent();
		}
		// If no indicators are enabled, don't call any zoom methods (chart is empty)

		// Call onChartReady callback
		if (onChartReady) {
			onChartReady(chart);
		}

		// Cleanup
		return () => {
			if (chartRef.current) {
				chartRef.current.remove();
				chartRef.current = null;
			}
		};
	}, [data, height, isDark, smaData, volumeData, volumeMAData, cvdData, showPrice, showVolume, global.showVolumeMA, showCVD, uniqueBars, global.showGrid]);
	// NOTE: onChartReady removed from dependencies - it's a callback, not data
	// Adding it causes infinite loop when parent component passes inline arrow functions

	// Apply zoom level when it changes (without recreating chart)
	// This effect handles zoom changes after initial chart creation
	useEffect(() => {
		// Skip if chart not ready or no data or invalid bars
		if (!chartRef.current || uniqueBars.length === 0 || !data) return;
		
		// Additional guard: Check if bars have valid time values
		if (!uniqueBars[0]?.time) return;
		
		// Check if at least one indicator is enabled (chart has data to display)
		const hasActiveIndicators = showPrice || showVolume || showCVD;
		if (!hasActiveIndicators) return;

		applyZoom(chartRef.current.timeScale(), zoomLevel, uniqueBars, resolution);
	}, [zoomLevel, resolution, uniqueBars, showPrice, showVolume, showCVD]);

	// Handle grid toggle without recreating chart (using global settings)
	useEffect(() => {
		if (!chartRef.current) return;

		const gridColor = isDark ? '#2B2B43' : '#e6e6e6';
		chartRef.current.applyOptions({
			grid: {
				vertLines: {
					color: global.showGrid ? gridColor : 'transparent'
				},
				horzLines: {
					color: global.showGrid ? gridColor : 'transparent'
				},
			},
		});
	}, [global.showGrid, isDark]);

	// Zoom is now applied synchronously during chart creation to prevent flicker
	// No separate effect needed

	// DISABLED: ResizeObserver was causing infinite expansion loop
	// The chart is already set to height='100%' which makes it responsive
	// Manual resize is handled during chart creation and layout changes
	// ResizeObserver was triggering panel resize -> component re-render -> new chart -> new ResizeObserver -> expand...
	useEffect(() => {
		// No-op - ResizeObserver removed
	}, [data]);

	// Show loading if no data AND (fetching OR streaming)
	const isLoading = !providedChartData && (loading || isStreaming);
	const loadingMessage = isStreaming ? 'Waiting for chart stream...' : 'Loading chart data...';

	return (
		<div className='h-full w-full relative'>
			{/* Chart Container - Always rendered */}
			<div ref={chartContainerRef} className="h-full w-full border border-gray-200 dark:border-gray-800 rounded-lg" />

			{/* Loading Overlay */}
			{isLoading && (
				<ChartLoadingOverlay
					message={loadingMessage}
					subtitle={`${symbol} • ${resolution}${isStreaming ? ' • Streaming in batches' : ''}`}
				/>
			)}

			{/* No Data State */}
			{!data && !isLoading && (
				<div className="absolute inset-0 flex items-center justify-center bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
					<div className="text-center p-6 max-w-md">
						<div className="text-yellow-600 dark:text-yellow-400 font-semibold mb-2">No Chart Data</div>
						<p className="text-yellow-500 dark:text-yellow-300 text-sm mb-4">
							Chart data not available. Please refresh the page.
						</p>
						<div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
							<p>Symbol: {symbol}</p>
							<p>Resolution: {resolution}</p>
						</div>
					</div>
				</div>
			)}

			{/* Error State */}
			{error && (
				<div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-950/20 rounded-lg">
					<div className="text-center p-6 max-w-md">
						<div className="text-red-600 dark:text-red-400 font-semibold mb-2">Failed to load chart</div>
						<p className="text-red-500 dark:text-red-300 text-sm mb-4">{error}</p>
						<div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
							<p>Symbol: {symbol}</p>
							<p>Resolution: {resolution}</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
