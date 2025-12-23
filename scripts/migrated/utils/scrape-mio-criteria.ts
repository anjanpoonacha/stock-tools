#!/usr/bin/env tsx
/**
 * MarketInOut Criteria Scraper (Framework-based)
 * 
 * Scrapes all criteria metadata from https://www.marketinout.com/stock-screener/
 * and fetches enum options for criteria that require API calls.
 * 
 * Usage:
 *   tsx scripts/migrated/utils/scrape-mio-criteria.ts
 */

import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { OutputManager, FileWriter, sleep, retry } from '../../framework/index.js';
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
} from '../../../src/types/mioCriteria.js';

// Constants
const MAIN_URL = 'https://www.marketinout.com/stock-screener/stock_screener.php';
const API_URL = 'https://www.marketinout.com/stock-screener/ajax_get_options.php';
const CONCURRENCY = 1;
const DELAY_MS = 1000;
const MAX_RETRIES = 3;

// Known enum criteria
const ENUM_CRITERIA = new Set([
  'sector', 'industry', 'exch', 'mcap', 'index', 'type',
  'equity', 'class', 'country', 'options', 'commodity', 
  'aggregate', 'wl', 'port'
]);

// Output paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../../..');
const OUTPUT_FILE = join(PROJECT_ROOT, 'src/data/mio-criteria.json');

/**
 * Fetch with retry using framework utility
 */
async function fetchWithRetry(url: string, options: RequestInit = {}): Promise<string> {
  return retry(
    async () => {
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
    },
    {
      maxRetries: MAX_RETRIES,
      delay: 1000,
      backoff: true,
    }
  );
}

/**
 * Determine criterion type from HTML attributes
 */
function determineCriterionType(element: any, $: cheerio.CheerioAPI): CriterionType {
  const typeAttr = $(element).attr('type');
  const id = $(element).attr('id') || '';
  
  if (typeAttr === 'enum') return 'enum';
  if (ENUM_CRITERIA.has(id)) return 'enum';
  
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
  
  return 'scalar';
}

/**
 * Extract parameter information
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
async function scrapeCriteriaMetadata(logger: any): Promise<{
  categories: Map<CategoryId, CriterionCategory>;
  criteriaById: Map<string, CriterionMetadata>;
  errors: Array<{ criterionId: string; error: string; timestamp: Date }>;
}> {
  logger.subsection('Fetching Main Page');
  const html = await fetchWithRetry(MAIN_URL);
  const $ = cheerio.load(html);
  
  const categories = new Map<CategoryId, CriterionCategory>();
  const criteriaById = new Map<string, CriterionMetadata>();
  const errors: Array<{ criterionId: string; error: string; timestamp: Date }> = [];
  
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
    
    $(categoryDiv)
      .find('a[ind]')
      .each((_, criterionElement) => {
        try {
          const id = $(criterionElement).attr('id');
          const ind = $(criterionElement).attr('ind');
          const name = $(criterionElement).attr('name');
          const title = $(criterionElement).attr('title');
          
          if (!id || !ind || !name) {
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
      
      logger.info(`${categoryId}: ${criteria.length} criteria`);
    }
  });
  
  return { categories, criteriaById, errors };
}

/**
 * Parse API response to extract options
 */
