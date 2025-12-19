/**
 * Panel Size Constants for ChartView
 * 
 * Centralized panel size configuration for the 3-panel layout:
 * - Panel 1 (Left): Toolbar - Chart controls and settings
 * - Panel 2 (Center): Chart Area - Main chart display
 * - Panel 3 (Right): Stock List - Scrollable stock list
 * 
 * All values are in percentages of total viewport width.
 * At 1920px viewport:
 * - 15% = ~288px
 * - 18% = ~346px
 * - 65% = ~1248px
 * 
 * Original target was 320px for side panels, which is ~16.67% at 1920px.
 */

/**
 * Default panel sizes (percentages)
 * These are used as:
 * 1. Initial defaults in KV storage
 * 2. Fallback when no saved layout exists
 * 3. Reset target for "restore defaults" functionality
 */
export const DEFAULT_PANEL_SIZES = {
	/** Left toolbar panel - Settings and chart controls */
	TOOLBAR: 5,
	
	/** Center chart panel - Main chart area (gets maximum space) */
	CHART: 80,
	
	/** Right stock list panel - Scrollable stock list */
	STOCK_LIST: 15,
} as const;

/**
 * Minimum panel sizes (percentages)
 * Prevents panels from becoming too small to be usable
 */
export const MIN_PANEL_SIZES = {
	TOOLBAR: 5,
	CHART: 30,
	STOCK_LIST: 10,
} as const;

/**
 * Maximum panel sizes (percentages)
 * Prevents panels from taking too much space
 */
export const MAX_PANEL_SIZES = {
	TOOLBAR: 25,
	CHART: 85,
	STOCK_LIST: 40,
} as const;

/**
 * Dual Chart Split Sizes (percentages)
 * Used when dual chart view is enabled (Chart 1 vs Chart 2)
 * 
 * Note: In react-resizable-panels:
 * - orientation="horizontal" = side-by-side (|) with vertical divider
 * - orientation="vertical" = stacked (--) with horizontal divider
 */
export const DUAL_CHART_SIZES = {
	HORIZONTAL: {
		CHART_1: 50,  // Left chart (side-by-side)
		CHART_2: 50,  // Right chart (side-by-side)
	},
	VERTICAL: {
		CHART_1: 70,  // Top chart (stacked)
		CHART_2: 30,  // Bottom chart (stacked)
	},
	MIN_SIZE: 20,  // Minimum size for each chart (prevents crushing)
} as const;

/**
 * Panel resize threshold (percentage)
 * Prevents infinite loops from floating-point panel resize events.
 * Only update state if panel size changes by more than this amount.
 * 
 * LOWERED to 0.01% to capture actual user drags (which typically change panels by 0.004-0.01%)
 * while still preventing floating-point precision loops (which are < 0.001%)
 */
export const PANEL_RESIZE_THRESHOLD = 0.01;

/**
 * Helper function to validate panel sizes
 * Ensures total is 100% and each panel is within min/max bounds
 */
export function validatePanelSizes(toolbar: number, chart: number, stockList: number): boolean {
	const total = toolbar + chart + stockList;
	
	// Check total is approximately 100% (allow small floating point errors)
	if (Math.abs(total - 100) > 1) {
		return false;
	}
	
	// Check each panel is within bounds
	if (toolbar < MIN_PANEL_SIZES.TOOLBAR || toolbar > MAX_PANEL_SIZES.TOOLBAR) {
		return false;
	}
	
	if (chart < MIN_PANEL_SIZES.CHART || chart > MAX_PANEL_SIZES.CHART) {
		return false;
	}
	
	if (stockList < MIN_PANEL_SIZES.STOCK_LIST || stockList > MAX_PANEL_SIZES.STOCK_LIST) {
		return false;
	}
	
	return true;
}

/**
 * Helper function to log panel sizes with viewport pixel equivalents
 * Useful for debugging panel resize issues
 */
export function logPanelSizes(
	toolbar: number,
	chart: number,
	stockList: number,
	context: string = 'Panel Resize'
): void {
	const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
	
	const toolbarPx = Math.round((toolbar / 100) * viewportWidth);
	const chartPx = Math.round((chart / 100) * viewportWidth);
	const stockListPx = Math.round((stockList / 100) * viewportWidth);
	const total = toolbar + chart + stockList;
	
}
