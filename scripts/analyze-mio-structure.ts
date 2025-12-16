// scripts/analyze-mio-structure.ts
// Diagnostic script to analyze MIO HTML structure and compare against our parsers

import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import { FormulaDataManager, MIO_FORMULA_DATA_URLS } from '../src/lib/mio/formulaData.js';
import type { FormulaIndicator, FormulaSample, FormulaDocumentation } from '../src/types/formulaEditor';

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
 * Tries public fetch first (no auth), falls back to local file
 */
async function fetchOrReadHtml(name: string, url: string): Promise<string | null> {
  // Try 1: Public fetch (no auth)
  try {
    console.log(`  Attempting public fetch: ${url}`);
    const response = await fetch(url);
    if (response.ok) {
      const html = await response.text();
      console.log(`    ✓ Fetched ${name} (${html.length} bytes)`);
      return html;
    } else {
      console.log(`    ✗ Public fetch returned ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`    ✗ Public fetch failed: ${errorMessage}`);
  }

  // Try 2: Read from local file
  const localPath = `${RAW_DIR}/${name}.html`;
  try {
    console.log(`  Attempting to read local file: ${localPath}`);
    const html = await fs.readFile(localPath, 'utf-8');
    console.log(`    ✓ Read ${name} from local file (${html.length} bytes)`);
    return html;
  } catch (error) {
    console.log(`    ✗ Local file not found: ${localPath}`);
  }

  return null;
}

/**
 * Create output directories if they don't exist
 */
async function createOutputDirectories(): Promise<void> {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(PARSED_DIR, { recursive: true });
  await fs.mkdir(STRUCTURE_DIR, { recursive: true });
}

/**
 * Fetch or read MIO URLs and return HTML data
 */
async function fetchMIOUrls(): Promise<Record<string, string>> {
  console.log('\nFetching MIO URLs...');

  const urls = [
    { name: 'indicators', url: MIO_FORMULA_DATA_URLS.INDICATOR_LIST },
    { name: 'samples', url: MIO_FORMULA_DATA_URLS.SAMPLES },
    { name: 'docs', url: MIO_FORMULA_DATA_URLS.WHATS_NEW },
  ];

  const htmlData: Record<string, string> = {};

  for (const { name, url } of urls) {
    console.log(`\n- Processing ${name}:`);
    const html = await fetchOrReadHtml(name, url);
    if (html) {
      htmlData[name] = html;
      // Save to local file for future use
      await fs.writeFile(`${RAW_DIR}/${name}.html`, html);
      console.log(`    Saved to ${RAW_DIR}/${name}.html`);
    } else {
      console.warn(`    ⚠️  No data available for ${name}`);
    }
  }

  return htmlData;
}

/**
 * Run existing parsers on HTML data
 */
async function runExistingParsers(htmlData: Record<string, string>): Promise<{
  indicators: FormulaIndicator[];
  samples: FormulaSample[];
  docs: FormulaDocumentation[];
}> {
  console.log('\nRunning existing parsers...');

  // Run parsers
  const indicators: FormulaIndicator[] = htmlData.indicators
    ? FormulaDataManager.parseIndicatorsHtml(htmlData.indicators)
    : [];
  if (htmlData.indicators) {
    await fs.writeFile(`${PARSED_DIR}/indicators.json`, JSON.stringify(indicators, null, 2));
    console.log(`  - Parsing indicators... Found ${indicators.length} indicators`);
  } else {
    console.log('  - Skipping indicators (no data)');
  }

  const samples: FormulaSample[] = htmlData.samples
    ? FormulaDataManager.parseSamplesHtml(htmlData.samples)
    : [];
  if (htmlData.samples) {
    await fs.writeFile(`${PARSED_DIR}/samples.json`, JSON.stringify(samples, null, 2));
    console.log(`  - Parsing samples... Found ${samples.length} samples`);
  } else {
    console.log('  - Skipping samples (no data)');
  }

  const docs: FormulaDocumentation[] = htmlData.docs
    ? FormulaDataManager.parseDocsHtml(htmlData.docs)
    : [];
  if (htmlData.docs) {
    await fs.writeFile(`${PARSED_DIR}/docs.json`, JSON.stringify(docs, null, 2));
    console.log(`  - Parsing documentation... Found ${docs.length} documentation sections`);
  } else {
    console.log('  - Skipping documentation (no data)');
  }

  return { indicators, samples, docs };
}

/**
 * Analyze HTML structure in detail
 */
function analyzeHtmlStructure(html: string, type: string): HtmlStructure {
  const $ = cheerio.load(html);

  // Count all element types
  const elementCounts: Record<string, number> = {};
  $('*').each((_, el) => {
    const tagName = $(el).prop('tagName')?.toLowerCase();
    if (tagName) {
      elementCounts[tagName] = (elementCounts[tagName] || 0) + 1;
    }
  });

  // Extract all classes
  const classes = new Set<string>();
  $('[class]').each((_, el) => {
    const classList = $(el).attr('class')?.split(/\s+/) || [];
    classList.forEach(c => c && classes.add(c));
  });

  // Extract all IDs
  const ids = new Set<string>();
  $('[id]').each((_, el) => {
    const id = $(el).attr('id');
    if (id) ids.add(id);
  });

  // Analyze tables
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
 * Detect gaps between parsed data and HTML structure
 */
function detectGaps(rawHtml: string, parsedData: any[], structure: HtmlStructure): GapAnalysis {
  const $ = cheerio.load(rawHtml);

  // Count potential data items in HTML
  const potentialItems = {
    tableCells: $('td').length,
    tableRows: $('tr').length,
    listItems: $('li').length,
    codeBlocks: $('code, pre').length,
    textareas: $('textarea').length,
    divs: $('div').length,
  };

  // Calculate extraction rate
  const maxPotential = Math.max(...Object.values(potentialItems), 1);
  const extractionRate = parsedData.length / maxPotential;

  // Find suggested selectors based on classes that might contain data
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
 * Generate detailed diagnostic report
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
  report += '\n';

  report += '### HTML Structure\n';
  report += `- Total elements: ${results.indicators.structure.totalElements}\n`;
  report += `- Tables: ${results.indicators.structure.tables.length}\n`;
  if (results.indicators.structure.tables.length > 0) {
    const table = results.indicators.structure.tables[0];
    report += `  - First table: ${table.rows} rows, ${table.cells} cells\n`;
  }
  report += `- Total classes: ${results.indicators.structure.classes.length}\n`;
  report += `- Total IDs: ${results.indicators.structure.ids.length}\n`;
  report += '\n';

  report += '### Element Breakdown\n';
  const topElements = Object.entries(results.indicators.structure.elementCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  topElements.forEach(([tag, count]) => {
    report += `- ${tag}: ${count}\n`;
  });
  report += '\n';

  report += '### Gap Analysis\n';
  report += `- Parsed count: ${results.indicators.gaps.gaps.parsedCount}\n`;
  report += `- Potential items in HTML:\n`;
  Object.entries(results.indicators.gaps.gaps.potentialItems).forEach(([type, count]) => {
    report += `  - ${type}: ${count}\n`;
  });
  report += `- Extraction rate: ${(results.indicators.gaps.gaps.extractionRate * 100).toFixed(1)}%\n\n`;

  if (results.indicators.gaps.suggestedSelectors.length > 0) {
    report += '### Suggested Selectors\n';
    results.indicators.gaps.suggestedSelectors.forEach(selector => {
      report += `- ${selector}\n`;
    });
    report += '\n';
  }

  report += '### Notable Classes\n';
  results.indicators.structure.classes.slice(0, 20).forEach(cls => {
    report += `- ${cls}\n`;
  });
  report += '\n';

  report += '---\n\n';

  // Samples section
  report += '## SAMPLES\n\n';
  report += `**URL:** ${MIO_FORMULA_DATA_URLS.SAMPLES}\n\n`;

  report += '### Parser Results\n';
  report += `- Items extracted: **${results.samples.parsed.length}**\n`;
  report += `- First 5 samples:\n`;
  results.samples.parsed.slice(0, 5).forEach(sample => {
    report += `  - ${sample.name}\n`;
    report += `    Formula: ${sample.formula.substring(0, 60)}${sample.formula.length > 60 ? '...' : ''}\n`;
  });
  report += '\n';

  report += '### HTML Structure\n';
  report += `- Total elements: ${results.samples.structure.totalElements}\n`;
  report += `- Tables: ${results.samples.structure.tables.length}\n`;
  if (results.samples.structure.tables.length > 0) {
    const table = results.samples.structure.tables[0];
    report += `  - First table: ${table.rows} rows, ${table.cells} cells\n`;
  }
  report += `- Total classes: ${results.samples.structure.classes.length}\n`;
  report += `- Total IDs: ${results.samples.structure.ids.length}\n`;
  report += '\n';

  report += '### Element Breakdown\n';
  const topSampleElements = Object.entries(results.samples.structure.elementCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  topSampleElements.forEach(([tag, count]) => {
    report += `- ${tag}: ${count}\n`;
  });
  report += '\n';

  report += '### Gap Analysis\n';
  report += `- Parsed count: ${results.samples.gaps.gaps.parsedCount}\n`;
  report += `- Potential items in HTML:\n`;
  Object.entries(results.samples.gaps.gaps.potentialItems).forEach(([type, count]) => {
    report += `  - ${type}: ${count}\n`;
  });
  report += `- Extraction rate: ${(results.samples.gaps.gaps.extractionRate * 100).toFixed(1)}%\n\n`;

  if (results.samples.gaps.suggestedSelectors.length > 0) {
    report += '### Suggested Selectors\n';
    results.samples.gaps.suggestedSelectors.forEach(selector => {
      report += `- ${selector}\n`;
    });
    report += '\n';
  }

  report += '### Notable Classes\n';
  results.samples.structure.classes.slice(0, 20).forEach(cls => {
    report += `- ${cls}\n`;
  });
  report += '\n';

  report += '---\n\n';

  // Documentation section
  report += '## DOCUMENTATION\n\n';
  report += `**URL:** ${MIO_FORMULA_DATA_URLS.WHATS_NEW}\n\n`;

  report += '### Parser Results\n';
  report += `- Items extracted: **${results.docs.parsed.length}**\n`;
  report += `- First 5 sections:\n`;
  results.docs.parsed.slice(0, 5).forEach(doc => {
    report += `  - ${doc.topic}\n`;
    report += `    Content: ${doc.content.substring(0, 80)}${doc.content.length > 80 ? '...' : ''}\n`;
  });
  report += '\n';

  report += '### HTML Structure\n';
  report += `- Total elements: ${results.docs.structure.totalElements}\n`;
  report += `- Tables: ${results.docs.structure.tables.length}\n`;
  report += `- Total classes: ${results.docs.structure.classes.length}\n`;
  report += `- Total IDs: ${results.docs.structure.ids.length}\n`;
  report += '\n';

  report += '### Element Breakdown\n';
  const topDocElements = Object.entries(results.docs.structure.elementCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  topDocElements.forEach(([tag, count]) => {
    report += `- ${tag}: ${count}\n`;
  });
  report += '\n';

  report += '### Gap Analysis\n';
  report += `- Parsed count: ${results.docs.gaps.gaps.parsedCount}\n`;
  report += `- Potential items in HTML:\n`;
  Object.entries(results.docs.gaps.gaps.potentialItems).forEach(([type, count]) => {
    report += `  - ${type}: ${count}\n`;
  });
  report += `- Extraction rate: ${(results.docs.gaps.gaps.extractionRate * 100).toFixed(1)}%\n\n`;

  if (results.docs.gaps.suggestedSelectors.length > 0) {
    report += '### Suggested Selectors\n';
    results.docs.gaps.suggestedSelectors.forEach(selector => {
      report += `- ${selector}\n`;
    });
    report += '\n';
  }

  report += '### Notable Classes\n';
  results.docs.structure.classes.slice(0, 20).forEach(cls => {
    report += `- ${cls}\n`;
  });
  report += '\n';

  report += '---\n\n';

  // Summary section
  report += '## SUMMARY\n\n';

  const totalParsed = results.indicators.parsed.length + results.samples.parsed.length + results.docs.parsed.length;
  const avgExtraction = (
    (results.indicators.gaps.gaps.extractionRate +
      results.samples.gaps.gaps.extractionRate +
      results.docs.gaps.gaps.extractionRate) / 3
  ) * 100;

  report += '### Overall Statistics\n';
  report += `- Total items extracted: ${totalParsed}\n`;
  report += `  - Indicators: ${results.indicators.parsed.length}\n`;
  report += `  - Samples: ${results.samples.parsed.length}\n`;
  report += `  - Documentation sections: ${results.docs.parsed.length}\n`;
  report += `- Average extraction rate: ${avgExtraction.toFixed(1)}%\n\n`;

  report += '### Key Findings\n';
  report += '1. **Indicators**\n';
  report += `   - Extraction rate: ${(results.indicators.gaps.gaps.extractionRate * 100).toFixed(1)}%\n`;
  report += `   - ${results.indicators.gaps.gaps.parsedCount} items parsed from potential ${results.indicators.gaps.gaps.potentialCount}\n`;
  report += '\n';

  report += '2. **Samples**\n';
  report += `   - Extraction rate: ${(results.samples.gaps.gaps.extractionRate * 100).toFixed(1)}%\n`;
  report += `   - ${results.samples.gaps.gaps.parsedCount} items parsed from potential ${results.samples.gaps.gaps.potentialCount}\n`;
  report += '\n';

  report += '3. **Documentation**\n';
  report += `   - Extraction rate: ${(results.docs.gaps.gaps.extractionRate * 100).toFixed(1)}%\n`;
  report += `   - ${results.docs.gaps.gaps.parsedCount} items parsed from potential ${results.docs.gaps.gaps.potentialCount}\n`;
  report += '\n';

  report += '### Recommended Actions\n';
  report += '1. Review raw HTML files in `output/raw/` to understand actual structure\n';
  report += '2. Check parsed JSON files in `output/parsed/` to verify extraction quality\n';
  report += '3. Consider implementing suggested selectors for improved extraction\n';
  report += '4. Test parser strategies against different HTML patterns\n';
  report += '\n';

  report += '### Output Files\n';
  report += '- Raw HTML: `output/raw/*.html`\n';
  report += '- Parsed JSON: `output/parsed/*.json`\n';
  report += '- Structure analysis: `output/structure/*.json`\n';
  report += '- This report: `output/analysis-report.md`\n';

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== MIO Structure Analysis Script (No Auth) ===\n');

  try {
    // 1. Create output directories
    await createOutputDirectories();
    console.log(`Output directories created at: ${OUTPUT_DIR}`);

    // 2. Fetch or read URLs
    const htmlData = await fetchMIOUrls();

    // 3. Check if we have any data
    if (Object.keys(htmlData).length === 0) {
      console.error('\n❌ No HTML data available!');
      console.log('\nTo get HTML, you have two options:');
      console.log('\nOption 1: Save HTML manually');
      console.log('  1. Visit each URL in your browser:');
      console.log(`     - Indicators: ${MIO_FORMULA_DATA_URLS.INDICATOR_LIST}`);
      console.log(`     - Samples: ${MIO_FORMULA_DATA_URLS.SAMPLES}`);
      console.log(`     - Docs: ${MIO_FORMULA_DATA_URLS.WHATS_NEW}`);
      console.log('  2. Right-click and "Save As..." to output/raw/ directory');
      console.log('     - indicators.html, samples.html, docs.html');
      console.log('\nOption 2: Use live app');
      console.log('  1. Run: pnpm dev');
      console.log('  2. Add temporary fetch code in app to save HTML');
      console.log('  3. Save HTML to output/raw/ directory');
      process.exit(1);
    }

    console.log(`\n✓ Have data for: ${Object.keys(htmlData).join(', ')}`);

    // 4. Run existing parsers
    const parsed = await runExistingParsers(htmlData);

    // 5. Analyze HTML structure
    console.log('\nAnalyzing HTML structure...');
    const structures: Record<string, HtmlStructure> = {};

    if (htmlData.indicators) {
      structures.indicators = analyzeHtmlStructure(htmlData.indicators, 'indicators');
      await fs.writeFile(`${STRUCTURE_DIR}/indicators-structure.json`, JSON.stringify(structures.indicators, null, 2));
      console.log('  - Indicators structure analyzed');
    }

    if (htmlData.samples) {
      structures.samples = analyzeHtmlStructure(htmlData.samples, 'samples');
      await fs.writeFile(`${STRUCTURE_DIR}/samples-structure.json`, JSON.stringify(structures.samples, null, 2));
      console.log('  - Samples structure analyzed');
    }

    if (htmlData.docs) {
      structures.docs = analyzeHtmlStructure(htmlData.docs, 'docs');
      await fs.writeFile(`${STRUCTURE_DIR}/docs-structure.json`, JSON.stringify(structures.docs, null, 2));
      console.log('  - Documentation structure analyzed');
    }

    // 6. Detect gaps
    console.log('\nDetecting gaps...');
    const gaps: Record<string, GapAnalysis> = {};

    if (htmlData.indicators && structures.indicators) {
      gaps.indicators = detectGaps(htmlData.indicators, parsed.indicators, structures.indicators);
      console.log('  - Indicators gap analysis complete');
    }

    if (htmlData.samples && structures.samples) {
      gaps.samples = detectGaps(htmlData.samples, parsed.samples, structures.samples);
      console.log('  - Samples gap analysis complete');
    }

    if (htmlData.docs && structures.docs) {
      gaps.docs = detectGaps(htmlData.docs, parsed.docs, structures.docs);
      console.log('  - Documentation gap analysis complete');
    }

    // 7. Generate report
    console.log('\nGenerating report...');
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
    await fs.writeFile(`${OUTPUT_DIR}/analysis-report.md`, report);

    console.log('\n=== Analysis Complete ===\n');
    console.log(`Report saved to: ${OUTPUT_DIR}/analysis-report.md`);
    console.log('\nSummary:');
    console.log(`  - Indicators: ${parsed.indicators.length} parsed`);
    console.log(`  - Samples: ${parsed.samples.length} parsed`);
    console.log(`  - Documentation: ${parsed.docs.length} sections parsed`);
    console.log('\nCheck the output directory for detailed results.');
  } catch (error) {
    console.error('\nError during analysis:', error);
    process.exit(1);
  }
}

// Run the script
main();
