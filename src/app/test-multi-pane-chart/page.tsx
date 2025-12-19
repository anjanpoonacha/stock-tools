/**
 * Multi-Pane Chart POC Test Page
 * 
 * This is a proof-of-concept demonstrating cross-timeframe synchronization
 * between two separate charts:
 * - Chart 1: Price + Volume + CVD (1D timeframe) - 3 panes in one chart
 * - Chart 2: CVD (188m timeframe) - separate chart
 * 
 * Features:
 * - Crosshair synchronization across different timeframes (1D ↔ 188m)
 * - Scroll/zoom synchronization between charts
 * - Time mapping for Indian trading hours (9:15 AM - 3:30 PM IST)
 * - 188m timeframe = 2 bars per day (morning 188m + afternoon 187m)
 */

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ReusableChart, type ChartDataResponse } from '@/components/ReusableChart';
import type { IChartApi } from 'lightweight-charts';
import { 
	createVolumeIndicator, 
	createCVDIndicator 
} from '@/types/chartIndicators';
import { useCrossChartSync } from '@/hooks/useCrossChartSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

export default function TestMultiPaneChartPage() {
	const { authStatus, isLoading: authLoading } = useAuth();
	
	// Chart references
	const [chart1, setChart1] = useState<IChartApi | null>(null);
	const [chart2, setChart2] = useState<IChartApi | null>(null);
	
	// Data for time mapping
	const [bars1D, setBars1D] = useState<Array<{ time: number }>>([]);
	const [bars188m, setBars188m] = useState<Array<{ time: number; values: number[] }>>([]);
	
	// Track if data has been loaded to prevent loops
	const chart1DataLoaded = useRef(false);
	const chart2DataLoaded = useRef(false);
	
	// Track if charts have been initialized to prevent re-setting them
	const chart1Initialized = useRef(false);
	const chart2Initialized = useRef(false);
	
	// Enable/disable sync
	const [syncEnabled, setSyncEnabled] = useState(true);
	
	// Memoize indicators to prevent chart recreation
	const chart1Indicators = useMemo(() => [
		createVolumeIndicator(true, 1, 100),
	], []);

	// Chart 2: No indicators - just price chart
	const chart2Indicators = useMemo(() => [], []);
	
	// Memoize chart ready callbacks
	const handleChart1Ready = useCallback((chart: IChartApi) => {
		if (!chart1Initialized.current) {
			console.log('[Chart 1] Ready');
			setChart1(chart);
			chart1Initialized.current = true;
		}
	}, []);
	
	const handleChart2Ready = useCallback((chart: IChartApi) => {
		if (!chart2Initialized.current) {
			console.log('[Chart 2] Ready');
			setChart2(chart);
			chart2Initialized.current = true;
		}
	}, []);
	
	// Handle data loaded from Chart 1 (1D) - wrapped in useCallback
	const handleChart1DataLoaded = useCallback((data: ChartDataResponse) => {
		// Only process once to prevent infinite loop
		if (chart1DataLoaded.current) {
			return;
		}
		
		console.log('[Chart 1] ========== DATA LOADED ==========');
		console.log('[Chart 1] Number of bars:', data.bars?.length || 0);
		console.log('[Chart 1] Has indicators?', !!data.indicators);
		console.log('[Chart 1] Indicator keys:', data.indicators ? Object.keys(data.indicators) : 'none');
		
		if (data.bars.length > 0) {
			console.log('[Chart 1] First bar:', JSON.stringify(data.bars[0]));
			console.log('[Chart 1] Last bar:', JSON.stringify(data.bars[data.bars.length - 1]));
			
			chart1DataLoaded.current = true;
			setBars1D(data.bars);
			console.log('[Chart 1] ✓ Bars state updated with', data.bars.length, 'bars');
		}
		console.log('[Chart 1] ========== END DATA LOADED ==========');
	}, []);
	
	// Handle data loaded from Chart 2 - wrapped in useCallback
	const handleChart2DataLoaded = useCallback((data: ChartDataResponse) => {
		// Only process once to prevent infinite loop
		if (chart2DataLoaded.current) {
			return;
		}

		console.log('[Chart 2] ========== DATA LOADED ==========');
		console.log('[Chart 2] Number of bars:', data.bars?.length || 0);

		if (data.bars.length > 0) {
			console.log('[Chart 2] First bar:', JSON.stringify(data.bars[0]));
			console.log('[Chart 2] Last bar:', JSON.stringify(data.bars[data.bars.length - 1]));

			chart2DataLoaded.current = true;
			// For Chart 2, we'll use the same data structure as Chart 1
			// Convert bars to match the expected format for time mapping
			const barsForMapping = data.bars.map(bar => ({
				time: bar.time,
				values: [bar.close] // Use close price as a dummy value
			}));
			setBars188m(barsForMapping);
			console.log('[Chart 2] ✓ Bars state updated with', barsForMapping.length, 'bars');
		}
		console.log('[Chart 2] ========== END DATA LOADED ==========');
	}, []);
	
	// Set up cross-chart synchronization
	useCrossChartSync({
		chart1,
		chart2,
		bars1D,
		bars188m,
		enabled: syncEnabled,
	});
	
	// Show loading state during authentication check
	if (authLoading) {
		return (
			<div className="container max-w-7xl mx-auto py-8 px-4">
				<div className="text-center py-12">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4" />
					<p className="text-muted-foreground">Checking authentication...</p>
				</div>
			</div>
		);
	}
	
	// Show login prompt if not authenticated
	if (!authStatus?.isAuthenticated) {
		return (
			<div className="container max-w-7xl mx-auto py-8 px-4">
				<Card className="border-destructive">
					<CardHeader>
						<CardTitle className="text-destructive">Authentication Required</CardTitle>
						<CardDescription>
							You need to be logged in to access the multi-pane chart POC.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground mb-4">
							Please log in using the MIO TV Session Extractor extension to continue.
						</p>
						<Button asChild>
							<a href="/user-authentication">Go to Login</a>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}
	
	return (
		<div className="container max-w-7xl mx-auto py-8 px-4 space-y-6">
			{/* Header Section */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<h1 className="text-3xl font-bold text-foreground">
						Cross-Timeframe Chart Sync POC
					</h1>
					<Badge variant={syncEnabled ? "default" : "secondary"} className="text-sm">
						{syncEnabled ? 'Sync Active' : 'Sync Disabled'}
					</Badge>
				</div>
				<p className="text-muted-foreground">
					Two-chart layout with 1D ↔ 60min cross-timeframe synchronization testing.
				</p>
			</div>
			
			{/* Instructions Card */}
			<Card className="border-blue-500/20 bg-blue-50/10 dark:bg-blue-950/10">
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Info className="h-4 w-4" />
						How It Works
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-muted-foreground">
					<p>
						<strong className="text-foreground">Chart 1 (Top):</strong> Daily (1D) price + volume chart.
						Shows daily candles with volume indicator.
					</p>
					<p>
						<strong className="text-foreground">Chart 2 (Bottom):</strong> Hourly (60min) price chart.
						Shows intraday hourly candles.
					</p>
					<p>
						<strong className="text-foreground">Hover/Scroll:</strong> Move your cursor or zoom on either
						chart to see synchronized crosshair and viewport across different timeframes.
					</p>
					<p className="text-xs pt-2 border-t border-border">
						<strong>Cross-Timeframe Sync:</strong> When you hover on a daily bar, the crosshair
						syncs to the corresponding hourly bars. Scroll/zoom is also synchronized between both charts.
					</p>
				</CardContent>
			</Card>
			
			{/* Chart Configuration Info */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Chart 1 Info */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">
							Chart 1: Main Chart (1D)
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-xs text-muted-foreground">
						<div className="flex justify-between">
							<span>Symbol:</span>
							<span className="text-foreground font-mono">NSE:RELIANCE</span>
						</div>
						<div className="flex justify-between">
							<span>Resolution:</span>
							<span className="text-foreground font-mono">1D</span>
						</div>
						<div className="flex justify-between">
							<span>Bars:</span>
							<span className="text-foreground font-mono">300</span>
						</div>
						<div className="pt-2 border-t border-border">
							<p className="font-medium text-foreground mb-1">2 Panes:</p>
							<ul className="ml-4 list-disc space-y-0.5">
								<li>Price Chart (Candlesticks)</li>
								<li>Volume Histogram</li>
							</ul>
						</div>
					</CardContent>
				</Card>
				
				{/* Chart 2 Info */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">
							Chart 2: Price (60min)
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-xs text-muted-foreground">
						<div className="flex justify-between">
							<span>Symbol:</span>
							<span className="text-foreground font-mono">NSE:RELIANCE</span>
						</div>
						<div className="flex justify-between">
							<span>Resolution:</span>
							<span className="text-foreground font-mono">60min</span>
						</div>
						<div className="flex justify-between">
							<span>Bars:</span>
							<span className="text-foreground font-mono">300</span>
						</div>
						<div className="pt-2 border-t border-border">
							<p className="font-medium text-foreground mb-1">Purpose:</p>
							<p>Hourly chart for testing cross-timeframe cursor and range synchronization</p>
						</div>
					</CardContent>
				</Card>
			</div>
			
			{/* Sync Toggle */}
			<Card>
				<CardContent className="py-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Cross-Chart Synchronization</p>
							<p className="text-xs text-muted-foreground">
								Enable/disable crosshair and scroll sync between charts
							</p>
						</div>
						<Button
							onClick={() => setSyncEnabled(!syncEnabled)}
							variant={syncEnabled ? "default" : "outline"}
							size="sm"
						>
							{syncEnabled ? 'Disable Sync' : 'Enable Sync'}
						</Button>
					</div>
				</CardContent>
			</Card>
			
			{/* Chart 1: Price + Volume + CVD 1D */}
			<div className="space-y-2">
				<div className="flex items-center justify-between px-2">
					<h2 className="text-lg font-semibold text-foreground">
						Chart 1: Price + Volume (1D)
					</h2>
					<Badge variant="outline" className="text-xs">
						Default Timeframe
					</Badge>
				</div>
				<ReusableChart
					symbol="NSE:RELIANCE"
					resolution="1D"
					barsCount={300}
					indicators={chart1Indicators}
					height={500}
					showGrid={true}
					onChartReady={handleChart1Ready}
					onDataLoaded={handleChart1DataLoaded}
				/>
			</div>
			
			{/* Chart 2: Price Chart */}
			<div className="space-y-2">
				<div className="flex items-center justify-between px-2">
					<h2 className="text-lg font-semibold text-foreground">
						Chart 2: Price (60min)
					</h2>
					<Badge variant="outline" className="text-xs">
						Different Timeframe
					</Badge>
				</div>
				<ReusableChart
					symbol="NSE:RELIANCE"
					resolution="60"
					barsCount={300}
					indicators={chart2Indicators}
					height={250}
					showGrid={true}
					onChartReady={handleChart2Ready}
					onDataLoaded={handleChart2DataLoaded}
				/>
			</div>
			
			{/* Debug Panel */}
			<Card className="border-muted">
				<CardHeader>
					<CardTitle className="text-sm">Debug Information</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
						<div className="space-y-1">
							<span className="text-muted-foreground">Chart 1 Status:</span>
							<p className="text-foreground">
								{chart1 ? '✓ Ready' : '⏳ Loading'}
							</p>
						</div>
						<div className="space-y-1">
							<span className="text-muted-foreground">Chart 2 Status:</span>
							<p className="text-foreground">
								{chart2 ? '✓ Ready' : '⏳ Loading'}
							</p>
						</div>
						<div className="space-y-1">
							<span className="text-muted-foreground">1D Bars:</span>
							<p className="text-foreground">{bars1D.length}</p>
						</div>
						<div className="space-y-1">
							<span className="text-muted-foreground">Chart 2 Bars:</span>
							<p className="text-foreground">{bars188m.length}</p>
						</div>
						<div className="space-y-1">
							<span className="text-muted-foreground">Sync Enabled:</span>
							<p className="text-foreground">{syncEnabled ? 'Yes' : 'No'}</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
