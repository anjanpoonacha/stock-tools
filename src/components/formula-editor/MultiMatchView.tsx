// src/components/formula-editor/MultiMatchView.tsx
// View displaying multiple matching criteria

import { Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import type { CriterionMatch, CriterionOption } from '@/types/mioCriteria';
import { CriterionCard } from './CriterionCard';

interface MultiMatchViewProps {
  matches: CriterionMatch[];
  loadedOptions: Map<string, CriterionOption[]>;
  loadingCriteria: Set<string>;
  errors: Map<string, string>;
  onLoadOptions: (criterionId: string) => void;
  onRefreshOptions: (criterionId: string) => void;
}

/**
 * View showing all matched criteria when multiple matches are found
 * 
 * Displays:
 * - Info alert explaining multiple matches
 * - List of all matching criteria cards
 * - Separators between cards
 * 
 * @param matches - Array of matched criteria
 * @param loadedOptions - Map of criterion ID to loaded options
 * @param loadingCriteria - Set of criterion IDs currently loading
 * @param errors - Map of criterion ID to error message
 * @param onLoadOptions - Callback to load options for a criterion
 * @param onRefreshOptions - Callback to refresh options for a criterion
 */
export function MultiMatchView({
  matches,
  loadedOptions,
  loadingCriteria,
  errors,
  onLoadOptions,
  onRefreshOptions,
}: MultiMatchViewProps) {
  return (
    <div className="p-4 space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Multiple matches found ({matches.length})</AlertTitle>
        <AlertDescription>
          Continue typing to narrow down, or browse all matches below.
        </AlertDescription>
      </Alert>
      
      <div className="space-y-3">
        {matches.map((match, index) => (
          <div key={match.criterion.id}>
            {index > 0 && <Separator className="my-3" />}
            <CriterionCard
              criterion={match.criterion}
              options={loadedOptions.get(match.criterion.id)}
              isLoading={loadingCriteria.has(match.criterion.id)}
              error={errors.get(match.criterion.id)}
              onLoadOptions={onLoadOptions}
              onRefreshOptions={onRefreshOptions}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
