// src/hooks/useCriteriaReference.ts
// React hook for managing criteria reference panel state

import { useState, useCallback, useEffect } from 'react';
import type { 
  EditorContext, 
  CriterionMetadata,
  CriterionOption,
  CriteriaSearchResult
} from '@/types/mioCriteria';
import { searchCriteria } from '@/lib/mio/criteriaSearch';
import { CriteriaOptionsClient } from '@/lib/mio/criteriaOptionsClient';

/**
 * Hook for managing criteria reference panel state
 * 
 * Handles:
 * - Automatic search when editor context changes
 * - Options loading for enum criteria
 * - Loading states and errors per criterion
 * - In-memory caching of loaded options
 * 
 * @param editorContext - Current editor context (word being typed)
 * @param allCriteria - Complete list of available criteria
 * @returns State and methods for reference panel
 * 
 * @example
 * function ReferencePanel() {
 *   const { context } = useEditorContext(allCriteria);
 *   const {
 *     searchResult,
 *     loadedOptions,
 *     loadingCriteria,
 *     errors,
 *     loadOptions,
 *     refreshOptions,
 *   } = useCriteriaReference(context, allCriteria);
 *   
 *   // Render based on search result...
 * }
 */
export function useCriteriaReference(
  editorContext: EditorContext | null,
  allCriteria: CriterionMetadata[]
) {
  const [searchResult, setSearchResult] = useState<CriteriaSearchResult | null>(null);
  const [loadedOptions, setLoadedOptions] = useState<Map<string, CriterionOption[]>>(new Map());
  const [loadingCriteria, setLoadingCriteria] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  
  // Singleton API client (reused across hook lifecycle)
  const [apiClient] = useState(() => new CriteriaOptionsClient());
  
  /**
   * Search criteria when editor context changes
   * Automatically clears previous search results
   */
  useEffect(() => {
    if (editorContext) {
      const result = searchCriteria(editorContext.currentWord, allCriteria);
      setSearchResult(result);
    } else {
      setSearchResult(null);
    }
  }, [editorContext, allCriteria]);
  
  /**
   * Load options for a specific criterion from API
   * Updates loading state, options cache, and errors
   * 
   * @param criterionId - The criterion ID to load options for
   */
  const loadOptions = useCallback(async (criterionId: string) => {
    // Mark as loading
    setLoadingCriteria(prev => new Set(prev).add(criterionId));
    
    // Clear any previous error
    setErrors(prev => {
      const next = new Map(prev);
      next.delete(criterionId);
      return next;
    });
    
    try {
      const options = await apiClient.getOptions(criterionId);
      
      // Update loaded options cache
      setLoadedOptions(prev => new Map(prev).set(criterionId, options));
      
      console.log(`[useCriteriaReference] Loaded ${options.length} options for ${criterionId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Store error message
      setErrors(prev => new Map(prev).set(criterionId, errorMessage));
      
      console.error(`[useCriteriaReference] Failed to load options for ${criterionId}:`, error);
    } finally {
      // Remove from loading set
      setLoadingCriteria(prev => {
        const next = new Set(prev);
        next.delete(criterionId);
        return next;
      });
    }
  }, [apiClient]);
  
  /**
   * Force refresh options from API, bypassing cache
   * Useful for retry after error or manual refresh
   * 
   * @param criterionId - The criterion ID to refresh
   */
  const refreshOptions = useCallback(async (criterionId: string) => {
    // Mark as loading
    setLoadingCriteria(prev => new Set(prev).add(criterionId));
    
    // Clear any previous error
    setErrors(prev => {
      const next = new Map(prev);
      next.delete(criterionId);
      return next;
    });
    
    try {
      const options = await apiClient.refreshOptions(criterionId);
      
      // Update loaded options cache
      setLoadedOptions(prev => new Map(prev).set(criterionId, options));
      
      console.log(`[useCriteriaReference] Refreshed ${options.length} options for ${criterionId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Store error message
      setErrors(prev => new Map(prev).set(criterionId, errorMessage));
      
      console.error(`[useCriteriaReference] Failed to refresh options for ${criterionId}:`, error);
    } finally {
      // Remove from loading set
      setLoadingCriteria(prev => {
        const next = new Set(prev);
        next.delete(criterionId);
        return next;
      });
    }
  }, [apiClient]);
  
  return {
    searchResult,
    loadedOptions,
    loadingCriteria,
    errors,
    loadOptions,
    refreshOptions,
  };
}
