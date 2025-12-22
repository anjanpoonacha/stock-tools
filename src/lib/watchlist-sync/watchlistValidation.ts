/**
 * Watchlist Validation
 * Utilities for validating watchlist names and operations
 */

/**
 * Validate watchlist name
 * @returns Error message if invalid, null if valid
 */
export function validateWatchlistName(name: string): string | null {
  if (name.length < 3) {
    return 'Name must be at least 3 characters';
  }

  if (name.length > 30) {
    return 'Name must be at most 30 characters';
  }

  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    return 'Only letters, numbers, and underscores allowed';
  }

  if (/\s/.test(name)) {
    return 'No spaces allowed';
  }

  return null;
}

/**
 * Validation rules for display
 */
export const WATCHLIST_NAME_RULES = 'No spaces • 3-30 chars • Letters, numbers, underscore only';

/**
 * Auto-generated watchlist prefix
 */
export const AUTO_WATCHLIST_PREFIX = 'AUTO_';

/**
 * Check if watchlist is auto-generated
 */
export function isAutoWatchlist(name: string): boolean {
  return name.startsWith(AUTO_WATCHLIST_PREFIX);
}

/**
 * Add AUTO_ prefix to watchlist name
 */
export function addAutoPrefix(name: string): string {
  return `${AUTO_WATCHLIST_PREFIX}${name}`;
}
