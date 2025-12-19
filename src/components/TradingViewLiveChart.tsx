/**
 * TradingView Live Chart Component
 * 
 * Renders real TradingView chart data using Lightweight Charts library.
 * Fetches historical OHLCV data from the /api/chart-data endpoint.
 * Features:
 * - Candlestick price chart
 * - Volume histogram
 * - 20-period Simple Moving Average (SMA)
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

interface TradingViewLiveChartProps {
	symbol?: string;
	resolution?: string;
	barsCount?: number;
	height?: ChartHeight; // Support both number and '100%'
	showSMA?: boolean;
	showVolume?: boolean;
	showGrid?: boolean;
	showCVD?: boolean;
	cvdAnchorPeriod?: string;
	cvdTimeframe?: string;
	zoomLevel?: ChartZoomLevel; // Zoom level control
	chartData?: {
		bars: OHLCVBar[];
		metadata: Partial<SymbolMetadata>;
		indicators?: {
			cvd?: StudyData;
		};
	};
	isStreaming?: boolean;
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
 */
export function TradingViewLiveChart({
	symbol = 'NSE:JUNIPER',
	resolution = '1D',
	barsCount = 300,
	height = DEFAULT_CHART_HEIGHT,
	showSMA = true,
	showVolume = true,
	showGrid = true,
	showCVD = false,
	cvdAnchorPeriod = '3M',
	cvdTimeframe,
	zoomLevel = ChartZoomLevel.MAX,
	chartData: providedChartData,
	isStreaming = false
}: TradingViewLiveChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const { authStatus, isLoading: authLoading } = useAuth();
	const { theme, resolvedTheme } = useTheme();

	// Track container dimensions for responsive sizing
	const containerDimensions = useChartDimensions(chartContainerRef);
	
	// If chartData is provided (from SSE stream), use it directly
	// If streaming is active, wait for data (don't fetch)
	// Otherwise, fetch from API (for standalone usage)
	const { data: fetchedData, loading, error } = useChartData({
		symbol,
		resolution,
		barsCount,
		apiEndpoint: '/api/chart-data',
		cvdEnabled: showCVD, // Respect showCVD prop - don't fetch CVD if not needed
		cvdAnchorPeriod: cvdAnchorPeriod || '3M',
		cvdTimeframe,
		enabled: !providedChartData && !isStreaming && authStatus?.isAuthenticated && !authLoading
	});
	
	// Use provided data if available, otherwise use fetched data
	const data = providedChartData || fetchedData;
	
	console.log('[TradingViewLiveChart] symbol:', symbol, 'resolution:', resolution);
	console.log('[TradingViewLiveChart] isStreaming:', isStreaming);
	console.log('[TradingViewLiveChart] providedChartData:', providedChartData ? `✓ bars=${providedChartData.bars?.length}, cvd=${providedChartData.indicators?.cvd?.values?.length}` : '✗ NONE');
	console.log('[TradingViewLiveChart] Data source:', providedChartData ? '📡 STREAMED' : (isStreaming ? '⏳ WAITING' : '🌐 API'));
	console.log('[TradingViewLiveChart] API fetch enabled:', !providedChartData && !isStreaming && authStatus?.isAuthenticated && !authLoading);
	
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

	// Memoize SMA calculation to avoid recalculating on every render
	const smaData = useMemo(() => {
		if (!data || uniqueBars.length === 0) return [];
		return calculateSMA(uniqueBars, 20);
	}, [data, uniqueBars]);

	// Memoize volume data to avoid recalculating on every render
	const volumeData = useMemo(() => {
		if (!data || uniqueBars.length === 0) return [];
		
		const volumes = uniqueBars.map(bar => ({
			time: bar.time,
			value: bar.volume,
			color: bar.close >= bar.open 
				? (isDark ? 'rgba(38, 166, 154, 0.8)' : 'rgba(38, 166, 154, 0.9)')  // Increased opacity from 0.4/0.5 to 0.8/0.9
				: (isDark ? 'rgba(239, 83, 80, 0.8)' : 'rgba(239, 83, 80, 0.9)')
		}));
		
		// Debug: Check volume values
		const hasVolume = volumes.some(v => v.value > 0);
		const avgVolume = volumes.reduce((sum, v) => sum + v.value, 0) / volumes.length;
		console.log('[Volume Debug] Volume data generated:', {
			count: volumes.length,
			hasVolume,
			avgVolume,
			firstVolume: volumes[0]?.value,
			lastVolume: volumes[volumes.length - 1]?.value
		});
		
		return volumes;
	}, [data, uniqueBars, isDark]);

	// Memoize CVD candlestick data (Cumulative Volume Delta)
	const cvdData = useMemo(() => {
		console.log('[CVD Debug] Full data object:', data);
		console.log('[CVD Debug] Indicators:', data?.indicators);
		console.log('[CVD Debug] CVD object:', data?.indicators?.cvd);
		
		if (!data?.indicators?.cvd?.values) {
			console.log('[CVD Debug] No CVD data available - indicators:', Object.keys(data?.indicators || {}));
			return [];
		}
		
		console.log('[CVD Debug] CVD values count:', data.indicators.cvd.values.length);
		
		// CVD values: [open, high, low, close, ...] - convert to candlestick format
		const filtered = data.indicators.cvd.values
			.filter((d: { values: number[] }) => d.values[3] !== 1e+100); // Filter out placeholder values
		
		console.log('[CVD Debug] Filtered values count:', filtered.length);
		
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
		const result = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
		console.log('[CVD Debug] Final CVD data points:', result.length);
		if (result.length > 0) {
			console.log('[CVD Debug] First CVD bar:', result[0]);
			console.log('[CVD Debug] Last CVD bar:', result[result.length - 1]);
		}
		return result;
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

		// Calculate chart dimensions
		const chartWidth = containerDimensions.width || 800;
		const chartHeight = parseChartHeight(
			height,
			containerDimensions.height,
			DEFAULT_CHART_HEIGHT
		);

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
					color: showGrid ? chartColors.gridColor : 'transparent'
				},
				horzLines: { 
					color: showGrid ? chartColors.gridColor : 'transparent'
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

		// Add candlestick series (price chart)
		const candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: candleColors.up,
			downColor: candleColors.down,
			borderVisible: false,
			wickUpColor: candleColors.up,
			wickDownColor: candleColors.down,
		});
		
		// Use pre-deduplicated bars from useMemo
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		candlestickSeries.setData(uniqueBars as any);

		// Add 20-period Simple Moving Average (SMA) - using memoized data
		if (showSMA && smaData.length > 0) {
			const smaSeries = chart.addSeries(LineSeries, {
				color: '#26a69a',  // Green color matching candle up color
				lineWidth: 1,
				priceLineVisible: false,
				lastValueVisible: true,
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			smaSeries.setData(smaData as any);
		}

		// Add volume histogram on separate pane (pane 1) - using memoized data
		console.log('[Volume Debug] showVolume:', showVolume, 'volumeData.length:', volumeData.length);
		
		if (showVolume && volumeData.length > 0) {
			console.log('[Volume Debug] Creating volume series...');
			console.log('[Volume Debug] Sample volume data:', volumeData.slice(0, 3));
			
			const volumeSeries = chart.addSeries(HistogramSeries, {
				priceFormat: {
					type: 'volume',
				},
				base: 0,  // Ensure bars start from 0
				priceScaleId: '',  // Use default price scale for volume pane
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			volumeSeries.setData(volumeData as any);
			// Move to pane 1 (creates pane if it doesn't exist)
			volumeSeries.moveToPane(1);
			
			console.log('[Volume Debug] Volume series moved to pane 1');
		} else {
			console.log('[Volume Debug] Volume not rendered - showVolume:', showVolume, 'volumeData.length:', volumeData.length);
		}

		// Add CVD pane if checkbox is enabled (data is always fetched, showCVD controls visibility)
		console.log('[CVD Debug] showCVD:', showCVD, 'cvdData.length:', cvdData.length);
		
		if (showCVD && cvdData.length > 0) {
			const cvdPaneIndex = showVolume ? 2 : 1; // Pane 2 if volume shown, else pane 1
			
			console.log('[CVD Debug] Rendering CVD on pane index:', cvdPaneIndex);
			
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
			
			console.log('[CVD Debug] CVD series moved to pane', cvdPaneIndex);
		} else {
			console.log('[CVD Debug] CVD not rendered - showCVD:', showCVD, 'cvdData.length:', cvdData.length);
		}

		// ✅ FIX: Set pane heights using stretch factors (relative sizing)
		// This avoids the synchronous setHeight() timing issue in lightweight-charts v5
		const panes = chart.panes();
		console.log('[Pane Debug] Total panes:', panes.length);

		if (showVolume && showCVD) {
			// 3 panes: Price (0), Volume (1), CVD (2)
			// Ratio: 50% : 25% : 25%
			panes[0].setStretchFactor(2);  // Main chart: 2 parts (50%)
			if (panes[1]) panes[1].setStretchFactor(1);  // Volume: 1 part (25%)
			if (panes[2]) panes[2].setStretchFactor(1);  // CVD: 1 part (25%)
			console.log('[Pane Debug] Set stretch factors: Price=2, Volume=1, CVD=1');
		} else if (showVolume) {
			// 2 panes: Price (0), Volume (1)
			// Ratio: 66% : 33%
			panes[0].setStretchFactor(2);  // Main chart: 2 parts (66%)
			if (panes[1]) panes[1].setStretchFactor(1);  // Volume: 1 part (33%)
			console.log('[Pane Debug] Set stretch factors: Price=2, Volume=1');
		} else if (showCVD) {
			// 2 panes: Price (0), CVD (1)
			// Ratio: 66% : 33%
			panes[0].setStretchFactor(2);  // Main chart: 2 parts (66%)
			if (panes[1]) panes[1].setStretchFactor(1);  // CVD: 1 part (33%)
			console.log('[Pane Debug] Set stretch factors: Price=2, CVD=1');
		}

		// Fit content to view
		chart.timeScale().fitContent();

		chartRef.current = chart;

		// Cleanup
		return () => {
			if (chartRef.current) {
				chartRef.current.remove();
				chartRef.current = null;
			}
		};
	}, [data, height, isDark, smaData, volumeData, cvdData, showSMA, showVolume, showGrid, showCVD, uniqueBars, containerDimensions]);

	// Apply zoom level when it changes
	useEffect(() => {
		if (!chartRef.current || !data || uniqueBars.length === 0) return;

		const timeScale = chartRef.current.timeScale();
		applyZoom(timeScale, zoomLevel, uniqueBars, resolution);
	}, [zoomLevel, uniqueBars, resolution, data]);

	// Handle window resize
	useEffect(() => {
		const handleResize = () => {
			if (chartRef.current && chartContainerRef.current) {
				chartRef.current.applyOptions({
					width: chartContainerRef.current.clientWidth,
				});
			}
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

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
