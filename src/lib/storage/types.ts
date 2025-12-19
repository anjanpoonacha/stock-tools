/**
 * Storage Types
 * Centralized type definitions for all storage schemas
 */

import { ChartZoomLevel } from '@/lib/chart/types';

/**
 * Storage backend type
 */
export enum StorageBackend {
  LOCAL_STORAGE = 'localStorage',
  SESSION_STORAGE = 'sessionStorage',
  VERCEL_KV = 'vercel-kv',
}

/**
 * Chart settings schema
 */
export interface ChartSettings {
  // Resolution settings
  resolution1: string;
  resolution2: string;

  // Zoom settings
  zoomLevel1: ChartZoomLevel;
  zoomLevel2: ChartZoomLevel;

  // CVD indicator settings
  showCVD: boolean;
  cvdAnchorPeriod: string;
  cvdUseCustomPeriod: boolean;
  cvdCustomPeriod: string;

  // Display settings
  showGrid: boolean;
  dualViewMode: boolean;
}

/**
 * View settings schema
 */
export interface ViewSettings {
  viewMode: 'table' | 'chart';
  currentStockIndex: number;
}

/**
 * Storage key configuration
 */
export interface StorageKeyConfig {
  key: string;
  backend: StorageBackend;
  ttl?: number; // TTL in seconds (for KV)
}

/**
 * Default chart settings
 */
export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  resolution1: '1D',
  resolution2: '1W',
  zoomLevel1: ChartZoomLevel.MAX,
  zoomLevel2: ChartZoomLevel.MAX,
  showCVD: true,
  cvdAnchorPeriod: '3M',
  cvdUseCustomPeriod: false,
  cvdCustomPeriod: '30S',
  showGrid: true,
  dualViewMode: false,
};

/**
 * Default view settings
 */
export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  viewMode: 'table',
  currentStockIndex: 0,
};
