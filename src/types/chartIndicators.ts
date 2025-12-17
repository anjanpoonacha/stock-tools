/**
 * Chart Indicator Types
 * 
 * Flexible type system for adding indicators to TradingView charts.
 * Supports multiple indicator types with custom configurations.
 */

import type { ISeriesApi, SeriesType } from 'lightweight-charts';

/**
 * Supported indicator types
 */
export type IndicatorType = 
	| 'cvd'           // Cumulative Volume Delta
	| 'volume'        // Volume Histogram
	| 'sma'           // Simple Moving Average
	| 'ema'           // Exponential Moving Average
	| 'rsi'           // Relative Strength Index
	| 'macd'          // Moving Average Convergence Divergence
	| 'bollinger'     // Bollinger Bands
	| 'custom';       // Custom indicator

/**
 * Indicator display mode
 */
export type IndicatorDisplayMode = 
	| 'overlay'       // Display on main price chart (e.g., SMA, Bollinger Bands)
	| 'pane';         // Display in separate pane (e.g., RSI, MACD, Volume)

/**
 * Base indicator configuration
 */
export interface BaseIndicatorConfig {
	/** Unique identifier for this indicator instance */
	id: string;
	
	/** Type of indicator */
	type: IndicatorType;
	
	/** Display name for the indicator */
	name?: string;
	
	/** Whether the indicator is enabled */
	enabled: boolean;
	
	/** Display mode: overlay on main chart or separate pane */
	displayMode: IndicatorDisplayMode;
	
	/** Pane index (only for 'pane' display mode) */
	paneIndex?: number;
	
	/** Pane height in pixels (only for 'pane' display mode) */
	paneHeight?: number;
	
	/** Custom colors for the indicator */
	colors?: {
		primary?: string;
		secondary?: string;
		up?: string;
		down?: string;
		[key: string]: string | undefined;
	};
}

/**
 * CVD (Cumulative Volume Delta) Indicator Configuration
 */
export interface CVDIndicatorConfig extends BaseIndicatorConfig {
	type: 'cvd';
	displayMode: 'pane';
	options: {
		/** Anchor period for CVD calculation (e.g., '3M', '6M', '1Y') */
		anchorPeriod: string;
		/** Custom timeframe for CVD bars (optional) */
		timeframe?: string;
	};
}

/**
 * Volume Indicator Configuration
 */
export interface VolumeIndicatorConfig extends BaseIndicatorConfig {
	type: 'volume';
	displayMode: 'pane';
	options?: {
		/** Show volume as histogram (default: true) */
		showAsHistogram?: boolean;
	};
}

/**
 * SMA (Simple Moving Average) Indicator Configuration
 */
export interface SMAIndicatorConfig extends BaseIndicatorConfig {
	type: 'sma';
	displayMode: 'overlay';
	options: {
		/** Period for SMA calculation (e.g., 20, 50, 200) */
		period: number;
		/** Line width */
		lineWidth?: number;
	};
}

/**
 * EMA (Exponential Moving Average) Indicator Configuration
 */
export interface EMAIndicatorConfig extends BaseIndicatorConfig {
	type: 'ema';
	displayMode: 'overlay';
	options: {
		/** Period for EMA calculation */
		period: number;
		/** Line width */
		lineWidth?: number;
	};
}

/**
 * RSI (Relative Strength Index) Indicator Configuration
 */
export interface RSIIndicatorConfig extends BaseIndicatorConfig {
	type: 'rsi';
	displayMode: 'pane';
	options: {
		/** Period for RSI calculation (default: 14) */
		period?: number;
		/** Overbought level (default: 70) */
		overboughtLevel?: number;
		/** Oversold level (default: 30) */
		oversoldLevel?: number;
	};
}

/**
 * MACD Indicator Configuration
 */
export interface MACDIndicatorConfig extends BaseIndicatorConfig {
	type: 'macd';
	displayMode: 'pane';
	options: {
		/** Fast period (default: 12) */
		fastPeriod?: number;
		/** Slow period (default: 26) */
		slowPeriod?: number;
		/** Signal period (default: 9) */
		signalPeriod?: number;
	};
}

/**
 * Bollinger Bands Indicator Configuration
 */
