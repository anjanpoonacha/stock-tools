# 🎯 Production-Ready Implementation Plan
## MIO TV Scripts - Performance & Code Quality Overhaul

**Created**: December 19, 2025  
**Status**: Ready for Implementation  
**Estimated Timeline**: 1.5-2 weeks with 3-4 agents working in parallel

---

## 📊 Executive Summary

### Scope
6 major workstreams executed in parallel by multiple agents focusing on:
- Performance optimization
- Code deduplication  
- Security improvements
- Logging cleanup
- TypeScript improvements
- Navigation reorganization

### Key Metrics
- **647 console statements** → Structured logging system
- **0 React.memo usage** → 15+ components memoized
- **899-line ChartView** → Split into 5 components (~150-200 lines each)
- **582-line TradingViewLiveChart** → Split into 4 components
- **7 `any` types** → Replace with proper TypeScript
- **18 instances of duplicated key generation** → Centralize to 1 utility
- **26 API routes** → Add consistent error handling + rate limiting

### Exclusions
- ❌ Testing (as requested)
- ❌ Extension files in `mio-session-extractor/` (skip logging cleanup here)

---

## 🎨 Parallel Workstreams Overview

```
┌─────────────────────────────────────────────────────────┐
│  WORKSTREAM 1: Navigation Reorganization (Agent 1)     │
│  Effort: 2 hours | Files: 2 | Priority: HIGH           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  WORKSTREAM 2: Component Splitting (Agent 2)           │
│  Effort: 4-5 days | Files: 2 → 9 | Priority: HIGH      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  WORKSTREAM 3: Performance Optimization (Agent 3)      │
│  Effort: 3-4 days | Files: 15+ | Priority: HIGH        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  WORKSTREAM 4: Code Deduplication (Agent 4)            │
│  Effort: 2-3 days | Files: 30+ | Priority: CRITICAL    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  WORKSTREAM 5: Logging & Security (Agent 5)            │
│  Effort: 3-4 days | Files: 80+ | Priority: CRITICAL    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  WORKSTREAM 6: TypeScript Improvements (Agent 6)       │
│  Effort: 1-2 days | Files: 7 | Priority: MEDIUM        │
└─────────────────────────────────────────────────────────┘
```

---

# 📋 WORKSTREAM 1: Navigation Reorganization

**Agent Assignment**: Agent 1 (UI/Frontend specialist)  
**Duration**: 2 hours  
**Dependencies**: None (can start immediately)  
**Priority**: HIGH

## Objective
Reorganize navigation to prioritize MIO Formula Manager as the #1 tool with visual emphasis.

## Current vs. Proposed Order

### Current Order
1. Symbol Converter (home page)
2. Screener → TV
3. TV → MIO
4. TradingView Charts
5. Manage MIO Lists
6. **MIO Formula Manager** ← This needs to be #1
7. User Authentication
8. System Analyzer
9. CSV → TradingView

### Proposed New Order
1. **MIO Formula Manager** (Most powerful tool - moved to top)
2. TradingView Charts (High value for analysis)
3. System Analyzer (Trading performance metrics)
4. Screener → TV (Sync functionality)
5. TV → MIO (Sync functionality)
6. Manage MIO Lists (List management)
7. Symbol Converter (Utility)
8. CSV → TradingView (Utility)
9. User Authentication (Settings/Profile)

## Implementation Tasks

### Task 1.1: Update Tools Configuration
**File**: `src/components/dashboard/DashboardLayout.tsx` (lines 20-127)

**Changes Required**:
```typescript
// Reorder TOOLS array - Move MIO Formula Manager to position 1
const TOOLS: Tool[] = [
    // POSITION 1: MIO Formula Manager (MOST IMPORTANT)
    {
        id: 'mioformulas',
        title: 'MIO Formula Manager',
        description: 'Extract and manage stock screener formulas from MarketInOut',
        href: '/mio-formulas',
        icon: 'FileCode' as const,
        category: 'Core Tools',  // Changed from 'Management'
        featured: true,
        keywords: ['formula', 'screener', 'mio', 'marketinout', 'api', 'primary'],
        primary: true,  // NEW: Add primary flag
    },
    // POSITION 2: TradingView Charts
    {
        id: 'chart',
        title: 'TradingView Charts',
        description: 'View and analyze NSE stocks with interactive charts',
        href: '/chart',
        icon: 'TrendingUp' as const,
        category: 'Core Tools',
        featured: true,
        keywords: ['chart', 'tradingview', 'analysis', 'nse', 'stocks'],
    },
    // ... rest of tools in new order
];
```

### Task 1.2: Update Tool Type Interface
**File**: `src/components/dashboard/DesktopSidebar.tsx` (line 49-58)

```typescript
interface Tool {
    id: string;
    title: string;
    description: string;
    href: string;
    icon: keyof typeof iconMap;
    category: string;
    featured?: boolean;
    primary?: boolean;  // NEW: Flag for most important tool
    keywords: string[];
}
```

### Task 1.3: Add Visual Emphasis
**File**: `src/components/dashboard/DesktopSidebar.tsx` (line 201-231)

Add visual indicators for primary tool:
- Ring border: `ring-1 ring-primary/30 bg-primary/5`
- Gradient icon background: `bg-gradient-to-br from-primary to-primary/70`
- Star badge: `<Badge variant="default">★ Primary</Badge>`

**Example Implementation**:
```typescript
{featuredTools.map((tool) => {
    const IconComponent = iconMap[tool.icon];
    const isActive = pathname === tool.href;
    const isPrimary = tool.primary;
    
    return (
        <Button
            key={tool.id}
            className={cn(
                'w-full h-auto p-3 justify-start',
                isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50',
                isPrimary && !isActive && 'ring-1 ring-primary/30 bg-primary/5'
            )}
        >
            <div className='flex items-center gap-3 w-full'>
                <div className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center',
                    isPrimary 
                        ? 'bg-gradient-to-br from-primary to-primary/70' 
                        : 'bg-gradient-to-br from-muted to-muted/80'
                )}>
                    <IconComponent className='w-4 h-4' />
                </div>
                <div className='flex-1 text-left'>
                    <div className='font-medium text-sm flex items-center gap-2'>
                        {tool.title}
                        {isPrimary && (
                            <Badge variant="default" className="text-[10px] h-4 px-1">
                                ★ Primary
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        </Button>
    );
})}
```

## Acceptance Criteria
- [ ] MIO Formula Manager appears first in featured tools
- [ ] Tool has visual distinction (ring border, gradient icon, star badge)
- [ ] Category changed to "Core Tools"
- [ ] All other tools follow new priority order
- [ ] No broken links or TypeScript errors

