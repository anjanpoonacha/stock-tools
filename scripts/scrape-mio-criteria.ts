#!/usr/bin/env tsx

/**
 * MarketInOut Criteria Scraper
 * 
 * Scrapes all criteria metadata from https://www.marketinout.com/stock-screener/
 * and fetches enum options for criteria that require API calls.
 * 
 * Usage: pnpm tsx scripts/scrape-mio-criteria.ts
 */

import * as cheerio from 'cheerio';
// Type imports removed for build compatibility
import pLimit from 'p-limit';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import type {
  CriterionType,
  CategoryId,
  CriterionMetadata,
  CriterionOption,
  CriterionOptionSet,
  CriterionCategory,
  CriterionTree,
  CriterionLookups,
  ScraperMetadata,
  MarketInOutScraperData,
} from '../src/types/mioCriteria.ts';

// Constants
const MAIN_URL = 'https://www.marketinout.com/stock-screener/stock_screener.php';
const API_URL = 'https://www.marketinout.com/stock-screener/ajax_get_options.php';
const CONCURRENCY = 1; // Rate limit: 1 request at a time
const DELAY_MS = 1000; // 1 second between requests
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // Exponential backoff base

// Known enum criteria that require API calls
const ENUM_CRITERIA = new Set([
  'sector', 'industry', 'exch', 'mcap', 'index', 'type',
  'equity', 'class', 'country', 'options', 'commodity', 
  'aggregate', 'wl', 'port'
]);

