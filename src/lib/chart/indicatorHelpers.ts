/**
 * Indicator Helper Functions
 * 
 * Utility functions for working with indicators in a Dependency Injection pattern.
 * Provides type-safe operations for getting, updating, and managing indicators.
 */

import type { ChartSlotConfig, IndicatorConfig, IndicatorType } from '@/types/chartSettings';

/**
 * Get a specific indicator from a slot by type
 * @param slot - The chart slot configuration
 * @param type - The indicator type to find
 * @returns The indicator config if found, undefined otherwise
 */
export function getIndicator(
	slot: ChartSlotConfig,
	type: IndicatorType
): IndicatorConfig | undefined {
	return slot.indicators.find((indicator) => indicator.type === type);
}

/**
 * Check if an indicator is enabled in a slot
 * @param slot - The chart slot configuration
 * @param type - The indicator type to check
 * @returns true if the indicator exists and is enabled, false otherwise
 */
export function isIndicatorEnabled(
	slot: ChartSlotConfig,
	type: IndicatorType
): boolean {
	const indicator = getIndicator(slot, type);
	return indicator?.enabled ?? false;
}

/**
 * Get a specific setting value from an indicator with type safety
 * @param slot - The chart slot configuration
 * @param type - The indicator type
 * @param settingKey - The setting key to retrieve
 * @param defaultValue - The default value if setting not found
 * @returns The setting value or default value
 */
export function getIndicatorSetting<T>(
	slot: ChartSlotConfig,
	type: IndicatorType,
	settingKey: string,
	defaultValue: T
): T {
	const indicator = getIndicator(slot, type);
	if (!indicator?.settings || !(settingKey in indicator.settings)) {
		return defaultValue;
	}
	return indicator.settings[settingKey] as T;
}

/**
 * Immutably update an indicator in a slot
 * @param slot - The chart slot configuration
 * @param type - The indicator type to update
 * @param updates - Partial updates to apply to the indicator
 * @returns A new slot config with the updated indicator
 */
export function updateIndicatorInSlot(
	slot: ChartSlotConfig,
	type: IndicatorType,
	updates: Partial<IndicatorConfig>
): ChartSlotConfig {
	const indicatorIndex = slot.indicators.findIndex((ind) => ind.type === type);
	
	// If indicator doesn't exist, return slot unchanged
	if (indicatorIndex === -1) {
		return slot;
	}

	// Create new indicators array with the updated indicator
	const updatedIndicators = slot.indicators.map((indicator, index) => {
		if (index !== indicatorIndex) {
			return indicator;
		}
		
		// Merge updates, handling nested settings object
		return {
			...indicator,
			...updates,
			settings: updates.settings 
				? { ...indicator.settings, ...updates.settings }
				: indicator.settings,
		};
	});

	// Return new slot with updated indicators
	return {
		...slot,
		indicators: updatedIndicators,
	};
}

/**
 * Toggle the enabled state of an indicator
 * @param slot - The chart slot configuration
 * @param type - The indicator type to toggle
 * @returns A new slot config with the indicator's enabled state toggled
 */
export function toggleIndicator(
	slot: ChartSlotConfig,
	type: IndicatorType
): ChartSlotConfig {
	const indicator = getIndicator(slot, type);
	if (!indicator) {
		return slot;
	}

	return updateIndicatorInSlot(slot, type, {
		enabled: !indicator.enabled,
	});
}

/**
 * Deep clone a slot configuration
 * @param slot - The chart slot configuration to clone
 * @returns A deep clone of the slot configuration
 */
export function cloneSlot(slot: ChartSlotConfig): ChartSlotConfig {
	return {
		resolution: slot.resolution,
		zoomLevel: slot.zoomLevel,
		indicators: slot.indicators.map((indicator) => ({
			type: indicator.type,
			enabled: indicator.enabled,
			settings: indicator.settings ? { ...indicator.settings } : undefined,
		})),
	};
}
