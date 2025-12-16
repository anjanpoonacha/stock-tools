#!/usr/bin/env tsx
// scripts/check-html-structure.ts
// Monitoring script to detect HTML structure changes on MIO pages

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';

const RAW_DIR = './output/raw';
const BASELINE_FILE = './output/structure-baseline.json';

interface StructureSignature {
  file: string;
  timestamp: string;
  tableCount: number;
  totalRows: number;
  totalCells: number;
  classes: string[];
  keySelectors: {
    [selector: string]: number;
  };
}

interface BaselineData {
  created: string;
  signatures: {
    [file: string]: StructureSignature;
  };
}

/**
 * Generate a signature of the HTML structure
 */
function generateSignature(filename: string): StructureSignature | null {
  const filepath = join(RAW_DIR, filename);

  if (!existsSync(filepath)) {
    return null;
  }

  const html = readFileSync(filepath, 'utf-8');
  const $ = cheerio.load(html);

  // Collect all unique classes
  const classes = new Set<string>();
  $('[class]').each((_, el) => {
    const classList = $(el).attr('class')?.split(/\s+/) || [];
    classList.forEach(c => c && classes.add(c));
  });

  // Count key selectors based on file type
  let keySelectors: { [selector: string]: number } = {};

  if (filename === 'indicators.html') {
    keySelectors = {
      'table': $('table').length,
      'tr.roweven': $('tr.roweven').length,
      'td.rowodd_1st': $('td.rowodd_1st').length,
    };
  } else if (filename === 'samples.html') {
    keySelectors = {
      'table': $('table').length,
      'tr.roweven': $('tr.roweven').length,
      'tr.roweven_box': $('tr.roweven_box').length,
      'td.rowodd_1st': $('td.rowodd_1st').length,
      'td[colspan]': $('td[colspan]').length,
      'td.rowodd_1st b': $('td.rowodd_1st b').length,
    };
  } else if (filename === 'docs.html') {
    keySelectors = {
      'table': $('table').length,
      '.news_title': $('.news_title').length,
      '.news_date': $('.news_date').length,
    };
  }

  return {
    file: filename,
    timestamp: new Date().toISOString(),
    tableCount: $('table').length,
    totalRows: $('tr').length,
    totalCells: $('td').length,
    classes: Array.from(classes).sort(),
    keySelectors,
  };
}

/**
 * Compare two signatures and report differences
 */
function compareSignatures(baseline: StructureSignature, current: StructureSignature): string[] {
  const warnings: string[] = [];

  // Check table count change
  if (baseline.tableCount !== current.tableCount) {
    warnings.push(
      `⚠️  Table count changed: ${baseline.tableCount} → ${current.tableCount}`
    );
  }

  // Check significant row/cell changes (>10% change)
  const rowChange = Math.abs(baseline.totalRows - current.totalRows) / baseline.totalRows;
  if (rowChange > 0.1) {
    warnings.push(
      `⚠️  Total rows changed significantly: ${baseline.totalRows} → ${current.totalRows} (${(rowChange * 100).toFixed(1)}% change)`
    );
  }

  const cellChange = Math.abs(baseline.totalCells - current.totalCells) / baseline.totalCells;
  if (cellChange > 0.1) {
    warnings.push(
      `⚠️  Total cells changed significantly: ${baseline.totalCells} → ${current.totalCells} (${(cellChange * 100).toFixed(1)}% change)`
    );
  }

  // Check for removed classes
  const removedClasses = baseline.classes.filter(c => !current.classes.includes(c));
  if (removedClasses.length > 0) {
    warnings.push(
      `⚠️  CSS classes removed: ${removedClasses.join(', ')}`
    );
  }

  // Check for critical new classes (might indicate structure change)
  const newClasses = current.classes.filter(c => !baseline.classes.includes(c));
  if (newClasses.length > 3) {
    warnings.push(
      `⚠️  Multiple new CSS classes added (${newClasses.length}): ${newClasses.slice(0, 5).join(', ')}...`
    );
  }

  // Check key selectors
  for (const [selector, baselineCount] of Object.entries(baseline.keySelectors)) {
    const currentCount = current.keySelectors[selector] || 0;

    if (baselineCount === 0 && currentCount > 0) {
      warnings.push(
        `⚠️  Selector "${selector}" appeared: 0 → ${currentCount}`
      );
    } else if (baselineCount > 0 && currentCount === 0) {
      warnings.push(
        `🚨 CRITICAL: Selector "${selector}" disappeared: ${baselineCount} → 0`
      );
    } else if (baselineCount > 0) {
      const change = Math.abs(baselineCount - currentCount) / baselineCount;
      if (change > 0.15) {
        warnings.push(
          `⚠️  Selector "${selector}" changed significantly: ${baselineCount} → ${currentCount} (${(change * 100).toFixed(1)}% change)`
        );
      }
    }
  }

  return warnings;
}

