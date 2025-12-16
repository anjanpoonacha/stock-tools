/**
 * MIO Parser Module
 *
 * Provides parsers for extracting structured data from MIO API HTML responses.
 *
 * Core parsers:
 * - IndicatorParser: Extracts indicator definitions from HTML
 * - SampleParser: Extracts sample formulas from HTML
 * - DocumentationParser: Extracts documentation from HTML
 *
 * Convenience functions provide a simple API for common parsing tasks.
 */

import { IndicatorParser } from './indicator-parser';
import { SampleParser } from './sample-parser';
import { DocumentationParser } from './documentation-parser';

export { BaseParser } from './base-parser';
export { IndicatorParser } from './indicator-parser';
export { SampleParser } from './sample-parser';
export { DocumentationParser } from './documentation-parser';

/**
 * Parse indicators HTML and extract indicator definitions
 *
 * @param html Raw HTML from MIO indicators API
 * @returns Array of indicator definitions
 *
 * @example
 * const html = await fetch('/api/indicators').then(r => r.text());
 * const indicators = parseIndicatorsHtml(html);
 */
export function parseIndicatorsHtml(html: string): unknown[] {
  return new IndicatorParser(html).parse();
}

/**
 * Parse samples HTML and extract sample formula definitions
 *
 * @param html Raw HTML from MIO samples API
 * @returns Array of sample definitions
 *
 * @example
 * const html = await fetch('/api/samples').then(r => r.text());
 * const samples = parseSamplesHtml(html);
 */
export function parseSamplesHtml(html: string): unknown[] {
  return new SampleParser(html).parse();
}

/**
 * Parse documentation HTML and extract documentation entries
 *
 * @param html Raw HTML from MIO documentation API
 * @returns Array of documentation entries
 *
 * @example
 * const html = await fetch('/api/docs').then(r => r.text());
 * const docs = parseDocsHtml(html);
 */
export function parseDocsHtml(html: string): unknown[] {
  return new DocumentationParser(html).parse();
}
