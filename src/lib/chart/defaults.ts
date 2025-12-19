/**
 * Default Chart Configurations
 * 
 * Factory defaults for fresh installations (no migration).
 * User's requirements:
 * - Single: 1 chart with everything enabled
 * - Horizontal (50-50): Everything enabled
 * - Vertical (70-30): Only CVD enabled
 */

import { ChartSettings, PanelLayout, AllSettings } from '@/types/chartSettings';
import { createFullIndicatorSet } from './indicatorRegistry';
import { DEFAULT_PANEL_SIZES } from './panelConstants';

// ============================================
// Chart Settings Defaults
// ============================================

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
	activeLayout: 'single',
	
	layouts: {
		// Single chart: Everything enabled (default use case)
		single: {
			mode: 'horizontal',  // Doesn't matter for single chart
			slotSizes: [100],
			slots: [
				{
					resolution: '1D',
					zoomLevel: 'MD',
					indicators: createFullIndicatorSet(['price', 'volume', 'cvd']),
				},
			],
		},
		
		// Horizontal: 50-50 split, everything enabled
		horizontal: {
			mode: 'horizontal',
			slotSizes: [50, 50],
			slots: [
				{
					resolution: '1D',
					zoomLevel: 'MD',
					indicators: createFullIndicatorSet(['price', 'volume', 'cvd']),
				},
				{
					resolution: '1W',
					zoomLevel: 'MD',
					indicators: createFullIndicatorSet(['price', 'volume', 'cvd']),
				},
			],
		},
		
		// Vertical: 70-30 split, only CVD enabled (per user requirement)
		vertical: {
			mode: 'vertical',
			slotSizes: [70, 30],
			slots: [
				{
					resolution: '1D',
					zoomLevel: 'MD',
					indicators: createFullIndicatorSet(['cvd']),  // Only CVD
				},
				{
					resolution: '1W',
					zoomLevel: 'MD',
					indicators: createFullIndicatorSet(['cvd']),  // Only CVD
				},
			],
		},
	},
	
	global: {
		showGrid: false,
		rangeSync: true,
		showVolumeMA: false,
		volumeMALength: 30,
	},
};

// ============================================
// Panel Layout Defaults
// ============================================

export const DEFAULT_PANEL_LAYOUT: PanelLayout = {
	'toolbar-panel': DEFAULT_PANEL_SIZES.TOOLBAR,
	'chart-panel': DEFAULT_PANEL_SIZES.CHART,
	'stock-list-panel': DEFAULT_PANEL_SIZES.STOCK_LIST,
};

// ============================================
// Combined Settings
// ============================================

export const DEFAULT_ALL_SETTINGS: AllSettings = {
	panelLayout: DEFAULT_PANEL_LAYOUT,
	chartSettings: DEFAULT_CHART_SETTINGS,
};
