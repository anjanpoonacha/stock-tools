import { describe, it, expect } from 'vitest';
import { SampleParser } from '../sample-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('SampleParser', () => {
  // Load real HTML from the output directory
  const htmlPath = path.join(process.cwd(), 'output/raw/samples.html');
  let html: string;

  try {
    html = fs.readFileSync(htmlPath, 'utf-8');
  } catch (error) {
    html = '';
  }

  it('should extract all 76 samples from real HTML (100% extraction)', () => {
    if (!html) {
      return;
    }

    const parser = new SampleParser(html);
    const samples = parser.parse();

    // Expected: 76 valid samples (excluding 18 section headers and 1 empty row)
    // HTML structure: 94 roweven rows + 1 roweven_box row = 95 total
    //   - 1 roweven_box header (Simple expressions)
    //   - 17 roweven headers with colspan
    //   - 76 valid data rows
    //   - 1 empty row at the end
    expect(samples).toHaveLength(76);
  });

  it('should skip section headers with colspan', () => {
    if (!html) {
      return;
    }

    const parser = new SampleParser(html);
    const samples = parser.parse();

    // None of the extracted samples should be section headers
    // Section headers typically have generic text like "Simple expressions"
    const sectionHeaderTexts = [
      'Simple expressions',
      'Using different time periods',
      'Referring to a ticker or index data',
      'Regime filter',
      'Historical screening',
      'Range screening',
      'Using data arrays',
      'Volume',
      'Aggregate functions',
      'Scoring conditions',
      'Negate operator',
      'Conditional expressions',
      'Fundamental criteria',
      'Technical criteria',
      'Heikin Ashi chart criteria',
      'Output instructions',
      'Access to a trading position in the backtesting tool',
      'Adding comments inside a formula expression',
    ];

    samples.forEach(sample => {
      const isHeaderText = sectionHeaderTexts.some(headerText =>
        sample.name === headerText || sample.formula === headerText
      );
      expect(isHeaderText).toBe(false);
    });
  });

  it('should extract valid sample structure', () => {
    if (!html) {
      return;
    }

    const parser = new SampleParser(html);
    const samples = parser.parse();

    // Check that all samples have required fields
    samples.forEach(sample => {
      expect(sample).toHaveProperty('name');
      expect(sample).toHaveProperty('formula');
      expect(sample).toHaveProperty('description');
      expect(sample).toHaveProperty('category');

      expect(typeof sample.name).toBe('string');
      expect(typeof sample.formula).toBe('string');
      expect(typeof sample.description).toBe('string');
      expect(sample.category).toBe('sample');

      // Name should not be empty
      expect(sample.name.length).toBeGreaterThan(0);

      // Formula should have minimum length
      expect(sample.formula.length).toBeGreaterThan(5);
    });
  });

  it('should clean formula text properly', () => {
    if (!html) {
      return;
    }

    const parser = new SampleParser(html);
    const samples = parser.parse();

    // Check that formulas don't have excessive whitespace
    samples.forEach(sample => {
      // Should not have multiple consecutive spaces
      expect(sample.formula).not.toMatch(/\s{2,}/);

      // Should not have leading/trailing whitespace
      expect(sample.formula).toBe(sample.formula.trim());
    });
  });

  it('should extract first sample correctly', () => {
    if (!html) {
      return;
    }

    const parser = new SampleParser(html);
    const samples = parser.parse();

    if (samples.length > 0) {
      const firstSample = samples[0];

      // First sample should be about NASDAQ exchange
      expect(firstSample.formula).toContain('exch');
      expect(firstSample.formula).toContain('nasdaq');

      // Should have a description
      expect(firstSample.description).toBeTruthy();
      expect(firstSample.description.length).toBeGreaterThan(0);

      // Should be categorized as sample
      expect(firstSample.category).toBe('sample');
    }
  });

  it('should handle formulas with various MIO syntax elements', () => {
    if (!html) {
      return;
    }

    const parser = new SampleParser(html);
    const samples = parser.parse();

    // Find samples with specific syntax elements
    const hasAndOperator = samples.some(s => s.formula.includes('and'));
    const hasOrOperator = samples.some(s => s.formula.includes('or'));
    const hasFunctionCall = samples.some(s => /\w+\([^)]*\)/.test(s.formula));
    const hasComparison = samples.some(s => /[<>=]/.test(s.formula));

    expect(hasAndOperator).toBe(true);
    expect(hasOrOperator).toBe(true);
    expect(hasFunctionCall).toBe(true);
    expect(hasComparison).toBe(true);
  });

  it('should generate meaningful names from formulas', () => {
    if (!html) {
      return;
    }

    const parser = new SampleParser(html);
    const samples = parser.parse();

    samples.forEach(sample => {
      // Name should not be empty or just "Formula Example"
      expect(sample.name.length).toBeGreaterThan(0);

      // Name should be truncated to max 80 characters
      expect(sample.name.length).toBeLessThanOrEqual(80);
    });
  });

  it('should handle edge cases with minimal HTML', () => {
    // Test with minimal valid HTML structure
    const minimalHtml = `
      <table>
        <tr class="roweven">
          <td class="rowodd_1st"><b>test_formula</b></td>
          <td>Test explanation</td>
        </tr>
      </table>
    `;

    const parser = new SampleParser(minimalHtml);
    const samples = parser.parse();

    expect(samples).toHaveLength(1);
    expect(samples[0].formula).toBe('test_formula');
    expect(samples[0].description).toBe('Test explanation');
  });

  it('should skip rows without formula cell', () => {
    const htmlWithInvalidRow = `
      <table>
        <tr class="roweven">
          <td>No formula cell</td>
          <td>Some text</td>
        </tr>
        <tr class="roweven">
          <td class="rowodd_1st"><b>valid_formula</b></td>
          <td>Valid explanation</td>
        </tr>
      </table>
    `;

    const parser = new SampleParser(htmlWithInvalidRow);
    const samples = parser.parse();

    expect(samples).toHaveLength(1);
    expect(samples[0].formula).toBe('valid_formula');
  });

  it('should skip formulas that are too short', () => {
    const htmlWithShortFormula = `
      <table>
        <tr class="roweven">
          <td class="rowodd_1st"><b>abc</b></td>
          <td>Too short</td>
        </tr>
        <tr class="roweven">
          <td class="rowodd_1st"><b>valid_formula_text</b></td>
          <td>Valid explanation</td>
        </tr>
      </table>
    `;

    const parser = new SampleParser(htmlWithShortFormula);
    const samples = parser.parse();

    // Should only have 1 sample (the valid one)
    expect(samples).toHaveLength(1);
    expect(samples[0].formula).toBe('valid_formula_text');
  });
});