// Output paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_FILE = join(PROJECT_ROOT, 'src/data/mio-criteria.json');

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Charset': 'utf-8',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
      console.log(`  ⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  throw new Error('Should not reach here');
}

/**
 * Determine criterion type from HTML attributes
 */
function determineCriterionType(element: any, $: cheerio.CheerioAPI): CriterionType {
  const typeAttr = $(element).attr('type');
  const id = $(element).attr('id') || '';
  
  // Explicit type attribute
  if (typeAttr === 'enum') return 'enum';
  
  // Check if it's a known enum
  if (ENUM_CRITERIA.has(id)) return 'enum';
  
  // Infer from ID patterns
  if (id.includes('rsi') || id.includes('cci') || id.includes('mfi') || 
      id.includes('stoch') || id.includes('williams') || id.includes('roc')) {
    return 'osc';
  }
  
  if (id.includes('sma') || id.includes('ema') || id.includes('wma') || id.includes('vwma')) {
    return 'ma';
  }
  
  if (id.includes('candlestick') || id.includes('pattern') || id.includes('signal')) {
    return 'event';
  }
  
  if (id.includes('price') || id === 'close' || id === 'open' || id === 'high' || id === 'low') {
    return 'price';
  }
  
  if (id.includes('volume') || id.includes('obv') || id.includes('vp')) {
    return 'series';
  }
  
  // Default to scalar for numeric ranges
  return 'scalar';
}

/**
 * Extract parameter information from criterion
 */
function extractParameters(
  element: any, 
  $: cheerio.CheerioAPI,
  criterionId: string
): {
  hasParameters: boolean;
  paramCount: number;
  defaultParams?: string;
  minValue?: string;
  maxValue?: string;
} {
  // Look for parameter input elements
  const paramInputs = $(`input[id^="${criterionId}_par"]`);
  
  if (paramInputs.length === 0) {
    return {
      hasParameters: false,
      paramCount: 0,
    };
  }
  
  const params: string[] = [];
  let minValue: string | undefined;
  let maxValue: string | undefined;
  
  paramInputs.each((_, input) => {
    const value = $(input).attr('value');
    const min = $(input).attr('min');
    const max = $(input).attr('max');
    
    if (value) params.push(value);
    if (min && !minValue) minValue = min;
    if (max && !maxValue) maxValue = max;
  });
  
  return {
    hasParameters: true,
    paramCount: paramInputs.length,
    defaultParams: params.join(','),
    minValue,
    maxValue,
  };
}

/**
 * Parse main page to extract all criteria
 */
async function scrapeCriteriaMetadata(): Promise<{
  categories: Map<CategoryId, CriterionCategory>;
  criteriaById: Map<string, CriterionMetadata>;
  errors: Array<{ criterionId: string; error: string; timestamp: Date }>;
}> {
  console.log('📥 Fetching main page...');
  const html = await fetchWithRetry(MAIN_URL);
  const $ = cheerio.load(html);
  
  const categories = new Map<CategoryId, CriterionCategory>();
  const criteriaById = new Map<string, CriterionMetadata>();
  const errors: Array<{ criterionId: string; error: string; timestamp: Date }> = [];
  
  // Find all category divs
  $('.sub_category[id^="subcat_"]').each((_, categoryDiv) => {
    const categoryId = $(categoryDiv)
      .attr('id')
      ?.replace('subcat_', '') as CategoryId;
    
    if (!categoryId) return;
    
    const categoryName = categoryId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    const criteria: CriterionMetadata[] = [];
    
    // Find all criteria in this category
    $(categoryDiv)
      .find('a[ind]')
      .each((_, criterionElement) => {
        try {
          const id = $(criterionElement).attr('id');
          const ind = $(criterionElement).attr('ind');
          const name = $(criterionElement).attr('name');
          const title = $(criterionElement).attr('title');
          
          if (!id || !ind || !name) {
            console.warn(`  ⚠️  Skipping criterion with missing attributes in ${categoryId}`);
            return;
          }
          
          const type = determineCriterionType(criterionElement, $);
          const params = extractParameters(criterionElement, $, id);
          
          const criterion: CriterionMetadata = {
            id,
            ind,
            type,
            name,
            title: title || undefined,
            category: categoryId,
            hasParameters: params.hasParameters,
            paramCount: params.paramCount,
            defaultParams: params.defaultParams,
            minValue: params.minValue,
            maxValue: params.maxValue,
            optionsLoaded: type === 'enum' ? false : null,
          };
          
          criteria.push(criterion);
          criteriaById.set(id, criterion);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push({
            criterionId: $(criterionElement).attr('id') || 'unknown',
            error: errorMsg,
            timestamp: new Date(),
          });
        }
      });
    
    if (criteria.length > 0) {
      categories.set(categoryId, {
        id: categoryId,
        name: categoryName,
        criteria,
      });
      
      console.log(`  ✓ ${categoryId}: ${criteria.length} criteria`);
    }
  });
  
  return { categories, criteriaById, errors };
}

/**
 * Parse API response to extract options
 */
function parseOptionsFromHtml(
  html: string,
  criterionId: string
): CriterionOption[] {
  const $ = cheerio.load(html);
  const options: CriterionOption[] = [];
  
  // Find all option links - they can be in different structures
  const optionLinks = $('a[local_id]');
  
  optionLinks.each((_, element) => {
    const optionId = $(element).attr('id');
    const localId = $(element).attr('local_id');
    const name = $(element).attr('name');
    const title = $(element).attr('title');
    const on = $(element).attr('on');
    
    if (!optionId || !localId || !name) return;
    
    options.push({
      optionId,
      localId,
      name,
      title: title || undefined,
      selected: on === '1',
    });
  });
  
  return options;
}

/**
 * Fetch options for a single enum criterion
 */
async function fetchCriterionOptions(
  criterionId: string
): Promise<CriterionOptionSet | null> {
  try {
    const url = `${API_URL}?crit_id=${criterionId}`;
    const html = await fetchWithRetry(url);
    
    const options = parseOptionsFromHtml(html, criterionId);
    
    if (options.length === 0) {
      console.log(`  ⚠️  ${criterionId}: No options found (may be user-specific)`);
      return null;
    }
    
    return {
      criterionId,
      options,
      fetchedAt: new Date(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ ${criterionId}: ${errorMsg}`);
    return null;
  }
}

/**
 * Fetch all enum options with rate limiting
 */
