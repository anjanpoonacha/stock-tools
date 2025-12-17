'use client';

import React, { useState, useMemo } from 'react';
import { TradingViewLiveChart } from '@/components/TradingViewLiveChart';
import { ReusableChart } from '@/components/ReusableChart';
import { ChartErrorBoundary } from '@/components/error/ChartErrorBoundary';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Info, AlertTriangle, Loader2 } from 'lucide-react';
import { 
	createCVDIndicator, 
	createVolumeIndicator, 
	createSMAIndicator 
} from '@/types/chartIndicators';
import type { IndicatorConfig } from '@/types/chartIndicators';

// NSE stock symbols
const STOCK_SYMBOLS = [
	{ value: 'NSE:JUNIPER', label: 'Juniper Hotels' },
	{ value: 'NSE:RELIANCE', label: 'Reliance Industries' },
	{ value: 'NSE:TCS', label: 'Tata Consultancy Services' },
	{ value: 'NSE:INFY', label: 'Infosys' },
	{ value: 'NSE:HDFCBANK', label: 'HDFC Bank' },
	{ value: 'NSE:ICICIBANK', label: 'ICICI Bank' },
];

// Timeframe options (TradingView resolution format)
const TIMEFRAMES = [
	{ value: '1D', label: '1 Day', barsCount: 300 },
	{ value: '1W', label: '1 Week', barsCount: 300 },
	{ value: '1M', label: '1 Month', barsCount: 300 },
	{ value: '60', label: '1 Hour', barsCount: 300 },
	{ value: '15', label: '15 Min', barsCount: 300 },
];

