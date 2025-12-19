/**
 * Centralized KV Settings Hook (Refactored)
 *
 * Single source of truth for ALL user settings using unified structure:
 * - Panel layout (sizes)
 * - Chart settings (layouts, indicators, global settings)
 *
 * This is the ONLY hook that should be used for persisting user preferences.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
	AllSettings,
	ChartSettings,
	PanelLayout,
	LayoutConfig,
	ChartSlotConfig,
	IndicatorConfig,
	IndicatorType,
	GlobalSettings,
} from '@/types/chartSettings';
import { DEFAULT_ALL_SETTINGS } from '@/lib/chart/defaults';

// API endpoint - single unified endpoint
const API_SETTINGS = '/api/kv/settings';

/**
 * Centralized settings hook - USE THIS INSTEAD OF OTHER HOOKS
 */
export function useKVSettings() {
	const [settings, setSettings] = useState<AllSettings>(DEFAULT_ALL_SETTINGS);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoaded, setIsLoaded] = useState(false);

	// Single debounce timer for all settings saves
	const saveTimer = useRef<NodeJS.Timeout | null>(null);

	// Load all settings on mount - ONCE only
	useEffect(() => {
		async function loadAll() {
			// Skip if already loaded to prevent re-fetching
			if (isLoaded) {
				return;
			}

			try {
				const response = await fetch(API_SETTINGS);
				const loadedSettings = await response.json();

				setSettings({
					panelLayout: loadedSettings?.panelLayout || DEFAULT_ALL_SETTINGS.panelLayout,
					chartSettings: loadedSettings?.chartSettings || DEFAULT_ALL_SETTINGS.chartSettings,
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
	}, [isLoaded]);

	// Save settings with 1 second debounce
	const saveSettings = useCallback(
		(updatedSettings: AllSettings) => {
			if (!isLoaded) return;

			if (saveTimer.current) {
				clearTimeout(saveTimer.current);
			}

			saveTimer.current = setTimeout(async () => {
				try {
					await fetch(API_SETTINGS, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(updatedSettings),
					});
					console.log('✅ Saved settings to KV');
				} catch (error) {
					console.error('❌ Failed to save settings:', error);
				}
			}, 1000); // 1 second debounce
		},
		[isLoaded]
	);

	// ============================================
	// Helper Methods
	// ============================================

	/**
	 * Get the current active layout configuration
	 */
	const getCurrentLayout = useCallback((): LayoutConfig => {
		const activeLayout = settings.chartSettings.activeLayout;
		return settings.chartSettings.layouts[activeLayout];
	}, [settings.chartSettings]);

	/**
	 * Get a specific slot by index
	 */
	const getSlot = useCallback(
		(slotIndex: number): ChartSlotConfig | undefined => {
			const layout = getCurrentLayout();
			return layout.slots[slotIndex];
		},
		[getCurrentLayout]
	);

	/**
	 * Update a specific slot configuration
	 */
	const updateSlot = useCallback(
		(slotIndex: number, updates: Partial<ChartSlotConfig>) => {
			setSettings((prev) => {
				const activeLayout = prev.chartSettings.activeLayout;
				const layout = prev.chartSettings.layouts[activeLayout];
				const updatedSlots = [...layout.slots];

				if (slotIndex >= 0 && slotIndex < updatedSlots.length) {
					updatedSlots[slotIndex] = {
						...updatedSlots[slotIndex],
						...updates,
					};
				}

				const newSettings = {
					...prev,
					chartSettings: {
						...prev.chartSettings,
						layouts: {
							...prev.chartSettings.layouts,
							[activeLayout]: {
								...layout,
								slots: updatedSlots,
							},
						},
					},
				};

				saveSettings(newSettings);
				return newSettings;
			});
		},
		[saveSettings]
	);

	/**
	 * Update a specific indicator within a slot
	 */
	const updateIndicatorInSlot = useCallback(
		(
			slotIndex: number,
			indicatorType: IndicatorType,
			updates: Partial<IndicatorConfig>
		) => {
			setSettings((prev) => {
				const activeLayout = prev.chartSettings.activeLayout;
				const layout = prev.chartSettings.layouts[activeLayout];
				const updatedSlots = [...layout.slots];

				if (slotIndex >= 0 && slotIndex < updatedSlots.length) {
					const slot = updatedSlots[slotIndex];
					const indicatorIndex = slot.indicators.findIndex(
						(ind) => ind.type === indicatorType
					);

					if (indicatorIndex !== -1) {
						const updatedIndicators = [...slot.indicators];
						updatedIndicators[indicatorIndex] = {
							...updatedIndicators[indicatorIndex],
							...updates,
						};

						updatedSlots[slotIndex] = {
							...slot,
							indicators: updatedIndicators,
						};
					}
				}

				const newSettings = {
					...prev,
					chartSettings: {
						...prev.chartSettings,
						layouts: {
							...prev.chartSettings.layouts,
							[activeLayout]: {
								...layout,
								slots: updatedSlots,
							},
						},
					},
				};

				saveSettings(newSettings);
				return newSettings;
			});
		},
		[saveSettings]
	);

	/**
	 * Switch to a different layout
	 */
	const setActiveLayout = useCallback(
		(layout: 'single' | 'horizontal' | 'vertical') => {
			setSettings((prev) => {
				const newSettings = {
					...prev,
					chartSettings: {
						...prev.chartSettings,
						activeLayout: layout,
					},
				};

				saveSettings(newSettings);
				return newSettings;
			});
		},
		[saveSettings]
	);

	/**
	 * Update a global setting
	 */
	const updateGlobalSetting = useCallback(
		<K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
			setSettings((prev) => {
				const newSettings = {
					...prev,
					chartSettings: {
						...prev.chartSettings,
						global: {
							...prev.chartSettings.global,
							[key]: value,
						},
					},
				};

				saveSettings(newSettings);
				return newSettings;
			});
		},
		[saveSettings]
	);

	// ============================================
	// Panel Layout Update (Backward Compatibility)
	// ============================================

	/**
	 * Update panel layout separately (backward compat)
	 * This is separate because panel resizing happens frequently
	 */
	const updatePanelLayout = useCallback(
		(layout: PanelLayout) => {
			setSettings((prev) => {
				const newSettings = {
					...prev,
					panelLayout: layout,
				};

				saveSettings(newSettings);
				return newSettings;
			});
		},
		[saveSettings]
	);

	return {
		// Loading state
		isLoading,
		isLoaded,

		// All settings
		settings,

		// Panel layout (backward compat)
		panelLayout: settings.panelLayout,
		updatePanelLayout,

		// Chart settings (direct access)
		chartSettings: settings.chartSettings,

		// Helper methods
		getCurrentLayout,
		getSlot,
		updateSlot,
		updateIndicatorInSlot,
		setActiveLayout,
		updateGlobalSetting,

		// Convenience accessors
		activeLayout: settings.chartSettings.activeLayout,
		globalSettings: settings.chartSettings.global,
	};
}
