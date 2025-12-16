import { BaseParser } from './base-parser';
import type { FormulaIndicator } from '@/types/formulaEditor';

/**
 * Parser for MIO indicator definitions
 *
 * Extracts indicator information from HTML tables including:
 * - Indicator name and syntax
 * - Description
 * - Parameters
 * - Category
 *
 * The HTML structure contains multiple tables with rows having class="roweven"
 * and first column having class="rowodd_1st" containing the syntax.
 */
export class IndicatorParser extends BaseParser<FormulaIndicator> {
  /**
   * Parse indicator HTML and extract all indicator definitions
   *
   * Processes only the indicator tables (those with "Indicator Example" title)
   * in the HTML document and extracts indicators from rows with the "roweven" class.
   * Each indicator has:
   * - syntax in the first td with class "rowodd_1st"
   * - description in the second td
   *
   * @returns Array of FormulaIndicator objects
   */
  parse(): FormulaIndicator[] {
    const indicators: FormulaIndicator[] = [];

    // Find all outer tables that contain the indicator sections
    this.$('table').each((_, outerTable) => {
      const $outerTable = this.$(outerTable);

      // Check if this table section has "Indicator Example" in the title
      const titleTable = $outerTable.find('table.title');
      const hasIndicatorTitle = titleTable.text().includes('Indicator Example');

      if (!hasIndicatorTitle) {
        return; // Skip non-indicator tables (Technical Events, Functions, etc.)
      }

      // Extract from the nested table with indicators
      $outerTable.find('tr.roweven').each((_, row) => {
        const $row = this.$(row);
        const syntax = $row.find('td.rowodd_1st').text().trim();
        const description = $row.find('td').eq(1).text().trim();

        // Only add if both syntax and description are present
        // and if syntax doesn't contain <b> tags (skip header rows)
        if (syntax && description && !syntax.includes('<b>')) {
          // Extract name from syntax (everything before the first parenthesis)
          const name = syntax.split('(')[0] || syntax;

          indicators.push({
            name: name,
            syntax: syntax,
            description: this.cleanText(description),
            category: 'indicator',
            parameters: this.extractParams(syntax),
          });
        }
      });
    });

    return indicators;
  }
}
