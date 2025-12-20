/**
 * useChartSettings Hook
 * React hook for chart settings with KV persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { ChartSettingsStorage, ViewSettingsStorage, ChartIndexStorage } from '@/lib/storage/chartSettings';
import { loadChartSettings, saveChartSettings, type ChartSettings as KVChartSettings } from '@/lib/storage/kvStorage';
import type { ChartSettings, ViewSettings } from '@/lib/storage/types';

/**
 * Hook for chart settings with KV persistence
 * @returns Chart settings and setter functions
 */
export function useChartSettings() {
  // Initialize from localStorage (will be overwritten by KV)
  const [settings, setSettings] = useState<ChartSettings>(() =>
    ChartSettingsStorage.get()
  );

  const [isLoaded, setIsLoaded] = useState(false);

  // Load from KV on mount
  useEffect(() => {
    async function loadFromKV() {
      try {
        const kvSettings = await loadChartSettings();
        if (kvSettings) {
          setSettings(kvSettings as ChartSettings);
        }
      } catch (error) {
        // Failed to load settings
      } finally {
        setIsLoaded(true);
      }
    }
    loadFromKV();
  }, []);

  // Persist to KV whenever settings change (after initial load)
  // Debounced to prevent API flooding during rapid UI interactions
  useEffect(() => {
    if (isLoaded) {
      const timeout = setTimeout(() => {
        saveChartSettings(settings as unknown as KVChartSettings);
      }, 500); // Only save after 500ms of no changes
      
      return () => clearTimeout(timeout);
    }
  }, [settings, isLoaded]);

  /**
   * Update multiple settings at once
   */
  const updateSettings = useCallback((partial: Partial<ChartSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  /**
   * Update single setting
   */
  const updateSetting = useCallback(
    <K extends keyof ChartSettings>(key: K, value: ChartSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  /**
   * Reset to defaults
   */
  const resetSettings = useCallback(() => {
    ChartSettingsStorage.reset();
    setSettings(ChartSettingsStorage.get());
  }, []);

  return {
    settings,
    updateSettings,
    updateSetting,
    resetSettings,
  };
}

/**
 * Hook for view settings with localStorage persistence
 * @returns View settings and setter functions
 */
export function useViewSettings() {
  // Initialize from storage
  const [viewMode, setViewModeState] = useState<'table' | 'chart'>(() =>
    ViewSettingsStorage.getViewMode()
  );

  const [currentStockIndex, setCurrentStockIndexState] = useState<number>(() =>
    ViewSettingsStorage.getCurrentStockIndex()
  );

  // Persist view mode
  const setViewMode = useCallback((mode: 'table' | 'chart') => {
    setViewModeState(mode);
    ViewSettingsStorage.setViewMode(mode);
  }, []);

  // Persist stock index
  const setCurrentStockIndex = useCallback((index: number) => {
    setCurrentStockIndexState(index);
    ViewSettingsStorage.setCurrentStockIndex(index);
  }, []);

  return {
    viewMode,
    setViewMode,
    currentStockIndex,
    setCurrentStockIndex,
  };
}

/**
 * Hook for per-formula chart index with sessionStorage
 * @param formulaId - Formula ID to scope the index
 * @returns Current index and setter
 */
export function useChartIndex(formulaId: string | null) {
  const [currentIndex, setCurrentIndexState] = useState<number>(() =>
    formulaId ? ChartIndexStorage.get(formulaId) : 0
  );

  // Persist to session storage
  const setCurrentIndex = useCallback(
    (index: number) => {
      setCurrentIndexState(index);
      if (formulaId) {
        ChartIndexStorage.set(formulaId, index);
      }
    },
    [formulaId]
  );

  // Reset if formula changes
  useEffect(() => {
    if (formulaId) {
      setCurrentIndexState(ChartIndexStorage.get(formulaId));
    } else {
      setCurrentIndexState(0);
    }
  }, [formulaId]);

  return {
    currentIndex,
    setCurrentIndex,
  };
}
