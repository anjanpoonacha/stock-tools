#!/usr/bin/env tsx
/**
 * Analyze MIO Structure (Framework-based)
 * 
 * Diagnostic script to analyze MIO HTML structure and compare against our parsers.
 * 
 * Usage:
 *   tsx scripts/migrated/utils/analyze-mio-structure.ts
 */

import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import { FormulaDataManager, MIO_FORMULA_DATA_URLS } from '../../../src/lib/mio/formulaData.js';
import { OutputManager, FileWriter } from '../../framework/index.js';
import type { FormulaIndicator, FormulaSample, FormulaDocumentation } from '../../../src/types/formulaEditor.js';

// Output directories
const OUTPUT_DIR = './output';
const RAW_DIR = `${OUTPUT_DIR}/raw`;
const PARSED_DIR = `${OUTPUT_DIR}/parsed`;
const STRUCTURE_DIR = `${OUTPUT_DIR}/structure`;

// Types for analysis
interface HtmlStructure {
  type: string;
  elementCounts: Record<string, number>;
  classes: string[];
  ids: string[];
  tables: Array<{
    rows: number;
    headers: number;
    cells: number;
    classes: string | undefined;
  }>;
  totalElements: number;
}

interface GapAnalysis {
  gaps: {
    parsedCount: number;
    potentialCount: number;
    extractionRate: number;
    potentialItems: Record<string, number>;
  };
  suggestedSelectors: string[];
}

interface AnalysisResults {
  indicators: {
    parsed: FormulaIndicator[];
    structure: HtmlStructure;
    gaps: GapAnalysis;
  };
  samples: {
    parsed: FormulaSample[];
    structure: HtmlStructure;
    gaps: GapAnalysis;
  };
  docs: {
    parsed: FormulaDocumentation[];
    structure: HtmlStructure;
    gaps: GapAnalysis;
  };
}

/**
 * Fetch HTML from URL or read from local file
 */