## Testing
```bash
pnpm dev
# 1. Navigate to http://localhost:3000
# 2. Verify MIO Formula Manager is at top of sidebar
# 3. Verify visual emphasis (star badge, gradient icon)
# 4. Click through all navigation links
# 5. Test on mobile viewport (< 768px)
```

---

# 📋 WORKSTREAM 2: Component Splitting

**Agent Assignment**: Agent 2 (React architecture specialist)  
**Duration**: 4-5 days  
**Dependencies**: Coordinate with Agent 3 on ChartView.tsx  
**Priority**: HIGH

## Objective
Split large monolithic components into smaller, maintainable, and performant sub-components.

## Task 2.1: Split ChartView.tsx (899 lines → 5 components)

**Original File**: `src/components/formula/ChartView.tsx`

### Target Architecture
```
ChartView.tsx (Main Orchestrator - ~150 lines)
├── ChartSettingsPanel.tsx (~120 lines)
├── StockListPanel.tsx (~150 lines)
├── ChartDisplay.tsx (~200 lines)
├── ChartControls.tsx (~100 lines)
└── hooks/
    ├── useChartViewState.ts (~80 lines)
    └── useChartSync.ts (~120 lines)
```

### Step 2.1.1: Create useChartViewState Hook
**New File**: `src/components/formula/hooks/useChartViewState.ts`

**Purpose**: Extract all state management logic

```typescript
export interface ChartViewState {
    selectedStock: Stock | null;
    setSelectedStock: (stock: Stock | null) => void;
    currentSymbol: string | null;
    activeCharts: Map<string, boolean>;
    toggleChart: (symbol: string) => void;
    isPaneMode: boolean;
    togglePaneMode: () => void;
    showSettingsPanel: boolean;
    setShowSettingsPanel: (show: boolean) => void;
    chartSettings: ChartSettings;
    updateChartSettings: (settings: Partial<ChartSettings>) => void;
}

export function useChartViewState(initialStocks: Stock[]): ChartViewState {
    // Implementation extracting all state from ChartView.tsx
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const [isPaneMode, setIsPaneMode] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [chartSettings, setChartSettings] = useState<ChartSettings>({
        resolution: '1D',
        barsCount: 2000,
        cvdEnabled: false,
    });
    
    // ... rest of state logic
    
    return {
        selectedStock,
        setSelectedStock,
        // ... all state and handlers
    };
}
```

### Step 2.1.2: Create ChartSettingsPanel Component
**New File**: `src/components/formula/ChartSettingsPanel.tsx`

```typescript
interface ChartSettingsPanelProps {
    settings: ChartSettings;
    onSettingsChange: (settings: Partial<ChartSettings>) => void;
    onClose: () => void;
    isVisible: boolean;
}

export function ChartSettingsPanel({ 
    settings, 
    onSettingsChange, 
    onClose, 
    isVisible 
}: ChartSettingsPanelProps) {
    // Extract resolution selector, bars count, CVD toggle
    // from ChartView.tsx
}
```

### Step 2.1.3: Create StockListPanel Component
**New File**: `src/components/formula/StockListPanel.tsx`

```typescript
interface StockListPanelProps {
    stocks: Stock[];
    selectedStock: Stock | null;
    onStockSelect: (stock: Stock) => void;
    activeCharts: Map<string, boolean>;
    onToggleChart: (symbol: string) => void;
    isPaneMode: boolean;
}

export function StockListPanel(props: StockListPanelProps) {
    // Extract stock list rendering from ChartView.tsx
}
```

### Step 2.1.4: Create ChartDisplay Component
**New File**: `src/components/formula/ChartDisplay.tsx`

```typescript
interface ChartDisplayProps {
    symbol: string | null;
    activeSymbols: string[];
    settings: ChartSettings;
    isPaneMode: boolean;
    className?: string;
}

export function ChartDisplay(props: ChartDisplayProps) {
    // Extract chart rendering logic (TradingViewLiveChart wrapper)
}
```

### Step 2.1.5: Create ChartControls Component
**New File**: `src/components/formula/ChartControls.tsx`

```typescript
interface ChartControlsProps {
    isPaneMode: boolean;
    onTogglePaneMode: () => void;
    onOpenSettings: () => void;
    onRefresh: () => void;
    showSettingsPanel: boolean;
}

export function ChartControls(props: ChartControlsProps) {
    // Extract action buttons from ChartView.tsx
}
```

### Step 2.1.6: Refactor Main ChartView
**Modified File**: `src/components/formula/ChartView.tsx` (~150 lines)

```typescript
'use client';

import { useChartViewState } from './hooks/useChartViewState';
import { ChartSettingsPanel } from './ChartSettingsPanel';
import { StockListPanel } from './StockListPanel';
import { ChartDisplay } from './ChartDisplay';
import { ChartControls } from './ChartControls';

interface ChartViewProps {
    stocks: Stock[];
    formulaId?: string;
}

export default function ChartView({ stocks, formulaId }: ChartViewProps) {
    const state = useChartViewState(stocks);
    
    return (
        <div className="flex h-full">
            <StockListPanel
                stocks={stocks}
                selectedStock={state.selectedStock}
                onStockSelect={state.setSelectedStock}
                activeCharts={state.activeCharts}
                onToggleChart={state.toggleChart}
                isPaneMode={state.isPaneMode}
            />
            
            <div className="flex-1 flex flex-col">
                <ChartControls
                    isPaneMode={state.isPaneMode}
                    onTogglePaneMode={state.togglePaneMode}
                    onOpenSettings={() => state.setShowSettingsPanel(true)}
                    onRefresh={() => {/* refresh logic */}}
                    showSettingsPanel={state.showSettingsPanel}
                />
                
                <ChartDisplay
                    symbol={state.currentSymbol}
                    activeSymbols={Array.from(state.activeCharts.keys())}
                    settings={state.chartSettings}
                    isPaneMode={state.isPaneMode}
                    className="flex-1"
                />
            </div>
            
            <ChartSettingsPanel
                settings={state.chartSettings}
                onSettingsChange={state.updateChartSettings}
                onClose={() => state.setShowSettingsPanel(false)}
                isVisible={state.showSettingsPanel}
            />
        </div>
    );
}
```

## Task 2.2: Split TradingViewLiveChart.tsx (582 lines → 4 components)

**Original File**: `src/components/TradingViewLiveChart.tsx`

### Target Architecture
```
TradingViewLiveChart.tsx (Main Container - ~120 lines)
├── ChartCanvas.tsx (~150 lines)
├── ChartLegend.tsx (~80 lines)
├── ChartToolbar.tsx (~100 lines)
└── hooks/
    └── useTradingViewChart.ts (~150 lines)
```

