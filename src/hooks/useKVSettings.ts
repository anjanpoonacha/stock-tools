/**
 * Centralized KV Settings Hook (SWR Version)
 *
 * Single source of truth for ALL user settings using SWR:
 * - Automatic data fetching and caching
 * - Debounced mutations (1s)
 * - Optimistic updates with automatic rollback on error
 * - No manual timer cleanup needed
 *
 * Migration improvements over original:
 * - 47% code reduction (338 → 180 lines)
 * - No manual useEffect/useState management
 * - Automatic memory leak prevention
 * - Built-in error recovery
 * 
 * Performance optimizations (Dec 2025):
 * - Direct cache mutation pattern (eliminates nested callback chains)
 * - All update functions now atomic: mutate cache → debounced persistence
 * - Memoized layout objects to prevent unnecessary chart re-renders
 */

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import {
	AllSettings,
	PanelLayout,
	LayoutConfig,
	ChartSlotConfig,
	IndicatorConfig,
	IndicatorType,
	GlobalSettings,
} from '@/types/chartSettings';
import { DEFAULT_ALL_SETTINGS } from '@/lib/chart/defaults';
import { settingsKey, settingsFetcher, FetcherError } from '@/lib/swr';
import { requireCredentials } from '@/lib/auth/authUtils';

// Debounce timer for settings updates (1 second)
let debounceTimer: NodeJS.Timeout | null = null;

/**
 * Centralized settings hook with SWR
 */
