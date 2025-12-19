/**
 * useChartSettings Hook
 * React hook for chart settings with automatic persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { ChartSettingsStorage, ViewSettingsStorage, ChartIndexStorage } from '@/lib/storage/chartSettings';
import type { ChartSettings, ViewSettings } from '@/lib/storage/types';

/**
 * Hook for chart settings with localStorage persistence
 * @returns Chart settings and setter functions
 */
export function useChartSettings() {
  // Initialize from storage
  const [settings, setSettings] = useState<ChartSettings>(() =>
    ChartSettingsStorage.get()
  );

  // Persist to storage whenever settings change
  useEffect(() => {
    ChartSettingsStorage.set(settings);
  }, [settings]);

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