### Step 2.2.1: Create useTradingViewChart Hook
**New File**: `src/hooks/useTradingViewChart.ts`

```typescript
export interface UseTradingViewChartReturn {
    chartContainerRef: React.RefObject<HTMLDivElement>;
    chart: IChartApi | null;
    series: ISeriesApi<'Candlestick'> | null;
    isLoading: boolean;
    error: string | null;
    updateChartData: (bars: Bar[]) => void;
    setIndicators: (indicators: Indicator[]) => void;
}

export function useTradingViewChart(params: {
    symbol: string;
    resolution: string;
    theme: 'light' | 'dark';
}): UseTradingViewChartReturn {
    // Extract chart initialization, data updates, cleanup
    // Contains existing 7 useMemo/useCallback
}
```

### Step 2.2.2-2.2.4: Create Sub-Components
- **ChartCanvas.tsx**: Render the actual chart container
- **ChartLegend.tsx**: Display OHLC values and indicators
- **ChartToolbar.tsx**: Zoom, reset, screenshot buttons

### Step 2.2.5: Refactor Main TradingViewLiveChart
**Modified File**: `src/components/TradingViewLiveChart.tsx` (~120 lines)

```typescript
'use client';

import { useTradingViewChart } from '@/hooks/useTradingViewChart';
import { ChartCanvas } from './chart/ChartCanvas';
import { ChartLegend } from './chart/ChartLegend';
import { ChartToolbar } from './chart/ChartToolbar';

export default function TradingViewLiveChart(props: TradingViewLiveChartProps) {
    const chart = useTradingViewChart({
        symbol: props.symbol,
        resolution: props.resolution,
        theme: useTheme(),
    });
    
    return (
        <div className="relative h-full w-full">
            <ChartToolbar {...toolbarProps} />
            <ChartCanvas {...canvasProps} />
            <ChartLegend {...legendProps} />
        </div>
    );
}
```

## Acceptance Criteria
- [ ] ChartView.tsx reduced from 899 to ~150 lines
- [ ] TradingViewLiveChart.tsx reduced from 582 to ~120 lines
- [ ] All sub-components in separate files
- [ ] No functionality lost
- [ ] TypeScript compiles without errors
- [ ] No circular dependencies

## Testing
```bash
pnpm tsc --noEmit
pnpm dev

# Manual tests:
# 1. Navigate to /mio-formulas
# 2. Load a formula with results
# 3. Test ChartView:
#    - Select different stocks
#    - Toggle settings panel
#    - Switch resolutions
#    - Enable/disable pane mode
#    - Toggle CVD indicator
# 4. Test TradingViewLiveChart:
#    - Chart renders correctly
#    - Zoom in/out works
#    - Legend updates
```

---

# 📋 WORKSTREAM 3: Performance Optimization

**Agent Assignment**: Agent 3 (React performance specialist)  
**Duration**: 3-4 days  
**Dependencies**: Coordinate with Agent 2 on ChartView.tsx  
**Priority**: HIGH

## Objective
Add React.memo, useMemo, and useCallback to eliminate unnecessary re-renders.

## Phase 1: High-Impact Components (Days 1-2)

### Task 3.1: Memoize ResultsTable Component
**File**: `src/components/formula/ResultsTable.tsx` (333 lines)

**Current Issues**: Renders entire stock list on every parent update

```typescript
import React, { useMemo, useCallback } from 'react';

export const ResultsTable = React.memo(function ResultsTable({
    stocks,
    onStockSelect,
    selectedStock
}: ResultsTableProps) {
    // Memoize sorted/filtered data
    const processedStocks = useMemo(() => {
        return stocks
            .filter(/* filters */)
            .sort(/* sorting */);
    }, [stocks]);
    
    // Memoize row click handler
    const handleRowClick = useCallback((stock: Stock) => {
        onStockSelect(stock);
    }, [onStockSelect]);
    
    // Memoize row renderer
    const renderRow = useCallback((stock: Stock, index: number) => {
        const isSelected = selectedStock?.symbol === stock.symbol;
        return (
            <TableRow 
                key={stock.symbol}
                onClick={() => handleRowClick(stock)}
                className={isSelected ? 'bg-muted' : ''}
            >
                {/* row content */}
            </TableRow>
        );
    }, [handleRowClick, selectedStock]);
    
    return (
        <Table>
            <TableBody>
                {processedStocks.map(renderRow)}
            </TableBody>
        </Table>
    );
});
```

**Expected Impact**: 40-60% reduction in render time for large stock lists (100+ items)

### Task 3.2: Memoize MultiPaneChart Component
**File**: `src/components/chart/MultiPaneChart.tsx` (267 lines)

**Current Issues**: Re-renders all chart panes when any single chart updates

```typescript
// Memoize individual chart pane
const ChartPane = React.memo(function ChartPane({ 
    symbol, 
    resolution, 
    barsCount,
    cvdEnabled,
    onRemove 
}: ChartPaneProps) {
    const handleRemove = useCallback(() => {
        onRemove(symbol);
    }, [symbol, onRemove]);
    
    return (
        <div className="border rounded-lg p-2">
            <TradingViewLiveChart
                symbol={symbol}
                resolution={resolution}
                barsCount={barsCount}
                cvdEnabled={cvdEnabled}
            />
        </div>
    );
});

export const MultiPaneChart = React.memo(function MultiPaneChart({
    symbols,
    resolution,
    barsCount,
    cvdEnabled,
    onRemoveChart
}: MultiPaneChartProps) {
    // Memoize grid layout calculation
    const gridLayout = useMemo(() => {
        const count = symbols.length;
        if (count === 1) return 'grid-cols-1';
        if (count === 2) return 'grid-cols-2';
        if (count <= 4) return 'grid-cols-2 grid-rows-2';
        return 'grid-cols-3 grid-rows-auto';
    }, [symbols.length]);
    
    return (
        <div className={`grid gap-4 ${gridLayout} h-full`}>
            {symbols.map((symbol) => (
                <ChartPane key={symbol} {...props} />
            ))}
        </div>
    );
});
```

**Expected Impact**: 70-80% reduction in unnecessary re-renders

### Task 3.3: Optimize FormulaList Component
**File**: `src/components/formula/FormulaList.tsx`

