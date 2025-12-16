import { BaseParser } from './base-parser';
import type { FormulaSample } from '@/types/formulaEditor';

/**
 * Parser for extracting formula samples from MIO HTML
 *
 * Extracts sample formulas with their explanations from the MIO samples page.
 * The HTML structure contains data rows with formula examples and section headers
 * that should be skipped.
 *
 * HTML Structure:
 * - Data rows: <tr class="roweven"> with 2 <td> cells (formula and explanation)
 * - Section headers: <tr class="roweven_box"> with colspan attribute (skip these)
 *
 * @example
 * ```typescript
 * const html = fs.readFileSync('samples.html', 'utf-8');
 * const parser = new SampleParser(html);
 * const samples = parser.parse();
 * console.log(`Extracted ${samples.length} samples`);
 * ```
 */
export class SampleParser extends BaseParser<FormulaSample> {
  /**
   * Parse the HTML and extract formula samples
   *
   * Extracts formula samples from data rows while skipping section headers.
   * Each sample includes:
   * - name: Derived from the first line of the formula (up to 80 chars)
   * - formula: The formula text with cleaned whitespace
   * - description: The explanation text
   * - category: Set to 'sample' for all extracted samples
   *
   * @returns Array of formula samples
   */
  parse(): FormulaSample[] {
    const samples: FormulaSample[] = [];

    // Select all table rows with class "roweven"
    this.$('table tr.roweven').each((_, row) => {
      const $row = this.$(row);

      // Skip section headers (rows with colspan attribute)
      const hasColspan = $row.find('td[colspan]').length > 0;
      if (hasColspan) return;

      // Find the formula cell (first cell with class rowodd_1st)
      const $formulaTd = $row.find('td.rowodd_1st').first();
      if ($formulaTd.length === 0) return;

      // Extract formula text from the entire cell content
      // (formulas may be split across multiple <b> tags and fonts)
      const formula = $formulaTd.text().trim();

      // Extract explanation from second cell
      const explanation = $row.find('td').eq(1).text().trim();

      // Only include valid formulas (with minimum length)
      if (formula && formula.length > 5) {
        // Generate name from first line of formula (up to 80 chars)
        const name = formula.split('\n')[0].substring(0, 80).trim() || 'Formula Example';

        samples.push({
          name: name,
          formula: this.cleanText(formula),
          description: explanation || name,
          category: 'sample',
        });
      }
    });

    return samples;
  }
}
