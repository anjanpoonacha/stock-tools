'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { UnifiedWatchlist } from '@/lib/watchlist-sync/types';
import type { Stock } from '@/types/stock';
import { getStoredCredentials } from '@/lib/auth/authUtils';
import { useToast } from '@/components/ui/toast';
import { WatchlistListItem, getPlatformBadge } from './WatchlistListItem';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { PlatformFilterTabs } from './watchlist-search/PlatformFilterTabs';
import { RecentWatchlistsSection } from './watchlist-search/RecentWatchlistsSection';
import { CreateWatchlistSection } from './watchlist-search/CreateWatchlistSection';
import { SearchFooter } from './watchlist-search/SearchFooter';
import { WatchlistStorage, MAX_RECENT_WATCHLISTS } from '@/lib/storage/watchlistStorage';
import type { PlatformFilter } from '@/lib/storage/watchlistStorage';
import { filterByPlatform, filterBySearchQuery, getRecentWatchlists } from '@/lib/watchlist-sync/watchlistFilters';

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
  const [isCreating, setIsCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [watchlistToDelete, setWatchlistToDelete] = useState<UnifiedWatchlist | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [platformFilter, setPlatformFilterState] = useState<PlatformFilter>(
    WatchlistStorage.getPlatformFilter()
  );
  const [recentWatchlistIds, setRecentWatchlistIds] = useState<string[]>(
    WatchlistStorage.getRecentWatchlistIds()
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Filter watchlists based on platform and search query
  const platformFilteredWatchlists = filterByPlatform(watchlists, platformFilter);
  const filteredWatchlists = filterBySearchQuery(platformFilteredWatchlists, searchQuery);

  // Get recent watchlists
  const recentWatchlists = getRecentWatchlists(
    watchlists,
    recentWatchlistIds,
    MAX_RECENT_WATCHLISTS
  );

  // Create combined navigation array for keyboard navigation
  // When searching: only filtered results
  // When not searching: recent + filtered (excluding duplicates from filtered)
  const navigableWatchlists = useMemo(() => {
    if (searchQuery) {
      // When searching, only show filtered results (no recent section)
      return filteredWatchlists;
    }
    
    // When not searching, combine recent + filtered (excluding duplicates)
    const recentIds = new Set(recentWatchlists.map(w => w.id));
    const nonRecentFiltered = filteredWatchlists.filter(w => !recentIds.has(w.id));
    return [...recentWatchlists, ...nonRecentFiltered];
  }, [searchQuery, recentWatchlists, filteredWatchlists]);

  // Track how many items are in the recent section (for index calculations)
  const recentCount = searchQuery ? 0 : recentWatchlists.length;

  // Handle platform filter change
  const handlePlatformFilterChange = (filter: PlatformFilter) => {
    setPlatformFilterState(filter);
    WatchlistStorage.setPlatformFilter(filter);
    setSelectedIndex(0);
  };

  // Handle watchlist selection
  const handleWatchlistSelect = (watchlist: UnifiedWatchlist) => {
    WatchlistStorage.addToRecentWatchlists(watchlist.id);
    setRecentWatchlistIds(WatchlistStorage.getRecentWatchlistIds());
    onSelect(watchlist);
    onClose();
  };

  // Reset selection when search query or filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, platformFilter]);

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
          prev < navigableWatchlists.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (navigableWatchlists[selectedIndex]) {
          handleWatchlistSelect(navigableWatchlists[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Handle create watchlist
  const handleCreateWatchlist = async (fullName: string) => {
    try {
      setIsCreating(true);

      // Get credentials from localStorage
      const credentials = getStoredCredentials();
      
      if (!credentials) {
        throw new Error('Authentication required. Please log in first.');
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
          
          // 3. Find the newly created watchlist by name and save its unified ID
          // IMPORTANT: Use the unified ID from the watchlist array, not the raw platform ID
          // This ensures consistency with the stable ID format (mio-{id}, tv-{id}, or unified-{mioId}-{tvId})
          setTimeout(() => {
            const newWatchlist = watchlists.find(w => w.name === fullName);
            if (newWatchlist) {
              WatchlistStorage.setCurrentWatchlistId(newWatchlist.id);
              onSelect(newWatchlist);
            }
          }, 100); // Small delay to ensure watchlists array is updated
          
          // 4. Close dialog
          // onClose(); // Commented out to allow user to add stocks immediately after creation
          
        } catch (error) {
          console.error('Error after creating watchlist:', error);
          toast('Watchlist created but failed to refresh list', 'info');
          throw new Error('Created successfully but could not refresh. Please refresh page manually.');
        }
      } else {
        throw new Error(data.error || 'Failed to create watchlist');
      }
    } catch (error) {
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  // Handle delete watchlist
  const handleDeleteWatchlist = async () => {
    if (!watchlistToDelete) return;
    
    setIsDeleting(true);
    
    try {
      // Get credentials
      const credentials = getStoredCredentials();
      if (!credentials) {
        toast('Authentication required. Please log in first.', 'error');
        setIsDeleting(false);
        return;
      }

      // Parallel deletion from both platforms
      const results = await Promise.allSettled([
        // MIO deletion
        fetch('/api/mio-action', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deleteIds: [watchlistToDelete.mioId],
            userEmail: credentials.userEmail,
            userPassword: credentials.userPassword,
          }),
        }).then(r => r.json()),
        
        // TV deletion
        fetch('/api/watchlist/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            watchlistId: watchlistToDelete.tvId,
            userEmail: credentials.userEmail,
            userPassword: credentials.userPassword,
          }),
        }).then(r => r.json()),
      ]);

      // Check results
      const mioSuccess = results[0].status === 'fulfilled' && results[0].value?.success;
      const tvSuccess = results[1].status === 'fulfilled' && results[1].value?.success;
      
      if (mioSuccess && tvSuccess) {
        // Full success
        toast(`Watchlist "${watchlistToDelete.name}" deleted from both platforms!`, 'success');
        await refreshWatchlists();
        setDeleteDialogOpen(false);
        setWatchlistToDelete(null);
      } else if (mioSuccess || tvSuccess) {
        // Partial success
        const platform = mioSuccess ? 'TradingView' : 'MarketInOut';
        toast(`Deleted from ${mioSuccess ? 'MarketInOut' : 'TradingView'} only. Failed on ${platform}.`, 'info');
        await refreshWatchlists();
        setDeleteDialogOpen(false);
        setWatchlistToDelete(null);
      } else {
        // Complete failure
        const mioError = results[0].status === 'rejected' ? results[0].reason : 'Unknown error';
        const tvError = results[1].status === 'rejected' ? results[1].reason : 'Unknown error';
        toast(`Failed to delete from both platforms. MIO: ${mioError}, TV: ${tvError}`, 'error');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to delete watchlist', 'error');
    } finally {
      setIsDeleting(false);
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

          {/* Platform Filter */}
          <PlatformFilterTabs
            value={platformFilter}
            onChange={handlePlatformFilterChange}
          />

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
            {filteredWatchlists.length === 0 && recentWatchlists.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {watchlists.length === 0
                  ? 'No watchlists available'
                  : 'No watchlists found'}
              </div>
            ) : (
              <div className="p-1">
                {/* Recent Watchlists Section */}
                {!searchQuery && (
                  <RecentWatchlistsSection
                    recentWatchlists={recentWatchlists}
                    currentWatchlistId={currentWatchlist?.id || null}
                    selectedIndex={selectedIndex}
                    startIndex={0}
                    listItemRefs={listItemRefs}
                    onSelect={handleWatchlistSelect}
                    onDelete={(wl) => {
                      setWatchlistToDelete(wl);
                      setDeleteDialogOpen(true);
                    }}
                  />
                )}

                {/* All Watchlists Section */}
                {filteredWatchlists.length > 0 ? (
                  <>
                    {recentWatchlists.length > 0 && !searchQuery && (
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        All Watchlists
                      </div>
                    )}
                    {filteredWatchlists.map((watchlist, index) => {
                      // Skip if already shown in recent section (when not searching)
                      if (!searchQuery && recentWatchlists.some(rw => rw.id === watchlist.id)) {
                        return null;
                      }

                      // Calculate global index: when searching, use direct index; otherwise, offset by recent count
                      const globalIndex = searchQuery ? index : recentCount + filteredWatchlists.filter((w, i) => {
                        // Count how many non-duplicate items appear before this one
                        return i < index && !recentWatchlists.some(rw => rw.id === w.id);
                      }).length;
                      
                      const isSelected = globalIndex === selectedIndex;
                      const isCurrent = currentWatchlist?.id === watchlist.id;

                      return (
                        <div
                          key={watchlist.id}
                          ref={(el) => {
                            listItemRefs.current[globalIndex] = el;
                          }}
                        >
                          <WatchlistListItem
                            watchlist={watchlist}
                            isSelected={isSelected}
                            isCurrent={isCurrent}
                            onSelect={handleWatchlistSelect}
                            onDelete={(wl) => {
                              setWatchlistToDelete(wl);
                              setDeleteDialogOpen(true);
                            }}
                          />
                        </div>
                      );
                    })}
                  </>
                ) : (
                  !searchQuery && recentWatchlists.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      No watchlists found
                    </div>
                  )
                )}
              </div>
            )}
          </ScrollArea>

          {/* Create New Watchlist Section */}
          <CreateWatchlistSection
            isCreating={isCreating}
            onCreateWatchlist={handleCreateWatchlist}
          />

          {/* Footer with instructions and stock info */}
          <SearchFooter currentStock={currentStock} />
        </div>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteWatchlist}
          title="Delete Watchlist"
          description={`Are you sure you want to delete "${watchlistToDelete?.name}"? This will remove it from both TradingView and MarketInOut.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          loading={isDeleting}
        />
      </DialogContent>
    </Dialog>
  );
}
