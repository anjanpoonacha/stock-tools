/**
 * OHLC Utility Functions
 * 
 * Provides utilities for working with OHLC bar data including:
 * - Bar retrieval and indexing
 * - Price change calculations
 * - Price and percentage formatting
 */

import type { OHLCVBar } from '@/lib/tradingview/types';

/**
 * Get the last bar from the bars array
 */
export function getLastBar(bars: OHLCVBar[]): OHLCVBar | null {
	if (!bars || bars.length === 0) return null;
	return bars[bars.length - 1];
}

/**
 * Get a bar at a specific index (handles negative indices)
 */
export function getBarAtIndex(bars: OHLCVBar[], index: number): OHLCVBar | null {
	if (!bars || bars.length === 0) return null;
	if (index < 0 || index >= bars.length) return null;
	return bars[index];
}

/**
 * Calculate price change between current and previous bar
 */
export function calculatePriceChange(
	currentBar: OHLCVBar,
	previousBar: OHLCVBar | null
): { absolute: number; percentage: number } {
	if (!previousBar) {
		return { absolute: 0, percentage: 0 };
	}

	const absolute = currentBar.close - previousBar.close;
	const percentage = previousBar.close !== 0 
		? (absolute / previousBar.close) * 100 
		: 0;

	return { absolute, percentage };
}

/**
 * Format a price with commas and optional decimal places
 * Examples: 2450 -> "2,450", 2450.50 -> "2,450.50"
 */
export function formatPrice(price: number, decimals: number = 2): string {
	// Handle edge cases
	if (!isFinite(price)) return '0';
	
	// Format with fixed decimals
	const formatted = price.toFixed(decimals);
	
	// Split into integer and decimal parts
	const [integerPart, decimalPart] = formatted.split('.');
	
	// Add commas to integer part
	const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	
	// Return with decimal part if present
	return decimalPart ? `${withCommas}.${decimalPart}` : withCommas;
}

/**
 * Format a percentage with sign and 2 decimal places
 * Examples: 0.8045 -> "+0.80%", -0.8045 -> "-0.80%"
 */
export function formatPercentage(percentage: number): string {
	// Handle edge cases
	if (!isFinite(percentage)) return '+0.00%';
	
	const sign = percentage >= 0 ? '+' : '';
	return `${sign}${percentage.toFixed(2)}%`;
}