```typescript
const FormulaCard = React.memo(function FormulaCard({
    formula,
    onSelect,
    onEdit,
    onDelete,
    isSelected
}: FormulaCardProps) {
    const handleSelect = useCallback(() => onSelect(formula.id), [formula.id, onSelect]);
    const handleEdit = useCallback(() => onEdit(formula.id), [formula.id, onEdit]);
    const handleDelete = useCallback(() => onDelete(formula.id), [formula.id, onDelete]);
    
    return <Card>{/* content */}</Card>;
});

export const FormulaList = React.memo(function FormulaList(props) {
    const visibleFormulas = useMemo(() => {
        return props.formulas.filter(f => !f.archived);
    }, [props.formulas]);
    
    return (
        <div className="grid gap-4">
            {visibleFormulas.map((formula) => (
                <FormulaCard key={formula.id} {...cardProps} />
            ))}
        </div>
    );
});
```

## Phase 2: Medium-Impact Components (Days 2-3)

### Task 3.4: Memoize Dashboard Components
**Files**:
- `src/components/dashboard/ActionCard.tsx`
- `src/components/dashboard/DesktopSidebar.tsx`
- `src/components/dashboard/MobileSidebar.tsx`

### Task 3.5: Memoize Form Components
**Files**:
- `src/components/formula-editor/FormulaEditorPanel.tsx`
- `src/components/formula-editor/CriteriaSelector.tsx`
- `src/components/formula-editor/FormulaPreview.tsx`

## Phase 3: Hook Optimization (Day 3-4)

### Task 3.6: Optimize Custom Hooks
**Files**:
- `src/hooks/useFormulaResults.ts`
- `src/hooks/useChartData.ts`
- `src/hooks/useFormulas.ts`

**Example Pattern**:
```typescript
export function useFormulaResults(formulaId: string) {
    const { getStoredCredentials } = useAuth();
    
    // Memoize credentials
    const credentials = useMemo(() => getStoredCredentials(), [getStoredCredentials]);
    
    // Memoize fetch function
    const fetchResults = useCallback(async () => {
        if (!credentials) return null;
        // fetch logic
    }, [credentials, formulaId]);
    
    return { data, error, isLoading };
}
```

### Task 3.7: Memoize Context Values
**File**: `src/contexts/AuthContext.tsx`

```typescript
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [credentials, setCredentials] = useState<Credentials | null>(null);
    
    // Memoize all functions
    const login = useCallback(async (email: string, password: string) => {
        // login logic
    }, []);
    
    const logout = useCallback(() => {
        setCredentials(null);
    }, []);
    
    // Memoize context value
    const contextValue = useMemo(() => ({
        credentials,
        isLoading,
        login,
        logout,
        isAuthenticated,
        getStoredCredentials,
    }), [credentials, isLoading, login, logout, isAuthenticated, getStoredCredentials]);
    
    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}
```

## Phase 4: List Virtualization (Day 4)

### Task 3.8: Add Virtualization for Long Lists

**Install**:
```bash
pnpm add @tanstack/react-virtual
```

**File**: `src/components/formula/ResultsTable.tsx`

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

export const ResultsTable = React.memo(function ResultsTable({ stocks }) {
    const parentRef = useRef<HTMLDivElement>(null);
    
    const virtualizer = useVirtualizer({
        count: stocks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 48, // Row height
        overscan: 10,
    });
    
    return (
        <div ref={parentRef} className="h-full overflow-auto">
            <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
                {virtualizer.getVirtualItems().map((virtualRow) => (
                    <div key={virtualRow.key} style={{
                        position: 'absolute',
                        transform: `translateY(${virtualRow.start}px)`,
                    }}>
                        {/* row content */}
                    </div>
                ))}
            </div>
        </div>
    );
});
```

**Performance Impact**: Handles 10,000+ stocks with 60 FPS scrolling

## Acceptance Criteria
- [ ] 15+ components wrapped with React.memo
- [ ] All expensive computations use useMemo
- [ ] All callbacks use useCallback
- [ ] Context values memoized
- [ ] Long lists use virtualization
- [ ] Re-render count reduced by >50%
- [ ] Chrome DevTools Profiler shows <30% CPU during idle

## Testing
```bash
pnpm dev

# Chrome DevTools → Profiler:
# 1. Navigate to /mio-formulas
# 2. Load formula with 500+ stocks
# 3. Record profile while:
#    - Selecting different stocks
#    - Toggling settings
#    - Switching pane mode
# 4. Verify:
#    - Component render times
#    - No unnecessary re-renders
#    - TTI < 2s, FCP < 1s, LCP < 2.5s
```

---

# 📋 WORKSTREAM 4: Code Deduplication

**Agent Assignment**: Agent 4 (Code architecture specialist)  
**Duration**: 2-3 days  
**Dependencies**: None  
**Priority**: CRITICAL

## Objective
Achieve **strictly zero code duplication** by extracting all repeated patterns.

## Task 4.1: Centralize KV Key Generation

**Problem**: Same key generation duplicated in 6+ API routes

### Step 4.1.1: Create Central KV Keys Utility
**New File**: `src/lib/storage/kvKeys.ts`

```typescript
/**
 * Centralized Vercel KV key generation
 */

export const KVKeys = {
    /**
     * Generate key for formula storage
     */
    formulas: (userEmail: string, userPassword: string): string => {
        return `mio-formulas:${userEmail.toLowerCase().trim()}:${userPassword}`;
    },

    /**
     * Generate key for session storage
     */
    session: (sessionId: string): string => {
        return `session:${sessionId}`;
    },

    /**
     * Generate key for watchlist storage
     */
    watchlist: (userEmail: string, listName: string): string => {
        return `watchlist:${userEmail.toLowerCase().trim()}:${listName}`;
    },

    /**
     * Generate key for user credentials
     */
    credentials: (userEmail: string): string => {
        return `credentials:${userEmail.toLowerCase().trim()}`;
    },

    /**
     * Generate key for session health data
     */
    sessionHealth: (userEmail: string): string => {
        return `session-health:${userEmail.toLowerCase().trim()}`;
    },
} as const;

/**
 * Type-safe key validation
 */
export function validateKVKey(key: string): boolean {
    return key.length > 0 && Buffer.byteLength(key, 'utf8') <= 1024;
}
```

### Step 4.1.2: Replace All Duplicated Key Generation

**Files to update** (18 instances across 6 files):
1. `src/app/api/formula-results/route.ts`
2. `src/app/api/mio-formulas/edit/route.ts`
3. `src/app/api/mio-formulas/route.ts`
4. `src/app/api/mio-formulas/create/route.ts`
5. `src/app/api/mio-formulas/data/route.ts`
6. `src/app/api/formula-results-with-charts/route.ts`

**Replace Pattern**:
```typescript
// BEFORE
function generateFormulasKey(userEmail: string, userPassword: string): string {
	return `mio-formulas:${userEmail.toLowerCase().trim()}:${userPassword}`;
}
const key = generateFormulasKey(userEmail, userPassword);