async function fetchOrReadHtml(name: string, url: string, logger: any): Promise<string | null> {
  // Try public fetch (no auth)
  try {
    logger.info(`Attempting public fetch: ${url}`);
    const response = await fetch(url);
    if (response.ok) {
      const html = await response.text();
      logger.success(`Fetched ${name} (${html.length} bytes)`);
      return html;
    } else {
      logger.warning(`Public fetch returned ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    logger.warning(`Public fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Try reading from local file
  const localPath = `${RAW_DIR}/${name}.html`;
  try {
    logger.info(`Attempting to read local file: ${localPath}`);
    const html = await fs.readFile(localPath, 'utf-8');
    logger.success(`Read ${name} from local file (${html.length} bytes)`);
    return html;
  } catch (error) {
    logger.warning(`Local file not found: ${localPath}`);
  }

  return null;
}

/**
 * Fetch or read MIO URLs
 */
async function fetchMIOUrls(logger: any): Promise<Record<string, string>> {
  logger.subsection('Fetching MIO URLs');

  const urls = [
    { name: 'indicators', url: MIO_FORMULA_DATA_URLS.INDICATOR_LIST },
    { name: 'samples', url: MIO_FORMULA_DATA_URLS.SAMPLES },
    { name: 'docs', url: MIO_FORMULA_DATA_URLS.WHATS_NEW },
  ];

  const htmlData: Record<string, string> = {};

  for (const { name, url } of urls) {
    logger.info(`Processing ${name}...`);
    const html = await fetchOrReadHtml(name, url, logger);
    if (html) {
      htmlData[name] = html;
      // Save to local file
      FileWriter.writeText(`${RAW_DIR}/${name}.html`, html);
      logger.detail('Saved to', `${RAW_DIR}/${name}.html`);
    } else {
      logger.warning(`No data available for ${name}`);
    }
  }

  return htmlData;
}

/**
 * Run existing parsers
 */
async function runExistingParsers(
  htmlData: Record<string, string>,
  logger: any
): Promise<{
  indicators: FormulaIndicator[];
  samples: FormulaSample[];
  docs: FormulaDocumentation[];
}> {
  logger.subsection('Running Existing Parsers');

  const indicators: FormulaIndicator[] = htmlData.indicators
    ? FormulaDataManager.parseIndicatorsHtml(htmlData.indicators)
    : [];
  if (htmlData.indicators) {
    FileWriter.writeJSON(`${PARSED_DIR}/indicators.json`, indicators, true);
    logger.success(`Parsed ${indicators.length} indicators`);
  }

  const samples: FormulaSample[] = htmlData.samples
    ? FormulaDataManager.parseSamplesHtml(htmlData.samples)
    : [];
  if (htmlData.samples) {
    FileWriter.writeJSON(`${PARSED_DIR}/samples.json`, samples, true);
    logger.success(`Parsed ${samples.length} samples`);
  }

  const docs: FormulaDocumentation[] = htmlData.docs
    ? FormulaDataManager.parseDocsHtml(htmlData.docs)
    : [];
  if (htmlData.docs) {
    FileWriter.writeJSON(`${PARSED_DIR}/docs.json`, docs, true);
    logger.success(`Parsed ${docs.length} documentation sections`);
  }

  return { indicators, samples, docs };
}

/**
 * Analyze HTML structure
 */
function analyzeHtmlStructure(html: string, type: string): HtmlStructure {
  const $ = cheerio.load(html);

  const elementCounts: Record<string, number> = {};
  $('*').each((_, el) => {
    const tagName = $(el).prop('tagName')?.toLowerCase();
    if (tagName) {
      elementCounts[tagName] = (elementCounts[tagName] || 0) + 1;
    }
  });

  const classes = new Set<string>();
  $('[class]').each((_, el) => {
    const classList = $(el).attr('class')?.split(/\s+/) || [];
    classList.forEach(c => c && classes.add(c));
  });

  const ids = new Set<string>();
  $('[id]').each((_, el) => {
    const id = $(el).attr('id');
    if (id) ids.add(id);
  });

  const tables: Array<{ rows: number; headers: number; cells: number; classes: string | undefined }> = [];
  $('table').each((_, table) => {
    const $table = $(table);
    tables.push({
      rows: $table.find('tr').length,
      headers: $table.find('th').length,
      cells: $table.find('td').length,
      classes: $table.attr('class'),
    });
  });

  return {
    type,
    elementCounts,
    classes: Array.from(classes).sort(),
    ids: Array.from(ids).sort(),
    tables,
    totalElements: $('*').length,
  };
}

/**
 * Detect gaps
 */
function detectGaps(rawHtml: string, parsedData: any[], structure: HtmlStructure): GapAnalysis {
  const $ = cheerio.load(rawHtml);

  const potentialItems = {
    tableCells: $('td').length,
    tableRows: $('tr').length,
    listItems: $('li').length,
    codeBlocks: $('code, pre').length,
    textareas: $('textarea').length,
    divs: $('div').length,
  };

  const maxPotential = Math.max(...Object.values(potentialItems), 1);
  const extractionRate = parsedData.length / maxPotential;

  const suggestedSelectors: string[] = [];
  const dataKeywords = ['name', 'description', 'syntax', 'formula', 'indicator', 'sample', 'title', 'content', 'text'];

  structure.classes.forEach((cls: string) => {
    const lowerCls = cls.toLowerCase();
    if (dataKeywords.some(keyword => lowerCls.includes(keyword))) {
      const count = $(`.${cls}`).length;
      if (count > 0) {
        suggestedSelectors.push(`.${cls} (${count} elements)`);
      }
    }
  });

  return {
    gaps: {
      parsedCount: parsedData.length,
      potentialCount: maxPotential,
      extractionRate,
      potentialItems,
    },
    suggestedSelectors,
  };
}

/**
 * Generate diagnostic report
 */
function generateDiagnosticReport(results: AnalysisResults): string {
  let report = '# MIO Structure Analysis Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '---\n\n';

  // Indicators section
  report += '## INDICATORS\n\n';
  report += `**URL:** ${MIO_FORMULA_DATA_URLS.INDICATOR_LIST}\n\n`;
  report += '### Parser Results\n';
  report += `- Items extracted: **${results.indicators.parsed.length}**\n`;
  report += `- First 5 indicators:\n`;
  results.indicators.parsed.slice(0, 5).forEach(ind => {
    report += `  - ${ind.name}: ${ind.syntax}\n`;
  });
  report += '\n### HTML Structure\n';
  report += `- Total elements: ${results.indicators.structure.totalElements}\n`;
  report += `- Tables: ${results.indicators.structure.tables.length}\n`;
  report += '\n### Gap Analysis\n';
  report += `- Parsed count: ${results.indicators.gaps.gaps.parsedCount}\n`;
  report += `- Extraction rate: ${(results.indicators.gaps.gaps.extractionRate * 100).toFixed(1)}%\n\n`;

  // Samples section
  report += '## SAMPLES\n\n';
  report += `**URL:** ${MIO_FORMULA_DATA_URLS.SAMPLES}\n\n`;
  report += '### Parser Results\n';
  report += `- Items extracted: **${results.samples.parsed.length}**\n`;
  report += '\n### Gap Analysis\n';
  report += `- Parsed count: ${results.samples.gaps.gaps.parsedCount}\n`;
  report += `- Extraction rate: ${(results.samples.gaps.gaps.extractionRate * 100).toFixed(1)}%\n\n`;

  // Documentation section
  report += '## DOCUMENTATION\n\n';
  report += `**URL:** ${MIO_FORMULA_DATA_URLS.WHATS_NEW}\n\n`;
  report += '### Parser Results\n';
  report += `- Items extracted: **${results.docs.parsed.length}**\n`;
  report += '\n### Gap Analysis\n';
  report += `- Parsed count: ${results.docs.gaps.gaps.parsedCount}\n`;
  report += `- Extraction rate: ${(results.docs.gaps.gaps.extractionRate * 100).toFixed(1)}%\n\n`;

  // Summary
  report += '## SUMMARY\n\n';
  const totalParsed = results.indicators.parsed.length + results.samples.parsed.length + results.docs.parsed.length;
  report += `- Total items extracted: ${totalParsed}\n`;
  report += `  - Indicators: ${results.indicators.parsed.length}\n`;
  report += `  - Samples: ${results.samples.parsed.length}\n`;
  report += `  - Documentation: ${results.docs.parsed.length}\n\n`;

  return report;
}

/**
 * Main execution
 */
async function main() {
  const output = new OutputManager({
    directory: OUTPUT_DIR,
    saveToFile: true,
    prettyPrint: true,
  });

  const logger = output.getLogger();

  logger.section('MIO Structure Analysis');

  try {
    // 1. Fetch or read URLs
    const htmlData = await fetchMIOUrls(logger);

    // 2. Check if we have data
    if (Object.keys(htmlData).length === 0) {
      logger.error('No HTML data available!');
      logger.info('To get HTML, you have two options:');
      logger.info('1. Save HTML manually by visiting URLs in your browser');
      logger.info('2. Use the live app to save HTML');
      process.exit(1);
    }

    logger.success(`Have data for: ${Object.keys(htmlData).join(', ')}`);

    // 3. Run existing parsers
    const parsed = await runExistingParsers(htmlData, logger);

    // 4. Analyze HTML structure
    logger.subsection('Analyzing HTML Structure');
    const structures: Record<string, HtmlStructure> = {};

    if (htmlData.indicators) {
      structures.indicators = analyzeHtmlStructure(htmlData.indicators, 'indicators');
      FileWriter.writeJSON(`${STRUCTURE_DIR}/indicators-structure.json`, structures.indicators, true);
      logger.success('Indicators structure analyzed');
    }

    if (htmlData.samples) {
      structures.samples = analyzeHtmlStructure(htmlData.samples, 'samples');
      FileWriter.writeJSON(`${STRUCTURE_DIR}/samples-structure.json`, structures.samples, true);
      logger.success('Samples structure analyzed');
    }

    if (htmlData.docs) {
      structures.docs = analyzeHtmlStructure(htmlData.docs, 'docs');
      FileWriter.writeJSON(`${STRUCTURE_DIR}/docs-structure.json`, structures.docs, true);
      logger.success('Documentation structure analyzed');
    }

    // 5. Detect gaps
    logger.subsection('Detecting Gaps');
    const gaps: Record<string, GapAnalysis> = {};

    if (htmlData.indicators && structures.indicators) {
      gaps.indicators = detectGaps(htmlData.indicators, parsed.indicators, structures.indicators);
      logger.success('Indicators gap analysis complete');
    }

    if (htmlData.samples && structures.samples) {
      gaps.samples = detectGaps(htmlData.samples, parsed.samples, structures.samples);
      logger.success('Samples gap analysis complete');
    }

    if (htmlData.docs && structures.docs) {
      gaps.docs = detectGaps(htmlData.docs, parsed.docs, structures.docs);
      logger.success('Documentation gap analysis complete');
    }

    // 6. Generate report
    logger.subsection('Generating Report');
    const results: AnalysisResults = {
      indicators: {
        parsed: parsed.indicators,
        structure: structures.indicators || { type: 'indicators', elementCounts: {}, classes: [], ids: [], tables: [], totalElements: 0 },
        gaps: gaps.indicators || { gaps: { parsedCount: 0, potentialCount: 0, extractionRate: 0, potentialItems: {} }, suggestedSelectors: [] },
      },
      samples: {
        parsed: parsed.samples,
        structure: structures.samples || { type: 'samples', elementCounts: {}, classes: [], ids: [], tables: [], totalElements: 0 },
        gaps: gaps.samples || { gaps: { parsedCount: 0, potentialCount: 0, extractionRate: 0, potentialItems: {} }, suggestedSelectors: [] },
      },
      docs: {
        parsed: parsed.docs,
        structure: structures.docs || { type: 'docs', elementCounts: {}, classes: [], ids: [], tables: [], totalElements: 0 },
        gaps: gaps.docs || { gaps: { parsedCount: 0, potentialCount: 0, extractionRate: 0, potentialItems: {} }, suggestedSelectors: [] },
      },
    };

    const report = generateDiagnosticReport(results);
    FileWriter.writeText(`${OUTPUT_DIR}/analysis-report.md`, report);

    logger.success('Analysis Complete');
    logger.detail('Report saved to', `${OUTPUT_DIR}/analysis-report.md`);
    logger.newline();
    logger.info('Summary:');
    logger.detail('  Indicators', `${parsed.indicators.length} parsed`);
    logger.detail('  Samples', `${parsed.samples.length} parsed`);
    logger.detail('  Documentation', `${parsed.docs.length} sections parsed`);
    
  } catch (error) {
    logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
