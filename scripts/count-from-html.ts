#!/usr/bin/env tsx
// scripts/count-from-html.ts
// Simple script to count items directly from raw HTML files

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseIndicatorsHtml, parseSamplesHtml, parseDocsHtml } from '../src/lib/mio/parsers/index.js';

const RAW_DIR = './output/raw';

interface CountResult {
  file: string;
  count: number;
  exists: boolean;
  error?: string;
}

function countFromFile(filename: string, parser: (html: string) => any[]): CountResult {
  const filepath = join(RAW_DIR, filename);

  if (!existsSync(filepath)) {
    return {
      file: filename,
      count: 0,
      exists: false,
      error: 'File not found'
    };
  }

  try {
    const html = readFileSync(filepath, 'utf-8');
    const items = parser(html);
    return {
      file: filename,
      count: items.length,
      exists: true
    };
  } catch (error) {
    return {
      file: filename,
      count: 0,
      exists: true,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function main() {
  console.log('=== Counting Items from Raw HTML Files ===\n');

  // Count indicators
  const indicators = countFromFile('indicators.html', parseIndicatorsHtml);
  console.log('📊 Indicators (indicators.html)');
  if (!indicators.exists) {
    console.log(`   ❌ ${indicators.error}`);
  } else if (indicators.error) {
    console.log(`   ❌ Error: ${indicators.error}`);
  } else {
    console.log(`   ✅ Count: ${indicators.count}`);
  }

  // Count samples
  const samples = countFromFile('samples.html', parseSamplesHtml);
  console.log('\n📝 Samples (samples.html)');
  if (!samples.exists) {
    console.log(`   ❌ ${samples.error}`);
  } else if (samples.error) {
    console.log(`   ❌ Error: ${samples.error}`);
  } else {
    console.log(`   ✅ Count: ${samples.count}`);
  }

  // Count documentation
  const docs = countFromFile('docs.html', parseDocsHtml);
  console.log('\n📚 Documentation (docs.html)');
  if (!docs.exists) {
    console.log(`   ❌ ${docs.error}`);
  } else if (docs.error) {
    console.log(`   ❌ Error: ${docs.error}`);
  } else {
    console.log(`   ✅ Count: ${docs.count}`);
  }

  // Summary
  const total = indicators.count + samples.count + docs.count;
  console.log('\n' + '='.repeat(50));
  console.log(`📈 Total Items: ${total}`);
  console.log('='.repeat(50));

  // Check if all files were processed
  const allSuccess = indicators.exists && samples.exists && docs.exists &&
                     !indicators.error && !samples.error && !docs.error;

  if (!allSuccess) {
    console.log('\n⚠️  Some files are missing or had errors.');
    console.log('   Run `pnpm run analyze-mio` to fetch the HTML files.');
    process.exit(1);
  }
}

main();
