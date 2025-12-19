/**
 * ChartLoadingOverlay Component
 * Reusable loading overlay with TradingView-style subtle effect
 * Used across chart components for consistent loading UX
 */

'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ChartLoadingOverlayProps {
  message?: string;
  subtitle?: string;
}

/**
 * Loading overlay that appears on top of chart area
 * Features:
 * - Subtle background blur (TradingView style)
 * - Theme-compliant colors
 * - Preserves layout (no visual jump)
 */
export function ChartLoadingOverlay({
  message = 'Loading chart data...',
  subtitle
}: ChartLoadingOverlayProps) {
  return (
    <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg'>
      <div className='text-center space-y-3'>
        <Loader2 className='h-8 w-8 animate-spin mx-auto text-primary' />
        <p className='text-sm text-muted-foreground'>{message}</p>
        {subtitle && <p className='text-xs text-muted-foreground/70'>{subtitle}</p>}
      </div>
    </div>
  );
}
