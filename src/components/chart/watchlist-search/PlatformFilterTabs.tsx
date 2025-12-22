'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PlatformFilter } from '@/lib/storage/watchlistStorage';

interface PlatformFilterTabsProps {
  value: PlatformFilter;
  onChange: (filter: PlatformFilter) => void;
}

/**
 * Platform Filter Tabs Component
 * Allows filtering watchlists by platform (All, TV+MIO, MIO, TV)
 */
export function PlatformFilterTabs({ value, onChange }: PlatformFilterTabsProps) {
  const handleChange = (newValue: string) => {
    onChange(newValue as PlatformFilter);
  };

  return (
    <Tabs value={value} onValueChange={handleChange}>
      <TabsList className="w-full">
        <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
        <TabsTrigger value="both" className="flex-1">TV+MIO</TabsTrigger>
        <TabsTrigger value="mio" className="flex-1">MIO</TabsTrigger>
        <TabsTrigger value="tv" className="flex-1">TV</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
