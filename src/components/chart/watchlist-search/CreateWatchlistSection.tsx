'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2 } from 'lucide-react';
import { validateWatchlistName, addAutoPrefix, WATCHLIST_NAME_RULES } from '@/lib/watchlist-sync/watchlistValidation';

interface CreateWatchlistSectionProps {
  isCreating: boolean;
  onCreateWatchlist: (fullName: string) => Promise<void>;
}

/**
 * Create Watchlist Section Component
 * Handles new watchlist creation with validation
 */
export function CreateWatchlistSection({
  isCreating,
  onCreateWatchlist,
}: CreateWatchlistSectionProps) {
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus create input when shown
  useEffect(() => {
    if (showCreateInput) {
      setTimeout(() => {
        createInputRef.current?.focus();
      }, 0);
    }
  }, [showCreateInput]);

  const handleCreate = async () => {
    setCreateError(null);

    // Validate name
    const validationError = validateWatchlistName(newWatchlistName);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    // Add AUTO_ prefix
    const fullName = addAutoPrefix(newWatchlistName);

    try {
      await onCreateWatchlist(fullName);
      
      // Reset form on success
      setNewWatchlistName('');
      setShowCreateInput(false);
      setCreateError(null);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create watchlist');
    }
  };

  const handleCancel = () => {
    setShowCreateInput(false);
    setNewWatchlistName('');
    setCreateError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className="pt-3 border-t border-border">
      {!showCreateInput ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowCreateInput(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Watchlist
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">AUTO_</span>
            <Input
              ref={createInputRef}
              type="text"
              placeholder="WatchlistName"
              value={newWatchlistName}
              onChange={(e) => {
                setNewWatchlistName(e.target.value);
                setCreateError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              className="flex-1"
            />
          </div>
          {createError && (
            <div className="text-xs text-destructive">{createError}</div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isCreating || !newWatchlistName}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {WATCHLIST_NAME_RULES}
          </div>
        </div>
      )}
    </div>
  );
}
