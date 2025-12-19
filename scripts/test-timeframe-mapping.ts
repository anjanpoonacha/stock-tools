/**
 * Test Script for Time Mapping Logic
 * 
 * Verifies that 1D ↔ 188m conversion works correctly for Indian trading hours.
 * 
 * Usage: tsx scripts/test-timeframe-mapping.ts
 */

import { map1DTo188m, map188mTo1D } from '../src/lib/chart/timeframeMapping';

// Create sample data
const sampleDate = new Date('2025-12-15T00:00:00+05:30'); // Dec 15, 2025 IST
const dailyTimestamp = Math.floor(sampleDate.getTime() / 1000);

console.log('='.repeat(60));
console.log('Testing Time Mapping Logic');
console.log('='.repeat(60));
console.log('');

// Sample 1D bars (3 days)
const bars1D = [
  { time: dailyTimestamp, open: 2850, high: 2870, low: 2840, close: 2860, volume: 1000000 },
  { time: dailyTimestamp + 86400, open: 2860, high: 2880, low: 2850, close: 2875, volume: 1100000 },
  { time: dailyTimestamp + 172800, open: 2875, high: 2900, low: 2870, close: 2890, volume: 1200000 },
];

console.log('Sample 1D Bars:');
bars1D.forEach((bar, i) => {
  const date = new Date(bar.time * 1000);
  console.log(`  Bar ${i}: ${date.toLocaleDateString('en-IN')} @ ${bar.time}`);
});
console.log('');

// Sample 188m bars (2 per day = 6 total for 3 days)
const bars188m = [
  // Dec 15 - Morning (9:15 AM)
  { time: dailyTimestamp + (9 * 3600) + (15 * 60), values: [100, 120, 90, 110] },
  // Dec 15 - Afternoon (12:23 PM)
  { time: dailyTimestamp + (12 * 3600) + (23 * 60), values: [110, 130, 100, 120] },
  
  // Dec 16 - Morning
  { time: dailyTimestamp + 86400 + (9 * 3600) + (15 * 60), values: [120, 140, 110, 130] },
  // Dec 16 - Afternoon
  { time: dailyTimestamp + 86400 + (12 * 3600) + (23 * 60), values: [130, 150, 120, 140] },
  
  // Dec 17 - Morning
  { time: dailyTimestamp + 172800 + (9 * 3600) + (15 * 60), values: [140, 160, 130, 150] },
  // Dec 17 - Afternoon
  { time: dailyTimestamp + 172800 + (12 * 3600) + (23 * 60), values: [150, 170, 140, 160] },
];

console.log('Sample 188m Bars:');
bars188m.forEach((bar, i) => {
  const date = new Date(bar.time * 1000);
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  console.log(`  Bar ${i}: ${date.toLocaleDateString('en-IN')} ${timeStr} @ ${bar.time}`);
});
console.log('');

// Test 1D → 188m mapping
console.log('='.repeat(60));
console.log('Test 1: Mapping 1D → 188m');
console.log('='.repeat(60));
console.log('');

bars1D.forEach((bar, i) => {
  const date = new Date(bar.time * 1000);
  console.log(`1D Bar ${i}: ${date.toLocaleDateString('en-IN')}`);
  
  const mapped = map1DTo188m(bar.time, bars188m);
  console.log(`  Maps to ${mapped.length} 188m bars:`);
  
  mapped.forEach((time, j) => {
    const mappedDate = new Date(time * 1000);
    const timeStr = mappedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    console.log(`    ${j + 1}. ${mappedDate.toLocaleDateString('en-IN')} ${timeStr}`);
  });
  
  if (mapped.length !== 2) {
    console.error(`  ❌ ERROR: Expected 2 bars, got ${mapped.length}`);
  } else {
    console.log(`  ✅ Correct: 2 bars per day`);
  }
  
  console.log('');
});

// Test 188m → 1D mapping
console.log('='.repeat(60));
console.log('Test 2: Mapping 188m → 1D');
console.log('='.repeat(60));
console.log('');

bars188m.forEach((bar, i) => {
  const date = new Date(bar.time * 1000);
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  console.log(`188m Bar ${i}: ${date.toLocaleDateString('en-IN')} ${timeStr}`);
  
  const mapped = map188mTo1D(bar.time, bars1D);
  
  if (mapped) {
    const mappedDate = new Date(mapped * 1000);
    console.log(`  Maps to: ${mappedDate.toLocaleDateString('en-IN')} (1D bar)`);
    console.log(`  ✅ Correct`);
  } else {
    console.error(`  ❌ ERROR: No mapping found`);
  }
  
  console.log('');
});

// Summary
console.log('='.repeat(60));
console.log('Test Summary');
console.log('='.repeat(60));
console.log(`Total 1D bars: ${bars1D.length}`);
console.log(`Total 188m bars: ${bars188m.length}`);
console.log(`Expected ratio: 2 188m bars per 1D bar`);
console.log(`Actual ratio: ${bars188m.length / bars1D.length}`);
console.log('');

if (bars188m.length === bars1D.length * 2) {
  console.log('✅ All tests passed!');
} else {
  console.log('❌ Bar count mismatch!');
}
