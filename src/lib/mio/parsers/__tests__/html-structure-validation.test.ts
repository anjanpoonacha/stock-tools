// src/lib/mio/parsers/__tests__/html-structure-validation.test.ts
// Tests that validate the HTML structure hasn't changed
// These tests will fail if MIO changes their page structure

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';

// __dirname is in src/lib/mio/parsers/__tests__/
// We need to go up 5 levels to reach project root, then into output/raw
const RAW_DIR = join(__dirname, '../../../../../output/raw');

/**
 * Structure validation tests
 * These tests check the raw HTML structure, NOT the parsing logic.
 * If these tests fail, it means MIO has changed their HTML structure
 * and the parsers need to be updated.
 */

describe('HTML Structure Validation - Indicators', () => {
  const htmlPath = join(RAW_DIR, 'indicators.html');

  it('should have the indicators.html file', () => {
    expect(existsSync(htmlPath)).toBe(true);
  });

  const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf-8') : '';
  const $ = cheerio.load(html);

  it('should have table structure', () => {
    const tables = $('table');
    expect(tables.length).toBeGreaterThan(0);
  });

  it('should have rows with class "roweven"', () => {
    const rows = $('tr.roweven');
    expect(rows.length).toBeGreaterThan(200); // Should have ~400+ rows
  });

  it('should have cells with class "rowodd_1st"', () => {
    const cells = $('td.rowodd_1st');
    expect(cells.length).toBeGreaterThan(200); // Should have many first column cells
  });

  it('should have expected indicator pattern (syntax + description)', () => {
    // Check first few indicators have the expected 2-column structure
    let validRows = 0;
    $('tr.roweven').slice(0, 10).each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      if (cells.length === 2) {
        const firstCell = cells.eq(0).text().trim();
        const secondCell = cells.eq(1).text().trim();
        if (firstCell && secondCell) {
          validRows++;
        }
      }
    });
    expect(validRows).toBeGreaterThan(5); // At least 5 valid rows in first 10
  });

  it('should have "Indicator Example" section markers', () => {
    const content = $.text();
    expect(content).toContain('Indicator Example');
  });

  it('should have known indicators (ac, ema, rsi, macd)', () => {
    const content = $.text();
    expect(content).toContain('ac(5,34,5)');
    expect(content).toContain('ema(50)');
    expect(content).toContain('rsi(14)');
    expect(content).toContain('macd(12,26,9)');
  });

  it('should not have unexpected structural changes', () => {
    // Check that we still have the basic structure we expect
    const tables = $('table').length;
    const rows = $('tr.roweven').length;
    const firstCells = $('td.rowodd_1st').length;

    // These are sanity checks - if they fail, structure has changed significantly
    expect(tables).toBeGreaterThan(0);
    expect(rows).toBeGreaterThan(100);
    expect(firstCells).toBeGreaterThan(100);

    // The ratio should be close to 1:1 (each roweven should have one rowodd_1st)
    const ratio = firstCells / rows;
    expect(ratio).toBeGreaterThan(0.3); // Allow some variance
    expect(ratio).toBeLessThan(3); // But not too much
  });
});

describe('HTML Structure Validation - Samples', () => {
  const htmlPath = join(RAW_DIR, 'samples.html');

  it('should have the samples.html file', () => {
    expect(existsSync(htmlPath)).toBe(true);
  });

  const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf-8') : '';
  const $ = cheerio.load(html);

  it('should have table structure', () => {
    const tables = $('table');
    expect(tables.length).toBeGreaterThan(0);
  });

  it('should have rows with class "roweven"', () => {
    const rows = $('tr.roweven');
    expect(rows.length).toBeGreaterThan(50); // Should have 70+ data rows
  });

  it('should have section headers with "roweven_box"', () => {
    const headers = $('tr.roweven_box');
    expect(headers.length).toBeGreaterThan(0); // Should have section headers
  });

  it('should have section headers with colspan attribute', () => {
    const colspanCells = $('td[colspan]');
    expect(colspanCells.length).toBeGreaterThan(10); // Should have multiple section headers
  });

  it('should have cells with class "rowodd_1st"', () => {
    const cells = $('td.rowodd_1st');
    expect(cells.length).toBeGreaterThan(50); // Should have many formula cells
  });

  it('should have formulas in <b> tags', () => {
    const boldTags = $('td.rowodd_1st b');
    expect(boldTags.length).toBeGreaterThan(40); // Most formulas are bold
  });

  it('should have expected sample pattern (formula + explanation)', () => {
    // Check that non-header rows have 2 cells
    let validRows = 0;
    $('tr.roweven').each((_, row) => {
      const $row = $(row);
      const hasColspan = $row.find('td[colspan]').length > 0;
      if (!hasColspan) {
        const cells = $row.find('td');
        if (cells.length === 2) {
          const firstCell = cells.eq(0).text().trim();
          const secondCell = cells.eq(1).text().trim();
          if (firstCell.length > 5 && secondCell) {
            validRows++;
          }
        }
      }
    });
    expect(validRows).toBeGreaterThan(50); // Should have 70+ valid formula rows
  });

  it('should have known sample patterns (exch, cap, price)', () => {
    const content = $.text();
    expect(content).toContain('exch(');
    expect(content).toContain('cap >');
    expect(content).toContain('price');
  });

  it('should not have unexpected structural changes', () => {
    const tables = $('table').length;
    const rows = $('tr.roweven').length;
    const headers = $('tr.roweven_box').length;
    const dataCells = $('td.rowodd_1st').length;

    expect(tables).toBeGreaterThan(0);
    expect(rows).toBeGreaterThan(70);
    expect(headers).toBeGreaterThan(0);
    expect(dataCells).toBeGreaterThan(50);
  });
});

