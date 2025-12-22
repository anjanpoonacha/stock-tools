/**
 * Watchlist Storage
 * Type-safe API for watchlist-related localStorage operations
 */

import { StorageManager, createStorageConfig } from './storageManager';
import { StorageBackend } from './types';

/**
 * Platform filter types
 */
export type PlatformFilter = 'all' | 'both' | 'mio' | 'tv';

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  PLATFORM_FILTER: 'watchlist-platform-filter',
  RECENT_WATCHLISTS: 'watchlist-recent',
  CURRENT_WATCHLIST: 'chart-current-watchlist',
} as const;

/**
 * Constants
 */
export const MAX_RECENT_WATCHLISTS = 5;

/**
 * Storage configurations
 */
const platformFilterConfig = createStorageConfig<PlatformFilter>(
  STORAGE_KEYS.PLATFORM_FILTER,
  'all',
  { backend: StorageBackend.LOCAL_STORAGE }
);

const recentWatchlistsConfig = createStorageConfig<string[]>(
  STORAGE_KEYS.RECENT_WATCHLISTS,
  [],
  { backend: StorageBackend.LOCAL_STORAGE }
);

const currentWatchlistConfig = createStorageConfig<string>(
  STORAGE_KEYS.CURRENT_WATCHLIST,
  '',
  { backend: StorageBackend.LOCAL_STORAGE }
);

/**
 * Watchlist Storage API
 */
export const WatchlistStorage = {
  /**
   * Platform Filter
   */
  getPlatformFilter(): PlatformFilter {
    return StorageManager.get(platformFilterConfig);
  },

  setPlatformFilter(filter: PlatformFilter): void {
    StorageManager.set(platformFilterConfig, filter);
  },

  /**
   * Recent Watchlists
   */
  getRecentWatchlistIds(): string[] {
    return StorageManager.get(recentWatchlistsConfig);
  },

  addToRecentWatchlists(watchlistId: string): void {
    const recent = this.getRecentWatchlistIds();
    // Remove if already exists (to move to front)
    const filtered = recent.filter(id => id !== watchlistId);
    // Add to front and limit to max
    const updated = [watchlistId, ...filtered].slice(0, MAX_RECENT_WATCHLISTS);
    StorageManager.set(recentWatchlistsConfig, updated);
  },

  clearRecentWatchlists(): void {
    StorageManager.set(recentWatchlistsConfig, []);
  },

  /**
   * Current Watchlist
   */
  getCurrentWatchlistId(): string {
    return StorageManager.get(currentWatchlistConfig);
  },

  setCurrentWatchlistId(watchlistId: string): void {
    StorageManager.set(currentWatchlistConfig, watchlistId);
  },

  clearCurrentWatchlist(): void {
    StorageManager.set(currentWatchlistConfig, '');
  },
};
