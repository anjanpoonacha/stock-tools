/**
 * Multi-Pane Chart System Types
 * 
 * TypeScript type definitions for the multi-pane chart system that enables
 * synchronized chart panes with independent symbols, resolutions, and indicators.
 */

import type { IChartApi, MouseEventParams } from 'lightweight-charts';
import type { IndicatorConfig } from '@/types/chartIndicators';

/**
 * Configuration for a single chart pane
 * 
 * Defines all the properties needed to render and manage an individual chart pane,
 * including the symbol, resolution, indicators, and UI settings.
 */
export interface PaneConfig {
	/** Unique identifier for this pane */
	id: string;
	
	/** Display label for the pane (e.g., "Main Chart", "Volume", "RSI") */
	label: string;
	
	/** Whether this pane is currently enabled/visible */
	enabled: boolean;
	
	/** Trading symbol to display (e.g., "AAPL", "BTCUSDT") */
	symbol: string;
	
	/** Chart resolution/timeframe (e.g., "1D", "1H", "15") */
	resolution: string;
	
	/** Number of bars/candles to fetch and display */
	barsCount: number;
	
	/** Array of indicators to render on this pane */
	indicators: IndicatorConfig[];
	
	/** Height of the pane in pixels */
	height: number;
}

/**
 * Props for the ChartPane component
 * 
 * Extends PaneConfig with additional callback props for chart lifecycle events
 * and crosshair synchronization.
 */
export interface ChartPaneProps extends PaneConfig {
	/** Callback fired when the chart is ready and the IChartApi is available */
	onChartReady?: (chart: IChartApi) => void;
	
	/** 
	 * Callback fired when the crosshair moves on this pane
	 * @param paneId - ID of the pane where the crosshair moved
	 * @param param - Mouse event parameters from lightweight-charts
	 */
	onCrosshairMove?: (paneId: string, param: MouseEventParams) => void;
	
	/** 
	 * External crosshair position to sync with other panes
	 * When set, this pane will display a crosshair at the specified time/price
	 */
	externalCrosshairPosition?: { time: number; price?: number } | null;
}

/**
 * Props for the MultiPaneChart component
 * 
 * Configuration for the entire multi-pane chart system, including all panes
 * and synchronization settings.
 */
export interface MultiPaneChartProps {
	/** Array of pane configurations to render */
	panes: PaneConfig[];
	
	/** 
	 * Callback fired when a pane is toggled on/off
	 * @param paneId - ID of the pane that was toggled
	 * @param enabled - New enabled state
	 */
	onPaneToggle?: (paneId: string, enabled: boolean) => void;
	
	/** 
	 * Whether to synchronize time range across all panes
	 * @default true
	 */
	syncTimeRange?: boolean;
	
	/** 
	 * Whether to synchronize crosshair position across all panes
	 * @default true
	 */
	syncCrosshair?: boolean;
}

/**
 * Internal state for crosshair synchronization
 * 
 * Tracks the source pane and position data for synchronized crosshair movements
 * across multiple chart panes.
 */
export interface CrosshairSyncState {
	/** ID of the pane where the crosshair movement originated */
	sourcePane: string;
	
	/** Unix timestamp of the crosshair position */
	time: number;
	
	/** Price level at the crosshair position (optional) */
	price?: number;
}