describe('HTML Structure Validation - Documentation', () => {
  const htmlPath = join(RAW_DIR, 'docs.html');

  it('should have the docs.html file', () => {
    expect(existsSync(htmlPath)).toBe(true);
  });

  const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf-8') : '';
  const $ = cheerio.load(html);

  it('should have table structure', () => {
    const tables = $('table');
    expect(tables.length).toBeGreaterThan(0);
  });

  it('should have cells with class "news_title"', () => {
    const titles = $('.news_title');
    expect(titles.length).toBeGreaterThan(100); // Should have 100+ documentation entries
  });

  it('should have cells with class "news_date"', () => {
    const dates = $('.news_date');
    expect(dates.length).toBeGreaterThan(100); // Should have 100+ date entries
  });

  it('should have expected 4-row documentation pattern', () => {
    // Find a title and check the pattern
    const $firstTitle = $('.news_title').first().parent(); // Get <tr>
    expect($firstTitle.length).toBe(1);

    // Check next rows exist
    const $dateRow = $firstTitle.next();
    const $contentRow = $dateRow.next();
    const $spacerRow = $contentRow.next();

    expect($dateRow.length).toBe(1);
    expect($contentRow.length).toBe(1);
    expect($spacerRow.length).toBe(1);

    // Check date row has news_date class
    expect($dateRow.find('.news_date').length).toBe(1);
  });

  it('should have known documentation topics', () => {
    const content = $.text();
    // Check for some recent and old documentation entries
    expect(content.toLowerCase()).toContain('chart');
    expect(content.toLowerCase()).toContain('indicator');
  });

  it('should have dates in expected format', () => {
    // Check that dates match MM/DD/YYYY or similar patterns
    const dates: string[] = [];
    $('.news_date').each((_, el) => {
      const text = $(el).text().trim();
      if (text) dates.push(text);
    });

    expect(dates.length).toBeGreaterThan(100);

    // Check first few dates have numbers and slashes
    const firstDate = dates[0];
    expect(firstDate).toMatch(/\d+\/\d+\/\d+/);
  });

  it('should not have unexpected structural changes', () => {
    const tables = $('table').length;
    const titles = $('.news_title').length;
    const dates = $('.news_date').length;

    expect(tables).toBeGreaterThan(0);
    expect(titles).toBeGreaterThan(100);
    expect(dates).toBeGreaterThan(100);

    // Titles and dates should be roughly equal (1:1 ratio)
    expect(Math.abs(titles - dates)).toBeLessThan(5);
  });
});

describe('HTML Structure Validation - Cross-File Checks', () => {
  it('should have all three HTML files', () => {
    expect(existsSync(join(RAW_DIR, 'indicators.html'))).toBe(true);
    expect(existsSync(join(RAW_DIR, 'samples.html'))).toBe(true);
    expect(existsSync(join(RAW_DIR, 'docs.html'))).toBe(true);
  });

  it('should have consistent table structure across files', () => {
    const files = ['indicators.html', 'samples.html', 'docs.html'];

    files.forEach(file => {
      const html = readFileSync(join(RAW_DIR, file), 'utf-8');
      const $ = cheerio.load(html);

      // All files should have tables
      expect($('table').length).toBeGreaterThan(0);

      // All files should have rows
      expect($('tr').length).toBeGreaterThan(10);

      // All files should have cells
      expect($('td').length).toBeGreaterThan(20);
    });
  });

  it('should detect if HTML becomes empty or corrupted', () => {
    const files = ['indicators.html', 'samples.html', 'docs.html'];

    files.forEach(file => {
      const html = readFileSync(join(RAW_DIR, file), 'utf-8');

      // Files should not be empty
      expect(html.length).toBeGreaterThan(1000);

      // Files should contain HTML
      expect(html).toContain('<');
      expect(html).toContain('>');

      // Files should have table tags
      expect(html).toContain('<table');
      expect(html).toContain('<tr');
      expect(html).toContain('<td');
    });
  });
});
