/**
 * Layout Settings Storage
 * Type-safe API for multi-pane chart layout persistence
 */

import { StorageManager, createStorageConfig } from './storageManager';
import { StorageBackend, LayoutSettings, DEFAULT_LAYOUT_SETTINGS } from './types';

/**
 * Storage keys with prefixing for organization
 */
const STORAGE_KEYS = {
  LAYOUT_SETTINGS: 'mio-tv:layout-settings',
} as const;

/**
 * Version for cache invalidation
 * Increment when schema changes
 */
const LAYOUT_VERSION = 'v1';

/**
 * Storage configuration for layout settings
 */
const layoutSettingsConfig = createStorageConfig<LayoutSettings>(
  STORAGE_KEYS.LAYOUT_SETTINGS,
  DEFAULT_LAYOUT_SETTINGS,
  {
    backend: StorageBackend.LOCAL_STORAGE,
    version: LAYOUT_VERSION,
  }
);

/**
 * Get layout settings from storage
 * @returns Current layout settings or defaults
 */
export function getLayoutSettings(): LayoutSettings {
  return StorageManager.get(layoutSettingsConfig);
}

/**
 * Save layout settings to storage
 * @param settings - Layout settings to persist
 */
export function saveLayoutSettings(settings: LayoutSettings): void {
  StorageManager.set(layoutSettingsConfig, settings);
}

/**
 * Update partial layout settings
 * @param partial - Partial layout settings to merge
 */
export function updateLayoutSettings(partial: Partial<LayoutSettings>): void {
  StorageManager.update(layoutSettingsConfig, partial);
}

/**
 * Reset layout settings to defaults
 */
export function resetLayoutSettings(): void {
  StorageManager.set(layoutSettingsConfig, DEFAULT_LAYOUT_SETTINGS);
}

/**
 * Get specific layout setting
 * @param key - Setting key to retrieve
 * @returns Setting value
 */
export function getLayoutSetting<K extends keyof LayoutSettings>(
  key: K
): LayoutSettings[K] {
  return getLayoutSettings()[key];
}

/**
 * Set specific layout setting
 * @param key - Setting key to update
 * @param value - New setting value
 */
export function setLayoutSetting<K extends keyof LayoutSettings>(
  key: K,
  value: LayoutSettings[K]
): void {
  updateLayoutSettings({ [key]: value } as Partial<LayoutSettings>);
}
