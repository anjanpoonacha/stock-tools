/**
 * Timeframe Mapping Utilities
 * 
 * Handles time conversions between 1D (daily) and 188m timeframes for Indian trading hours.
 * 
 * Indian Stock Market Trading Hours (IST):
 * - Total trading time: 9:15 AM - 3:30 PM (375 minutes)
 * - Morning session: 9:15 AM - 12:23 PM (188 minutes)
 * - Afternoon session: 12:23 PM - 3:30 PM (187 minutes)
 * 
 * The 188m timeframe represents approximately half of the trading day,
 * allowing for morning and afternoon session analysis.
 */

// Indian trading hours constants (in IST)
const TRADING_DAY_START_HOUR = 9;
const TRADING_DAY_START_MINUTE = 15;
const TRADING_DAY_END_HOUR = 15;
const TRADING_DAY_END_MINUTE = 30;

/**
 * Gets the trading day start timestamp (9:15 AM) for a given timestamp.
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Unix timestamp for 9:15 AM on the same date in IST
 * 
 * @example
 * const timestamp = Date.now();
 * const dayStart = getTradingDayStart(timestamp);
 * // Returns timestamp for 9:15 AM on the same date
 */
function getTradingDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(TRADING_DAY_START_HOUR, TRADING_DAY_START_MINUTE, 0, 0);
  return date.getTime();
}

/**
 * Gets the trading day end timestamp (3:30 PM) for a given timestamp.
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Unix timestamp for 3:30 PM on the same date in IST
 * 
 * @example
 * const timestamp = Date.now();
 * const dayEnd = getTradingDayEnd(timestamp);
 * // Returns timestamp for 3:30 PM on the same date
 */
function getTradingDayEnd(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(TRADING_DAY_END_HOUR, TRADING_DAY_END_MINUTE, 0, 0);
  return date.getTime();
}

/**
 * Maps a 1D (daily) timestamp to corresponding 188m bar timestamps.
 * Returns an array of 188m timestamps that fall within the trading day of the given daily timestamp.
 *
 * @param dailyTimestamp - Unix timestamp of the daily bar (in seconds)
 * @param bars188m - Array of 188m CVD bars with time and values
 * @returns Array of 188m timestamps (typically 2: morning + afternoon session)
 *
 * @example
 * ```typescript
 * const bars188m = [
 *   { time: 1734253500, values: [...] }, // Dec 15, 9:15 AM
 *   { time: 1734264780, values: [...] }, // Dec 15, 12:23 PM
 * ];
 *
 * const daily = 1734220800; // Dec 15, 2025
 * const mapped = map1DTo188m(daily, bars188m);
 * // Returns: [1734253500, 1734264780]
 * ```
 */
export function map1DTo188m(
  dailyTimestamp: number,
  bars188m: Array<{ time: number; values: number[] }>
): number[] {
  // Handle empty array gracefully
  if (!bars188m || bars188m.length === 0) {
    return [];
  }

  // Normalize dailyTimestamp to seconds (if it's in milliseconds, divide by 1000)
  const dailyTimestampSec = dailyTimestamp > 10000000000 ? Math.floor(dailyTimestamp / 1000) : dailyTimestamp;

  // Get the date from the daily timestamp
  const dailyDate = new Date(dailyTimestampSec * 1000);
  const year = dailyDate.getFullYear();
  const month = dailyDate.getMonth();
  const day = dailyDate.getDate();

  // Calculate trading day boundaries for this specific date
  const tradingStart = new Date(year, month, day, TRADING_DAY_START_HOUR, TRADING_DAY_START_MINUTE, 0, 0);
  const tradingEnd = new Date(year, month, day, TRADING_DAY_END_HOUR, TRADING_DAY_END_MINUTE, 0, 0);

  const tradingStartSec = Math.floor(tradingStart.getTime() / 1000);
  const tradingEndSec = Math.floor(tradingEnd.getTime() / 1000);

  // Detect if bars188m uses seconds or milliseconds by checking the first bar
  const firstBarTime = bars188m[0].time;
  const isMilliseconds = firstBarTime > 10000000000;

  // Find all 188m bars within this trading day
  const matched = bars188m
    .filter(bar => {
      // Normalize bar.time to seconds for comparison
      const barTimeSec = isMilliseconds ? Math.floor(bar.time / 1000) : bar.time;
      return barTimeSec >= tradingStartSec && barTimeSec <= tradingEndSec;
    })
    .map(bar => bar.time)
    .sort((a, b) => a - b);

  return matched;
}

/**
 * Maps a 188m bar timestamp back to its parent 1D (daily) timestamp.
 *
 * Finds the daily bar that contains the given 188m bar by matching the date.
 *
 * @param bar188mTimestamp - Unix timestamp of the 188m bar
 * @param bars1D - Array of daily bars with time property
 * @returns The 1D timestamp that contains this 188m bar, or null if not found
 *
 * @example
 * const bar188m = { time: 1734577680000 }; // Afternoon bar
 * const bars1D = [
 *   { time: 1734566400000 }, // Daily bar
 *   { time: 1734652800000 }
 * ];
 * const dailyTime = map188mTo1D(bar188m.time, bars1D);
 * // Returns 1734566400000 - the daily bar containing this 188m bar
 */
export function map188mTo1D(
  bar188mTimestamp: number,
  bars1D: Array<{ time: number }>
): number | null {
  // Handle empty array gracefully
  if (!bars1D || bars1D.length === 0) {
    return null;
  }

  // Normalize bar188mTimestamp to milliseconds for Date constructor
  const bar188mMs = bar188mTimestamp > 10000000000 ? bar188mTimestamp : bar188mTimestamp * 1000;

  // Detect if bars1D uses seconds or milliseconds
  const firstDailyBar = bars1D[0].time;
  const dailyIsMilliseconds = firstDailyBar > 10000000000;

  // Find the 1D bar that falls on the same date
  // We look for a daily bar whose timestamp is within the same trading day
  const matchingBar = bars1D.find(bar => {
    // Normalize bar.time to milliseconds for Date constructor
    const barMs = dailyIsMilliseconds ? bar.time : bar.time * 1000;

    // Check if the daily bar is on the same date
    // Daily bars typically use the start of day or end of day timestamp
    const barDate = new Date(barMs);
    const targetDate = new Date(bar188mMs);

    // Compare dates (year, month, day)
    return (
      barDate.getFullYear() === targetDate.getFullYear() &&
      barDate.getMonth() === targetDate.getMonth() &&
      barDate.getDate() === targetDate.getDate()
    );
  });

  return matchingBar ? matchingBar.time : null;
}

/**
 * Helper to check if a timestamp falls within trading hours.
 * 
 * @param timestamp - Unix timestamp to check
 * @returns True if timestamp is within 9:15 AM - 3:30 PM IST
 * 
 * @example
 * const timestamp = Date.now();
 * if (isWithinTradingHours(timestamp)) {
 *   console.log('Market is open');
 * }
 */
export function isWithinTradingHours(timestamp: number): boolean {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  const totalMinutes = hours * 60 + minutes;
  const startMinutes = TRADING_DAY_START_HOUR * 60 + TRADING_DAY_START_MINUTE; // 555 (9:15)
  const endMinutes = TRADING_DAY_END_HOUR * 60 + TRADING_DAY_END_MINUTE; // 930 (3:30)
  
  return totalMinutes >= startMinutes && totalMinutes <= endMinutes;
}
