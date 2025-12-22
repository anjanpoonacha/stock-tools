'use client';

import React from 'react';
import type { Stock } from '@/types/stock';

interface SearchFooterProps {
  currentStock: Stock;
}

/**
 * Search Footer Component
 * Displays keyboard shortcuts and current stock info
 */
export function SearchFooter({ currentStock }: SearchFooterProps) {
  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>↑↓ Navigate | Enter Select | ESC Close</span>
      </div>
      <div className="text-sm text-muted-foreground">
        Adding: <span className="font-medium text-foreground">{currentStock.symbol}</span>
      </div>
    </div>
  );
}
