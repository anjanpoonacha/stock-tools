/**
 * DualChartView - Dual chart layout with resizable panels
 *
 * Features:
 * - Horizontal and vertical layouts
 * - Resizable panels with react-resizable-panels
 * - Focus indicators (primary border + ring)
 * - Click-to-focus functionality
 * - Two independent TradingViewLiveChart instances
 */

'use client';

import React, { useCallback } from 'react';
import { Group as PanelGroup, Panel, Separator as ResizeHandle } from 'react-resizable-panels';
import { TradingViewLiveChart } from '@/components/TradingViewLiveChart';
import { RESPONSIVE_CHART_HEIGHT } from '@/lib/chart/constants';
import { cn } from '@/lib/utils';
import type { ChartSettings, DualChartLayout } from '@/hooks/useKVSettings';
import type { IChartApi } from 'lightweight-charts';
import type { OHLCVBar } from '@/lib/tradingview/types';

// Resolution configurations
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

interface DualChartViewProps {
	layoutMode: 'horizontal' | 'vertical';
	currentSymbol: string;
	resolution1: string;
	resolution2: string;
	zoomLevel1: string;
	zoomLevel2: string;
	showGrid: boolean;
	showCVD: boolean;
	cvdAnchorPeriod: string;
	cvdUseCustomPeriod: boolean;
	cvdCustomPeriod: string;
	chartSettings: ChartSettings;
	getResolutionConfig: (resolution: string) => { value: string; label: string; barsCount: number };
	focusedChartIndex: number;
	setFocusedChartIndex: (index: number) => void;
	// Dual chart layout persistence
	dualChartLayout: DualChartLayout;
	onDualChartLayoutChange: (orientation: 'horizontal' | 'vertical', sizes: { chart1: number; chart2: number }) => void;
	// Stable callback references (prevents infinite loop)
	onChart1Ready: (chart: IChartApi) => void;
	onChart1DataLoaded: (bars: OHLCVBar[]) => void;
	onChart2Ready: (chart: IChartApi) => void;
	onChart2DataLoaded: (bars: OHLCVBar[]) => void;
}

export function DualChartView({
	layoutMode,
	currentSymbol,
	resolution1,
	resolution2,
	zoomLevel1,
	zoomLevel2,
	showGrid,
	showCVD,
	cvdAnchorPeriod,
	cvdUseCustomPeriod,
	cvdCustomPeriod,
	chartSettings,
	getResolutionConfig,
	focusedChartIndex,
	setFocusedChartIndex,
	dualChartLayout,
	onDualChartLayoutChange,
	onChart1Ready,
	onChart1DataLoaded,
	onChart2Ready,
	onChart2DataLoaded,
}: DualChartViewProps) {
	// Handle dual chart panel resize with threshold check
	const handleDualPanelResize = useCallback(
		(layout: Record<string, number>) => {
			const chart1 = layout['dual-chart-1'];
			const chart2 = layout['dual-chart-2'];
			
			if (chart1 === undefined || chart2 === undefined) return;
			
			console.log('🎨 [Dual Chart Resize]', { chart1, chart2, layoutMode });
			
			// Calculate differences from saved layout
			const chart1Diff = Math.abs(chart1 - dualChartLayout[layoutMode].chart1);
			const chart2Diff = Math.abs(chart2 - dualChartLayout[layoutMode].chart2);
			
			// Only update if changed by more than 0.01% (same threshold as main panels)
			const THRESHOLD = 0.01;
			const changed = chart1Diff > THRESHOLD || chart2Diff > THRESHOLD;
			
			if (changed) {
				console.log('✅ [Dual Chart] Updating layout');
				onDualChartLayoutChange(layoutMode, { chart1, chart2 });
			} else {
				console.log('⏭️ [Dual Chart] Skipped - below threshold');
			}
		},
		[layoutMode, dualChartLayout, onDualChartLayoutChange]
	);

	return (
		<PanelGroup
			orientation={layoutMode}
			className='h-full w-full'
			id={`dual-chart-${layoutMode}`}
			onLayoutChange={handleDualPanelResize}
		>
			{/* Chart 1 */}
			<Panel id="dual-chart-1" defaultSize={dualChartLayout[layoutMode].chart1} minSize={20} order={1}>
				<div
					className={cn(
						'h-full bg-background rounded-lg border overflow-hidden transition-all cursor-pointer flex flex-col',
						focusedChartIndex === 0 ? 'border-primary ring-2 ring-primary/20' : 'border-border'
					)}
					onClick={() => setFocusedChartIndex(0)}
					role='button'
					tabIndex={0}
					aria-label={`Chart 1 - ${getResolutionConfig(resolution1).label}${
						focusedChartIndex === 0 ? ' (focused)' : ''
					}`}
				>
					<div className='p-2 border-b border-border bg-muted/30 flex-shrink-0'>
						<p className='text-xs font-medium text-muted-foreground'>
							{getResolutionConfig(resolution1).label}
							{focusedChartIndex === 0 && <span className='ml-2 text-[10px] text-primary'>● Focused</span>}
						</p>
					</div>
					<div className='flex-1 min-h-0 p-2'>
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
							onChartReady={onChart1Ready}
							onDataLoaded={onChart1DataLoaded}
						/>
					</div>
				</div>
			</Panel>

		<ResizeHandle
			className={cn(
				'transition-colors relative z-10',
				layoutMode === 'horizontal' 
					? 'w-1 bg-border hover:bg-primary cursor-col-resize' 
					: 'h-2 w-full bg-border hover:bg-primary cursor-row-resize'
			)}
		/>

		{/* Chart 2 */}
		<Panel id="dual-chart-2" defaultSize={dualChartLayout[layoutMode].chart2} minSize={20} order={2}>
				<div
					className={cn(
						'h-full bg-background rounded-lg border overflow-hidden transition-all cursor-pointer flex flex-col',
						focusedChartIndex === 1 ? 'border-primary ring-2 ring-primary/20' : 'border-border'
					)}
					onClick={() => setFocusedChartIndex(1)}
					role='button'
					tabIndex={0}
					aria-label={`Chart 2 - ${getResolutionConfig(resolution2).label}${
						focusedChartIndex === 1 ? ' (focused)' : ''
					}`}
				>
					<div className='p-2 border-b border-border bg-muted/30 flex-shrink-0'>
						<p className='text-xs font-medium text-muted-foreground'>
							{getResolutionConfig(resolution2).label}
							{focusedChartIndex === 1 && <span className='ml-2 text-[10px] text-primary'>● Focused</span>}
						</p>
					</div>
					<div className='flex-1 min-h-0 p-2'>
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
							onChartReady={onChart2Ready}
							onDataLoaded={onChart2DataLoaded}
						/>
					</div>
				</div>
			</Panel>
		</PanelGroup>
	);
}
