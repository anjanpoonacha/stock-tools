/**
 * Session State Management
 * 
 * Manages view preferences and session state for formula results page.
 * - View mode stored in localStorage (persists across sessions)
 * - Chart index stored in sessionStorage (persists during session only)
 */

const VIEW_MODE_KEY = 'formula-results-view-mode';
const CHART_INDEX_KEY_PREFIX = 'formula-results-chart-index';

export type ViewMode = 'table' | 'chart';

/**
 * Get saved view mode from localStorage
 * @returns View mode ('table' or 'chart'), defaults to 'table'
 */
export function getViewMode(): ViewMode {
	if (typeof window === 'undefined') return 'table';
	
	try {
		const saved = localStorage.getItem(VIEW_MODE_KEY);
		return (saved === 'chart' ? 'chart' : 'table') as ViewMode;
	} catch (error) {
		return 'table';
	}
}

/**
 * Save view mode to localStorage
 * @param mode - View mode to save
 */
export function setViewMode(mode: ViewMode): void {
	if (typeof window === 'undefined') return;
	
	try {
		localStorage.setItem(VIEW_MODE_KEY, mode);
	} catch (error) {
	}
}

/**
 * Get saved chart index for a specific formula from sessionStorage
 * @param formulaId - Formula ID
 * @returns Saved chart index, or 0 if not found
 */
export function getChartIndex(formulaId: string): number {
	if (typeof window === 'undefined') return 0;
	
	try {
		const key = `${CHART_INDEX_KEY_PREFIX}:${formulaId}`;
		const saved = sessionStorage.getItem(key);
		return saved ? parseInt(saved, 10) : 0;
	} catch (error) {
		return 0;
	}
}

/**
 * Save chart index for a specific formula to sessionStorage
 * @param formulaId - Formula ID
 * @param index - Chart index to save
 */
export function setChartIndex(formulaId: string, index: number): void {
	if (typeof window === 'undefined') return;
	
	try {
		const key = `${CHART_INDEX_KEY_PREFIX}:${formulaId}`;
		sessionStorage.setItem(key, index.toString());
	} catch (error) {
	}
}

/**
 * Clear chart index for a specific formula from sessionStorage
 * @param formulaId - Formula ID
 */
export function clearChartIndex(formulaId: string): void {
	if (typeof window === 'undefined') return;
	
	try {
		const key = `${CHART_INDEX_KEY_PREFIX}:${formulaId}`;
		sessionStorage.removeItem(key);
	} catch (error) {
	}
}
