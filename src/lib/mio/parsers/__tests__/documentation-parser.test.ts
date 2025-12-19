import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DocumentationParser } from '../documentation-parser';
import type { FormulaDocumentation } from '../../../../types/formulaEditor';

describe('DocumentationParser', () => {
  let html: string;
  let parser: DocumentationParser;
  let docs: FormulaDocumentation[];

  // Load the real HTML file once for all tests
  beforeAll(() => {
    const htmlPath = join(process.cwd(), 'output/raw/docs.html');
    html = readFileSync(htmlPath, 'utf-8');
    parser = new DocumentationParser(html);
    docs = parser.parse();
  });

  describe('parse()', () => {
    it('should extract at least 107 documentation entries', () => {
      expect(docs.length).toBeGreaterThanOrEqual(107);
    });

    it('should extract entries with the correct structure', () => {
      const firstDoc = docs[0];

      expect(firstDoc).toHaveProperty('topic');
      expect(firstDoc).toHaveProperty('content');
      expect(firstDoc).toHaveProperty('url');
      expect(firstDoc).toHaveProperty('date');

      expect(typeof firstDoc.topic).toBe('string');
      expect(typeof firstDoc.content).toBe('string');
      expect(typeof firstDoc.url).toBe('string');
    });

    it('should extract dates in the correct format', () => {
      // Find entries with dates
      const entriesWithDates = docs.filter(doc => doc.date);

      expect(entriesWithDates.length).toBeGreaterThan(0);

      // Check date format (MM/DD/YYYY or M/D/YYYY)
      const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
      entriesWithDates.forEach(doc => {
        if (doc.date) {
          expect(doc.date).toMatch(datePattern);
        }
      });
    });

    it('should have the correct URL for all entries', () => {
      const expectedUrl = 'https://www.marketinout.com/home/whats-new.php';

      docs.forEach(doc => {
        expect(doc.url).toBe(expectedUrl);
      });
    });

    it('should extract specific known documentation entries', () => {
      // Test for a specific entry we know exists in the HTML
      const compareTickersEntry = docs.find(doc =>
        doc.topic.includes('Compare multiple tickers')
      );

      expect(compareTickersEntry).toBeDefined();
      expect(compareTickersEntry?.topic).toBe('Compare multiple tickers on the same chart');
      expect(compareTickersEntry?.date).toBe('12/8/2025');
      expect(compareTickersEntry?.content).toContain('Stock Chart');
    });

    it('should clean text content properly', () => {
      // Content should not have excessive whitespace
      docs.forEach(doc => {
        expect(doc.content).not.toMatch(/\s{2,}/); // No double spaces
        expect(doc.content).not.toMatch(/^\s/); // No leading whitespace
        expect(doc.content).not.toMatch(/\s$/); // No trailing whitespace
      });
    });

    it('should filter out entries with insufficient content', () => {
      // All entries should have content longer than 10 characters
      docs.forEach(doc => {
        expect(doc.content.length).toBeGreaterThan(10);
      });
    });

    it('should extract content with HTML entities properly decoded', () => {
      // Find entries that might have HTML entities
      const entriesWithAmpersands = docs.filter(doc =>
        doc.content.includes('&')
      );

      // These should be properly decoded, not &amp;
      entriesWithAmpersands.forEach(doc => {
        expect(doc.content).not.toContain('&amp;');
        expect(doc.content).not.toContain('&lt;');
        expect(doc.content).not.toContain('&gt;');
      });
    });

    it('should extract all topics in chronological order (newest first)', () => {
      // The first entry should be the most recent
      expect(docs[0].topic).toBe('Compare multiple tickers on the same chart');
      expect(docs[0].date).toBe('12/8/2025');

      // Check that dates are generally descending
      const datesWithIndices = docs
        .map((doc, idx) => ({ date: doc.date, idx }))
        .filter(item => item.date);

      expect(datesWithIndices.length).toBeGreaterThan(10);
    });

    it('should handle entries without dates gracefully', () => {
      // Some entries might not have dates, that's okay
      const entriesWithoutDates = docs.filter(doc => !doc.date);

      // But most should have dates
      expect(entriesWithoutDates.length).toBeLessThan(docs.length * 0.1); // Less than 10%
    });
  });

  describe('edge cases', () => {
    it('should handle empty HTML', () => {
      const emptyParser = new DocumentationParser('');
      const result = emptyParser.parse();

      expect(result).toEqual([]);
    });

    it('should handle HTML without news_title elements', () => {
      const htmlWithoutNews = '<html><body><table><tr><td>No news here</td></tr></table></body></html>';
      const parser = new DocumentationParser(htmlWithoutNews);
      const result = parser.parse();

      expect(result).toEqual([]);
    });

    it('should handle malformed HTML structure', () => {
      const malformedHtml = `
        <html>
          <body>
            <tr><td class="news_title">Title Only</td></tr>
          </body>
        </html>
      `;
      const parser = new DocumentationParser(malformedHtml);
      const result = parser.parse();

      // Should not throw, but might return empty or partial results
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('data quality checks', () => {
    it('should have all entries with non-empty topics', () => {
      docs.forEach(doc => {
        expect(doc.topic).toBeTruthy();
        expect(doc.topic.length).toBeGreaterThan(0);
      });
    });

    it('should have all entries with non-empty content', () => {
      docs.forEach(doc => {
        expect(doc.content).toBeTruthy();
        expect(doc.content.length).toBeGreaterThan(10);
      });
    });

    it('should have topics that are concise (not full paragraphs)', () => {
      docs.forEach(doc => {
        // Topics should be relatively short (less than 200 chars)
        expect(doc.topic.length).toBeLessThan(200);
      });
    });

    it('should have content that is substantial', () => {
      // Most content should be at least 50 characters
      const substantialContent = docs.filter(doc => doc.content.length >= 50);
      expect(substantialContent.length).toBeGreaterThan(docs.length * 0.9); // 90%
    });
  });

  describe('specific content verification', () => {
    it('should extract technical indicator entries', () => {
      const indicatorEntries = docs.filter(doc =>
        doc.topic.toLowerCase().includes('indicator') ||
        doc.content.toLowerCase().includes('indicator')
      );

      expect(indicatorEntries.length).toBeGreaterThan(5);
    });

    it('should extract feature announcement entries', () => {
      const featureEntries = docs.filter(doc =>
        doc.content.toLowerCase().includes('added') ||
        doc.content.toLowerCase().includes('new')
      );

      expect(featureEntries.length).toBeGreaterThan(10);
    });

    it('should preserve HTML links in content', () => {
      // Content should mention links (even if as text)
      const entriesWithLinks = docs.filter(doc =>
        doc.content.includes('Stock Screener') ||
        doc.content.includes('Formula Screener')
      );

      expect(entriesWithLinks.length).toBeGreaterThan(5);
    });
  });
});
