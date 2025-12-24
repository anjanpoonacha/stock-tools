'use client';

import { Button } from '@/components/ui/button';
import { RefreshCw, TableIcon, BarChart3 } from 'lucide-react';

interface ViewToggleProps {
  viewMode: 'table' | 'chart';
  loading: boolean;
  hasStocks: boolean;
  onRefresh: () => void;
  onSetViewMode: (mode: 'table' | 'chart') => void;
  onViewCharts: () => void;
}

export function ViewToggle({
  viewMode,
  loading,
  hasStocks,
  onRefresh,
  onSetViewMode,
  onViewCharts,
}: ViewToggleProps) {
  return (
    <div className='flex gap-1.5 flex-shrink-0'>
      <Button
        variant='outline'
        size='sm'
        onClick={onRefresh}
        disabled={loading}
        title='Reload stock data'
      >
        <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
      
      <Button
        variant={viewMode === 'table' ? 'default' : 'outline'}
        size='sm'
        onClick={() => onSetViewMode('table')}
        disabled={loading}
      >
        <TableIcon className='h-4 w-4 mr-1.5' />
        Table View
      </Button>
      
      <Button
        variant={viewMode === 'chart' ? 'default' : 'outline'}
        size='sm'
        onClick={onViewCharts}
        disabled={loading || !hasStocks}
      >
        <BarChart3 className='h-4 w-4 mr-1.5' />
        Chart View
      </Button>
    </div>
  );
}
