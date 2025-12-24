/**
 * Indicator Renderer
 * 
 * Handles rendering of different indicator types on lightweight charts.
 * Provides a factory pattern for creating and managing indicators.
 */

import type { IChartApi } from 'lightweight-charts';
import { LineSeries, HistogramSeries, CandlestickSeries } from 'lightweight-charts';
import type { 
	IndicatorConfig, 
	IndicatorRenderResult,
	CVDIndicatorConfig,
	VolumeIndicatorConfig,
	SMAIndicatorConfig,
} from '@/types/chartIndicators';
import type { OHLCVBar } from '@/lib/tradingview/types';

/**
 * Process CVD data from API response
 */
function processCVDData(values: Array<{ time: number; values: number[] }>) {
	// Filter out placeholder values and deduplicate
	const filtered = values.filter(d => d.values[3] !== 1e+100);
	
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
	
	return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
}

/**
 * Process volume data from OHLCV bars
 */
function processVolumeData(
	bars: OHLCVBar[], 
	isDark: boolean
) {
	return bars.map(bar => ({
		time: bar.time,
		value: bar.volume,
		color: bar.close >= bar.open 
			? (isDark ? 'rgba(38, 166, 154, 0.4)' : 'rgba(38, 166, 154, 0.5)') 
			: (isDark ? 'rgba(239, 83, 80, 0.4)' : 'rgba(239, 83, 80, 0.5)')
	}));
}

/**
 * Calculate Simple Moving Average (SMA)
 */
function calculateSMA(bars: OHLCVBar[], period: number) {
	const smaData: Array<{ time: number; value: number }> = [];
	
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
 * Render CVD indicator
 */
function renderCVD(
	chart: IChartApi,
	config: CVDIndicatorConfig,
	data: Array<{ time: number; values: number[] }>
): IndicatorRenderResult {
	const processedData = processCVDData(data);
	
	const series = chart.addSeries(CandlestickSeries, {
		upColor: config.colors?.up || '#26a69a',
		downColor: config.colors?.down || '#ef5350',
		borderVisible: false,
		wickUpColor: config.colors?.up || '#26a69a',
		wickDownColor: config.colors?.down || '#ef5350',
		lastValueVisible: false,  // Hide current value line
	});
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	series.setData(processedData as any);
	
	// Move to pane
	if (config.paneIndex !== undefined) {
		series.moveToPane(config.paneIndex);
		
		// Set pane height
		if (config.paneHeight) {
			const panes = chart.panes();
			if (panes[config.paneIndex]) {
				panes[config.paneIndex].setHeight(config.paneHeight);
			}
		}
	}
	
	return {
		config,
		series,
		paneIndex: config.paneIndex,
	};
}

/**
 * Render Volume indicator
 */
function renderVolume(
	chart: IChartApi,
	config: VolumeIndicatorConfig,
	bars: OHLCVBar[],
	isDark: boolean
): IndicatorRenderResult {
	const volumeData = processVolumeData(bars, isDark);
	
	const series = chart.addSeries(HistogramSeries, {
		priceFormat: {
			type: 'volume',
		},
		priceLineVisible: false,  // Hide horizontal price line
	});
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	series.setData(volumeData as any);
	
	// Move to pane
	if (config.paneIndex !== undefined) {
		series.moveToPane(config.paneIndex);
		
		// Set pane height
		if (config.paneHeight) {
			const panes = chart.panes();
			if (panes[config.paneIndex]) {
				panes[config.paneIndex].setHeight(config.paneHeight);
			}
		}
	}
	
	return {
		config,
		series,
		paneIndex: config.paneIndex,
	};
}

/**
 * Render SMA indicator
 */
function renderSMA(
	chart: IChartApi,
	config: SMAIndicatorConfig,
	bars: OHLCVBar[]
): IndicatorRenderResult {
	const smaData = calculateSMA(bars, config.options.period);
	
	const series = chart.addSeries(LineSeries, {
		color: config.colors?.primary || '#26a69a',
		lineWidth: (config.options.lineWidth || 1) as 1 | 2 | 3 | 4,
		title: config.name || `SMA(${config.options.period})`,
		priceLineVisible: false,
		lastValueVisible: false,
	});
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	series.setData(smaData as any);
	
	return {
		config,
		series,
	};
}

/**
 * Main indicator renderer factory
 */
export class IndicatorRenderer {
	private chart: IChartApi;
	private bars: OHLCVBar[];
	private isDark: boolean;
	private indicators: Map<string, IndicatorRenderResult> = new Map();
	
	constructor(chart: IChartApi, bars: OHLCVBar[], isDark: boolean) {
		this.chart = chart;
		this.bars = bars;
		this.isDark = isDark;
	}
	
	/**
	 * Render a single indicator
	 */
	renderIndicator(
		config: IndicatorConfig,
		indicatorData?: Array<{ time: number; values: number[] }>
	): IndicatorRenderResult | null {
		if (!config.enabled) {
			return null;
		}
		
		let result: IndicatorRenderResult | null = null;
		
		switch (config.type) {
			case 'cvd':
				if (indicatorData) {
					result = renderCVD(this.chart, config, indicatorData);
				}
				break;
			
			case 'volume':
				result = renderVolume(this.chart, config, this.bars, this.isDark);
				break;
			
			case 'sma':
				result = renderSMA(this.chart, config, this.bars);
				break;
			
			// Add more indicator types here as needed
			case 'ema':
			case 'rsi':
			case 'macd':
			case 'bollinger':
			case 'custom':
				break;
			
			default:
		}
		
		if (result) {
			this.indicators.set(config.id, result);
		}
		
		return result;
	}
	
	/**
	 * Render multiple indicators
	 */
	renderIndicators(
		configs: IndicatorConfig[],
		indicatorDataMap?: Map<string, Array<{ time: number; values: number[] }>>
	): IndicatorRenderResult[] {
		const results: IndicatorRenderResult[] = [];
		
		for (const config of configs) {
			const indicatorData = indicatorDataMap?.get(config.id);
			const result = this.renderIndicator(config, indicatorData);
			if (result) {
				results.push(result);
			}
		}
		
		return results;
	}
	
	/**
	 * Get a rendered indicator by ID
	 */
	getIndicator(id: string): IndicatorRenderResult | undefined {
		return this.indicators.get(id);
	}
	
	/**
	 * Get all rendered indicators
	 */
	getAllIndicators(): IndicatorRenderResult[] {
		return Array.from(this.indicators.values());
	}
	
	/**
	 * Clear all indicators
	 */
	clearIndicators(): void {
		this.indicators.clear();
	}
}

/**
 * Helper function to extract indicator data from API response
 */
export function extractIndicatorData(
	apiResponse: {
		indicators?: {
			[key: string]: {
				studyId: string;
				values: Array<{ time: number; values: number[] }>;
			};
		};
	}
): Map<string, Array<{ time: number; values: number[] }>> {
	const dataMap = new Map<string, Array<{ time: number; values: number[] }>>();
	
	if (apiResponse.indicators) {
		for (const [key, indicator] of Object.entries(apiResponse.indicators)) {
			dataMap.set(key, indicator.values);
		}
	}
	
	return dataMap;
}
