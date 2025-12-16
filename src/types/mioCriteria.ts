// src/types/mioCriteria.ts
// TypeScript interfaces for MarketInOut criteria metadata and options

/**
 * Criterion types identified from MarketInOut stock screener
 */
export type CriterionType = 
  | 'enum'    // Enumeration - requires API call for options (sector, industry, etc.)
  | 'scalar'  // Simple numeric range (price, volume, eps, etc.)
  | 'osc'     // Oscillator with parameters (RSI, MACD, CCI, etc.)
  | 'ma'      // Moving average with period (SMA, EMA, etc.)
  | 'price'   // Price value/comparison
  | 'series'  // Data series (OBV, volume, etc.)
  | 'event';  // Pattern/event detection (candlesticks, trend lines, etc.)

/**
 * Category IDs from the stock screener page
 */
export type CategoryId =
  | 'universe'
  | 'price_volume'
  | 'ma'
  | 'osc'
  | 'trend'
  | 'lines'
  | 'volatility'
  | 'ichimoku'
  | 'patterns'
  | 'price_action'
  | 'volume'
  | 'rs'
  | 'price_perf'
  | 'fund'
  | 'fs'
  | 'tip'
  | 'div';

/**
 * Metadata about a single criterion from the main page
 */
export interface CriterionMetadata {
  /** Unique identifier (e.g., "sector", "rsi") */
  id: string;
  
  /** Indicator identifier (usually same as id) */
  ind: string;
  
  /** Type of criterion */
  type: CriterionType;
  
  /** Display name (e.g., "Sector", "RSI") */
  name: string;
  
  /** Optional tooltip/description */
  title?: string;
  
  /** Category this criterion belongs to */
  category: CategoryId;
  
  /** Whether this criterion has parameter inputs */
  hasParameters: boolean;
  
  /** Number of parameters (0-9) */
  paramCount: number;
  
  /** Default parameter value(s), comma-separated for multi-param */
  defaultParams?: string;
  
  /** Minimum value for parameter validation */
  minValue?: string;
  
  /** Maximum value for parameter validation */
  maxValue?: string;
  
  /** Whether enum options have been loaded (null for non-enum types) */
  optionsLoaded: boolean | null;
}

/**
 * A single option from an enum criterion API response
 */
export interface CriterionOption {
  /** Full option ID (e.g., "sector_13") */
  optionId: string;
  
  /** Local/internal ID (e.g., "13") */
  localId: string;
  
  /** Display name (e.g., "Energy") */
  name: string;
  
  /** Optional full descriptive title */
  title?: string;
  
  /** Whether this option is currently selected */
  selected: boolean;
}

/**
 * Set of options for a specific enum criterion
 */
export interface CriterionOptionSet {
  /** Criterion ID this option set belongs to */
  criterionId: string;
  
  /** List of all available options */
  options: CriterionOption[];
  
  /** Timestamp when options were fetched */
  fetchedAt: Date;
}

/**
 * A category containing multiple criteria
 */
export interface CriterionCategory {
  /** Category ID */
  id: CategoryId;
  
  /** Display name */
  name: string;
  
  /** Criteria in this category */
  criteria: CriterionMetadata[];
}

/**
 * Full hierarchical structure of all criteria
 */
export interface CriterionTree {
  /** Categories indexed by ID */
  categories: Map<CategoryId, CriterionCategory>;
  
  /** All criteria indexed by ID for quick lookup */
  criteriaById: Map<string, CriterionMetadata>;
  
  /** Enum options indexed by criterion ID */
  optionsById: Map<string, CriterionOptionSet>;
  
  /** When this tree was built */
  timestamp: Date;
}

/**
 * Quick lookup maps for O(1) access
 */
export interface CriterionLookups {
  /** All enum criteria IDs (require API calls) */
  enumCriteria: Set<string>;
  
  /** All oscillator/indicator criteria (have parameters) */
  indicatorCriteria: Set<string>;
  
  /** All event-based criteria (pattern detection) */
  eventCriteria: Set<string>;
  
  /** All scalar criteria (simple numeric ranges) */
  scalarCriteria: Set<string>;
  
  /** Category -> Criteria IDs mapping */
  categoryToCriteria: Map<CategoryId, string[]>;
  
  /** Type -> Criteria IDs mapping */
  typeToCriteria: Map<CriterionType, string[]>;
}

/**
 * Metadata about the scraping operation
 */
export interface ScraperMetadata {
  /** When the scrape started */
  startTime: Date;
  
  /** When the scrape completed */
  endTime?: Date;
  
  /** Total criteria scraped */
  totalCriteria: number;
  
  /** Total categories scraped */
  totalCategories: number;
  
  /** Total enum options fetched */
  totalOptions: number;
  
  /** Any errors encountered */
  errors: Array<{
    criterionId: string;
    error: string;
    timestamp: Date;
  }>;
}

/**
 * The complete scraped dataset
 */
export interface MarketInOutScraperData {
  /** The full criterion tree */
  tree: CriterionTree;
  
  /** Fast lookup maps */
  lookups: CriterionLookups;
  
  /** Scraping metadata */
  metadata: ScraperMetadata;
  
  /** Version of the scraper that generated this data */
  version: string;
}

/**
 * Search result from criteria search
 */
export interface CriteriaSearchResult {
  /** Original query string */
  query: string;
  
  /** Matching criteria */
  matches: CriterionMatch[];
  
  /** When the search was performed */
  timestamp: Date;
}

/**
 * A single matched criterion with relevance info
 */
export interface CriterionMatch {
  /** The matched criterion */
  criterion: CriterionMetadata;
  
  /** How it matched (id, name, or both) */
  matchType: 'id' | 'name' | 'both';
  
  /** Relevance score (higher = more relevant) */
  relevanceScore: number;
}

/**
 * Editor context from cursor position
 */
export interface EditorContext {
  /** Word that user just typed */
  currentWord: string;
  
  /** Character that triggered the search */
  triggerChar?: ' ' | ',' | '(';
  
  /** Cursor position in document */
  cursorPosition: number;
  
  /** Line number */
  lineNumber: number;
}
