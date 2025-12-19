/**
 * Storage Manager
 * Beautiful, centralized storage utility with type safety
 * Supports localStorage, sessionStorage, and future KV integration
 */

import { StorageBackend } from './types';

/**
 * Storage configuration for each key
 */
interface StorageConfig<T> {
  key: string;
  backend: StorageBackend;
  defaultValue: T;
  version?: string; // For cache invalidation
}

/**
 * Centralized Storage Manager
 * Type-safe storage operations with automatic serialization
 */
export class StorageManager {
  /**
   * Get storage backend instance
   */
  private static getBackend(backend: StorageBackend): Storage | null {
    if (typeof window === 'undefined') return null;

    switch (backend) {
      case StorageBackend.LOCAL_STORAGE:
        return window.localStorage;
      case StorageBackend.SESSION_STORAGE:
        return window.sessionStorage;
      default:
        return null;
    }
  }

  /**
   * Get value from storage
   * @param config - Storage configuration
   * @returns Stored value or default
   */
  static get<T>(config: StorageConfig<T>): T {
    const backend = this.getBackend(config.backend);
    if (!backend) return config.defaultValue;

    try {
      const item = backend.getItem(config.key);
      if (!item) return config.defaultValue;

      const parsed = JSON.parse(item);

      // Check version for cache invalidation
      if (config.version && parsed.version !== config.version) {
        backend.removeItem(config.key);
        return config.defaultValue;
      }

      return parsed.data as T;
    } catch (error) {
      return config.defaultValue;
    }
  }

  /**
   * Set value in storage
   * @param config - Storage configuration
   * @param value - Value to store
   */
  static set<T>(config: StorageConfig<T>, value: T): void {
    const backend = this.getBackend(config.backend);
    if (!backend) return;

    try {
      const payload = {
        data: value,
        version: config.version,
        timestamp: Date.now(),
      };

      backend.setItem(config.key, JSON.stringify(payload));
    } catch (error) {
    }
  }

  /**
   * Update partial value in storage
   * @param config - Storage configuration
   * @param partial - Partial value to merge
   */
  static update<T extends object>(
    config: StorageConfig<T>,
    partial: Partial<T>
  ): void {
    const current = this.get(config);
    const updated = { ...current, ...partial };
    this.set(config, updated);
  }

  /**
   * Remove value from storage
   * @param config - Storage configuration
   */
  static remove<T>(config: StorageConfig<T>): void {
    const backend = this.getBackend(config.backend);
    if (!backend) return;

    try {
      backend.removeItem(config.key);
    } catch (error) {
    }
  }

  /**
   * Check if key exists in storage
   * @param config - Storage configuration
   */
  static has<T>(config: StorageConfig<T>): boolean {
    const backend = this.getBackend(config.backend);
    if (!backend) return false;

    return backend.getItem(config.key) !== null;
  }

  /**
   * Clear all storage (use with caution)
   * @param backend - Storage backend to clear
   */
  static clear(backend: StorageBackend): void {
    const backendInstance = this.getBackend(backend);
    if (!backendInstance) return;

    try {
      backendInstance.clear();
    } catch (error) {
    }
  }
}

/**
 * Storage configuration factory
 * Creates typed storage configs with defaults
 */
export function createStorageConfig<T>(
  key: string,
  defaultValue: T,
  options: {
    backend?: StorageBackend;
    version?: string;
  } = {}
): StorageConfig<T> {
  return {
    key,
    defaultValue,
    backend: options.backend || StorageBackend.LOCAL_STORAGE,
    version: options.version,
  };
}