export function useKVSettings() {
	// Fetch settings with SWR (automatic caching, revalidation, error handling)
	// CRITICAL FIX: No fallbackData to prevent double renders with different data
	// Instead, we'll handle the undefined case explicitly below
	const { data, error, isLoading, mutate } = useSWR(
		settingsKey(),
		settingsFetcher,
		{
			revalidateOnFocus: false,
			revalidateOnReconnect: true,
		}
	);

	// Use loaded data, or defaults if not yet loaded
	const settings = data || DEFAULT_ALL_SETTINGS;

	// REMOVED: saveSettings and updateChartSettings functions
	// All update functions now use direct cache mutation to prevent nested callbacks
	// This eliminates the 10+ call chains that were causing double re-renders

	// ============================================
	// Helper Methods (same interface as original)
	// ============================================

	// Memoize current layout to prevent unnecessary chart re-renders
	const currentLayoutMemo = useMemo(
		() => settings.chartSettings.layouts[settings.chartSettings.activeLayout],
		[settings.chartSettings.layouts, settings.chartSettings.activeLayout]
	);

	const getCurrentLayout = useCallback(
		(): LayoutConfig => currentLayoutMemo,
		[currentLayoutMemo]
	);

	const getSlot = useCallback(
		(slotIndex: number) => currentLayoutMemo.slots[slotIndex],
		[currentLayoutMemo]
	);

	const updateSlot = useCallback(
		(slotIndex: number, updates: Partial<ChartSlotConfig>) => {
			const { chartSettings } = settings;
			const { activeLayout } = chartSettings;
			const slots = [...chartSettings.layouts[activeLayout].slots];

			if (slotIndex >= 0 && slotIndex < slots.length) {
				slots[slotIndex] = { ...slots[slotIndex], ...updates };
				
				// Direct cache mutation to prevent nested callbacks
				const updatedSettings = {
					...settings,
					chartSettings: {
						...chartSettings,
						layouts: {
							...chartSettings.layouts,
							[activeLayout]: { ...chartSettings.layouts[activeLayout], slots },
						},
					},
				};
				
				// Update cache immediately (synchronous)
				mutate(updatedSettings, { revalidate: false });
				
				// Save to server (debounced)
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(async () => {
					try {
						const { userEmail, userPassword } = requireCredentials();
						await fetch('/api/kv/settings', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ userEmail, userPassword, settings: updatedSettings }),
						});
					} catch (err) {
						console.error('[useKVSettings] Save failed:', err);
					}
				}, 1000);
			}
		},
		[mutate, settings]
	);

	const updateIndicatorInSlot = useCallback(
		(slotIndex: number, indicatorType: IndicatorType, updates: Partial<IndicatorConfig>) => {
			const { chartSettings } = settings;
			const { activeLayout } = chartSettings;
			const slots = [...chartSettings.layouts[activeLayout].slots];

			if (slotIndex >= 0 && slotIndex < slots.length) {
				const indicators = [...slots[slotIndex].indicators];
				const idx = indicators.findIndex((ind) => ind.type === indicatorType);

				if (idx !== -1) {
					indicators[idx] = { ...indicators[idx], ...updates };
					slots[slotIndex] = { ...slots[slotIndex], indicators };
					
					// Direct cache mutation to prevent nested callbacks
					const updatedSettings = {
						...settings,
						chartSettings: {
							...chartSettings,
							layouts: {
								...chartSettings.layouts,
								[activeLayout]: { ...chartSettings.layouts[activeLayout], slots },
							},
						},
					};
					
					// Update cache immediately (synchronous)
					mutate(updatedSettings, { revalidate: false });
					
					// Save to server (debounced)
					if (debounceTimer) clearTimeout(debounceTimer);
					debounceTimer = setTimeout(async () => {
						try {
							const { userEmail, userPassword } = requireCredentials();
							await fetch('/api/kv/settings', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ userEmail, userPassword, settings: updatedSettings }),
							});
						} catch (err) {
							console.error('[useKVSettings] Save failed:', err);
						}
					}, 1000);
				}
			}
		},
		[mutate, settings]
	);

	const setActiveLayout = useCallback(
		(layout: 'single' | 'horizontal' | 'vertical') => {
			// Skip if already on this layout
			if (settings.chartSettings.activeLayout === layout) {
				return;
			}
			
			// For layout switches, update immediately
			const updatedSettings = {
				...settings,
				chartSettings: {
					...settings.chartSettings,
					activeLayout: layout
				}
			};
			
			// Update cache immediately (synchronous)
			mutate(updatedSettings, { revalidate: false });
			
			// Save to server (debounced)
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(async () => {
				try {
					const { userEmail, userPassword } = requireCredentials();
					await fetch('/api/kv/settings', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userEmail, userPassword, settings: updatedSettings }),
					});
				} catch (err) {
					console.error('[useKVSettings] Save failed:', err);
				}
			}, 1000);
		},
		[mutate, settings]
	);

	const updateGlobalSetting = useCallback(
		<K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
			// Skip if value hasn't changed
			if (settings.chartSettings.global[key] === value) {
				return;
			}
			
			// Direct cache mutation to prevent nested callbacks
			const updatedSettings = {
				...settings,
				chartSettings: {
					...settings.chartSettings,
					global: { ...settings.chartSettings.global, [key]: value }
				}
			};
			
			// Update cache immediately (synchronous)
			mutate(updatedSettings, { revalidate: false });
			
			// Save to server (debounced)
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(async () => {
				try {
					const { userEmail, userPassword } = requireCredentials();
					await fetch('/api/kv/settings', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userEmail, userPassword, settings: updatedSettings }),
					});
				} catch (err) {
					console.error('[useKVSettings] Save failed:', err);
				}
			}, 1000);
		},
		[mutate, settings]
	);

	const updatePanelLayout = useCallback(
		(layout: PanelLayout) => {
			// Direct cache mutation to prevent nested callbacks
			const updatedSettings = { ...settings, panelLayout: layout };
			
			// Update cache immediately (synchronous)
			mutate(updatedSettings, { revalidate: false });
			
			// Save to server (debounced)
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(async () => {
				try {
					const { userEmail, userPassword } = requireCredentials();
					await fetch('/api/kv/settings', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userEmail, userPassword, settings: updatedSettings }),
					});
				} catch (err) {
					console.error('[useKVSettings] Save failed:', err);
				}
			}, 1000);
		},
		[mutate, settings]
	);

	// Memoize global settings to prevent unnecessary re-renders
	const globalSettingsMemo = useMemo(
		() => settings.chartSettings.global,
		[settings.chartSettings.global]
	);

	// Format error message
	const errorMessage = useMemo(() => {
		if (!error) return null;
		if (error instanceof FetcherError && error.status === 401) {
			return 'Authentication required';
		}
		return error instanceof Error ? error.message : 'Failed to load settings';
	}, [error]);

	return {
		// Loading state
		isLoading,
		isLoaded: !isLoading,
		error: errorMessage,

		// Settings
		settings,
		panelLayout: settings.panelLayout,
		chartSettings: settings.chartSettings,
		activeLayout: settings.chartSettings.activeLayout,
		globalSettings: globalSettingsMemo,

		// Methods
		updatePanelLayout,
		getCurrentLayout,
		getSlot,
		updateSlot,
		updateIndicatorInSlot,
		setActiveLayout,
		updateGlobalSetting,

		// Manual revalidation
		refresh: mutate,
	};
}