export interface BollingerIndicatorConfig extends BaseIndicatorConfig {
	type: 'bollinger';
	displayMode: 'overlay';
	options: {
		/** Period for moving average (default: 20) */
		period?: number;
		/** Standard deviation multiplier (default: 2) */
		stdDev?: number;
	};
}

/**
 * Custom Indicator Configuration
 */
export interface CustomIndicatorConfig extends BaseIndicatorConfig {
	type: 'custom';
	options: {
		/** Custom data processor function */
		processData?: (data: unknown) => unknown;
		/** Custom renderer function */
		render?: (chart: unknown, data: unknown) => ISeriesApi<SeriesType>;
	};
}

/**
 * Union type of all indicator configurations
 */
export type IndicatorConfig = 
	| CVDIndicatorConfig
	| VolumeIndicatorConfig
	| SMAIndicatorConfig
	| EMAIndicatorConfig
	| RSIIndicatorConfig
	| MACDIndicatorConfig
	| BollingerIndicatorConfig
	| CustomIndicatorConfig;

/**
 * Indicator data from API response
 */
export interface IndicatorData {
	/** Indicator ID (matches config id) */
	id: string;
	
	/** Study ID from TradingView (for server-side indicators) */
	studyId?: string;
	
	/** Study name */
	studyName?: string;
	
	/** Indicator configuration used */
	config?: unknown;
	
	/** Time-series values */
	values: Array<{
		time: number;
		values: number[];
	}>;
}

/**
 * Indicator rendering result
 */
export interface IndicatorRenderResult {
	/** Indicator configuration */
	config: IndicatorConfig;
	
	/** Lightweight Charts series instance */
	series: ISeriesApi<SeriesType>;
	
	/** Pane index (if applicable) */
	paneIndex?: number;
}

/**
 * Helper function to create CVD indicator config
 */
export function createCVDIndicator(
	enabled: boolean = false,
	anchorPeriod: string = '3M',
	timeframe?: string,
	paneIndex: number = 2,
	paneHeight: number = 120
): CVDIndicatorConfig {
	return {
		id: 'cvd',
		type: 'cvd',
		name: 'CVD',
		enabled,
		displayMode: 'pane',
		paneIndex,
		paneHeight,
		options: {
			anchorPeriod,
			timeframe,
		},
		colors: {
			up: '#26a69a',
			down: '#ef5350',
		},
	};
}

/**
 * Helper function to create Volume indicator config
 */
export function createVolumeIndicator(
	enabled: boolean = true,
	paneIndex: number = 1,
	paneHeight: number = 100
): VolumeIndicatorConfig {
	return {
		id: 'volume',
		type: 'volume',
		name: 'Volume',
		enabled,
		displayMode: 'pane',
		paneIndex,
		paneHeight,
		options: {
			showAsHistogram: true,
		},
	};
}

/**
 * Helper function to create SMA indicator config
 */
export function createSMAIndicator(
	enabled: boolean = true,
	period: number = 20,
	color: string = '#26a69a'
): SMAIndicatorConfig {
	return {
		id: `sma-${period}`,
		type: 'sma',
		name: `SMA(${period})`,
		enabled,
		displayMode: 'overlay',
		options: {
			period,
			lineWidth: 1,
		},
		colors: {
			primary: color,
		},
	};
}

/**
 * Helper function to create EMA indicator config
 */
export function createEMAIndicator(
	enabled: boolean = false,
	period: number = 12,
	color: string = '#2962FF'
): EMAIndicatorConfig {
	return {
		id: `ema-${period}`,
		type: 'ema',
		name: `EMA(${period})`,
		enabled,
		displayMode: 'overlay',
		options: {
			period,
			lineWidth: 1,
		},
		colors: {
			primary: color,
		},
	};
}

/**
 * Helper function to create RSI indicator config
 */
export function createRSIIndicator(
	enabled: boolean = false,
	period: number = 14,
	paneIndex: number = 3,
	paneHeight: number = 100
): RSIIndicatorConfig {
	return {
		id: 'rsi',
		type: 'rsi',
		name: `RSI(${period})`,
		enabled,
		displayMode: 'pane',
		paneIndex,
		paneHeight,
		options: {
			period,
			overboughtLevel: 70,
			oversoldLevel: 30,
		},
		colors: {
			primary: '#9C27B0',
			secondary: '#E1BEE7',
		},
	};
}
