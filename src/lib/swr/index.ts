/**
 * SWR Utilities - Central Export
 * 
 * Convenient single import for all SWR-related utilities
 * 
 * @example
 * import { chartDataFetcher, chartDataKey, FetcherError } from '@/lib/swr';
 */

// ============================================================================
// Backward Compatibility Exports (existing implementations)
// ============================================================================

// Keep existing formula results implementation (used by useFormulaResults hook)
export {
	formulaResultsFetcher,
	formulaResultsKey,
	type FormulaResultsResponse,
	type FormulaResultsKeyParams,
} from './formulaResultsFetcher';

// ============================================================================
// New Shared Fetchers (enhanced with automatic credential management)
// ============================================================================

export {
	chartDataFetcher,
	watchlistFetcher,
	watchlistStatusFetcher,
	FetcherError,
} from './fetchers';

export type {
	ChartDataFetcherParams,
	FormulaListResponse,
} from './fetchers';

// Export formula fetchers with different names to avoid conflicts
export {
	formulaFetcher as formulaListFetcher,
	extractFormulas,
	formulaResultsFetcher as formulaResultsAutoFetcher,
} from './fetchers';

// ============================================================================
// Settings Fetchers & Mutations
// ============================================================================

export {
	settingsFetcher,
	isSettingsAuthenticated,
} from './settings-fetchers';

export {
	updateSettingsMutation,
	updateSettingsImmediately,
} from './settings-mutations';

// ============================================================================
// New Cache Key Factories
// ============================================================================

export {
	chartDataKey,
	simpleChartDataKey,
	watchlistKey,
	platformWatchlistKey,
	watchlistStatusKey,
	mioWatchlistsKey,
	tvWatchlistsKey,
	watchlistSymbolsKey,
	settingsKey,
	isValidKey,
	keyMatches,
} from './keys';

// Export formula keys with different names to avoid conflicts
export {
	formulaKey as formulaListKey,
	formulaResultsKey as formulaResultsAutoKey,
} from './keys';

// ============================================================================
// Watchlist Fetchers (platform-specific)
// ============================================================================

export {
	mioWatchlistFetcher,
	tvWatchlistFetcher,
	watchlistSymbolsFetcher,
} from './watchlist-fetchers';

export type {
	MIOWatchlistsResponse,
	TVWatchlistsResponse,
	WatchlistSymbolsResponse,
} from './watchlist-fetchers';

// ============================================================================
// Watchlist Mutations
// ============================================================================

export {
	addStockToWatchlist,
	removeStockFromWatchlist,
	createWatchlist,
	deleteWatchlists,
	syncWatchlistToMio,
	appendToTvWatchlist,
	addStockToWatchlistMutation,
	removeStockFromWatchlistMutation,
	createWatchlistMutation,
	deleteWatchlistsMutation,
	syncWatchlistToMioMutation,
	appendToTvWatchlistMutation,
} from './watchlist-mutations';

export type {
	AddStockToWatchlistArgs,
	RemoveStockFromWatchlistArgs,
	CreateWatchlistArgs,
	DeleteWatchlistArgs,
	SyncWatchlistToMioArgs,
	AppendToTvWatchlistArgs,
	MutationResponse,
} from './watchlist-mutations';
