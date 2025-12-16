// src/components/formula-editor/CriteriaReferencePanel.tsx
// Main container for the context-aware criteria reference panel

'use client';

import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { EditorContext, CriterionMetadata } from '@/types/mioCriteria';
import { useCriteriaReference } from '@/hooks/useCriteriaReference';
import { EmptyState } from './EmptyState';
import { NoMatchesState } from './NoMatchesState';
import { PanelHeader } from './PanelHeader';
import { CriterionCard } from './CriterionCard';
import { MultiMatchView } from './MultiMatchView';

interface CriteriaReferencePanelProps {
  editorContext: EditorContext | null;
}

/**
 * Context-aware criteria reference panel (30% width, right side)
 * 
 * States:
 * 1. Empty: No context detected yet
 * 2. No matches: Search returned no results
 * 3. Single match: Show detailed criterion card
 * 4. Multiple matches: Show all matching criteria
 * 
 * Layout:
 * - Fixed 30% width
 * - Border on left side
 * - Subtle background
 * - Fixed header + scrollable content
 * 
 * @param editorContext - Current editor context from cursor position
 */
export function CriteriaReferencePanel({ editorContext }: CriteriaReferencePanelProps) {
  const [allCriteria, setAllCriteria] = useState<CriterionMetadata[]>([]);
  
  // Load criteria data from static JSON
  useEffect(() => {
    import('@/data/mio-criteria.json').then((data) => {
      // Convert Map to array and cast to proper types
      const criteriaArray = Object.values(data.tree.criteriaById) as CriterionMetadata[];
      setAllCriteria(criteriaArray);
      console.log(`[CriteriaReferencePanel] Loaded ${criteriaArray.length} criteria`);
    }).catch((error) => {
      console.error('[CriteriaReferencePanel] Failed to load criteria data:', error);
    });
  }, []);
  
  const {
    searchResult,
    loadedOptions,
    loadingCriteria,
    errors,
    loadOptions,
    refreshOptions,
  } = useCriteriaReference(editorContext, allCriteria);
  
  // Determine current state
  const isEmpty = !editorContext;
  const hasNoMatches = searchResult && searchResult.matches.length === 0;
  const hasSingleMatch = searchResult && searchResult.matches.length === 1;
  const hasMultipleMatches = searchResult && searchResult.matches.length > 1;
  
  return (
    <div className="border-l bg-muted/30 flex-1 flex flex-col min-w-[280px] max-w-[400px] min-h-0">
      {/* Fixed Header */}
      <PanelHeader
        query={searchResult?.query}
        matchCount={searchResult?.matches.length}
      />

      {/* Scrollable Content */}
      <ScrollArea className="flex-1 min-h-0">
        {isEmpty && <EmptyState />}

        {hasNoMatches && (
          <NoMatchesState query={searchResult.query} />
        )}

        {hasSingleMatch && (
          <div className="p-4">
            <CriterionCard
              criterion={searchResult.matches[0].criterion}
              options={loadedOptions.get(searchResult.matches[0].criterion.id)}
              isLoading={loadingCriteria.has(searchResult.matches[0].criterion.id)}
              error={errors.get(searchResult.matches[0].criterion.id)}
              onLoadOptions={loadOptions}
              onRefreshOptions={refreshOptions}
            />
          </div>
        )}

        {hasMultipleMatches && (
          <MultiMatchView
            matches={searchResult.matches}
            loadedOptions={loadedOptions}
            loadingCriteria={loadingCriteria}
            errors={errors}
            onLoadOptions={loadOptions}
            onRefreshOptions={refreshOptions}
          />
        )}
      </ScrollArea>
    </div>
  );
}
