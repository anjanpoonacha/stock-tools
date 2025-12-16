// src/components/formula-editor/PanelHeader.tsx
// Header component for criteria reference panel

import { Badge } from '@/components/ui/badge';

interface PanelHeaderProps {
  query?: string;
  matchCount?: number;
}

/**
 * Panel header showing current search state
 * 
 * Displays:
 * - Panel title
 * - Current search query (if any)
 * - Number of matches found
 * 
 * @param query - Current search query
 * @param matchCount - Number of matches found
 */
export function PanelHeader({ query, matchCount }: PanelHeaderProps) {
  return (
    <div className="border-b px-4 py-3 bg-background">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm truncate">Criteria Reference</h3>
        {query && matchCount !== undefined && (
          <Badge variant="outline" className="shrink-0">
            {matchCount} {matchCount === 1 ? 'match' : 'matches'}
          </Badge>
        )}
      </div>
      {query && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          Searching for: <span className="font-mono break-all">{query}</span>
        </p>
      )}
    </div>
  );
}
