/**
 * Chart Pane Component
 * 
 * Single chart pane component that renders a lightweight-charts instance
 * with cursor event emission for synchronized crosshairs across multiple panes.
 * 
 * Features:
 * - Renders single chart with specified symbol, resolution, and indicators
 * - Emits crosshair move events for external synchronization
 * - Receives external crosshair updates to sync with other panes
 * - Theme-aware (dark/light mode support)
 * - Loading and error states
 * 
 * @example
 * ```tsx
 * <ChartPane
 *   paneId="pane-1"
 *   symbol="NSE:RELIANCE"
 *   resolution="1D"
 *   barsCount={300}
 *   indicators={[createVolumeIndicator(true)]}
 *   label="Primary Chart"
 *   onCrosshairMove={(paneId, param) => handleCrosshairMove(paneId, param)}
 *   externalCrosshairPosition={crosshairPosition}
 * />
 * ```
 */

'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { 
	createChart, 
	type IChartApi, 
	ColorType,
	CandlestickSeries,
	type MouseEventParams,
} from 'lightweight-charts';
import { useAuth } from '@/contexts/AuthContext';
import type { OHLCVBar } from '@/lib/tradingview/types';
import type { IndicatorConfig } from '@/types/chartIndicators';
import { IndicatorRenderer, extractIndicatorData } from '@/lib/chart-data/indicatorRenderer';
import { useChartData } from '@/hooks/useChartData';

/**
 * External crosshair position for synchronization
 */
export interface ExternalCrosshairPosition {
	time?: number;
	point?: { x: number; y: number };
}

/**
 * Chart Pane Props
 */
export interface ChartPaneProps {
	/** Unique pane identifier */
	paneId: string;
	
	/** Trading symbol (e.g., 'NSE:RELIANCE', 'NASDAQ:AAPL') */
	symbol: string;
	
	/** Chart resolution (e.g., '1D', '1H', '15') */
	resolution: string;
	
	/** Number of bars to fetch */
	barsCount?: number;
	
	/** Chart height in pixels */
	height?: number;
	
	/** Pane label displayed in header */
	label?: string;
	
	/** Show grid lines */
	showGrid?: boolean;
	
	/** Array of indicator configurations */
	indicators?: IndicatorConfig[];
	
	/** Custom API endpoint (defaults to /api/chart-data) */
	apiEndpoint?: string;
	
	/** Callback when crosshair moves (for syncing with other panes) */
	onCrosshairMove?: (paneId: string, param: MouseEventParams) => void;
	
	/** External crosshair position from another pane */
	externalCrosshairPosition?: ExternalCrosshairPosition | null;
}

/**
 * Chart Pane Component
 */
