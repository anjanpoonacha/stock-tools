/**
 * Chart Utilities
 * Shared utility functions for chart operations
 */

import { ChartZoomLevel } from './types';
import { BARS_PER_SCREEN, ZOOM_MULTIPLIERS } from './constants';
import type { IChartApi, Time } from 'lightweight-charts';
import type { OHLCVBar } from '@/lib/tradingview/types';

/**
 * Get bars per screen for a given resolution
 * @param resolution - Chart resolution (e.g., '1D', '1W', '5')
 * @returns Number of bars that fit on one screen
 */
export function getBarsPerScreen(resolution: string): number {
  return BARS_PER_SCREEN[resolution] ?? BARS_PER_SCREEN.DEFAULT;
}

/**
 * Calculate visible bar count based on zoom level
 * @param zoomLevel - Zoom level enum value
 * @param resolution - Chart resolution
 * @param totalBars - Total number of bars available
 * @returns Number of bars to display
 */
export function calculateVisibleBars(
  zoomLevel: ChartZoomLevel,
  resolution: string,
  totalBars: number
): number {
  const barsPerScreen = getBarsPerScreen(resolution);
  const multiplier = ZOOM_MULTIPLIERS[zoomLevel];

  // MAX zoom = show all bars
  if (multiplier === 0) {
    return totalBars;
  }

  // Calculate visible bars, capped at total available
  return Math.min(barsPerScreen * multiplier, totalBars);
}

/**
 * Apply zoom level to chart time scale
 * @param timeScale - Chart time scale API
 * @param zoomLevel - Zoom level to apply
 * @param bars - Array of OHLCV bars
 * @param resolution - Chart resolution
 */
export function applyZoom(
  timeScale: ReturnType<IChartApi['timeScale']>,
  zoomLevel: ChartZoomLevel,
  bars: OHLCVBar[],
  resolution: string
): void {
  // MAX zoom = fit all content
  if (zoomLevel === ChartZoomLevel.MAX) {
    timeScale.fitContent();
    return;
  }

  // Calculate visible range
  const visibleBars = calculateVisibleBars(zoomLevel, resolution, bars.length);
  const firstBarIndex = Math.max(0, bars.length - visibleBars);
  const lastBarIndex = bars.length - 1;

  // Apply visible range (show last N bars)
  if (firstBarIndex < bars.length && lastBarIndex < bars.length) {
    timeScale.setVisibleRange({
      from: bars[firstBarIndex].time as Time,
      to: bars[lastBarIndex].time as Time,
    });
  }
}

/**
 * Parse chart height prop to pixel value
 * @param height - Height prop (number or '100%')
 * @param containerHeight - Container height in pixels
 * @param defaultHeight - Default fallback height
 * @returns Calculated height in pixels
 */
export function parseChartHeight(
  height: number | string,
  containerHeight: number,
  defaultHeight: number
): number {
  // If percentage, use container height
  if (typeof height === 'string' && height === '100%') {
    return containerHeight || defaultHeight;
  }

  // If number, use as-is; otherwise use default
  return typeof height === 'number' ? height : defaultHeight;
}