// AFTER
import { KVKeys } from '@/lib/storage/kvKeys';
const key = KVKeys.formulas(userEmail, userPassword);
```

## Task 4.2: Create API Error Handling Middleware

### Step 4.2.1: Create Error Handler
**New File**: `src/lib/api/errorHandler.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SessionError } from '@/lib/errors/types';
import { ZodError } from 'zod';

export interface APIContext {
    route: string;
    method: string;
    userId?: string;
}

/**
 * Centralized API error handling
 */
export async function withErrorHandling<T>(
    handler: (request: NextRequest) => Promise<T>,
    context: APIContext
): Promise<NextResponse> {
    try {
        const result = await handler(request);
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error(`[${context.route}] ${context.method} Error:`, error);

        // Handle Zod validation errors
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Validation error',
                    details: error.errors,
                },
                { status: 400 }
            );
        }

        // Handle SessionError
        if (error instanceof SessionError) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.userMessage,
                    code: error.errorCode,
                    recoverySteps: error.getRecoveryInstructions(),
                },
                { status: error.severity === 'critical' ? 500 : 400 }
            );
        }

        // Handle standard errors
        if (error instanceof Error) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Internal server error',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

/**
 * Validate required fields
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
    body: unknown,
    requiredFields: string[]
): T {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be an object');
    }

    const missingFields = requiredFields.filter((field) => !(field in body));

    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    return body as T;
}
```

### Step 4.2.2: Create Response Types
**New File**: `src/lib/api/types.ts`

```typescript
export interface APISuccessResponse<T = unknown> {
    success: true;
    data: T;
    timestamp?: string;
}

export interface APIErrorResponse {
    success: false;
    error: string;
    code?: string;
    details?: unknown;
    recoverySteps?: string[];
    timestamp?: string;
}

export type APIResponse<T = unknown> = APISuccessResponse<T> | APIErrorResponse;

export function successResponse<T>(data: T): APISuccessResponse<T> {
    return { success: true, data, timestamp: new Date().toISOString() };
}

export function errorResponse(error: string, options?: {
    code?: string;
    details?: unknown;
}): APIErrorResponse {
    return {
        success: false,
        error,
        code: options?.code,
        details: options?.details,
        timestamp: new Date().toISOString(),
    };
}
```

### Step 4.2.3: Refactor API Routes

**Example**: `src/app/api/formula-results/route.ts`

```typescript
// BEFORE
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (!body.userEmail || !body.userPassword) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }
        // logic
        return NextResponse.json({ success: true, data: results });
    } catch (error) {
        console.error('[Formula-Results] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// AFTER
import { withErrorHandling, validateRequiredFields } from '@/lib/api/errorHandler';
import { KVKeys } from '@/lib/storage/kvKeys';

export async function POST(request: NextRequest) {
    return withErrorHandling(
        async (req) => {
            const body = await req.json();
            const { userEmail, userPassword, formulaId } = validateRequiredFields<{
                userEmail: string;
                userPassword: string;
                formulaId: string;
            }>(body, ['userEmail', 'userPassword', 'formulaId']);

            const formulasKey = KVKeys.formulas(userEmail, userPassword);
            // ... business logic

            return results;
        },
        { route: '/api/formula-results', method: 'POST' }
    );
}
```

**Apply to all 26 API routes**

## Task 4.3: Extract Common Component Patterns

### Step 4.3.1: Reusable Loading State
**New File**: `src/components/ui/loading-state.tsx`

```typescript
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
    message?: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ 
    message = 'Loading...', 
    className, 
    size = 'md' 
}: LoadingStateProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className={cn('flex flex-col items-center justify-center gap-4 p-8', className)}>
            <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
            {message && <p className='text-sm text-muted-foreground'>{message}</p>}
        </div>
    );
}
```

### Step 4.3.2: Reusable Empty State
**New File**: `src/components/ui/empty-state.tsx`

```typescript
import { LucideIcon } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({ 
    icon: Icon, 
    title, 
    description, 
    action, 
    className 
}: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-4 p-12 text-center', className)}>
            <div className='rounded-full bg-muted p-6'>
                <Icon className='w-12 h-12 text-muted-foreground' />
            </div>
            <div className='space-y-2'>
                <h3 className='font-semibold text-lg'>{title}</h3>
                {description && <p className='text-sm text-muted-foreground'>{description}</p>}
            </div>
            {action && <Button onClick={action.onClick}>{action.label}</Button>}
        </div>
    );
}
```

### Step 4.3.3: Replace Duplicated States

**Search and replace pattern**:
```bash
# Find all custom loading states
grep -r "Loading..." src/components --include="*.tsx"

# Replace with LoadingState component
{isLoading && <LoadingState message="Loading formulas..." />}

# Replace empty states
{formulas.length === 0 && (
    <EmptyState
        icon={FileCode}
        title="No formulas found"
        description="Create your first formula"
        action={{ label: 'Create Formula', onClick: onCreateFormula }}
    />
)}
```

## Task 4.4: Centralize Auth Utilities

**File**: `src/lib/auth/authUtils.ts` (enhance existing)

```typescript
const AUTH_STORAGE_KEY = 'mio-tv-auth-credentials';

export interface Credentials {
    userEmail: string;
    userPassword: string;
}

export function getStoredCredentials(): Credentials | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!stored) return null;
        const credentials = JSON.parse(stored) as Credentials;
        if (!credentials.userEmail || !credentials.userPassword) return null;
        return credentials;
    } catch {
        return null;
    }
}

export function storeCredentials(credentials: Credentials): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(credentials));
}

export function clearCredentials(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
    return getStoredCredentials() !== null;
}

export function validateCredentials(credentials: unknown): credentials is Credentials {
    if (!credentials || typeof credentials !== 'object') return false;
    const creds = credentials as Record<string, unknown>;
    return (
        typeof creds.userEmail === 'string' &&
        creds.userEmail.length > 0 &&
        typeof creds.userPassword === 'string' &&
        creds.userPassword.length > 0
    );
}
```

## Task 4.5: Extract Chart Configuration

**New File**: `src/lib/chart/constants.ts`

```typescript
export const CHART_RESOLUTIONS = [
    { value: '1', label: '1 Minute' },
    { value: '5', label: '5 Minutes' },
    { value: '15', label: '15 Minutes' },
    { value: '30', label: '30 Minutes' },
    { value: '60', label: '1 Hour' },
    { value: '240', label: '4 Hours' },
    { value: '1D', label: '1 Day' },
    { value: '1W', label: '1 Week' },
    { value: '1M', label: '1 Month' },
] as const;

export const DEFAULT_CHART_SETTINGS = {
    resolution: '1D' as const,
    barsCount: 2000,
    cvdEnabled: false,
    theme: 'dark' as const,
} as const;

export const CHART_LIMITS = {
    minBars: 100,
    maxBars: 20000,
    defaultBars: 2000,
} as const;

export const CHART_COLORS = {
    upColor: '#26a69a',
    downColor: '#ef5350',
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
} as const;

export type ChartResolution = (typeof CHART_RESOLUTIONS)[number]['value'];
```

**Replace hardcoded values in**:
- `src/components/TradingViewLiveChart.tsx`
- `src/components/formula/ChartView.tsx`
- `src/components/chart/ChartPane.tsx`
- `src/hooks/useChartData.ts`

## Acceptance Criteria
- [ ] Zero duplicated key generation functions
- [ ] All API routes use withErrorHandling
- [ ] All loading states use LoadingState component
- [ ] All empty states use EmptyState component
- [ ] All auth operations use centralized utils
- [ ] All chart settings use centralized constants
- [ ] Code duplication = 0%

## Verification
```bash
# 1. No duplicated key functions
grep -r "function generate.*Key" src/app/api
# Result: 0 matches

# 2. No inline try-catch in API routes
grep -r "try {" src/app/api/**/route.ts
# Result: Only imports