export function ChartPane({
	paneId,
	symbol,
	resolution,
	barsCount = 300,
	height = 400,
	label,
	showGrid = true,
	indicators = [],
	apiEndpoint = '/api/chart-data',
	onCrosshairMove,
	externalCrosshairPosition,
}: ChartPaneProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const isUpdatingExternally = useRef(false);
	const { authStatus, isLoading: authLoading } = useAuth();
	const { theme, resolvedTheme } = useTheme();
	
	// Extract CVD indicator settings
	const enabledIndicators = indicators.filter(ind => ind.enabled);
	const cvdIndicator = enabledIndicators.find(ind => ind.type === 'cvd');
	
	// Fetch chart data
	const { data, loading, error } = useChartData({
		symbol,
		resolution,
		barsCount,
		apiEndpoint,
		cvdEnabled: !!cvdIndicator, // Only fetch CVD if CVD indicator is present
		cvdAnchorPeriod: cvdIndicator?.options?.anchorPeriod || '3M',
		cvdTimeframe: cvdIndicator?.options?.timeframe,
		enabled: authStatus?.isAuthenticated && !authLoading
	});
	
	// Determine if dark mode is active
	const isDark = resolvedTheme === 'dark' || theme === 'dark';

	// Use bars directly - deduplication now happens in useChartData hook
	const bars = data?.bars || [];

	// Create and render chart
	useEffect(() => {
		if (!data || !chartContainerRef.current) {
			return;
		}

		// Clear existing chart
		if (chartRef.current) {
			chartRef.current.remove();
			chartRef.current = null;
		}

		// Get container dimensions
		const containerWidth = chartContainerRef.current.clientWidth || 800;

		// Theme-aware colors
		const chartColors = {
			background: isDark ? '#1a1a1a' : '#ffffff',
			textColor: isDark ? '#d1d5db' : '#333333',
			gridColor: isDark ? '#2a2a2a' : '#f0f0f0',
			borderColor: isDark ? '#374151' : '#e0e0e0',
		};

		// Create chart
		const chart = createChart(chartContainerRef.current, {
			width: containerWidth,
			height: height,
			layout: {
				background: { type: ColorType.Solid, color: chartColors.background },
				textColor: chartColors.textColor,
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
			crosshair: {
				mode: 1, // Normal crosshair mode
			},
		});

		// Add main candlestick series
		const candleColors = {
			up: '#26a69a',
			down: '#ef5350',
		};

		const candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: candleColors.up,
			downColor: candleColors.down,
			borderVisible: false,
			wickUpColor: candleColors.up,
			wickDownColor: candleColors.down,
		});
		
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		candlestickSeries.setData(bars as any);

		// Render indicators using IndicatorRenderer
		const renderer = new IndicatorRenderer(chart, bars, isDark);
		const indicatorDataMap = extractIndicatorData(data);
		renderer.renderIndicators(indicators, indicatorDataMap);

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
	}, [data, height, isDark, indicators, showGrid, bars]);

	// Subscribe to crosshair move events
	useEffect(() => {
		const chart = chartRef.current;
		if (!chart || !onCrosshairMove) {
			return;
		}

		const handleCrosshairMove = (param: MouseEventParams) => {
			// Don't emit event if we're receiving an external update
			if (isUpdatingExternally.current) {
				return;
			}
			
			onCrosshairMove(paneId, param);
		};

		chart.subscribeCrosshairMove(handleCrosshairMove);

		return () => {
			chart.unsubscribeCrosshairMove(handleCrosshairMove);
		};
	}, [paneId, onCrosshairMove]);

	// Handle external crosshair position updates
	useEffect(() => {
		const chart = chartRef.current;
		if (!chart || !externalCrosshairPosition) {
			return;
		}

		// Set flag to prevent circular updates
		isUpdatingExternally.current = true;

		try {
			if (externalCrosshairPosition.time !== undefined) {
				// Move crosshair to specific time
				chart.timeScale().scrollToPosition(0, false);
				
				// Note: lightweight-charts doesn't have a direct API to set crosshair position by time
				// This is a limitation - we can only react to mouse movements
				// For full sync, you might need to use the setCrosshairPosition method if available
				// or implement a custom crosshair overlay
			}
		} finally {
			// Reset flag after a short delay to allow the update to complete
			setTimeout(() => {
				isUpdatingExternally.current = false;
			}, 50);
		}
	}, [externalCrosshairPosition]);

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

	// Generate pane label
	const paneLabel = useMemo(() => {
		if (label) return label;
		
		const indicatorNames = enabledIndicators
			.map(ind => ind.name || ind.type.toUpperCase())
			.join(', ');
		
		return indicatorNames 
			? `${symbol} (${indicatorNames})` 
			: symbol;
	}, [label, symbol, enabledIndicators]);

	if (loading) {
		return (
			<div className="border border-border rounded-lg bg-background">
				{/* Header */}
				<div className="px-4 py-2 border-b border-border bg-muted/30">
					<h3 className="text-sm font-medium text-foreground">{paneLabel}</h3>
				</div>
				
				{/* Loading State */}
				<div className="flex items-center justify-center bg-muted/30" style={{ height }}>
					<div className="text-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto" />
						<p className="mt-3 text-sm text-muted-foreground">Loading chart data...</p>
						<p className="text-xs text-muted-foreground/70 mt-1">{symbol} • {resolution}</p>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="border border-border rounded-lg bg-background">
				{/* Header */}
				<div className="px-4 py-2 border-b border-border bg-muted/30">
					<h3 className="text-sm font-medium text-foreground">{paneLabel}</h3>
				</div>
				
				{/* Error State */}
				<div className="flex items-center justify-center" style={{ height }}>
					<div className="text-center p-6 max-w-md">
						<div className="text-destructive font-semibold mb-2">Failed to load chart</div>
						<p className="text-destructive/80 text-sm mb-4">{error}</p>
						<div className="text-xs text-muted-foreground space-y-1">
							<p>Symbol: {symbol}</p>
							<p>Resolution: {resolution}</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="border border-border rounded-lg bg-background">
			{/* Header */}
			<div className="px-4 py-2 border-b border-border bg-muted/30">
				<h3 className="text-sm font-medium text-foreground">{paneLabel}</h3>
			</div>
			
			{/* Chart Container */}
			<div ref={chartContainerRef} className="rounded-b-lg overflow-hidden" />
		</div>
	);
}
