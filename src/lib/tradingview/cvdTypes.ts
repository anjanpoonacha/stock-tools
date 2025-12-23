/**
 * CVD (Cumulative Volume Delta) Type Definitions
 * 
 * Based on comprehensive testing of 240 combinations with 100% success rate.
 * 
 * Key Findings:
 * - All anchor periods from 1W to 12M work perfectly
 * - All delta timeframes work when constraint is respected
 * - CRITICAL: Delta timeframe MUST be less than chart timeframe
 * 
 * @see CVD_TEST_RESULTS_SUMMARY.md for full test results
 */

/**
 * Valid CVD anchor periods (tested and verified)
 * 
 * Note: Maximum is 12M (12 months), not 1Y
 * Using month notation for consistency with TradingView API
 */
export const CVD_ANCHOR_PERIODS = [
  '1W',   // 1 week
  '1M',   // 1 month
  '3M',   // 3 months (recommended default)
  '6M',   // 6 months
  '12M',  // 12 months (max)
] as const;

export type CVDAnchorPeriod = typeof CVD_ANCHOR_PERIODS[number];

/**
 * All possible delta timeframes for CVD
 * 
 * Note: Not all timeframes are valid for all chart resolutions.
 * Use getValidDeltaTimeframes() to get valid options for a specific chart.
 */
export const CVD_DELTA_TIMEFRAMES = [
  '15S',  // 15 seconds
  '30S',  // 30 seconds
  '1',    // 1 minute
  '5',    // 5 minutes
  '15',   // 15 minutes
  '30',   // 30 minutes
  '60',   // 60 minutes / 1 hour
  'D',    // Daily
  'W',    // Weekly
] as const;

export type CVDDeltaTimeframe = typeof CVD_DELTA_TIMEFRAMES[number];

/**
 * Timeframe ordering for constraint validation
 * Lower index = smaller timeframe
 * 
 * Used to enforce: Delta timeframe < Chart timeframe
 * 
 * Note: For numeric timeframes not in this list, validation will use
 * parseTimeframeToMinutes() to compare values numerically.
 */
export const TIMEFRAME_ORDER: Record<string, number> = {
  '15S': 0,
  '30S': 1,
  '1': 2,
  '5': 3,
  '15': 4,
  '30': 5,
  '60': 6,
  '75': 6.2,   // 75 minutes (1.25 hours) - custom timeframe
  '188': 6.5,  // 188 minutes (3.13 hours) - custom timeframe from user
  'D': 7,
  '1D': 7,     // Alias for 'D'
  'W': 8,
  '1W': 8,     // Alias for 'W'
} as const;

/**
 * CVD settings interface (for component props)
 */
export interface CVDSettings {
  /** Anchor period for CVD calculation */
  anchorPeriod: CVDAnchorPeriod;
  
  /** Whether to use custom delta timeframe */
  useCustomPeriod?: boolean;
  
  /** Custom delta timeframe (must be < chart timeframe) */
  customPeriod?: CVDDeltaTimeframe;
  
  /** Whether to allow manual input */
  useManualInput?: boolean;
  
  /** Manual period value (for advanced users) */
  manualPeriod?: string;
}

/**
 * Default CVD settings (based on user's optimal configuration)
 */
export const DEFAULT_CVD_SETTINGS: CVDSettings = {
  anchorPeriod: '3M',
  useCustomPeriod: false,
  customPeriod: '1',  // 1 minute (when custom is enabled)
  useManualInput: false,
  manualPeriod: '',
};
