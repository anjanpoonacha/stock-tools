/**
 * Centralized KV Settings Hook
 *
 * Single source of truth for ALL user settings:
 * - Panel layout (sizes)
 * - Chart settings (resolutions, zoom, indicators)
 * - Layout settings (mode, sync)
 *
 * This is the ONLY hook that should be used for persisting user preferences.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_PANEL_SIZES } from '@/lib/chart/panelConstants';

// API endpoints
const API = {
	PANEL_LAYOUT: '/api/kv/panel-layout',
	CHART_SETTINGS: '/api/kv/chart-settings',
	LAYOUT_SETTINGS: '/api/kv/layout-settings',
	DUAL_CHART_LAYOUT: '/api/kv/dual-chart-layout',
} as const;

// Type definitions
export interface PanelLayout {
	'toolbar-panel': number;
	'chart-panel': number;
	'stock-list-panel': number;
}

export interface ChartSettings {
	resolution1: string;
	resolution2: string;
	zoomLevel1: string;
	zoomLevel2: string;
	// Chart 1 Indicator Visibility
	showPrice1: boolean;
	showVolume1: boolean;
	showCVD1: boolean;
	cvdAnchorPeriod1: string;
	cvdUseCustomPeriod1: boolean;
	cvdCustomPeriod1: string;
	// Chart 2 Indicator Visibility
	showPrice2: boolean;
	showVolume2: boolean;
	showCVD2: boolean;
	cvdAnchorPeriod2: string;
	cvdUseCustomPeriod2: boolean;
	cvdCustomPeriod2: string;
	showGrid: boolean;
	dualViewMode: boolean;
	showVolumeMA: boolean;
	volumeMALength: number;
}

export interface LayoutSettings {
	mode: 'horizontal' | 'vertical';
	rangeSync: boolean;
}

export interface DualChartLayout {
	horizontal: {
		chart1: number;
		chart2: number;
	};
	vertical: {
		chart1: number;
		chart2: number;
	};
}

interface AllSettings {
	panelLayout: PanelLayout;
	chartSettings: ChartSettings;
	layoutSettings: LayoutSettings;
	dualChartLayout: DualChartLayout;
}

// Default values
const DEFAULTS: AllSettings = {
	panelLayout: {
		'toolbar-panel': DEFAULT_PANEL_SIZES.TOOLBAR,
		'chart-panel': DEFAULT_PANEL_SIZES.CHART,
		'stock-list-panel': DEFAULT_PANEL_SIZES.STOCK_LIST,
	},
	chartSettings: {
		resolution1: '1D',
		resolution2: '1W',
		zoomLevel1: 'MD',
		zoomLevel2: 'MD',
		// Chart 1 defaults
		showPrice1: true,
		showVolume1: true,
		showCVD1: false,
		cvdAnchorPeriod1: '3M',
		cvdUseCustomPeriod1: false,
		cvdCustomPeriod1: '1',
		// Chart 2 defaults
		showPrice2: true,
		showVolume2: true,
		showCVD2: false,
		cvdAnchorPeriod2: '3M',
		cvdUseCustomPeriod2: false,
		cvdCustomPeriod2: '1',
		showGrid: false,
		dualViewMode: false,
		showVolumeMA: false,
		volumeMALength: 30,
	},
	layoutSettings: {
		mode: 'horizontal',
		rangeSync: true,
	},
	dualChartLayout: {
		horizontal: {
			chart1: 50,
			chart2: 50,
		},
		vertical: {
			chart1: 50,
			chart2: 50,
		},
	},
};

/**
 * Centralized settings hook - USE THIS INSTEAD OF OTHER HOOKS
 */
