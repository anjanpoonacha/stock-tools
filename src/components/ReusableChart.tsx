/**
 * Reusable Chart Component
 * 
 * Flexible, reusable chart component with indicator support.
 * Uses the new indicator configuration system for easy customization.
 * 
 * @example
 * ```tsx
 * import { ReusableChart } from '@/components/ReusableChart';
 * import { createCVDIndicator, createVolumeIndicator, createSMAIndicator } from '@/types/chartIndicators';
 * 
 * <ReusableChart
 *   symbol="NSE:RELIANCE"
 *   resolution="1D"
 *   barsCount={300}
 *   indicators={[
 *     createVolumeIndicator(true),
 *     createSMAIndicator(true, 20),
 *     createCVDIndicator(true, '3M', '30S'),
 *   ]}
 * />
 * ```
 */

'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { 
	createChart, 
	type IChartApi, 
	ColorType,
	CandlestickSeries
} from 'lightweight-charts';
import { useAuth } from '@/contexts/AuthContext';
import type { OHLCVBar } from '@/lib/tradingview/types';
import type { IndicatorConfig } from '@/types/chartIndicators';
import { IndicatorRenderer, extractIndicatorData } from '@/lib/chart-data/indicatorRenderer';

export interface ReusableChartProps {
	/** Trading symbol (e.g., 'NSE:RELIANCE', 'NASDAQ:AAPL') */
	symbol?: string;
	
	/** Chart resolution (e.g., '1D', '1H', '15') */
	resolution?: string;
	
	/** Number of bars to fetch */
	barsCount?: number;
	
	/** Chart height in pixels */
	height?: number;
	
	/** Show grid lines */
	showGrid?: boolean;
	
	/** Array of indicator configurations */
	indicators?: IndicatorConfig[];
	
	/** Custom API endpoint (defaults to /api/chart-data) */
	apiEndpoint?: string;
	
	/** Callback when chart is ready */
	onChartReady?: (chart: IChartApi) => void;
	
	/** Callback when data is loaded */
	onDataLoaded?: (data: ChartDataResponse) => void;
}

export interface ChartDataResponse {
	success: boolean;
	symbol: string;
	resolution: string;
	bars: OHLCVBar[];
	metadata: {
		name?: string;
		exchange?: string;
		currency_code?: string;
		pricescale?: number;
	};
	indicators?: {
		[key: string]: {
			studyId: string;
			studyName: string;
			config: unknown;
			values: Array<{
				time: number;
				values: number[];
			}>;
		};
	};
	error?: string;
}

/**
 * Reusable Chart Component
 */
export function ReusableChart({
	symbol = 'NSE:JUNIPER',
	resolution = '1D',
	barsCount = 300,
	height = 500,
	showGrid = true,
	indicators = [],
	apiEndpoint = '/api/chart-data',
	onChartReady,
	onDataLoaded,
}: ReusableChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<ChartDataResponse | null>(null);
	const { authStatus, isLoading: authLoading } = useAuth();
	const { theme, resolvedTheme } = useTheme();
	
	// Determine if dark mode is active
	const isDark = resolvedTheme === 'dark' || theme === 'dark';

	// Memoize deduplicated and sorted bars
	const uniqueBars = useMemo(() => {
		if (!data?.bars) return [];
		const uniqueMap = new Map<number, OHLCVBar>();
		for (const bar of data.bars) {
			uniqueMap.set(bar.time, bar);
		}
		return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
	}, [data?.bars]);

	// Fetch chart data
	useEffect(() => {
		let mounted = true;

		async function loadChart() {
			try {
				setLoading(true);
				setError(null);

				// Wait for auth to finish loading
				if (authLoading) {
					return;
				}

				// Check if authenticated
				if (!authStatus?.isAuthenticated) {
					throw new Error('Please log in to view charts');
				}

				// Get credentials
				const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');
				if (!storedCredentials) {
					throw new Error('Authentication credentials not found. Please log in again.');
				}

				const credentials = JSON.parse(storedCredentials);

				// Build API URL
				const url = new URL(apiEndpoint, window.location.origin);
				url.searchParams.set('symbol', symbol);
				url.searchParams.set('resolution', resolution);
				url.searchParams.set('barsCount', barsCount.toString());
				
				// Add indicator parameters
				const enabledIndicators = indicators.filter(ind => ind.enabled);
				for (const indicator of enabledIndicators) {
					if (indicator.type === 'cvd') {
						url.searchParams.set('cvdEnabled', 'true');
						url.searchParams.set('cvdAnchorPeriod', indicator.options.anchorPeriod);
						if (indicator.options.timeframe) {
							url.searchParams.set('cvdTimeframe', indicator.options.timeframe);
						}
					}
					// Add more indicator types here as needed
				}

				// Fetch data
				const response = await fetch(url.toString(), {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						userEmail: credentials.userEmail,
						userPassword: credentials.userPassword
					})
				});

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const result: ChartDataResponse = await response.json();

				if (!mounted) return;

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch chart data');
				}

				if (!result.bars || result.bars.length === 0) {
					throw new Error('No chart data received');
				}

				setData(result);
				setLoading(false);
				
				// Call callback
				if (onDataLoaded) {
					onDataLoaded(result);
				}
			} catch (err) {
				console.error('[Chart] Error loading data:', err);
				if (!mounted) return;
				const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
				setError(errorMessage);
				setLoading(false);
			}
		}

		loadChart();
		
		return () => {
			mounted = false;
		};
	}, [symbol, resolution, barsCount, indicators, authStatus, authLoading, apiEndpoint, onDataLoaded]);

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
		candlestickSeries.setData(uniqueBars as any);

		// Render indicators using IndicatorRenderer
		const renderer = new IndicatorRenderer(chart, uniqueBars, isDark);
		const indicatorDataMap = extractIndicatorData(data);
		renderer.renderIndicators(indicators, indicatorDataMap);

		// Fit content to view
		chart.timeScale().fitContent();

		chartRef.current = chart;
		
		// Call callback
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
	}, [data, height, isDark, indicators, showGrid, uniqueBars, onChartReady]);

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

	if (loading) {
		return (
			<div className="flex items-center justify-center bg-muted/30 rounded-lg" style={{ height }}>
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto" />
					<p className="mt-4 text-muted-foreground">Loading chart data...</p>
					<p className="text-sm text-muted-foreground/70 mt-1">{symbol} • {resolution}</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center bg-red-50 dark:bg-red-950/20 rounded-lg" style={{ height }}>
				<div className="text-center p-6 max-w-md">
					<div className="text-red-600 dark:text-red-400 font-semibold mb-2">Failed to load chart</div>
					<p className="text-red-500 dark:text-red-300 text-sm mb-4">{error}</p>
					<div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
						<p>Symbol: {symbol}</p>
						<p>Resolution: {resolution}</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{/* Chart Container */}
			<div ref={chartContainerRef} className="border border-border rounded-lg" />

			{/* Chart Footer */}
			{data && (
				<div className="flex items-center justify-between text-xs text-muted-foreground px-2">
					<div>
						{data.bars.length} bars loaded
						{indicators.filter(ind => ind.enabled).length > 0 && (
							<span className="ml-2">
								• {indicators.filter(ind => ind.enabled).length} indicator(s)
							</span>
						)}
					</div>
					<div>
						{new Date(data.bars[0]?.time * 1000).toLocaleDateString()} 
						{' - '}
						{new Date(data.bars[data.bars.length - 1]?.time * 1000).toLocaleDateString()}
					</div>
				</div>
			)}
		</div>
	);
}
