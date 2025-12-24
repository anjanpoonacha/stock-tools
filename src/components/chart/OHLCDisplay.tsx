/**
 * OHLC Display Component
 * 
 * Displays compact OHLC (Open, High, Low, Close) data with price change indicators.
 * Shows last bar by default and updates when crosshair hovers over different bars.
 * 
 * Format: O:2,450 H:2,475 L:2,445 C:2,470 +19.65 (+0.80%)
 * - Green text for positive changes
 * - Red text for negative changes
 */

'use client';

import { useMemo } from 'react';
import type { OHLCVBar } from '@/lib/tradingview/types';
import {
	getLastBar,
	getBarAtIndex,
	calculatePriceChange,
	formatPrice,
	formatPercentage,
} from '@/lib/chart/ohlcUtils';
import { cn } from '@/lib/utils';

interface OHLCDisplayProps {
	/** Array of OHLC bars */
	bars: OHLCVBar[];
	/** Optional index for crosshair tracking (falls back to last bar if not provided) */
	currentBarIndex?: number;
	/** Optional number of decimal places for price formatting */
	decimals?: number;
}

export function OHLCDisplay({ bars, currentBarIndex, decimals = 2 }: OHLCDisplayProps) {
	// Get the bar to display (either at crosshair index or last bar)
	const currentBar = useMemo(() => {
		if (currentBarIndex !== undefined && currentBarIndex >= 0) {
			return getBarAtIndex(bars, currentBarIndex);
		}
		return getLastBar(bars);
	}, [bars, currentBarIndex]);

	// Get previous bar for change calculation
	const previousBar = useMemo(() => {
		if (!currentBar) return null;
		
		const currentIndex = currentBarIndex !== undefined 
			? currentBarIndex 
			: bars.length - 1;
		
		return getBarAtIndex(bars, currentIndex - 1);
	}, [bars, currentBar, currentBarIndex]);

	// Calculate price change
	const priceChange = useMemo(() => {
		if (!currentBar) return { absolute: 0, percentage: 0 };
		return calculatePriceChange(currentBar, previousBar);
	}, [currentBar, previousBar]);

	// If no data, show placeholder
	if (!currentBar) {
		return (
			<span className="text-[10px] text-muted-foreground ml-2">
				No data
			</span>
		);
	}

	// Determine color based on price change
	const changeColor = priceChange.absolute >= 0 ? 'text-green-500' : 'text-red-500';

	return (
		<span className="text-[10px] text-muted-foreground ml-2 font-mono">
			<span>O:{formatPrice(currentBar.open, decimals)}</span>
			{' '}
			<span>H:{formatPrice(currentBar.high, decimals)}</span>
			{' '}
			<span>L:{formatPrice(currentBar.low, decimals)}</span>
			{' '}
			<span>C:{formatPrice(currentBar.close, decimals)}</span>
			{' '}
			<span className={cn(changeColor)}>
				{formatPrice(priceChange.absolute, decimals)} ({formatPercentage(priceChange.percentage)})
			</span>
		</span>
	);
}