async function scrapeEnumOptions(
  criteriaById: Map<string, CriterionMetadata>
): Promise<{
  optionsById: Map<string, CriterionOptionSet>;
  errors: Array<{ criterionId: string; error: string; timestamp: Date }>;
}> {
  console.log('\n📥 Fetching enum options...');
  
  const enumCriteria = Array.from(criteriaById.values()).filter(
    c => c.type === 'enum'
  );
  
  console.log(`Found ${enumCriteria.length} enum criteria to fetch`);
  
  const optionsById = new Map<string, CriterionOptionSet>();
  const errors: Array<{ criterionId: string; error: string; timestamp: Date }> = [];
  const limit = pLimit(CONCURRENCY);
  
  let completed = 0;
  const total = enumCriteria.length;
  
  const fetchPromises = enumCriteria.map(criterion =>
    limit(async () => {
      try {
        // Rate limiting delay
        await sleep(DELAY_MS);
        
        console.log(`  [${++completed}/${total}] Fetching ${criterion.id}...`);
        
        const optionSet = await fetchCriterionOptions(criterion.id);
        
        if (optionSet) {
          optionsById.set(criterion.id, optionSet);
          // Update metadata to mark options as loaded
          criterion.optionsLoaded = true;
          console.log(`  ✓ ${criterion.id}: ${optionSet.options.length} options`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({
          criterionId: criterion.id,
          error: errorMsg,
          timestamp: new Date(),
        });
      }
    })
  );
  
  await Promise.all(fetchPromises);
  
  return { optionsById, errors };
}

/**
 * Build lookup maps for fast access
 */
function buildLookups(
  criteriaById: Map<string, CriterionMetadata>
): CriterionLookups {
  const enumCriteria = new Set<string>();
  const indicatorCriteria = new Set<string>();
  const eventCriteria = new Set<string>();
  const scalarCriteria = new Set<string>();
  const categoryToCriteria = new Map<CategoryId, string[]>();
  const typeToCriteria = new Map<CriterionType, string[]>();
  
  criteriaById.forEach((criterion, id) => {
    // Type-based sets
    if (criterion.type === 'enum') enumCriteria.add(id);
    if (criterion.type === 'osc' || criterion.type === 'ma') indicatorCriteria.add(id);
    if (criterion.type === 'event') eventCriteria.add(id);
    if (criterion.type === 'scalar') scalarCriteria.add(id);
    
    // Category mapping
    if (!categoryToCriteria.has(criterion.category)) {
      categoryToCriteria.set(criterion.category, []);
    }
    categoryToCriteria.get(criterion.category)!.push(id);
    
    // Type mapping
    if (!typeToCriteria.has(criterion.type)) {
      typeToCriteria.set(criterion.type, []);
    }
    typeToCriteria.get(criterion.type)!.push(id);
  });
  
  return {
    enumCriteria,
    indicatorCriteria,
    eventCriteria,
    scalarCriteria,
    categoryToCriteria,
    typeToCriteria,
  };
}

/**
 * Convert Maps/Sets to plain objects for JSON serialization
 */
function serializeForJson(data: MarketInOutScraperData): any {
  return {
    tree: {
      categories: Object.fromEntries(
        Array.from(data.tree.categories.entries()).map(([key, value]) => [
          key,
          {
            ...value,
            criteria: value.criteria,
          },
        ])
      ),
      criteriaById: Object.fromEntries(data.tree.criteriaById),
      optionsById: Object.fromEntries(
        Array.from(data.tree.optionsById.entries()).map(([key, value]) => [
          key,
          {
            ...value,
            fetchedAt: value.fetchedAt.toISOString(),
          },
        ])
      ),
      timestamp: data.tree.timestamp.toISOString(),
    },
    lookups: {
      enumCriteria: Array.from(data.lookups.enumCriteria),
      indicatorCriteria: Array.from(data.lookups.indicatorCriteria),
      eventCriteria: Array.from(data.lookups.eventCriteria),
      scalarCriteria: Array.from(data.lookups.scalarCriteria),
      categoryToCriteria: Object.fromEntries(data.lookups.categoryToCriteria),
      typeToCriteria: Object.fromEntries(data.lookups.typeToCriteria),
    },
    metadata: {
      ...data.metadata,
      startTime: data.metadata.startTime.toISOString(),
      endTime: data.metadata.endTime?.toISOString(),
      errors: data.metadata.errors.map(e => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
    },
    version: data.version,
  };
}

/**
 * Main scraper function
 */
async function main() {
  console.log('🚀 MarketInOut Criteria Scraper\n');
  console.log('Target:', MAIN_URL);
  console.log('');
  
  const startTime = new Date();
  
  try {
    // Step 1: Scrape main page for criteria metadata
    const { categories, criteriaById, errors: metadataErrors } = 
      await scrapeCriteriaMetadata();
    
    console.log(`\n✓ Scraped ${categories.size} categories`);
    console.log(`✓ Found ${criteriaById.size} criteria`);
    
    // Step 2: Fetch enum options
    const { optionsById, errors: optionErrors } = 
      await scrapeEnumOptions(criteriaById);
    
    console.log(`\n✓ Fetched options for ${optionsById.size} enum criteria`);
    
    // Step 3: Build lookups
    const lookups = buildLookups(criteriaById);
    
    // Step 4: Build final data structure
    const endTime = new Date();
    const totalOptions = Array.from(optionsById.values())
      .reduce((sum, set) => sum + set.options.length, 0);
    
    const metadata: ScraperMetadata = {
      startTime,
      endTime,
      totalCriteria: criteriaById.size,
      totalCategories: categories.size,
      totalOptions,
      errors: [...metadataErrors, ...optionErrors],
    };
    
    const tree: CriterionTree = {
      categories,
      criteriaById,
      optionsById,
      timestamp: new Date(),
    };
    
    const scraperData: MarketInOutScraperData = {
      tree,
      lookups,
      metadata,
      version: '1.0.0',
    };
    
    // Step 5: Save to file
    console.log('\n💾 Saving data...');
    
    // Ensure output directory exists
    const outputDir = dirname(OUTPUT_FILE);
    mkdirSync(outputDir, { recursive: true });
    
    // Convert to JSON-serializable format
    const jsonData = serializeForJson(scraperData);
    writeFileSync(OUTPUT_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');
    
    console.log(`✓ Saved to: ${OUTPUT_FILE}`);
    
    // Step 6: Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SCRAPING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Categories:       ${metadata.totalCategories}`);
    console.log(`Criteria:         ${metadata.totalCriteria}`);
    console.log(`Enum Options:     ${metadata.totalOptions}`);
    console.log(`Enum Criteria:    ${lookups.enumCriteria.size}`);
    console.log(`Indicator Crit.:  ${lookups.indicatorCriteria.size}`);
    console.log(`Event Criteria:   ${lookups.eventCriteria.size}`);
    console.log(`Scalar Criteria:  ${lookups.scalarCriteria.size}`);
    console.log(`Duration:         ${((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1)}s`);
    console.log(`Errors:           ${metadata.errors.length}`);
    
    if (metadata.errors.length > 0) {
      console.log('\n⚠️  ERRORS:');
      metadata.errors.forEach(err => {
        console.log(`  - ${err.criterionId}: ${err.error}`);
      });
    }
    
    // Validation checks
    console.log('\n✅ VALIDATION:');
    const validations = [
      { name: '17 categories', pass: metadata.totalCategories === 17 },
      { name: '300+ criteria', pass: metadata.totalCriteria >= 300 },
      { name: '14 enum types', pass: lookups.enumCriteria.size === 14 },
      { name: 'Options fetched', pass: optionsById.size >= 12 }, // wl/port may be empty
    ];
    
    validations.forEach(v => {
      console.log(`  ${v.pass ? '✓' : '✗'} ${v.name}`);
    });
    
    const allPassed = validations.every(v => v.pass);
    
    if (allPassed) {
      console.log('\n🎉 All validations passed!');
    } else {
      console.log('\n⚠️  Some validations failed. Please review.');
    }
    
    console.log('\n✅ Done!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the scraper
main();
