/**
 * Platform types
 */
export type Platform = 'mio' | 'tv';

/**
 * Unified watchlist that may exist on one or both platforms
 */
export interface UnifiedWatchlist {
  id: string;                    // Unique ID (generated)
  name: string;                  // Display name
  platforms: Platform[];         // ['mio', 'tv'] or ['mio'] or ['tv']
  mioId?: string;                // MIO watchlist ID (if exists)
  tvId?: string;                 // TradingView watchlist ID (if exists)
}

/**
 * Session information for both platforms
 */
export interface WatchlistSessions {
  mio?: {
    internalSessionId: string;
  };
  tv?: {
    sessionId: string;          // Raw sessionid cookie value
  };
}

/**
 * Result of adding stock to watchlist
 */
export interface AddStockResult {
  success: boolean;              // True if at least one platform succeeded
  platforms: {
    mio?: {
      success: boolean;
      error?: string;
    };
    tv?: {
      success: boolean;
      error?: string;
    };
  };
}

/**
 * Configuration for keybindings
 */
export interface KeybindingConfig {
  chart: {
    watchlist: {
      openSearch: string;        // Default: ";"
      quickAdd: string;          // Default: "Alt+W"
      description: string;
    };
    navigation?: {
      nextStock: string;
      prevStock: string;
      description: string;
    };
  };
}