# 3. No localStorage.getItem for credentials
grep -r "localStorage.getItem.*credentials" src
# Result: Only authUtils.ts

# 4. TypeScript check
pnpm tsc --noEmit
```

---

# 📋 WORKSTREAM 5: Logging & Security

**Agent Assignment**: Agent 5 (Security & logging specialist)  
**Duration**: 3-4 days  
**Dependencies**: Task 4.2 should complete first  
**Priority**: CRITICAL

## Objective
1. Replace 647 console statements with structured logging
2. Implement security (encrypted storage, rate limiting)
3. **Skip extension files** (`mio-session-extractor/`)

## Task 5.1: Structured Logging System

### Step 5.1.1: Create Logger Utility
**New File**: `src/lib/logger/index.ts`

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
    [key: string]: unknown;
}

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development';
    private isProduction = process.env.NODE_ENV === 'production';

    debug(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.debug(`[DEBUG] ${message}`, context || '');
        }
    }

    info(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.log(`[INFO] ${message}`, context || '');
        }
        if (this.isProduction) {
            this.sendToLoggingService('info', message, context);
        }
    }

    warn(message: string, context?: LogContext): void {
        console.warn(`[WARN] ${message}`, context || '');
        if (this.isProduction) {
            this.sendToLoggingService('warn', message, context);
        }
    }

    error(message: string, error?: Error, context?: LogContext): void {
        console.error(`[ERROR] ${message}`, {
            error: error?.message,
            stack: error?.stack,
            ...context,
        });
        if (this.isProduction) {
            this.sendToLoggingService('error', message, {
                errorMessage: error?.message,
                stack: error?.stack,
                ...context,
            });
        }
    }

    private sendToLoggingService(level: LogLevel, message: string, context?: LogContext): void {
        // TODO: Integrate with Sentry, Vercel Logs, etc.
    }
}

export const logger = new Logger();
```

### Step 5.1.2: Remove Console Statements

**Target**: 647 console statements in `src/` (excluding `mio-session-extractor/`)

**Categories**:
1. **API Routes** (~150 statements) - Priority 1
2. **Contexts** (`AuthContext.tsx`) - Priority 2
3. **Hooks** (~200 statements) - Priority 2
4. **Components** (~250 statements) - Priority 3
5. **Library functions** (~50 statements) - Priority 3

**Replacement Pattern**:
```typescript
// BEFORE
console.log('[Component] Message', data);
console.error('[Component] Error:', error);

// AFTER
import { logger } from '@/lib/logger';
logger.debug('[Component] Message', { data });
logger.error('[Component] Error occurred', error as Error);
```

**Automated Script**: `scripts/replace-console-logs.ts`

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = glob.sync('src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.ts', '**/node_modules/**', '**/mio-session-extractor/**'],
});

let totalReplaced = 0;

for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    let modified = false;

    // Replace console.log -> logger.debug
    if (content.includes('console.log')) {
        content = content.replace(/console\.log/g, 'logger.debug');
        modified = true;
        totalReplaced++;
    }

    // Replace console.error -> logger.error
    if (content.includes('console.error')) {
        content = content.replace(/console\.error/g, 'logger.error');
        modified = true;
        totalReplaced++;
    }

    // Replace console.warn -> logger.warn
    if (content.includes('console.warn')) {
        content = content.replace(/console\.warn/g, 'logger.warn');
        modified = true;
        totalReplaced++;
    }

    // Add import if modified
    if (modified && !content.includes('from \'@/lib/logger\'')) {
        const importMatch = content.match(/^(import .+\n)+/m);
        if (importMatch) {
            const lastImportEnd = importMatch[0].length;
            content =
                content.slice(0, lastImportEnd) +
                "import { logger } from '@/lib/logger';\n" +
                content.slice(lastImportEnd);
        }
    }

    if (modified) {
        writeFileSync(file, content);
        console.log(`✓ Updated ${file}`);
    }
}

console.log(`\n✓ Replaced ${totalReplaced} console statements`);
```

**Run**:
```bash
pnpm tsx scripts/replace-console-logs.ts
```

## Task 5.2: Security Improvements

### Step 5.2.1: Encrypted LocalStorage

**Install**:
```bash
pnpm add crypto-js @types/crypto-js -D
```

**New File**: `src/lib/security/secureStorage.ts`

```typescript
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-key-change-in-production';

export const SecureStorage = {
    set(key: string, value: unknown): void {
        if (typeof window === 'undefined') return;
        try {
            const stringValue = JSON.stringify(value);
            const encrypted = CryptoJS.AES.encrypt(stringValue, ENCRYPTION_KEY).toString();
            localStorage.setItem(key, encrypted);
        } catch (error) {
            console.error('[SecureStorage] Failed to encrypt:', error);
        }
    },

    get<T>(key: string): T | null {
        if (typeof window === 'undefined') return null;
        try {
            const encrypted = localStorage.getItem(key);
            if (!encrypted) return null;

            const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
            const stringValue = decrypted.toString(CryptoJS.enc.Utf8);
            if (!stringValue) return null;

            return JSON.parse(stringValue) as T;
        } catch (error) {
            console.error('[SecureStorage] Failed to decrypt:', error);
            return null;
        }
    },

    remove(key: string): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(key);
    },

    clear(): void {
        if (typeof window === 'undefined') return;
        localStorage.clear();
    },
};
```

### Step 5.2.2: Update AuthContext
**File**: `src/contexts/AuthContext.tsx`

```typescript
// BEFORE
localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(credentials));
const stored = localStorage.getItem(AUTH_STORAGE_KEY);

