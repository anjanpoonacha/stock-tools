import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IndicatorParser } from '../indicator-parser';

describe('IndicatorParser', () => {
  describe('parse real HTML', () => {
    test('should extract all 226 indicators from indicators.html', () => {
      // Load the actual HTML file
      const htmlPath = join(process.cwd(), 'output/raw/indicators.html');
      const html = readFileSync(htmlPath, 'utf-8');

      // Parse the HTML
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      // Verify we extracted all expected indicators
      // Note: The HTML contains 227 potential indicators, but one (rci) is commented out
      expect(indicators.length).toBe(226);
    });

    test('should correctly parse indicator structure', () => {
      const htmlPath = join(process.cwd(), 'output/raw/indicators.html');
      const html = readFileSync(htmlPath, 'utf-8');

      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      // Verify all indicators have required fields
      indicators.forEach((indicator) => {
        expect(indicator).toHaveProperty('name');
        expect(indicator).toHaveProperty('syntax');
        expect(indicator).toHaveProperty('description');
        expect(indicator).toHaveProperty('category');
        expect(indicator).toHaveProperty('parameters');

        // Verify field types
        expect(typeof indicator.name).toBe('string');
        expect(typeof indicator.syntax).toBe('string');
        expect(typeof indicator.description).toBe('string');
        expect(typeof indicator.category).toBe('string');
        expect(Array.isArray(indicator.parameters)).toBe(true);

        // Verify name and syntax are not empty
        expect(indicator.name.length).toBeGreaterThan(0);
        expect(indicator.syntax.length).toBeGreaterThan(0);
        expect(indicator.description.length).toBeGreaterThan(0);
      });
    });

    test('should correctly extract specific known indicators', () => {
      const htmlPath = join(process.cwd(), 'output/raw/indicators.html');
      const html = readFileSync(htmlPath, 'utf-8');

      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      // Test ac (Accelerator Oscillator) - first indicator in the list
      const ac = indicators.find((i) => i.name === 'ac');
      expect(ac).toBeDefined();
      expect(ac?.syntax).toBe('ac(5,34,5)');
      expect(ac?.description).toBe('Accelerator Oscillator');
      expect(ac?.category).toBe('indicator');
      expect(ac?.parameters).toEqual(['5', '34', '5']);

      // Test ema (Exponential Moving Average)
      const ema = indicators.find((i) => i.name === 'ema' && i.syntax === 'ema(50)');
      expect(ema).toBeDefined();
      expect(ema?.syntax).toBe('ema(50)');
      expect(ema?.description).toBe('Exponential Moving Average');
      expect(ema?.parameters).toEqual(['50']);

      // Test rsi (Relative Strength Index)
      const rsi = indicators.find((i) => i.name === 'rsi');
      expect(rsi).toBeDefined();
      expect(rsi?.syntax).toBe('rsi(14)');
      expect(rsi?.description).toBe('Relative Strength Index');
      expect(rsi?.parameters).toEqual(['14']);

      // Test indicators without parameters
      const ad = indicators.find((i) => i.name === 'ad');
      expect(ad).toBeDefined();
      expect(ad?.syntax).toBe('ad');
      expect(ad?.description).toBe('Accumulation / Distribution');
      expect(ad?.parameters).toEqual([]);

      // Test macd
      const macd = indicators.find((i) => i.name === 'macd');
      expect(macd).toBeDefined();
      expect(macd?.syntax).toBe('macd(12,26,9)');
      expect(macd?.description).toBe('MACD');
      expect(macd?.parameters).toEqual(['12', '26', '9']);

      // Test last indicator (zigzag)
      const zigzag = indicators.find((i) => i.name === 'zigzag');
      expect(zigzag).toBeDefined();
      expect(zigzag?.syntax).toBe('zigzag(7)');
      expect(zigzag?.description).toBe('ZigZag');
      expect(zigzag?.parameters).toEqual(['7']);
    });

    test('should extract market breadth indicators', () => {
      const htmlPath = join(process.cwd(), 'output/raw/indicators.html');
      const html = readFileSync(htmlPath, 'utf-8');

      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      // Test indicators from second table (market breadth)
      const advdec = indicators.find((i) => i.name === 'advdec');
      expect(advdec).toBeDefined();
      expect(advdec?.syntax).toBe('advdec');
      expect(advdec?.description).toBe('Advance/Decline Line');
      expect(advdec?.parameters).toEqual([]);

      const trin = indicators.find((i) => i.name === 'trin');
      expect(trin).toBeDefined();
      expect(trin?.syntax).toBe('trin');
      expect(trin?.description).toBe('Arms Index');
      expect(trin?.parameters).toEqual([]);
    });

    test('should handle complex syntax with nested indicators', () => {
      const htmlPath = join(process.cwd(), 'output/raw/indicators.html');
      const html = readFileSync(htmlPath, 'utf-8');

      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      // Test indicators from third table (nested indicators)
      const smaRsi = indicators.find(
        (i) => i.syntax === 'sma(rsi(14), 50)'
      );
      expect(smaRsi).toBeDefined();
      expect(smaRsi?.name).toBe('sma');
      expect(smaRsi?.description).toBe('The simple moving average is applied to another indicator');
    });

    test('should handle special characters in descriptions', () => {
      const htmlPath = join(process.cwd(), 'output/raw/indicators.html');
      const html = readFileSync(htmlPath, 'utf-8');

      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      // Test indicators with special characters (e.g., &amp;)
      const snr_res = indicators.find((i) => i.name === 'snr_res');
      expect(snr_res).toBeDefined();
      expect(snr_res?.description).toContain('S&R indicator');
    });
  });

  describe('parse synthetic HTML', () => {
    test('should handle empty HTML', () => {
      const parser = new IndicatorParser('');
      const indicators = parser.parse();
      expect(indicators).toEqual([]);
    });

    test('should handle HTML without tables', () => {
      const html = '<html><body><div>No tables here</div></body></html>';
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();
      expect(indicators).toEqual([]);
    });

    test('should handle table without roweven class', () => {
      const html = `
        <table>
          <tr>
            <td class="rowodd_1st">ema(50)</td>
            <td>Exponential Moving Average</td>
          </tr>
        </table>
      `;
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();
      expect(indicators).toEqual([]);
    });

    test('should handle row without rowodd_1st class', () => {
      const html = `
        <table>
          <tr class="roweven">
            <td>ema(50)</td>
            <td>Exponential Moving Average</td>
          </tr>
        </table>
      `;
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();
      expect(indicators).toEqual([]);
    });

    test('should handle partial data', () => {
      const html = `
        <table>
          <tr class="roweven">
            <td class="rowodd_1st">ema(50)</td>
            <td></td>
          </tr>
        </table>
      `;
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();
      expect(indicators).toEqual([]);
    });

    test('should parse valid minimal HTML', () => {
      const html = `
        <table>
          <tr>
            <td colspan="2">
              <table class="title">
                <tr>
                  <td><b>Indicator Example</b></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table>
                <tr class="roweven">
                  <td class="rowodd_1st">ema(50)</td>
                  <td>Exponential Moving Average</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      expect(indicators.length).toBe(1);
      expect(indicators[0].name).toBe('ema');
      expect(indicators[0].syntax).toBe('ema(50)');
      expect(indicators[0].description).toBe('Exponential Moving Average');
      expect(indicators[0].parameters).toEqual(['50']);
    });

    test('should parse multiple indicators', () => {
      const html = `
        <table>
          <tr>
            <td colspan="2">
              <table class="title">
                <tr>
                  <td><b>Indicator Example</b></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table>
                <tr class="roweven">
                  <td class="rowodd_1st">ema(50)</td>
                  <td>Exponential Moving Average</td>
                </tr>
                <tr class="roweven">
                  <td class="rowodd_1st">rsi(14)</td>
                  <td>Relative Strength Index</td>
                </tr>
                <tr class="roweven">
                  <td class="rowodd_1st">macd(12,26,9)</td>
                  <td>MACD</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      expect(indicators.length).toBe(3);
      expect(indicators[0].name).toBe('ema');
      expect(indicators[1].name).toBe('rsi');
      expect(indicators[2].name).toBe('macd');
      expect(indicators[2].parameters).toEqual(['12', '26', '9']);
    });

    test('should handle indicators without parameters', () => {
      const html = `
        <table>
          <tr>
            <td colspan="2">
              <table class="title">
                <tr>
                  <td><b>Indicator Example</b></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table>
                <tr class="roweven">
                  <td class="rowodd_1st">ad</td>
                  <td>Accumulation / Distribution</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      expect(indicators.length).toBe(1);
      expect(indicators[0].name).toBe('ad');
      expect(indicators[0].syntax).toBe('ad');
      expect(indicators[0].parameters).toEqual([]);
    });

    test('should clean whitespace in descriptions', () => {
      const html = `
        <table>
          <tr>
            <td colspan="2">
              <table class="title">
                <tr>
                  <td><b>Indicator Example</b></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table>
                <tr class="roweven">
                  <td class="rowodd_1st">ema(50)</td>
                  <td>  Exponential   Moving   Average  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      expect(indicators[0].description).toBe('Exponential Moving Average');
    });

    test('should parse multiple tables', () => {
      const html = `
        <table>
          <tr>
            <td colspan="2">
              <table class="title">
                <tr>
                  <td><b>Indicator Example</b></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table>
                <tr class="roweven">
                  <td class="rowodd_1st">ema(50)</td>
                  <td>Exponential Moving Average</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table>
          <tr>
            <td colspan="2">
              <table class="title">
                <tr>
                  <td><b>Indicator Example</b></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table>
                <tr class="roweven">
                  <td class="rowodd_1st">rsi(14)</td>
                  <td>Relative Strength Index</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
      const parser = new IndicatorParser(html);
      const indicators = parser.parse();

      expect(indicators.length).toBe(2);
      expect(indicators[0].name).toBe('ema');
      expect(indicators[1].name).toBe('rsi');
    });
  });
});
