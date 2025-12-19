import { describe, it, expect } from 'vitest';
import { parseSamplesHtml, SampleParser } from '../index';
import * as fs from 'fs';
import * as path from 'path';

describe('Parser Integration', () => {
  const htmlPath = path.join(process.cwd(), 'output/raw/samples.html');
  let html: string;

  try {
    html = fs.readFileSync(htmlPath, 'utf-8');
  } catch (error) {
    html = '';
  }

  it('should export SampleParser class', () => {
    expect(SampleParser).toBeDefined();
    expect(typeof SampleParser).toBe('function');
  });

  it('should export parseSamplesHtml convenience function', () => {
    expect(parseSamplesHtml).toBeDefined();
    expect(typeof parseSamplesHtml).toBe('function');
  });

  it('parseSamplesHtml should work correctly', () => {
    if (!html) {
      return;
    }

    const samples = parseSamplesHtml(html);

    expect(Array.isArray(samples)).toBe(true);
    expect(samples.length).toBe(76);

    // Verify structure
    samples.forEach(sample => {
      expect(sample).toHaveProperty('name');
      expect(sample).toHaveProperty('formula');
      expect(sample).toHaveProperty('description');
      expect(sample).toHaveProperty('category');
    });
  });

  it('SampleParser and parseSamplesHtml should produce identical results', () => {
    if (!html) {
      return;
    }

    const parser = new SampleParser(html);
    const samplesFromClass = parser.parse();
    const samplesFromFunction = parseSamplesHtml(html);

    expect(samplesFromClass).toEqual(samplesFromFunction);
  });
});
