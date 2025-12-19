/**
 * Volume Moving Average Calculations
 *
 * Provides EMA calculation for volume data.
 */

import type { OHLCVBar } from '@/lib/tradingview/types';

/**
 * Time-value pair for series data
 */
export interface TimeValue {
	time: number;
	value: number;
}

/**
 * Calculate Exponential Moving Average (EMA) for volume
 *
 * @param bars - OHLCV bars array
 * @param length - EMA period length (default: 30)
 * @returns Array of time-value pairs for EMA
 */
export function calculateVolumeEMA(
	bars: OHLCVBar[],
	length: number = 30
): TimeValue[] {
	if (bars.length === 0) return [];
	if (length <= 0) return [];

	const multiplier = 2 / (length + 1);
	const result: TimeValue[] = [];

	// Initialize with SMA for first period
	let ema = 0;
	const initialBars = bars.slice(0, length);

	if (initialBars.length < length) {
		// Not enough data, use available data
		ema = initialBars.reduce((sum, bar) => sum + bar.volume, 0) / initialBars.length;
	} else {
		ema = initialBars.reduce((sum, bar) => sum + bar.volume, 0) / length;
	}

	// Calculate EMA for each bar
	for (let i = 0; i < bars.length; i++) {
		if (i < length - 1) {
			// Skip bars until we have enough for initial SMA
			continue;
		}

		if (i === length - 1) {
			// First EMA value (SMA)
			result.push({ time: bars[i].time, value: ema });
		} else {
			// Calculate EMA: EMA = (Close - EMA(prev)) * multiplier + EMA(prev)
			ema = (bars[i].volume - ema) * multiplier + ema;
			result.push({ time: bars[i].time, value: ema });
		}
	}

	return result;
}