// AFTER
import { SecureStorage } from '@/lib/security/secureStorage';
SecureStorage.set(AUTH_STORAGE_KEY, credentials);
const credentials = SecureStorage.get<Credentials>(AUTH_STORAGE_KEY);
```

### Step 5.2.3: Update authUtils
**File**: `src/lib/auth/authUtils.ts`

```typescript
import { SecureStorage } from '@/lib/security/secureStorage';

export function getStoredCredentials(): Credentials | null {
    return SecureStorage.get<Credentials>(AUTH_STORAGE_KEY);
}

export function storeCredentials(credentials: Credentials): void {
    SecureStorage.set(AUTH_STORAGE_KEY, credentials);
}

export function clearCredentials(): void {
    SecureStorage.remove(AUTH_STORAGE_KEY);
}
```

### Step 5.2.4: Rate Limiting

**Install**:
```bash
pnpm add lru-cache
```

**New File**: `src/lib/api/rateLimit.ts`

```typescript
import { LRUCache } from 'lru-cache';
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
    interval: number; // milliseconds
    maxRequests: number;
}

const rateLimitCache = new LRUCache<string, number[]>({
    max: 500,
    ttl: 60000,
});

export async function rateLimit(
    request: NextRequest,
    config: RateLimitConfig = { interval: 60000, maxRequests: 30 }
): Promise<{ success: boolean; remaining: number; reset: number }> {
    const identifier =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';

    const now = Date.now();
    const timestamps = rateLimitCache.get(identifier) || [];
    const validTimestamps = timestamps.filter((ts) => now - ts < config.interval);

    if (validTimestamps.length >= config.maxRequests) {
        const oldestTimestamp = Math.min(...validTimestamps);
        const resetTime = oldestTimestamp + config.interval;
        return { success: false, remaining: 0, reset: resetTime };
    }

    validTimestamps.push(now);
    rateLimitCache.set(identifier, validTimestamps);

    return {
        success: true,
        remaining: config.maxRequests - validTimestamps.length,
        reset: now + config.interval,
    };
}

export function withRateLimit(
    handler: (request: NextRequest) => Promise<Response>,
    config?: RateLimitConfig
) {
    return async (request: NextRequest): Promise<Response> => {
        const result = await rateLimit(request, config);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Rate limit exceeded',
                    retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': String(config?.maxRequests || 30),
                        'X-RateLimit-Remaining': String(result.remaining),
                        'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)),
                    },
                }
            );
        }

        return handler(request);
    };
}
```

### Step 5.2.5: Apply Rate Limiting

**Update**: `src/lib/api/errorHandler.ts`

```typescript
import { withRateLimit, RateLimitConfig } from './rateLimit';

export async function withErrorHandling<T>(
    handler: (request: NextRequest) => Promise<T>,
    context: APIContext,
    rateLimitConfig?: RateLimitConfig
): Promise<NextResponse> {
    const rateLimitedHandler = rateLimitConfig
        ? withRateLimit(async (req) => {
              const result = await handler(req);
              return NextResponse.json({ success: true, data: result });
          }, rateLimitConfig)
        : async (req: NextRequest) => {
              const result = await handler(req);
              return NextResponse.json({ success: true, data: result });
          };

    // Error handling logic...
}
```

**Apply to critical routes**:
```typescript
// src/app/api/formula-results/route.ts
export async function POST(request: NextRequest) {
    return withErrorHandling(
        async (req) => {
            // handler logic
        },
        { route: '/api/formula-results', method: 'POST' },
        { interval: 60000, maxRequests: 30 } // Rate limit config
    );
}
```

## Acceptance Criteria
- [ ] Logger utility created
- [ ] All 647 console statements replaced (excluding extension)
- [ ] No console.log/error/warn in src/ (excluding extension)
- [ ] Secure storage implemented
- [ ] All credential storage uses SecureStorage
- [ ] Rate limiting on critical API routes
- [ ] No sensitive data in logs

## Testing
```bash
# 1. Verify no console statements
grep -r "console\." src --exclude-dir=mio-session-extractor | wc -l
# Result: 0

# 2. Test logger
NODE_ENV=development pnpm dev
# Verify logs appear in terminal

# 3. Test secure storage
# - Login
# - Check DevTools → Local Storage
# - Verify encrypted (not plain JSON)