/**
 * Main function
 */
function main() {
  console.log('=== MIO HTML Structure Monitor ===\n');

  const files = ['indicators.html', 'samples.html', 'docs.html'];

  // Check if HTML files exist
  const missingFiles = files.filter(f => !existsSync(join(RAW_DIR, f)));
  if (missingFiles.length > 0) {
    console.error('❌ Missing HTML files:', missingFiles.join(', '));
    console.log('\n💡 Run `pnpm run analyze-mio` to fetch the HTML files.');
    process.exit(1);
  }

  // Generate current signatures
  const currentSignatures: { [file: string]: StructureSignature } = {};
  for (const file of files) {
    const sig = generateSignature(file);
    if (sig) {
      currentSignatures[file] = sig;
    }
  }

  // Check if baseline exists
  if (!existsSync(BASELINE_FILE)) {
    console.log('📝 No baseline found. Creating initial baseline...\n');

    const baseline: BaselineData = {
      created: new Date().toISOString(),
      signatures: currentSignatures,
    };

    writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));

    console.log('✅ Baseline created successfully!\n');
    console.log('Structure Summary:');
    for (const [file, sig] of Object.entries(currentSignatures)) {
      console.log(`\n📄 ${file}:`);
      console.log(`   Tables: ${sig.tableCount}`);
      console.log(`   Rows: ${sig.totalRows}`);
      console.log(`   Cells: ${sig.totalCells}`);
      console.log(`   CSS Classes: ${sig.classes.length}`);
      console.log(`   Key Selectors:`);
      for (const [selector, count] of Object.entries(sig.keySelectors)) {
        console.log(`      ${selector}: ${count}`);
      }
    }

    console.log('\n💡 Run this script again after fetching new HTML to detect changes.');
    return;
  }

  // Load baseline
  const baseline: BaselineData = JSON.parse(readFileSync(BASELINE_FILE, 'utf-8'));
  console.log(`📊 Comparing against baseline created: ${new Date(baseline.created).toLocaleString()}\n`);

  let hasWarnings = false;

  // Compare each file
  for (const file of files) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 ${file}`);
    console.log('='.repeat(60));

    const baselineSig = baseline.signatures[file];
    const currentSig = currentSignatures[file];

    if (!baselineSig) {
      console.log('⚠️  No baseline signature found for this file');
      hasWarnings = true;
      continue;
    }

    if (!currentSig) {
      console.log('🚨 CRITICAL: File is missing or unreadable');
      hasWarnings = true;
      continue;
    }

    const warnings = compareSignatures(baselineSig, currentSig);

    if (warnings.length === 0) {
      console.log('✅ No significant structure changes detected');
      console.log(`   Tables: ${currentSig.tableCount}`);
      console.log(`   Rows: ${currentSig.totalRows}`);
      console.log(`   Cells: ${currentSig.totalCells}`);
    } else {
      console.log('⚠️  Structure changes detected:\n');
      warnings.forEach(w => console.log(`   ${w}`));
      hasWarnings = true;
    }
  }

  console.log('\n' + '='.repeat(60));

  if (hasWarnings) {
    console.log('\n⚠️  STRUCTURE CHANGES DETECTED!');
    console.log('\n📝 Actions to take:');
    console.log('   1. Review the warnings above');
    console.log('   2. Run tests: pnpm test src/lib/mio/parsers');
    console.log('   3. If tests fail, update parsers to match new structure');
    console.log('   4. Update baseline: rm output/structure-baseline.json && pnpm run check-structure');
    process.exit(1);
  } else {
    console.log('\n✅ All HTML structures are stable!');
    console.log('\n💡 Parsers should continue working correctly.');
  }
}

main();
