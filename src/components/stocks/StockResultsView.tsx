'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Stock } from '@/types/stock';
import ResultsTable from '@/components/formula/ResultsTable';
import ChartView from '@/components/formula/ChartView';
import { ChartLoadingOverlay } from '@/components/ui/chart-loading-overlay';
import { ViewToggle } from './ViewToggle';
import { StockViewHeader } from './StockViewHeader';
import { useViewSettings, useChartIndex } from '@/hooks/useChartSettings';
import { filterAndSortStocks, type SortField, type SortOrder } from '@/lib/utils/stockOrdering';

interface StockResultsViewProps {
  stocks: Stock[];
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onBack: () => void;
  entityId: string; // formulaId or watchlistId for chart index storage
  entityType: 'formula' | 'watchlist';
}

export function StockResultsView({
  stocks,
  title,
  subtitle,
  badges,
  loading,
  error,
  onRefresh,
  onBack,
  entityId,
  entityType,
}: StockResultsViewProps) {
  const searchParams = useSearchParams();
  
  // View mode state
  const { viewMode, setViewMode } = useViewSettings();
  
  // Chart index state (per entity)
  const { currentIndex: currentStockIndex, setCurrentIndex: setCurrentStockIndex } = useChartIndex(entityId);
  
  // Custom symbol state for jumping to arbitrary symbols
  const [customSymbol, setCustomSymbol] = useState<string | null>(null);
  
  // Filters from URL
  const sectorFilter = searchParams.get('sector') || 'all';
  const industryFilter = searchParams.get('industry') || 'all';
  const sortBy = (searchParams.get('sortBy') as SortField) || 'symbol';
  const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'asc';
  
  // Filter and sort stocks
  const filteredAndSortedStocks = useMemo(() => {
    return filterAndSortStocks(stocks, {
      sortField: sortBy,
      sortOrder,
      sectorFilter,
      industryFilter,
    });
  }, [stocks, sortBy, sortOrder, sectorFilter, industryFilter]);
  
  // Stock symbols including custom symbol
  const stockSymbols = useMemo(() => {
    const baseSymbols = filteredAndSortedStocks.map(s => s.symbol);
    if (customSymbol && !baseSymbols.includes(customSymbol)) {
      return [...baseSymbols, customSymbol];
    }
    return baseSymbols;
  }, [filteredAndSortedStocks, customSymbol]);
  
  // Display stocks including custom stock
  const displayStocks = useMemo(() => {
    if (customSymbol && !filteredAndSortedStocks.find(s => s.symbol === customSymbol)) {
      const customStock: Stock = {
        symbol: customSymbol,
        name: customSymbol,
        sector: 'Custom',
        industry: 'Custom Symbol',
      };
      return [...filteredAndSortedStocks, customStock];
    }
    return filteredAndSortedStocks;
  }, [filteredAndSortedStocks, customSymbol]);
  
  // Reset chart index when filters change
  useEffect(() => {
    setCurrentStockIndex(0);
  }, [sectorFilter, industryFilter, setCurrentStockIndex]);
  
  // Validate chart index bounds when stocks change
  useEffect(() => {
    if (currentStockIndex >= stockSymbols.length && stockSymbols.length > 0) {
      setCurrentStockIndex(Math.max(0, stockSymbols.length - 1));
    }
  }, [stockSymbols, currentStockIndex, setCurrentStockIndex]);
  
  // Handlers
  const handleViewCharts = () => {
    if (filteredAndSortedStocks.length === 0) {
      alert('No stocks to view. Try adjusting your filters.');
      return;
    }
    setCurrentStockIndex(0);
    setViewMode('chart');
  };
  
  const handleBackToTable = () => {
    setViewMode('table');
  };
  
  const handleSymbolJump = (symbol: string) => {
    setCustomSymbol(symbol);
    const newIndex = displayStocks.length;
    setCurrentStockIndex(newIndex);
  };
  
  return (
    <div className='h-full flex flex-col overflow-hidden'>
      {/* Header */}
      <StockViewHeader
        title={title}
        subtitle={subtitle}
        badges={badges}
        onBack={onBack}
        actions={
          <ViewToggle
            viewMode={viewMode}
            loading={loading}
            hasStocks={displayStocks.length > 0}
            onRefresh={onRefresh}
            onSetViewMode={setViewMode}
            onViewCharts={handleViewCharts}
          />
        }
      />
      
      {/* Content */}
      <div className='flex-1 min-h-0 relative'>
        {loading && <ChartLoadingOverlay message={`Loading ${entityType} stocks...`} />}
        
        {!loading && error && (
          <div className='flex items-center justify-center h-full'>
            <div className='text-center text-muted-foreground'>
              <p className='text-lg font-medium'>Error loading stocks</p>
              <p className='text-sm'>{error}</p>
            </div>
          </div>
        )}
        
        {!loading && !error && (
          <>
            {viewMode === 'table' ? (
              <ResultsTable
                stocks={stocks}
                onViewCharts={handleViewCharts}
              />
            ) : (
              <ChartView
                stocks={displayStocks}
                stockSymbols={stockSymbols}
                currentIndex={currentStockIndex}
                setCurrentIndex={setCurrentStockIndex}
                onBackToTable={handleBackToTable}
                onSymbolJump={handleSymbolJump}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
