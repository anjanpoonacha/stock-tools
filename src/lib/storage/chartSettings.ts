/**
 * Chart Settings Storage
 * Type-safe API for chart settings persistence
 */

import { StorageManager, createStorageConfig } from './storageManager';
import { StorageBackend, ChartSettings, ViewSettings, DEFAULT_CHART_SETTINGS, DEFAULT_VIEW_SETTINGS } from './types';

/**
 * Storage keys with prefixing for organization
 */
const STORAGE_KEYS = {
  CHART_SETTINGS: 'mio-tv:chart-settings',
  VIEW_SETTINGS: 'mio-tv:view-settings',
  CHART_INDEX: 'mio-tv:chart-index',
} as const;

/**
 * Version for cache invalidation
 * Increment when schema changes
 */
const SETTINGS_VERSION = 'v1';

/**
 * Storage configurations
 */
const chartSettingsConfig = createStorageConfig<ChartSettings>(
  STORAGE_KEYS.CHART_SETTINGS,
  DEFAULT_CHART_SETTINGS,
  {
    backend: StorageBackend.LOCAL_STORAGE,
    version: SETTINGS_VERSION,
  }
);

const viewSettingsConfig = createStorageConfig<ViewSettings>(
  STORAGE_KEYS.VIEW_SETTINGS,
  DEFAULT_VIEW_SETTINGS,
  {
    backend: StorageBackend.LOCAL_STORAGE,
    version: SETTINGS_VERSION,
  }
);

/**
 * Chart Settings API
 * Beautiful, type-safe interface for chart settings
 */
export const ChartSettingsStorage = {
  /**
   * Get all chart settings
   */
  get(): ChartSettings {
    return StorageManager.get(chartSettingsConfig);
  },

  /**
   * Set all chart settings
   */
  set(settings: ChartSettings): void {
    StorageManager.set(chartSettingsConfig, settings);
  },

  /**
   * Update partial chart settings
   */
  update(partial: Partial<ChartSettings>): void {
    StorageManager.update(chartSettingsConfig, partial);
  },

  /**
   * Reset to default settings
   */
  reset(): void {
    StorageManager.set(chartSettingsConfig, DEFAULT_CHART_SETTINGS);
  },

  /**
   * Get specific setting
   */
  getSetting<K extends keyof ChartSettings>(key: K): ChartSettings[K] {
    return this.get()[key];
  },

  /**
   * Set specific setting
   */
  setSetting<K extends keyof ChartSettings>(
    key: K,
    value: ChartSettings[K]
  ): void {
    this.update({ [key]: value } as Partial<ChartSettings>);
  },
};

/**
 * View Settings API
 */
export const ViewSettingsStorage = {
  /**
   * Get all view settings
   */
  get(): ViewSettings {
    return StorageManager.get(viewSettingsConfig);
  },

  /**
   * Set all view settings
   */
  set(settings: ViewSettings): void {
    StorageManager.set(viewSettingsConfig, settings);
  },

  /**
   * Update partial view settings
   */
  update(partial: Partial<ViewSettings>): void {
    StorageManager.update(viewSettingsConfig, partial);
  },

  /**
   * Get view mode
   */
  getViewMode(): 'table' | 'chart' {
    return this.get().viewMode;
  },

  /**
   * Set view mode
   */
  setViewMode(mode: 'table' | 'chart'): void {
    this.update({ viewMode: mode });
  },

  /**
   * Get current stock index
   */
  getCurrentStockIndex(): number {
    return this.get().currentStockIndex;
  },

  /**
   * Set current stock index
   */
  setCurrentStockIndex(index: number): void {
    this.update({ currentStockIndex: index });
  },
};

/**
 * Chart Index Storage (per-formula, session-only)
 * Scoped by formula ID for session persistence
 */
export const ChartIndexStorage = {
  /**
   * Get chart index for formula
   */
  get(formulaId: string): number {
    const key = `${STORAGE_KEYS.CHART_INDEX}:${formulaId}`;
    const config = createStorageConfig<number>(key, 0, {
      backend: StorageBackend.SESSION_STORAGE,
    });

    return StorageManager.get(config);
  },

  /**
   * Set chart index for formula
   */
  set(formulaId: string, index: number): void {
    const key = `${STORAGE_KEYS.CHART_INDEX}:${formulaId}`;
    const config = createStorageConfig<number>(key, 0, {
      backend: StorageBackend.SESSION_STORAGE,
    });

    StorageManager.set(config, index);
  },

  /**
   * Remove chart index for formula
   */
  remove(formulaId: string): void {
    const key = `${STORAGE_KEYS.CHART_INDEX}:${formulaId}`;
    const config = createStorageConfig<number>(key, 0, {
      backend: StorageBackend.SESSION_STORAGE,
    });

    StorageManager.remove(config);
  },
};
