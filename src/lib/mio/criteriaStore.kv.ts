// src/lib/mio/criteriaStore.kv.ts
/**
 * ⚠️ SERVER-SIDE ONLY ⚠️
 * 
 * This module requires Vercel KV environment variables and must only be
 * imported in server-side code (API routes, server components).
 * 
 * DO NOT import in client components or hooks.
 * Use the API route /api/mio-criteria/options instead.
 */

import { kv } from '@vercel/kv';
import type { 
  CriterionTree, 
  CriterionOption, 
  CategoryId,
  CriterionCategory,
  CriterionMetadata,
  CriterionOptionSet
} from '@/types/mioCriteria';

/**
 * KV store wrapper for MarketInOut criteria metadata and enum options
 * 
 * Key patterns:
 * - mio:criteria:metadata:v1 → Full CriterionTree (no TTL)
 * - mio:options:{criterionId} → CriterionOption[] (TTL: 24h)
 */
export class CriteriaKVStore {
  private readonly METADATA_KEY = 'mio:criteria:metadata:v1';
  private readonly OPTIONS_PREFIX = 'mio:options:';
  private readonly OPTIONS_TTL = 86400; // 24 hours in seconds

  /**
   * Save complete criteria metadata to KV store
   * Converts Maps to objects for JSON serialization
   */
  async saveCriteriaMetadata(data: CriterionTree): Promise<void> {
    try {
      // Convert Maps to plain objects for JSON serialization
      const serializable = {
        categories: Object.fromEntries(data.categories),
        criteriaById: Object.fromEntries(data.criteriaById),
        optionsById: Object.fromEntries(data.optionsById),
        timestamp: data.timestamp.toISOString(),
      };

      await kv.set(this.METADATA_KEY, JSON.stringify(serializable));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get criteria metadata from KV store
   * Falls back to local JSON file if KV fails or returns null
   */
  async getCriteriaMetadata(): Promise<CriterionTree | null> {
    try {
      const data = await kv.get(this.METADATA_KEY);
      
      if (!data) {
        return await this.loadLocalMetadata();
      }

      // Parse stored data
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Reconstruct Maps from plain objects
      const tree: CriterionTree = {
        categories: new Map(Object.entries(parsed.categories)) as Map<CategoryId, CriterionCategory>,
        criteriaById: new Map(Object.entries(parsed.criteriaById)) as Map<string, CriterionMetadata>,
        optionsById: new Map(Object.entries(parsed.optionsById)) as Map<string, CriterionOptionSet>,
        timestamp: new Date(parsed.timestamp),
      };

      return tree;
    } catch (error) {
      return await this.loadLocalMetadata();
    }
  }

  /**
   * Fallback to local JSON file when KV is unavailable
   */
  private async loadLocalMetadata(): Promise<CriterionTree | null> {
    try {
      // Dynamic import to avoid bundling issues
      const localData = await import('@/data/mio-criteria.json');
      
      // Convert plain objects back to Maps
      const treeData = localData.default.tree || localData.default;
      const tree: CriterionTree = {
        categories: new Map(Object.entries(treeData.categories || {})) as unknown as Map<CategoryId, CriterionCategory>,
        criteriaById: new Map(Object.entries(treeData.criteriaById || {})) as unknown as Map<string, CriterionMetadata>,
        optionsById: new Map(Object.entries(treeData.optionsById || {})) as unknown as Map<string, CriterionOptionSet>,
        timestamp: new Date(treeData.timestamp || Date.now()),
      };
      
      return tree;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save enum options for a specific criterion with 24h TTL
   */
  async saveOptions(criterionId: string, options: CriterionOption[]): Promise<void> {
    const key = `${this.OPTIONS_PREFIX}${criterionId}`;
    
    try {
      await kv.set(key, JSON.stringify(options), { ex: this.OPTIONS_TTL });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get cached enum options for a specific criterion
   * Returns null if not found or expired
   */
  async getOptions(criterionId: string): Promise<CriterionOption[] | null> {
    const key = `${this.OPTIONS_PREFIX}${criterionId}`;
    
    try {
      const data = await kv.get(key);
      
      if (!data) {
        return null;
      }

      const options = typeof data === 'string' ? JSON.parse(data) : data;
      
      return options as CriterionOption[];
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all MIO-related keys from KV store
   * Useful for debugging and cache invalidation
   */
  async clearAll(): Promise<void> {
    try {
      // Clear metadata
      await kv.del(this.METADATA_KEY);
      
      // Clear all option keys
      const optionKeys = await kv.keys(`${this.OPTIONS_PREFIX}*`);
      if (optionKeys.length > 0) {
        await Promise.all(optionKeys.map(key => kv.del(key)));
      }
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get statistics about cached options
   * Useful for monitoring and debugging
   */
  async getStats(): Promise<{ totalOptions: number; criteriaWithOptions: string[] }> {
    try {
      const optionKeys = await kv.keys(`${this.OPTIONS_PREFIX}*`);
      const criteriaWithOptions = optionKeys.map(key => 
        key.replace(this.OPTIONS_PREFIX, '')
      );
      
      return {
        totalOptions: optionKeys.length,
        criteriaWithOptions,
      };
    } catch (error) {
      return { totalOptions: 0, criteriaWithOptions: [] };
    }
  }
}
