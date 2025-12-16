// src/components/formula-editor/ParameterInfo.tsx
// Component displaying parameter information for oscillators and moving averages

import { Badge } from '@/components/ui/badge';
import type { CriterionMetadata } from '@/types/mioCriteria';

interface ParameterInfoProps {
  criterion: CriterionMetadata;
}

/**
 * Display parameter details for oscillators and moving averages
 * 
 * Shows:
 * - Number of parameters
 * - Default parameter values
 * - Valid range (min/max)
 * - Usage syntax example
 * 
 * @param criterion - The criterion metadata
 */
export function ParameterInfo({ criterion }: ParameterInfoProps) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Parameters:</span>
        <Badge variant="secondary">{criterion.paramCount}</Badge>
      </div>
      
      {criterion.defaultParams && (
        <div>
          <span className="text-muted-foreground">Default:</span>{' '}
          <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
            {criterion.defaultParams}
          </code>
        </div>
      )}
      
      {(criterion.minValue || criterion.maxValue) && (
        <div>
          <span className="text-muted-foreground">Range:</span>{' '}
          <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
            {criterion.minValue || '∞'} to {criterion.maxValue || '∞'}
          </code>
        </div>
      )}
      
      <div className="text-muted-foreground">
        <span>Syntax:</span>{' '}
        <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
          {criterion.name}({criterion.defaultParams || '...'})
        </code>
      </div>
    </div>
  );
}
