'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Trash2 } from 'lucide-react';
import type { UnifiedWatchlist } from '@/lib/watchlist-sync/types';
import { isAutoWatchlist } from '@/lib/watchlist-sync/watchlistValidation';

interface WatchlistListItemProps {
  watchlist: UnifiedWatchlist;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: (watchlist: UnifiedWatchlist) => void;
  onDelete?: (watchlist: UnifiedWatchlist) => void;
}

/**
 * Get platform badge text and variant based on watchlist platforms
 */
export function getPlatformBadge(platforms: string[]) {
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
}

/**
 * Individual watchlist list item component
 * Displays watchlist name, platform badge, current indicator, and selection state
 */
export function WatchlistListItem({
  watchlist,
  isSelected,
  isCurrent,
  onSelect,
  onDelete,
}: WatchlistListItemProps) {
  const badge = getPlatformBadge(watchlist.platforms);

  return (
    <div
      onClick={() => onSelect(watchlist)}
      className={`
        group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer
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

      {/* Delete Button */}
      {onDelete && isAutoWatchlist(watchlist.name) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(watchlist);
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
