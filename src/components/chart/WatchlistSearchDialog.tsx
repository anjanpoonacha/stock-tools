'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Check, Plus, Loader2 } from 'lucide-react';
import type { UnifiedWatchlist } from '@/lib/watchlist-sync/types';
import type { Stock } from '@/types/stock';
import { getStoredCredentials } from '@/lib/auth/authUtils';
import { useToast } from '@/components/ui/toast';

interface WatchlistSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (watchlist: UnifiedWatchlist) => void;
  watchlists: UnifiedWatchlist[];
  currentWatchlist: UnifiedWatchlist | null;
  currentStock: Stock;
  refreshWatchlists: () => Promise<void>;
}

export function WatchlistSearchDialog({
  open,
  onClose,
  onSelect,
  watchlists,
  currentWatchlist,
  currentStock,
  refreshWatchlists,
}: WatchlistSearchDialogProps) {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const listItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Filter watchlists based on search query
  const filteredWatchlists = watchlists.filter((watchlist) =>
    watchlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset selection when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Auto-focus search input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
      setSearchQuery('');
      setSelectedIndex(0);
      setShowCreateInput(false);
      setNewWatchlistName('');
      setCreateError(null);
    }
  }, [open]);

  // Auto-focus create input when shown
  useEffect(() => {
    if (showCreateInput) {
      setTimeout(() => {
        createInputRef.current?.focus();
      }, 0);
    }
  }, [showCreateInput]);

  // Auto-scroll to highlighted item
  useEffect(() => {
    if (listItemRefs.current[selectedIndex]) {
      listItemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredWatchlists.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredWatchlists[selectedIndex]) {
          onSelect(filteredWatchlists[selectedIndex]);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Get platform badge text and variant
  const getPlatformBadge = (platforms: string[]) => {
    const hasMio = platforms.includes('mio');
    const hasTv = platforms.includes('tv');

    if (hasMio && hasTv) {
      return { text: 'TV + MIO', variant: 'default' as const };
    } else if (hasMio) {
      return { text: 'MIO only', variant: 'secondary' as const };
    } else if (hasTv) {
      return { text: 'TV only', variant: 'outline' as const };
    }
    return { text: 'Unknown', variant: 'secondary' as const };
  };

  // Validate watchlist name
  const validateWatchlistName = (name: string): string | null => {
    if (name.length < 3) {
      return 'Name must be at least 3 characters';
    }
    if (name.length > 30) {
      return 'Name must be at most 30 characters';
    }
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      return 'Only letters, numbers, and underscores allowed';
    }
    if (/\s/.test(name)) {
      return 'No spaces allowed';
    }
    return null;
  };

  // Handle create watchlist
  const handleCreateWatchlist = async () => {
    setCreateError(null);

    // Validate name
    const validationError = validateWatchlistName(newWatchlistName);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    // Add AUTO_ prefix
    const fullName = `AUTO_${newWatchlistName}`;

    try {
      setIsCreating(true);

      // Get credentials from localStorage
      const credentials = getStoredCredentials();
      
      if (!credentials) {
        setCreateError('Authentication required. Please log in first.');
        return;
      }

      const response = await fetch('/api/watchlist/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          userEmail: credentials.userEmail,
          userPassword: credentials.userPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        try {
          // 1. Show success toast
          toast(`Watchlist "${fullName}" created successfully!`, 'success');
          
          // 2. Re-fetch watchlists to include the new one
          await refreshWatchlists();
          
          // 3. Save the watchlist ID to localStorage
          const watchlistId = data.mioId || data.tvId;
          if (watchlistId) {
            localStorage.setItem('chart-current-watchlist', watchlistId);
          }
          
          // 4. Reset form and close dialog
          setNewWatchlistName('');
          setShowCreateInput(false);
          setCreateError(null);
          onClose();
          
        } catch (error) {
          console.error('Error after creating watchlist:', error);
          toast('Watchlist created but failed to refresh list', 'info');
          setCreateError('Created successfully but could not refresh. Please refresh page manually.');
        }
      } else {
        setCreateError(data.error || 'Failed to create watchlist');
      }
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Network error');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle create input key press
  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateWatchlist();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowCreateInput(false);
      setNewWatchlistName('');
      setCreateError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Watchlist</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Watchlist Display */}
          {currentWatchlist && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-3 border-b border-border">
              <span>Current:</span>
              <span className="font-medium text-foreground">
                {currentWatchlist.name}
              </span>
              <Badge variant={getPlatformBadge(currentWatchlist.platforms).variant} className="text-xs">
                {getPlatformBadge(currentWatchlist.platforms).text}
              </Badge>
            </div>
          )}

          {/* Search Input */}
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search watchlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full"
          />

          {/* Watchlist List */}
          <ScrollArea className="h-[300px] border border-border rounded-md">
            {filteredWatchlists.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {watchlists.length === 0
                  ? 'No watchlists available'
                  : 'No watchlists found'}
              </div>
            ) : (
              <div className="p-1">
                {filteredWatchlists.map((watchlist, index) => {
                  const isSelected = index === selectedIndex;
                  const isCurrent = currentWatchlist?.id === watchlist.id;
                  const badge = getPlatformBadge(watchlist.platforms);

                  return (
                    <div
                      key={watchlist.id}
                      ref={(el) => {
                        listItemRefs.current[index] = el;
                      }}
                      onClick={() => {
                        onSelect(watchlist);
                        onClose();
                      }}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer
                        transition-colors
                        ${
                          isSelected
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-muted'
                        }
                      `}
                    >
                      {/* Selection Indicator */}
                      <div className="w-4 flex-shrink-0">
                        {isSelected && (
                          <span className="text-foreground">→</span>
                        )}
                      </div>

                      {/* Current Indicator */}
                      <div className="w-4 flex-shrink-0">
                        {isCurrent && (
                          <Check className="w-4 h-4 text-foreground" />
                        )}
                      </div>

                      {/* Watchlist Name */}
                      <span className="flex-1 font-medium">
                        {watchlist.name}
                      </span>

                      {/* Platform Badge */}
                      <Badge variant={badge.variant} className="text-xs">
                        {badge.text}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Create New Watchlist Section */}
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
                    onKeyDown={handleCreateKeyDown}
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
                    onClick={handleCreateWatchlist}
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
                    onClick={() => {
                      setShowCreateInput(false);
                      setNewWatchlistName('');
                      setCreateError(null);
                    }}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  No spaces • 3-30 chars • Letters, numbers, underscore only
                </div>
              </div>
            )}
          </div>

          {/* Footer with instructions and stock info */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>↑↓ Navigate | Enter Select | ESC Close</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Adding: <span className="font-medium text-foreground">{currentStock.symbol}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
