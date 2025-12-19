import { BaseParser } from './base-parser';
import type { FormulaDocumentation } from '../../../types/formulaEditor';

/**
 * Parser for extracting documentation entries from MIO "What's New" page
 *
 * Extracts documentation entries from a 4-row HTML table structure:
 * - Row 1: Title (<td class="news_title">)
 * - Row 2: Date (<td class="news_date">)
 * - Row 3: Content (<td>)
 * - Row 4: Spacer (<td>&nbsp;</td>)
 *
 * @example
 * const html = fs.readFileSync('output/raw/docs.html', 'utf-8');
 * const parser = new DocumentationParser(html);
 * const docs = parser.parse();
 */
export class DocumentationParser extends BaseParser<FormulaDocumentation> {
  /**
   * Parse the HTML and extract documentation entries
   *
   * Iterates through all elements with class "news_title" and extracts
   * the associated date and content from subsequent table rows.
   *
   * @returns Array of documentation entries
   */
  parse(): FormulaDocumentation[] {
    const docs: FormulaDocumentation[] = [];

    this.$('.news_title').each((_, titleEl) => {
      const $titleTd = this.$(titleEl);
      const $titleRow = $titleTd.parent(); // Get <tr>
      const topic = $titleTd.text().trim();

      // Get date from next row
      const $dateRow = $titleRow.next();
      const date = $dateRow.find('.news_date').text().trim();

      // Get content from row after date
      const $contentRow = $dateRow.next();
      const content = $contentRow.find('td').text().trim();

      // Only add entries with valid content (longer than 10 chars to filter out junk)
      if (topic && content && content.length > 10) {
        docs.push({
          topic: topic,
          content: this.cleanText(content),
          url: 'https://www.marketinout.com/home/whats-new.php',
          date: date || undefined,
        });
      }
    });

    return docs;
  }
}