const ChartPageContent: React.FC = () => {
	const [selectedSymbol, setSelectedSymbol] = useState<string>('NSE:JUNIPER');
	const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
	const [showSMA, setShowSMA] = useState<boolean>(true);
	const [showVolume, setShowVolume] = useState<boolean>(true);
	const [showGrid, setShowGrid] = useState<boolean>(true);
	const [showCVD, setShowCVD] = useState<boolean>(false);
	const [cvdAnchorPeriod, setCvdAnchorPeriod] = useState<string>('3M');
	const [cvdTimeframe, setCvdTimeframe] = useState<string>('chart');
	const [useNewChart, setUseNewChart] = useState<boolean>(false);
	const { authStatus, isAuthenticated, isLoading } = useAuth();
	
	// Build indicator configurations using the new system
	const indicators = useMemo<IndicatorConfig[]>(() => {
		const configs: IndicatorConfig[] = [];
		
		// Add SMA indicator
		if (showSMA) {
			configs.push(createSMAIndicator(true, 20));
		}
		
		// Add Volume indicator
		if (showVolume) {
			configs.push(createVolumeIndicator(true, 1, 100));
		}
		
		// Add CVD indicator
		if (showCVD) {
			const timeframe = cvdTimeframe === 'chart' ? undefined : cvdTimeframe;
			configs.push(createCVDIndicator(true, cvdAnchorPeriod, timeframe, 2, 120));
		}
		
		return configs;
	}, [showSMA, showVolume, showCVD, cvdAnchorPeriod, cvdTimeframe]);

	return (
		<div className='container mx-auto py-8 space-y-6'>
			{/* Header */}
			<div className='space-y-2'>
				<h1 className='text-3xl font-bold tracking-tight'>TradingView Chart Analysis</h1>
				<p className='text-muted-foreground'>
					Analyze stock charts with real-time data from TradingView
				</p>
			</div>

			{/* Info Alert */}
			{isLoading ? (
				<Alert>
					<Loader2 className='h-4 w-4 animate-spin' />
					<AlertDescription>
						Checking authentication status...
					</AlertDescription>
				</Alert>
			) : isAuthenticated() ? (
				<Alert>
					<Info className='h-4 w-4' />
					<AlertDescription>
						Live charts with real TradingView data. Historical OHLCV bars with volume and 20-period SMA indicator.
					</AlertDescription>
				</Alert>
			) : (
				<Alert variant="destructive">
					<AlertTriangle className='h-4 w-4' />
					<AlertDescription>
						Please log in to view charts. Your TradingView session will be retrieved automatically from the browser extension.
					</AlertDescription>
				</Alert>
			)}

			{/* Controls Card */}
			<Card>
				<CardHeader>
					<CardTitle>Chart Settings</CardTitle>
					<CardDescription>Select a stock symbol and timeframe to view the chart</CardDescription>
				</CardHeader>
				<CardContent className='space-y-6'>
					{/* Symbol Selector */}
					<div className='space-y-2'>
						<label className='text-sm font-medium'>Stock Symbol</label>
						<Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
							<SelectTrigger className='w-full md:w-[300px]'>
								<SelectValue placeholder='Select a stock' />
							</SelectTrigger>
							<SelectContent>
								{STOCK_SYMBOLS.map(stock => (
									<SelectItem key={stock.value} value={stock.value}>
										{stock.label} ({stock.value})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Timeframe Selector */}
					<div className='space-y-2'>
						<label className='text-sm font-medium'>Timeframe</label>
						<div className='flex flex-wrap gap-2'>
							{TIMEFRAMES.map(timeframe => (
								<Button
									key={timeframe.value}
									variant={selectedTimeframe === timeframe.value ? 'default' : 'outline'}
									size='sm'
									onClick={() => setSelectedTimeframe(timeframe.value)}
								>
									{timeframe.label}
								</Button>
							))}
						</div>
					</div>

					{/* Chart Display Settings */}
					<div className='space-y-2 pt-4 border-t'>
						<label className='text-sm font-medium'>Chart Display</label>
						<div className='flex flex-wrap gap-4'>
							<div className='flex items-center gap-2'>
								<Checkbox 
									id='show-sma'
									checked={showSMA}
									onCheckedChange={(checked) => setShowSMA(checked === true)}
								/>
								<Label htmlFor='show-sma' className='text-sm cursor-pointer'>SMA(20)</Label>
							</div>
							<div className='flex items-center gap-2'>
								<Checkbox 
									id='show-volume'
									checked={showVolume}
									onCheckedChange={(checked) => setShowVolume(checked === true)}
								/>
								<Label htmlFor='show-volume' className='text-sm cursor-pointer'>Volume</Label>
							</div>
							<div className='flex items-center gap-2'>
								<Checkbox 
									id='show-grid'
									checked={showGrid}
									onCheckedChange={(checked) => setShowGrid(checked === true)}
								/>
								<Label htmlFor='show-grid' className='text-sm cursor-pointer'>Grid Lines</Label>
							</div>
							<div className='flex items-center gap-2 ml-auto'>
								<Checkbox 
									id='use-new-chart'
									checked={useNewChart}
									onCheckedChange={(checked) => setUseNewChart(checked === true)}
								/>
								<Label htmlFor='use-new-chart' className='text-sm cursor-pointer font-medium text-primary'>
									Use Reusable Chart (New)
								</Label>
							</div>
						</div>
					</div>

					{/* CVD Indicator Settings */}
					<div className='space-y-3 pt-4 border-t'>
						<div className='flex items-center gap-2'>
							<Checkbox 
								id='show-cvd'
								checked={showCVD}
								onCheckedChange={(checked) => setShowCVD(checked === true)}
							/>
							<Label htmlFor='show-cvd' className='text-sm font-medium cursor-pointer'>
								CVD (Cumulative Volume Delta)
							</Label>
						</div>
						
						{showCVD && (
							<div className='ml-6 space-y-3 p-4 bg-muted/50 rounded-lg'>
								<div className='space-y-2'>
									<label className='text-sm font-medium'>Anchor Period</label>
									<Select value={cvdAnchorPeriod} onValueChange={setCvdAnchorPeriod}>
										<SelectTrigger className='w-full md:w-[200px]'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='1W'>1 Week</SelectItem>
											<SelectItem value='1M'>1 Month</SelectItem>
											<SelectItem value='3M'>3 Months</SelectItem>
											<SelectItem value='6M'>6 Months</SelectItem>
											<SelectItem value='1Y'>1 Year</SelectItem>
										</SelectContent>
									</Select>
								</div>
								
								<div className='space-y-2'>
									<label className='text-sm font-medium'>Custom Timeframe (Optional)</label>
									<Select value={cvdTimeframe} onValueChange={setCvdTimeframe}>
										<SelectTrigger className='w-full md:w-[200px]'>
											<SelectValue placeholder='Use chart resolution' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='chart'>Chart Resolution</SelectItem>
											<SelectItem value='15S'>15 Seconds</SelectItem>
											<SelectItem value='30S'>30 Seconds</SelectItem>
											<SelectItem value='1'>1 Minute</SelectItem>
											<SelectItem value='5'>5 Minutes</SelectItem>
											<SelectItem value='15'>15 Minutes</SelectItem>
										</SelectContent>
									</Select>
									<p className='text-xs text-muted-foreground'>
										CVD bar granularity independent of chart timeframe
									</p>
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Chart Card */}
			<Card>
				<CardHeader>
					<CardTitle>
						{STOCK_SYMBOLS.find(s => s.value === selectedSymbol)?.label} ({selectedSymbol})
					</CardTitle>
					<CardDescription>
						Historical OHLCV data • {TIMEFRAMES.find(t => t.value === selectedTimeframe)?.label} timeframe
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex items-center justify-center bg-muted/30 rounded-lg" style={{ height: 600 }}>
							<div className="text-center">
								<Loader2 className="h-12 w-12 animate-spin text-foreground mx-auto mb-4" />
								<p className="text-foreground font-semibold mb-2">Checking Authentication</p>
								<p className="text-muted-foreground text-sm">
									Please wait while we verify your credentials...
								</p>
							</div>
						</div>
					) : isAuthenticated() ? (
						<ChartErrorBoundary>
							{useNewChart ? (
								<ReusableChart
									symbol={selectedSymbol}
									resolution={selectedTimeframe}
									barsCount={TIMEFRAMES.find(t => t.value === selectedTimeframe)?.barsCount || 300}
									height={600}
									showGrid={showGrid}
									indicators={indicators}
								/>
							) : (
								<TradingViewLiveChart
									symbol={selectedSymbol}
									resolution={selectedTimeframe}
									barsCount={TIMEFRAMES.find(t => t.value === selectedTimeframe)?.barsCount || 300}
									height={600}
									showSMA={showSMA}
									showVolume={showVolume}
									showGrid={showGrid}
									showCVD={showCVD}
									cvdAnchorPeriod={cvdAnchorPeriod}
									cvdTimeframe={cvdTimeframe === 'chart' ? undefined : cvdTimeframe}
								/>
							)}
						</ChartErrorBoundary>
					) : (
						<div className="flex items-center justify-center bg-muted/30 rounded-lg" style={{ height: 600 }}>
							<div className="text-center p-6 max-w-md">
								<AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
								<p className="text-foreground font-semibold mb-2">Please Log In</p>
								<p className="text-muted-foreground text-sm mb-4">
									You need to be logged in to view charts. Your TradingView session will be retrieved automatically.
								</p>
								<p className="text-muted-foreground text-xs">
									Logged in as: {authStatus?.userEmail || 'Not logged in'}
								</p>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default ChartPageContent;
