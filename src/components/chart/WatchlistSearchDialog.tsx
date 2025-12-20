'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check } from 'lucide-react';
import type { UnifiedWatchlist } from '@/lib/watchlist-sync/types';
import type { Stock } from '@/types/stock';

interface WatchlistSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (watchlist: UnifiedWatchlist) => void;
  watchlists: UnifiedWatchlist[];
  currentWatchlist: UnifiedWatchlist | null;
  currentStock: Stock;
}

export function WatchlistSearchDialog({
  open,
  onClose,
  onSelect,
  watchlists,
  currentWatchlist,
  currentStock,
}: WatchlistSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    }
  }, [open]);

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
