/**
 * Watchlist Filters
 * Utilities for filtering watchlists by platform and search query
 */

import type { UnifiedWatchlist } from './types';
import type { PlatformFilter } from '../storage/watchlistStorage';

/**
 * Filter watchlists by platform
 */
export function filterByPlatform(
  watchlists: UnifiedWatchlist[],
  filter: PlatformFilter
): UnifiedWatchlist[] {
  if (filter === 'all') {
    return watchlists;
  }

  return watchlists.filter((watchlist) => {
    switch (filter) {
      case 'both':
        return watchlist.platforms.includes('mio') && watchlist.platforms.includes('tv');
      case 'mio':
        return watchlist.platforms.includes('mio');
      case 'tv':
        return watchlist.platforms.includes('tv');
      default:
        return true;
    }
  });
}

/**
 * Filter watchlists by search query
 */
export function filterBySearchQuery(
  watchlists: UnifiedWatchlist[],
  query: string
): UnifiedWatchlist[] {
  if (!query.trim()) {
    return watchlists;
  }

  const lowerQuery = query.toLowerCase();
  return watchlists.filter((watchlist) =>
    watchlist.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get recent watchlists from all watchlists
 */
export function getRecentWatchlists(
  watchlists: UnifiedWatchlist[],
  recentIds: string[],
  maxRecent: number = 5
): UnifiedWatchlist[] {
  return recentIds
    .map(id => watchlists.find(w => w.id === id))
    .filter((w): w is UnifiedWatchlist => w !== undefined)
    .slice(0, maxRecent);
}
