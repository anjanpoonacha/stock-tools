/**
 * Chart Constants
 * Single source of truth for chart configuration values
 */

import { ChartZoomLevel } from './types';

/**
 * Bars per screen by resolution
 * Defines how many bars fit on one screen for each timeframe
 */
export const BARS_PER_SCREEN: Record<string, number> = {
  '1D': 60,      // ~3 months of trading days
  '1W': 52,      // ~1 year of weeks
  '5': 100,      // 5min resolution
  '15': 100,     // 15min resolution
  '75': 100,     // 75min resolution
  '188': 100,    // 188min resolution
  DEFAULT: 60,   // Fallback value
} as const;

/**
 * Zoom multipliers by zoom level
 * 0 = fit all bars (MAX)
 */
export const ZOOM_MULTIPLIERS: Record<ChartZoomLevel, number> = {
  [ChartZoomLevel.MAX]: 0,      // 0 means fit all bars
  [ChartZoomLevel.FIVE_X]: 5,   // 5 screens worth
  [ChartZoomLevel.TWO_X]: 2,    // 2 screens worth
  [ChartZoomLevel.ONE_X]: 1,    // 1 screen worth
} as const;

/**
 * Zoom button display labels
 */
export const ZOOM_LABELS: Record<ChartZoomLevel, string> = {
  [ChartZoomLevel.MAX]: 'Max',
  [ChartZoomLevel.FIVE_X]: '5x',
  [ChartZoomLevel.TWO_X]: '2x',
  [ChartZoomLevel.ONE_X]: '1x',
} as const;

/**
 * Default chart heights
 */
export const DEFAULT_CHART_HEIGHT = 500;
export const RESPONSIVE_CHART_HEIGHT = '100%' as const;