# 4. Test rate limiting
# - Make 31 requests to /api/formula-results
# - Verify 31st returns 429
```

---

# 📋 WORKSTREAM 6: TypeScript Improvements

**Agent Assignment**: Agent 6 (TypeScript specialist)  
**Duration**: 1-2 days  
**Dependencies**: None  
**Priority**: MEDIUM

## Objective
Replace all 7 instances of `any` type with proper TypeScript types.

## Task 6.1: Monaco Editor Types

**File**: `src/components/formula-editor/monacoAutocomplete.ts`

**Install**:
```bash
pnpm add -D @types/monaco-editor
```

**Replace** (3 instances):
```typescript
// BEFORE
provideCompletionItems: (model: any, position: any) => {
provideHover: (model: any, position: any) => {
provideSignatureHelp: (model: any, position: any) => {

// AFTER
import type { editor, languages, Position, IMarkdownString } from 'monaco-editor';

provideCompletionItems: (
    model: editor.ITextModel,
    position: Position
): languages.ProviderResult<languages.CompletionList> => {
    // implementation
},

provideHover: (
    model: editor.ITextModel,
    position: Position
): languages.ProviderResult<languages.Hover> => {
    // implementation
},

provideSignatureHelp: (
    model: editor.ITextModel,
    position: Position
): languages.ProviderResult<languages.SignatureHelpResult> => {
    // implementation
},
```

## Task 6.2: Error Handling Types

**File**: `src/hooks/useTvSync.ts`

```typescript
// BEFORE
let errorData: any = null;

// AFTER
interface TVSyncErrorResponse {
    error?: string;
    message?: string;
    details?: string;
    code?: string;
    [key: string]: unknown;
}

let errorData: TVSyncErrorResponse | null = null;
try {
    errorData = await response.json() as TVSyncErrorResponse;
} catch (parseError) {
    throw new Error(`Request failed with status ${response.status}`);
}
```

## Task 6.3: Health Report Types

**File**: `src/lib/validation/healthIntegration.ts`

```typescript
// BEFORE
healthReport: any; // eslint-disable-line @typescript-eslint/no-explicit-any

// AFTER
interface HealthCheckResult {
    status: 'healthy' | 'unhealthy' | 'degraded';
    message: string;
    timestamp: string;
}

interface PlatformHealthCheck {
    platform: 'mio' | 'tradingview';
    checks: {
        authentication: HealthCheckResult;
        api: HealthCheckResult;
        session: HealthCheckResult;
    };
}

interface HealthReport {
    overall: 'healthy' | 'unhealthy' | 'degraded';
    platforms: PlatformHealthCheck[];
    timestamp: string;
    metadata?: Record<string, unknown>;
}

healthReport: HealthReport;
```

## Task 6.4: Error Categorization Types

**File**: `src/lib/errorCategorization.ts`

```typescript
// BEFORE
export function extractTradingViewError(responseData: any): string {
export function extractMarketInOutError(responseData: any): string {

// AFTER
interface ErrorResponse {
    error?: string;
    message?: string;
    details?: string;
    statusText?: string;
    [key: string]: unknown;
}

export function extractTradingViewError(responseData: ErrorResponse): string {
    if (typeof responseData === 'string') return responseData;
    if (responseData.error) {
        return typeof responseData.error === 'string'
            ? responseData.error
            : JSON.stringify(responseData.error);
    }
    if (responseData.message) return responseData.message;
    return 'TradingView request failed';
}

export function extractMarketInOutError(responseData: ErrorResponse): string {
    // Similar implementation
}
```

## Task 6.5: Add Type Exports

**New File**: `src/types/api.ts`

```typescript
export interface ErrorResponse {
    error?: string;
    message?: string;
    details?: string;
    statusText?: string;
    code?: string;
    [key: string]: unknown;
}

export interface SuccessResponse<T = unknown> {
    success: true;
    data: T;
    timestamp?: string;
}

export interface FailureResponse {
    success: false;
    error: string;
    code?: string;
    details?: unknown;
    timestamp?: string;
}

export type APIResponse<T = unknown> = SuccessResponse<T> | FailureResponse;
```

## Acceptance Criteria
- [ ] All 7 `any` types replaced
- [ ] Monaco editor types imported
- [ ] No `@typescript-eslint/no-explicit-any` disable comments
- [ ] TypeScript strict mode passes

## Testing
```bash
# 1. No any types remain
grep -r ": any" src --include="*.ts" --include="*.tsx"
# Result: 0

# 2. No eslint-disable for any
grep -r "eslint-disable.*no-explicit-any" src
# Result: 0

# 3. TypeScript check
pnpm tsc --noEmit
# Result: 0 errors

# 4. Test Monaco editor
# - Open /mio-formulas
# - Create/edit formula
# - Verify autocomplete works
```

---

# 📊 Master Timeline

## Week 1

**Monday-Tuesday**:
- ✓ Workstream 1 (Agent 1): Navigation - 2 hours
- ✓ Workstream 6 (Agent 6): TypeScript - 1-2 days
- → Workstream 4 (Agent 4): Deduplication START - Day 1

**Wednesday-Friday**:
- → Workstream 2 (Agent 2): Component Splitting - Day 1-3
- → Workstream 4 (Agent 4): Deduplication - Day 2-3

## Week 2

**Monday-Tuesday**:
- → Workstream 2 (Agent 2): Component Splitting - Day 4-5
- → Workstream 5 (Agent 5): Logging & Security START
  (Wait for Task 4.2 to complete)

**Wednesday-Friday**:
- → Workstream 3 (Agent 3): Performance - Day 1-3
  (Coordinate with Agent 2 on ChartView)
- → Workstream 5 (Agent 5): Logging & Security - Day 2-4

## Week 3 (if needed)

**Monday-Tuesday**:
- → Workstream 3 (Agent 3): Performance - Day 4
- → Final testing & integration

---

# 🔗 Dependencies

```
Workstream 1 (Navigation)     → No dependencies
Workstream 6 (TypeScript)     → No dependencies
Workstream 4 (Deduplication)  → No dependencies
Workstream 4 (Task 4.2)       → Must complete before Workstream 5
Workstream 2 (Splitting)      → Coordinate with Workstream 3
Workstream 3 (Performance)    → Coordinate with Workstream 2
Workstream 5 (Logging)        → Depends on Workstream 4 (Task 4.2)
```

---

# ✅ Final Deliverables

## Navigation & UX
- [ ] MIO Formula Manager is #1 in navigation
- [ ] Visual emphasis (star badge, gradient icon)
- [ ] All links work correctly

## Performance
- [ ] 15+ components use React.memo
- [ ] useMemo/useCallback for expensive operations
- [ ] Virtualization for lists >100 items
- [ ] Context values memoized
- [ ] Re-render count reduced by >50%

## Code Quality
- [ ] Zero code duplication
- [ ] ChartView: 899 → ~150 lines
- [ ] TradingViewLiveChart: 582 → ~120 lines
- [ ] All API routes use centralized middleware
- [ ] All components < 400 lines

## TypeScript
- [ ] Zero `any` types
- [ ] Proper Monaco editor types
- [ ] Strict mode passes

## Logging & Security
- [ ] All 647 console statements replaced
- [ ] Structured logger implemented
- [ ] Encrypted localStorage
- [ ] Rate limiting on critical routes

## Testing
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm build` succeeds
- [ ] All features work
- [ ] Manual checklist complete

---

# 📝 Agent Handoff Instructions

## For Each Agent:

1. **Read assigned workstream thoroughly**
2. **Check dependencies** - Don't start if not met
3. **Create feature branch**: `git checkout -b workstream-X-description`
4. **Follow task order**
5. **Run tests after each task**:
   ```bash
   pnpm tsc --noEmit
   pnpm dev
   ```
6. **Commit frequently**:
   ```bash
   git commit -m "feat(workstream-X): Complete Task X.Y - description"
   ```
7. **When complete**:
   - Run final checklist
   - Push branch
   - Document deviations
   - Report metrics (lines changed, files modified)

---

# 🚀 Post-Implementation

1. **Integration Testing** (1 day)
   - Merge all branches
   - Resolve conflicts
   - Full regression test

2. **Performance Benchmarking** (4 hours)
   - Chrome DevTools Profiler
   - Measure TTI, FCP, LCP
   - Compare before/after

3. **Final Build** (2 hours)
   - `pnpm build`
   - Deploy to staging
   - Smoke test

4. **Documentation** (4 hours)
   - Update README
   - Document new utilities
   - Create architecture diagram

---

**End of Plan**
