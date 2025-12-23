/**
 * CVD (Cumulative Volume Delta) Validation Utilities
 * 
 * Provides runtime validation for CVD settings to ensure:
 * 1. Valid anchor periods
 * 2. Valid delta timeframes
 * 3. Constraint: Delta timeframe < Chart timeframe
 * 
 * Based on exhaustive testing of 240 combinations.
 * 
 * Supports custom numeric timeframes (e.g., '188' for 3+ hours) via
 * automatic parsing and comparison.
 */

import { 
  CVD_ANCHOR_PERIODS, 
  CVD_DELTA_TIMEFRAMES, 
  TIMEFRAME_ORDER,
  type CVDAnchorPeriod,
  type CVDDeltaTimeframe 
} from './cvdTypes';

/**
 * Parse a timeframe string to minutes for numeric comparison
 * 
 * Handles:
 * - Seconds: '15S', '30S' → 0.25, 0.5 minutes
 * - Minutes: '1', '5', '15', '188' → 1, 5, 15, 188 minutes
 * - Days: 'D', '1D' → 1440 minutes
 * - Weeks: 'W', '1W' → 10080 minutes
 * 
 * @param timeframe - Timeframe string
 * @returns Minutes as number, or null if invalid
 */
export function parseTimeframeToMinutes(timeframe: string): number | null {
  // Handle seconds
  if (timeframe.endsWith('S')) {
    const seconds = parseInt(timeframe.slice(0, -1));
    return isNaN(seconds) ? null : seconds / 60;
  }
  
  // Handle days
  if (timeframe === 'D' || timeframe === '1D') {
    return 1440; // 24 hours * 60 minutes
  }
  
  // Handle weeks
  if (timeframe === 'W' || timeframe === '1W') {
    return 10080; // 7 days * 24 hours * 60 minutes
  }
  
  // Handle numeric minutes (most common: '1', '5', '15', '188', etc.)
  const minutes = parseInt(timeframe);
  return isNaN(minutes) ? null : minutes;
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Get valid delta timeframes for a given chart timeframe
 * 
 * Returns only timeframes that are LESS than the chart timeframe.
 * This enforces the critical constraint discovered in testing.
 * 
 * Supports custom numeric timeframes by parsing to minutes.
 * 
 * @param chartTimeframe - Chart resolution (e.g., '15', '60', '1D', '1W', '188')
 * @returns Array of valid delta timeframes
 * 
 * @example
 * getValidDeltaTimeframes('1D')   // ['15S', '30S', '1', '5', '15', '30', '60']
 * getValidDeltaTimeframes('15')   // ['15S', '30S', '1', '5']
 * getValidDeltaTimeframes('188')  // ['15S', '30S', '1', '5', '15', '30', '60']
 */
export function getValidDeltaTimeframes(chartTimeframe: string): CVDDeltaTimeframe[] {
  const chartIndex = TIMEFRAME_ORDER[chartTimeframe];
  
  // If chart timeframe is in our mapping, use index comparison
  if (chartIndex !== undefined) {
    return CVD_DELTA_TIMEFRAMES.filter(tf => {
      const tfIndex = TIMEFRAME_ORDER[tf];
      return tfIndex !== undefined && tfIndex < chartIndex;
    });
  }
  
  // For unknown timeframes, try numeric comparison
  const chartMinutes = parseTimeframeToMinutes(chartTimeframe);
  if (chartMinutes !== null) {
    return CVD_DELTA_TIMEFRAMES.filter(tf => {
      const tfMinutes = parseTimeframeToMinutes(tf);
      return tfMinutes !== null && tfMinutes < chartMinutes;
    });
  }
  
  // Fallback: return intraday only as safe default for unknown formats
  return ['15S', '30S', '1', '5', '15', '30', '60'];
}

/**
 * Check if a delta timeframe is valid for a chart timeframe
 * 
 * Uses TIMEFRAME_ORDER for known timeframes, falls back to numeric
 * comparison for custom timeframes (e.g., '188' for 3+ hours).
 * 
 * @param deltaTimeframe - Delta timeframe to validate
 * @param chartTimeframe - Chart resolution
 * @returns true if delta < chart, false otherwise
 * 
 * @example
 * isValidDeltaTimeframe('1', '1D')    // true (1min < 1day)
 * isValidDeltaTimeframe('30S', '188') // true (30sec < 188min)
 * isValidDeltaTimeframe('1D', '1D')   // false (equal, not less than)
 * isValidDeltaTimeframe('W', '1D')    // false (1week > 1day)
 */
export function isValidDeltaTimeframe(
  deltaTimeframe: string, 
  chartTimeframe: string
): boolean {
  const deltaIndex = TIMEFRAME_ORDER[deltaTimeframe];
  const chartIndex = TIMEFRAME_ORDER[chartTimeframe];
  
  // If both are in the mapping, use index comparison
  if (deltaIndex !== undefined && chartIndex !== undefined) {
    return deltaIndex < chartIndex;
  }
  
  // Fallback to numeric comparison for custom timeframes
  const deltaMinutes = parseTimeframeToMinutes(deltaTimeframe);
  const chartMinutes = parseTimeframeToMinutes(chartTimeframe);
  
  if (deltaMinutes !== null && chartMinutes !== null) {
    return deltaMinutes < chartMinutes;
  }
  
  // If we can't parse either, reject for safety
  return false;
}

/**
 * Validate CVD anchor period
 * 
 * @param anchorPeriod - Anchor period to validate
 * @returns Validation result
 */
export function validateAnchorPeriod(anchorPeriod: string): ValidationResult {
  if (!CVD_ANCHOR_PERIODS.includes(anchorPeriod as CVDAnchorPeriod)) {
    return {
      valid: false,
      error: `Invalid anchor period: "${anchorPeriod}". Must be one of: ${CVD_ANCHOR_PERIODS.join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
 * Validate CVD delta timeframe (standalone)
 * 
 * @param deltaTimeframe - Delta timeframe to validate
 * @returns Validation result
 */
export function validateDeltaTimeframe(deltaTimeframe: string): ValidationResult {
  if (!CVD_DELTA_TIMEFRAMES.includes(deltaTimeframe as CVDDeltaTimeframe)) {
    return {
      valid: false,
      error: `Invalid delta timeframe: "${deltaTimeframe}". Must be one of: ${CVD_DELTA_TIMEFRAMES.join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
 * Validate complete CVD settings
 * 
 * Performs comprehensive validation:
 * 1. Anchor period is valid
 * 2. Delta timeframe is valid (if provided)
 * 3. Delta timeframe < Chart timeframe (critical constraint)
 * 
 * @param chartTimeframe - Chart resolution
 * @param anchorPeriod - CVD anchor period
 * @param deltaTimeframe - CVD delta timeframe (optional)
 * @returns Validation result with detailed error message
 * 
 * @example
 * validateCVDSettings('1D', '3M', '1')     // { valid: true }
 * validateCVDSettings('1D', '3M', 'W')     // { valid: false, error: "..." }
 * validateCVDSettings('15', 'INVALID', '1') // { valid: false, error: "..." }
 */
export function validateCVDSettings(
  chartTimeframe: string,
  anchorPeriod: string,
  deltaTimeframe?: string
): ValidationResult {
  // Validate anchor period
  const anchorValidation = validateAnchorPeriod(anchorPeriod);
  if (!anchorValidation.valid) {
    return anchorValidation;
  }
  
  // Validate delta timeframe if provided
  if (deltaTimeframe) {
    // Check if it's a valid timeframe
    const deltaValidation = validateDeltaTimeframe(deltaTimeframe);
    if (!deltaValidation.valid) {
      return deltaValidation;
    }
    
    // Check constraint: delta < chart
    if (!isValidDeltaTimeframe(deltaTimeframe, chartTimeframe)) {
      return {
        valid: false,
        error: `Delta timeframe "${deltaTimeframe}" must be less than chart timeframe "${chartTimeframe}". Valid options: ${getValidDeltaTimeframes(chartTimeframe).join(', ')}`
      };
    }
  }
  
  return { valid: true };
}

/**
 * Get optimal CVD settings for a chart timeframe
 * 
 * Returns recommended settings based on test results:
 * - Anchor: Always 3M (user's preference, balanced)
 * - Delta: 1 minute for most charts, 15S for intraday
 * 
 * @param chartTimeframe - Chart resolution
 * @returns Recommended CVD settings
 */
export function getOptimalCVDSettings(chartTimeframe: string): {
  anchorPeriod: CVDAnchorPeriod;
  deltaTimeframe: CVDDeltaTimeframe;
} {
  const chartIndex = TIMEFRAME_ORDER[chartTimeframe];
  
  // For very short timeframes (15min or less), use 15S
  // For others, use 1 minute
  const deltaTimeframe: CVDDeltaTimeframe = 
    (chartIndex !== undefined && chartIndex <= 4) ? '15S' : '1';
  
  return {
    anchorPeriod: '3M',  // User's optimal choice
    deltaTimeframe,
  };
}
