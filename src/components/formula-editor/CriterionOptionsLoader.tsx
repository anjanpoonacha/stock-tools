// src/components/formula-editor/CriterionOptionsLoader.tsx
// Click-to-load interface for enum criterion options

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, Loader2, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { CriterionOption } from '@/types/mioCriteria';

interface CriterionOptionsLoaderProps {
  criterionId: string;
  options?: CriterionOption[];
  isLoading?: boolean;
  error?: string;
  onLoad?: (criterionId: string) => void;
  onRefresh?: (criterionId: string) => void;
}

/**
 * Click-to-load interface for enum criterion options
 * 
 * States:
 * 1. Initial: Shows "Load Values" button
 * 2. Loading: Shows spinner and "Loading..." text
 * 3. Success: Shows scrollable list of options
 * 4. Error: Shows error message with retry button
 * 
 * @param criterionId - The criterion ID
 * @param options - Loaded options (undefined = not loaded yet)
 * @param isLoading - Whether options are currently loading
 * @param error - Error message if loading failed
 * @param onLoad - Callback to load options
 * @param onRefresh - Callback to refresh options
 */
export function CriterionOptionsLoader({
  criterionId,
  options,
  isLoading,
  error,
  onLoad,
  onRefresh,
}: CriterionOptionsLoaderProps) {
  // Local state for search and copy feedback
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!options) return [];
    if (!searchQuery.trim()) return options;
    
    const query = searchQuery.toLowerCase();
    return options.filter(opt => 
      opt.name.toLowerCase().includes(query) ||
      opt.title?.toLowerCase().includes(query) ||
      opt.localId.includes(query)
    );
  }, [options, searchQuery]);
  
  // Copy option localId to clipboard
  const handleCopyOption = useCallback(async (option: CriterionOption) => {
    try {
      await navigator.clipboard.writeText(option.localId);
      setCopiedId(option.optionId);
      // Reset after 2 seconds
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      // Failed to copy to clipboard
    }
  }, []);
  
  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load options</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{error}</p>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onRefresh?.(criterionId)}
            className="mt-2"
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Initial state - not loaded yet
  if (!options) {
    return (
      <Button 
        onClick={() => onLoad?.(criterionId)}
        disabled={isLoading}
        className="w-full"
        variant="outline"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-2" />
            Load Available Values
          </>
        )}
      </Button>
    );
  }
  
  // Success state - options loaded
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Values ({options.length}):</p>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => onRefresh?.(criterionId)}
          disabled={isLoading}
          title="Refresh options"
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
        </Button>
      </div>
      
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No options available for this criterion.
        </p>
      ) : (
        <>
          {/* Search Input */}
          <div className="space-y-1">
            <Input 
              placeholder="Search options..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm"
            />
            {searchQuery && (
              <p className="text-xs text-muted-foreground">
                Showing {filteredOptions.length} of {options.length} options
              </p>
            )}
          </div>
          
          {/* Options List */}
          <ScrollArea className="h-64 rounded-md border p-2">
            <div className="space-y-1">
              {filteredOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No options match &quot;{searchQuery}&quot;
                </p>
              ) : (
                filteredOptions.map(option => {
                  const isCopied = copiedId === option.optionId;
                  return (
                    <button
                      key={option.optionId}
                      onClick={() => handleCopyOption(option)}
                      className="w-full px-3 py-2 text-sm rounded hover:bg-accent transition-colors text-left flex items-center justify-between group"
                      title={`Click to copy: ${option.localId} (${option.title || option.name})`}
                    >
                      <span className="truncate">• {option.name}</span>
                      {isCopied ? (
                        <Check className="h-3 w-3 text-green-600 flex-shrink-0 ml-2" />
                      ) : (
                        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
