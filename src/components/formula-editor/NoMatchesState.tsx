// src/components/formula-editor/NoMatchesState.tsx
// No matches state for criteria search

import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface NoMatchesStateProps {
  query: string;
}

/**
 * State shown when search returns no matching criteria
 * 
 * Provides helpful suggestions for common criterion types
 * to guide users toward valid inputs.
 * 
 * @param query - The search query that returned no matches
 */
export function NoMatchesState({ query }: NoMatchesStateProps) {
  return (
    <div className="p-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No matches found</AlertTitle>
        <AlertDescription>
          No criteria found for <span className="break-all">&quot;{query}&quot;</span>.
          
          <div className="mt-4 space-y-2">
            <p className="font-semibold text-sm">Common criteria:</p>
            <div className="space-y-1.5 text-xs">
              <div><strong>Universe:</strong> sector, industry, exchange</div>
              <div><strong>Price/Vol:</strong> price, volume, marketcap</div>
              <div><strong>Indicators:</strong> rsi, macd, sma, ema</div>
              <div><strong>Fundamentals:</strong> eps, pe, revenue</div>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
