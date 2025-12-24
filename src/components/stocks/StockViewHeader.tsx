'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';

interface StockViewHeaderProps {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  onBack: () => void;
  actions?: ReactNode;
}

export function StockViewHeader({
  title,
  subtitle,
  badges,
  onBack,
  actions,
}: StockViewHeaderProps) {
  return (
    <div className='flex-shrink-0 px-4 py-2 border-b border-border'>
      <div className='flex items-center justify-between gap-4'>
        <div className='flex items-baseline gap-3 flex-1 min-w-0'>
          <Button 
            variant='ghost' 
            size='sm' 
            onClick={onBack}
            className='flex-shrink-0'
          >
            <ArrowLeft className='h-4 w-4 mr-1.5' />
            Back
          </Button>
          
          <h2 className='text-xl font-bold tracking-tight truncate'>
            {title}
          </h2>
          
          {badges && (
            <div className='flex items-center gap-2 flex-shrink-0'>
              {badges}
            </div>
          )}
          
          {subtitle && (
            <p className='text-sm text-muted-foreground truncate'>
              {subtitle}
            </p>
          )}
        </div>
        
        {actions && (
          <div className='flex-shrink-0'>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