function parseOptionsFromHtml(html: string, criterionId: string): CriterionOption[] {
  const $ = cheerio.load(html);
  const options: CriterionOption[] = [];
  
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
async function fetchCriterionOptions(criterionId: string): Promise<CriterionOptionSet | null> {
  try {
    const url = `${API_URL}?crit_id=${criterionId}`;
    const html = await fetchWithRetry(url);
    
    const options = parseOptionsFromHtml(html, criterionId);
    
    if (options.length === 0) {
      return null;
    }
    
    return {
      criterionId,
      options,
      fetchedAt: new Date(),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch all enum options with rate limiting
 */
async function scrapeEnumOptions(
  criteriaById: Map<string, CriterionMetadata>,
  logger: any
): Promise<{
  optionsById: Map<string, CriterionOptionSet>;
  errors: Array<{ criterionId: string; error: string; timestamp: Date }>;
}> {
  logger.subsection('Fetching Enum Options');
  
  const enumCriteria = Array.from(criteriaById.values()).filter(
    c => c.type === 'enum'
  );
  
  logger.info(`Found ${enumCriteria.length} enum criteria to fetch`);
  
  const optionsById = new Map<string, CriterionOptionSet>();
  const errors: Array<{ criterionId: string; error: string; timestamp: Date }> = [];
  const limit = pLimit(CONCURRENCY);
  
  let completed = 0;
  const total = enumCriteria.length;
  
  const fetchPromises = enumCriteria.map(criterion =>
    limit(async () => {
      try {
        await sleep(DELAY_MS);
        
        logger.info(`[${++completed}/${total}] Fetching ${criterion.id}...`);
        
        const optionSet = await fetchCriterionOptions(criterion.id);
        
        if (optionSet) {
          optionsById.set(criterion.id, optionSet);
          criterion.optionsLoaded = true;
          logger.success(`${criterion.id}: ${optionSet.options.length} options`);
        } else {
          logger.warning(`${criterion.id}: No options (may be user-specific)`);
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
 * Build lookup maps
 */
function buildLookups(criteriaById: Map<string, CriterionMetadata>): CriterionLookups {
  const enumCriteria = new Set<string>();
  const indicatorCriteria = new Set<string>();
  const eventCriteria = new Set<string>();
  const scalarCriteria = new Set<string>();
  const categoryToCriteria = new Map<CategoryId, string[]>();
  const typeToCriteria = new Map<CriterionType, string[]>();
  
  criteriaById.forEach((criterion, id) => {
    if (criterion.type === 'enum') enumCriteria.add(id);
    if (criterion.type === 'osc' || criterion.type === 'ma') indicatorCriteria.add(id);
    if (criterion.type === 'event') eventCriteria.add(id);
    if (criterion.type === 'scalar') scalarCriteria.add(id);
    
    if (!categoryToCriteria.has(criterion.category)) {
      categoryToCriteria.set(criterion.category, []);
    }
    categoryToCriteria.get(criterion.category)!.push(id);
    
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
  const output = new OutputManager({
    directory: './output',
    saveToFile: true,
    prettyPrint: true,
  });

  const logger = output.getLogger();

  logger.section('MarketInOut Criteria Scraper');
  logger.detail('Target', MAIN_URL);
  
  const startTime = new Date();
  
  try {
    // Step 1: Scrape main page
    const { categories, criteriaById, errors: metadataErrors } = 
      await scrapeCriteriaMetadata(logger);
    
    logger.success(`Scraped ${categories.size} categories`);
    logger.success(`Found ${criteriaById.size} criteria`);
    
    // Step 2: Fetch enum options
    const { optionsById, errors: optionErrors } = 
      await scrapeEnumOptions(criteriaById, logger);
    
    logger.success(`Fetched options for ${optionsById.size} enum criteria`);
    
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
    logger.subsection('Saving Data');
    
    const jsonData = serializeForJson(scraperData);
    FileWriter.writeJSON(OUTPUT_FILE, jsonData, true);
    
    logger.success(`Saved to: ${OUTPUT_FILE}`);
    
    // Step 6: Print summary
    logger.subsection('Summary');
    logger.detail('Categories', metadata.totalCategories);
    logger.detail('Criteria', metadata.totalCriteria);
    logger.detail('Enum Options', metadata.totalOptions);
    logger.detail('Enum Criteria', lookups.enumCriteria.size);
    logger.detail('Indicator Criteria', lookups.indicatorCriteria.size);
    logger.detail('Event Criteria', lookups.eventCriteria.size);
    logger.detail('Scalar Criteria', lookups.scalarCriteria.size);
    logger.detail('Duration', `${((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1)}s`);
    logger.detail('Errors', metadata.errors.length);
    
    if (metadata.errors.length > 0) {
      logger.subsection('Errors');
      metadata.errors.forEach(err => {
        logger.warning(`${err.criterionId}: ${err.error}`);
      });
    }
    
    // Validation checks
    logger.subsection('Validation');
    const validations = [
      { name: '17 categories', pass: metadata.totalCategories === 17 },
      { name: '300+ criteria', pass: metadata.totalCriteria >= 300 },
      { name: '14 enum types', pass: lookups.enumCriteria.size === 14 },
      { name: 'Options fetched', pass: optionsById.size >= 12 },
    ];
    
    validations.forEach(v => {
      if (v.pass) {
        logger.success(v.name);
      } else {
        logger.warning(v.name);
      }
    });
    
    const allPassed = validations.every(v => v.pass);
    
    if (allPassed) {
      logger.newline();
      logger.success('All validations passed!');
    } else {
      logger.newline();
      logger.warning('Some validations failed. Please review.');
    }
    
  } catch (error) {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
