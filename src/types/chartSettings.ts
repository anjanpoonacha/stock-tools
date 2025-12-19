/**
 * Chart Settings Type Definitions
 * 
 * Scalable, slot-based architecture for charts and indicators.
 * Supports any number of charts, any number of indicators, and any number of layouts.
 */

// ============================================
// Core Types
// ============================================

export interface IndicatorConfig {
	type: IndicatorType;
	enabled: boolean;
	settings?: Record<string, any>;
}

export type IndicatorType = 'price' | 'volume' | 'cvd';  // Extensible union type

export interface ChartSlotConfig {
	resolution: string;
	zoomLevel: string;
	indicators: IndicatorConfig[];
}

export interface LayoutConfig {
	mode: 'horizontal' | 'vertical';
	slots: ChartSlotConfig[];
	slotSizes?: number[];
}

export interface GlobalSettings {
	showGrid: boolean;
	rangeSync: boolean;
	showVolumeMA: boolean;
	volumeMALength: number;
}

export interface ChartSettings {
	activeLayout: 'single' | 'horizontal' | 'vertical';
	layouts: {
		single: LayoutConfig;      // Dedicated single chart layout
		horizontal: LayoutConfig;  // Dual horizontal (50-50)
		vertical: LayoutConfig;    // Dual vertical (70-30)
	};
	global: GlobalSettings;
}

// Panel layout stays separate (not chart-specific)
export interface PanelLayout {
	'toolbar-panel': number;
	'chart-panel': number;
	'stock-list-panel': number;
}

// Combined settings for the hook
export interface AllSettings {
	panelLayout: PanelLayout;
	chartSettings: ChartSettings;
}
