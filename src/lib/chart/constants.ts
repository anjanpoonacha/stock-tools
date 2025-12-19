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
  [ChartZoomLevel.SM]: 1,       // 1 screen worth (Small zoom)
  [ChartZoomLevel.MD]: 2,       // 2 screens worth (Medium zoom)
  [ChartZoomLevel.LG]: 5,       // 5 screens worth (Large zoom)
  [ChartZoomLevel.MAX]: 0,      // 0 means fit all bars (Maximum zoom)
} as const;

/**
 * Zoom button display labels
 */
export const ZOOM_LABELS: Record<ChartZoomLevel, string> = {
  [ChartZoomLevel.SM]: 'SM',
  [ChartZoomLevel.MD]: 'MD',
  [ChartZoomLevel.LG]: 'LG',
  [ChartZoomLevel.MAX]: 'MAX',
} as const;

/**
 * Default chart heights
 */
export const DEFAULT_CHART_HEIGHT = 500;
export const RESPONSIVE_CHART_HEIGHT = '100%' as const;

/**
 * CVD Indicator Settings
 */
export const CVD_ANCHOR_PERIODS = [
  { value: '3M', label: '3 Months' },
  { value: '6M', label: '6 Months' },
  { value: '1Y', label: '1 Year' },
  { value: '2Y', label: '2 Years' },
  { value: '3Y', label: '3 Years' },
  { value: '5Y', label: '5 Years' },
] as const;

/**
 * CVD Custom Periods
 * Format follows TradingView resolution syntax:
 * - Seconds: Uppercase S (e.g., '15S', '30S')
 * - Minutes: Number only (e.g., '1', '5', '15', '30', '60', '75', '188')
 * - Days: Uppercase D (e.g., '1D')
 * - Weeks: Uppercase W (e.g., '1W')
 * - Months: Uppercase M (e.g., '1M', '3M', '6M')
 * - Years: Uppercase Y (e.g., '1Y')
 */
export const CVD_CUSTOM_PERIODS = [
  { value: '15S', label: '15 Seconds' },
  { value: '30S', label: '30 Seconds' },
  { value: '1', label: '1 Minute' },
  { value: '5', label: '5 Minutes' },
  { value: '15', label: '15 Minutes' },
  { value: '75', label: '75 Minutes' },
  { value: '188', label: '188 Minutes' },
  { value: '1D', label: '1 Day' },
] as const;
