/**
 * Vercel KV Storage for Chart View Settings (Client-Side API)
 *
 * Stores all user preferences including:
 * - Panel layout (sizes)
 * - Layout mode (horizontal/vertical)
 * - Range sync state
 * - Chart settings (resolutions, zoom, indicators)
 *
 * Uses API routes to communicate with Vercel KV (server-side only)
 */

const API_ROUTES = {
	PANEL_LAYOUT: '/api/kv/panel-layout',
	CHART_SETTINGS: '/api/kv/chart-settings',
	LAYOUT_SETTINGS: '/api/kv/layout-settings',
} as const;

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
	showCVD: boolean;
	cvdAnchorPeriod: string;
	cvdUseCustomPeriod: boolean;
	cvdCustomPeriod: string;
	showGrid: boolean;
	dualViewMode: boolean;
	showVolumeMA: boolean;
	volumeMALength: number;
}

export interface LayoutSettings {
	mode: 'horizontal' | 'vertical';
	rangeSync: boolean;
}

// Default values
const DEFAULT_PANEL_LAYOUT: PanelLayout = {
	'toolbar-panel': 5,
	'chart-panel': 81,
	'stock-list-panel': 14,
};

const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
	mode: 'horizontal',
	rangeSync: true,
};

/**
 * Panel Layout Storage
 */
export async function savePanelLayout(layout: PanelLayout): Promise<void> {
	try {
		const response = await fetch(API_ROUTES.PANEL_LAYOUT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(layout),
		});
		if (response.ok) {
		} else {
			throw new Error('Failed to save');
		}
	} catch (error) {
	}
}

export async function loadPanelLayout(): Promise<PanelLayout> {
	try {
		const response = await fetch(API_ROUTES.PANEL_LAYOUT);
		if (response.ok) {
			const layout = await response.json();
			return layout;
		}
	} catch (error) {
	}
	return DEFAULT_PANEL_LAYOUT;
}

/**
 * Chart Settings Storage
 */
export async function saveChartSettings(settings: ChartSettings): Promise<void> {
	try {
		const response = await fetch(API_ROUTES.CHART_SETTINGS, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(settings),
		});
		if (response.ok) {
		} else {
			throw new Error('Failed to save');
		}
	} catch (error) {
	}
}

export async function loadChartSettings(): Promise<ChartSettings | null> {
	try {
		const response = await fetch(API_ROUTES.CHART_SETTINGS);
		if (response.ok) {
			const settings = await response.json();
			if (settings) {
				return settings;
			}
		}
	} catch (error) {
	}
	return null;
}

/**
 * Layout Settings (mode + rangeSync)
 */
export async function saveLayoutSettings(settings: LayoutSettings): Promise<void> {
	try {
		const response = await fetch(API_ROUTES.LAYOUT_SETTINGS, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(settings),
		});
		if (response.ok) {
		} else {
			throw new Error('Failed to save');
		}
	} catch (error) {
	}
}

export async function loadLayoutSettings(): Promise<LayoutSettings> {
	try {
		const response = await fetch(API_ROUTES.LAYOUT_SETTINGS);
		if (response.ok) {
			const settings = await response.json();
			return settings;
		}
	} catch (error) {
	}
	return DEFAULT_LAYOUT_SETTINGS;
}

/**
 * Save all settings at once
 */
export async function saveAllSettings(data: {
	panelLayout: PanelLayout;
	chartSettings: ChartSettings;
	layoutSettings: LayoutSettings;
}): Promise<void> {
	await Promise.all([
		savePanelLayout(data.panelLayout),
		saveChartSettings(data.chartSettings),
		saveLayoutSettings(data.layoutSettings),
	]);
}

/**
 * Load all settings at once
 */
export async function loadAllSettings(): Promise<{
	panelLayout: PanelLayout;
	chartSettings: ChartSettings | null;
	layoutSettings: LayoutSettings;
}> {
	const [panelLayout, chartSettings, layoutSettings] = await Promise.all([
		loadPanelLayout(),
		loadChartSettings(),
		loadLayoutSettings(),
	]);

	return { panelLayout, chartSettings, layoutSettings };
}
