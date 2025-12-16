// src/components/formula-editor/CriterionCard.tsx
// Card component displaying details for a single criterion

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { CriterionMetadata, CriterionOption, CriterionType } from '@/types/mioCriteria';
import { CriterionOptionsLoader } from './CriterionOptionsLoader';
import { ParameterInfo } from './ParameterInfo';

interface CriterionCardProps {
  criterion: CriterionMetadata;
  options?: CriterionOption[];
  isLoading?: boolean;
  error?: string;
  onLoadOptions?: (criterionId: string) => void;
  onRefreshOptions?: (criterionId: string) => void;
  compact?: boolean;  // For multi-match view
}

/**
 * Card displaying comprehensive details for a criterion
 * 
 * Shows:
 * - Criterion name and ID
 * - Type badge (colored by type)
 * - Description/title
 * - Type-specific information:
 *   - Enum: Options loader
 *   - Oscillator/MA: Parameter information
 *   - Scalar: Range information
 * 
 * @param criterion - The criterion metadata
 * @param options - Loaded options (for enum types)
 * @param isLoading - Loading state
 * @param error - Error message
 * @param onLoadOptions - Callback to load options
 * @param onRefreshOptions - Callback to refresh options
 * @param compact - Use compact styling (for multi-match view)
 */
export function CriterionCard({
  criterion,
  options,
  isLoading,
  error,
  onLoadOptions,
  onRefreshOptions,
  compact = false,
}: CriterionCardProps) {
  return (
    <Card className={compact ? '' : 'border-0 shadow-none'}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{criterion.name}</CardTitle>
            <p className="text-sm text-muted-foreground">({criterion.id})</p>
          </div>
          <Badge variant={getTypeBadgeVariant(criterion.type)}>
            {getTypeLabel(criterion.type)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Description */}
        {criterion.title && (
          <p className="text-sm">{criterion.title}</p>
        )}
        
        {/* Type-specific info */}
        {criterion.type === 'enum' && (
          <CriterionOptionsLoader
            criterionId={criterion.id}
            options={options}
            isLoading={isLoading}
            error={error}
            onLoad={onLoadOptions}
            onRefresh={onRefreshOptions}
          />
        )}
        
        {['osc', 'ma'].includes(criterion.type) && (
          <ParameterInfo criterion={criterion} />
        )}
        
        {criterion.type === 'scalar' && (
          <ScalarInfo criterion={criterion} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Display information for scalar (numeric range) criteria
 */
function ScalarInfo({ criterion }: { criterion: CriterionMetadata }) {
  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="font-semibold">Type:</span>{' '}
        <span className="text-muted-foreground">Numeric Range</span>
      </div>
      
      {(criterion.minValue || criterion.maxValue) && (
        <div>
          <span className="font-semibold">Valid Range:</span>{' '}
          <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
            {criterion.minValue || '∞'} to {criterion.maxValue || '∞'}
          </code>
        </div>
      )}
      
      <div className="text-muted-foreground">
        <span>Usage:</span>{' '}
        <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
          {criterion.name} &gt; value
        </code>
      </div>
    </div>
  );
}

/**
 * Get badge variant based on criterion type
 */
function getTypeBadgeVariant(type: CriterionType): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (type) {
    case 'enum':
      return 'default';
    case 'osc':
    case 'ma':
      return 'secondary';
    case 'scalar':
      return 'outline';
    default:
      return 'outline';
  }
}

/**
 * Get human-readable label for criterion type
 */
function getTypeLabel(type: CriterionType): string {
  const labels: Record<CriterionType, string> = {
    enum: 'Enumeration',
    scalar: 'Range',
    osc: 'Oscillator',
    ma: 'Moving Average',
    price: 'Price',
    series: 'Series',
    event: 'Event',
  };
  return labels[type] || type;
}
