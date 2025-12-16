import * as cheerio from 'cheerio';

/**
 * Abstract base parser for MIO HTML content
 *
 * Provides common functionality for parsing HTML responses from MIO API:
 * - HTML loading and DOM manipulation via cheerio
 * - Text cleaning utilities
 * - Parameter extraction from syntax strings
 *
 * @template T The type of parsed data this parser produces
 */
export abstract class BaseParser<T> {
  protected $: cheerio.CheerioAPI;

  /**
   * Creates a new parser instance
   *
   * @param html Raw HTML string to parse
   */
  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  /**
   * Parse the HTML and extract structured data
   *
   * @returns Array of parsed items
   */
  abstract parse(): T[];

  /**
   * Clean and normalize text content
   *
   * Removes extra whitespace, newlines, and trims the result.
   *
   * @param text Raw text content
   * @returns Cleaned text
   */
  protected cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract parameter names from function syntax
   *
   * Parses syntax like "FUNCTION(param1, param2, param3)" and extracts
   * the parameter list as an array.
   *
   * @param syntax Function syntax string
   * @returns Array of parameter names, empty array if no parameters found
   *
   * @example
   * extractParams("EMA(close, period)") // Returns: ["close", "period"]
   * extractParams("CLOSE()") // Returns: []
   * extractParams("INVALID") // Returns: []
   */
  protected extractParams(syntax: string): string[] {
    const match = syntax.match(/\(([^)]*)\)/);
    if (!match) return [];
    return match[1].split(',').map(p => p.trim()).filter(Boolean);
  }
}