export function useKVSettings() {
	const [settings, setSettings] = useState<AllSettings>(DEFAULTS);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoaded, setIsLoaded] = useState(false);

	// Debounce timers for each setting type
	const panelSaveTimer = useRef<NodeJS.Timeout | null>(null);
	const chartSaveTimer = useRef<NodeJS.Timeout | null>(null);
	const layoutSaveTimer = useRef<NodeJS.Timeout | null>(null);
	const dualChartSaveTimer = useRef<NodeJS.Timeout | null>(null);

	// Load all settings on mount - ONCE only to prevent infinite loop
	useEffect(() => {
		async function loadAll() {
			// CRITICAL FIX: Skip if already loaded to prevent re-fetching on every render
			if (isLoaded) {
				return;
			}
			
			try {
				const [panelRes, chartRes, layoutRes, dualChartRes] = await Promise.all([
					fetch(API.PANEL_LAYOUT),
					fetch(API.CHART_SETTINGS),
					fetch(API.LAYOUT_SETTINGS),
				fetch(API.DUAL_CHART_LAYOUT),
				]);

				const [panelLayout, chartSettings, layoutSettings, dualChartLayout] = await Promise.all([
					panelRes.json(),
					chartRes.json(),
					layoutRes.json(),
				dualChartRes.json(),
				]);

				setSettings({
					panelLayout: panelLayout || DEFAULTS.panelLayout,
					chartSettings: chartSettings || DEFAULTS.chartSettings,
					layoutSettings: layoutSettings || DEFAULTS.layoutSettings,
				dualChartLayout: dualChartLayout || DEFAULTS.dualChartLayout,
				});

				console.log('✅ Loaded settings from KV');
			} catch (error) {
				console.error('❌ Failed to load settings from KV:', error);
				// Use defaults on error
			} finally {
				setIsLoading(false);
				setIsLoaded(true);
			}
		}
		loadAll();
	}, [isLoaded]); // Include isLoaded to check guard condition

	// Save panel layout (debounced)
	const savePanelLayout = useCallback((layout: PanelLayout) => {
		if (!isLoaded) return;

		if (panelSaveTimer.current) {
			clearTimeout(panelSaveTimer.current);
		}

		panelSaveTimer.current = setTimeout(async () => {
			try {
				await fetch(API.PANEL_LAYOUT, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(layout),
				});
				console.log('✅ Saved panel layout to KV');
			} catch (error) {
				console.error('❌ Failed to save panel layout:', error);
			}
		}, 1000); // 1 second debounce
	}, [isLoaded]);

	// Save chart settings (debounced)
	const saveChartSettings = useCallback((chartSettings: ChartSettings) => {
		if (!isLoaded) return;

		if (chartSaveTimer.current) {
			clearTimeout(chartSaveTimer.current);
		}

		chartSaveTimer.current = setTimeout(async () => {
			try {
				await fetch(API.CHART_SETTINGS, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(chartSettings),
				});
				console.log('✅ Saved chart settings to KV');
			} catch (error) {
				console.error('❌ Failed to save chart settings:', error);
			}
		}, 500); // 500ms debounce for chart settings
	}, [isLoaded]);

	// Save layout settings (immediate)
	const saveLayoutSettings = useCallback(async (layoutSettings: LayoutSettings) => {
		if (!isLoaded) return;

		try {
			await fetch(API.LAYOUT_SETTINGS, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(layoutSettings),
			});
			console.log('✅ Saved layout settings to KV');
		} catch (error) {
			console.error('❌ Failed to save layout settings:', error);
		}
	}, [isLoaded]);

	// Update panel layout
	const updatePanelLayout = useCallback((layout: PanelLayout) => {
		setSettings(prev => ({ ...prev, panelLayout: layout }));
		savePanelLayout(layout);
	}, [savePanelLayout]);

	// Update single chart setting
	const updateChartSetting = useCallback(<K extends keyof ChartSettings>(
		key: K,
		value: ChartSettings[K]
	) => {
		let newChartSettings: ChartSettings;
		setSettings(prev => {
			newChartSettings = { ...prev.chartSettings, [key]: value };
			return { ...prev, chartSettings: newChartSettings };
		});
		// Save with the newly created settings object
		saveChartSettings(newChartSettings!);
	}, [saveChartSettings]);

	// Update multiple chart settings
	const updateChartSettings = useCallback((partial: Partial<ChartSettings>) => {
		let newChartSettings: ChartSettings;
		setSettings(prev => {
			newChartSettings = { ...prev.chartSettings, ...partial };
			return { ...prev, chartSettings: newChartSettings };
		});
		// Save with the newly created settings object
		saveChartSettings(newChartSettings!);
	}, [saveChartSettings]);

	// Update layout mode
	const updateLayoutMode = useCallback((mode: 'horizontal' | 'vertical') => {
		setSettings(prev => {
			const newLayoutSettings = { ...prev.layoutSettings, mode };
			saveLayoutSettings(newLayoutSettings);
			return { ...prev, layoutSettings: newLayoutSettings };
		});
	}, [saveLayoutSettings]);

	// Update range sync
	const updateRangeSync = useCallback((rangeSync: boolean) => {
		setSettings(prev => {
			const newLayoutSettings = { ...prev.layoutSettings, rangeSync };
			saveLayoutSettings(newLayoutSettings);
			return { ...prev, layoutSettings: newLayoutSettings };
		});
	}, [saveLayoutSettings]);

	// Save dual chart layout (debounced)
	const saveDualChartLayout = useCallback((layout: DualChartLayout) => {
		if (!isLoaded) return;

		if (dualChartSaveTimer.current) {
			clearTimeout(dualChartSaveTimer.current);
		}

		dualChartSaveTimer.current = setTimeout(async () => {
			try {
				await fetch(API.DUAL_CHART_LAYOUT, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(layout),
				});
				console.log('✅ Saved dual chart layout to KV');
			} catch (error) {
				console.error('❌ Failed to save dual chart layout:', error);
			}
		}, 1000); // 1 second debounce
	}, [isLoaded]);

	// Update dual chart layout
	const updateDualChartLayout = useCallback((
		orientation: 'horizontal' | 'vertical',
		sizes: { chart1: number; chart2: number }
	) => {
		setSettings(prev => {
			const newDualChartLayout = {
				...prev.dualChartLayout,
				[orientation]: sizes,
			};
			saveDualChartLayout(newDualChartLayout);
			return { ...prev, dualChartLayout: newDualChartLayout };
		});
	}, [saveDualChartLayout]);

	return {
		// Loading state
		isLoading,
		isLoaded,

		// All settings
		settings,

		// Panel layout
		panelLayout: settings.panelLayout,
		updatePanelLayout,

		// Chart settings
		chartSettings: settings.chartSettings,
		updateChartSetting,
		updateChartSettings,

		// Layout settings
		layoutMode: settings.layoutSettings.mode,
		rangeSync: settings.layoutSettings.rangeSync,
		updateLayoutMode,
		updateRangeSync,

		// Dual chart layout
		dualChartLayout: settings.dualChartLayout,
		updateDualChartLayout,
	};
}
