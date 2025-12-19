/**
 * Chart Type Definitions
 * Centralized type definitions for chart components
 */

/**
 * Zoom level enum - predefined zoom presets
 */
export enum ChartZoomLevel {
  SM = 'SM',
  MD = 'MD',
  LG = 'LG',
  MAX = 'MAX',
}

/**
 * Loading state interface
 */
export interface ChartLoadingState {
  isLoading: boolean;
  message?: string;
  subtitle?: string;
}

/**
 * Chart height type - supports both pixel values and percentage
 */
export type ChartHeight = number | '100%';

/**
 * Zoom configuration
 */
export interface ZoomConfig {
  level: ChartZoomLevel;
  barsPerScreen: number;
}
