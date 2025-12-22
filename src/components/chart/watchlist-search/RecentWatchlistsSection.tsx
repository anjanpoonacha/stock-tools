'use client';

import React from 'react';
import type { UnifiedWatchlist } from '@/lib/watchlist-sync/types';
import { WatchlistListItem } from '../WatchlistListItem';

interface RecentWatchlistsSectionProps {
  recentWatchlists: UnifiedWatchlist[];
  currentWatchlistId: string | null;
  selectedIndex: number;
  startIndex: number; // Offset in the global navigation array (always 0 for recent)
  listItemRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onSelect: (watchlist: UnifiedWatchlist) => void;
  onDelete?: (watchlist: UnifiedWatchlist) => void;
}

/**
 * Recent Watchlists Section Component
 * Displays recently selected watchlists at the top
 */
export function RecentWatchlistsSection({
  recentWatchlists,
  currentWatchlistId,
  selectedIndex,
  startIndex,
  listItemRefs,
  onSelect,
  onDelete,
}: RecentWatchlistsSectionProps) {
  if (recentWatchlists.length === 0) {
    return null;
  }

  return (
    <div className="mb-3">
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        Recent
      </div>
      {recentWatchlists.map((watchlist, index) => {
        const globalIndex = startIndex + index;
        const isSelected = globalIndex === selectedIndex;
        const isCurrent = currentWatchlistId === watchlist.id;
        return (
          <div 
            key={`recent-${watchlist.id}`}
            ref={(el) => {
              listItemRefs.current[globalIndex] = el;
            }}
          >
            <WatchlistListItem
              watchlist={watchlist}
              isSelected={isSelected}
              isCurrent={isCurrent}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          </div>
        );
      })}
      <div className="my-2 border-b border-border" />
    </div>
  );
}
