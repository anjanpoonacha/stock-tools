/**
 * Test script for symbol normalization
 * Verifies that MIO format (WIPRO.NS) is correctly converted to TradingView format (NSE:WIPRO)
 */

import { mioToTv, tvToMio, normalizeSymbol, isValidMioSymbol, isValidTvSymbol } from '../src/lib/utils/exchangeMapper';

console.log('=== Symbol Normalization Tests ===\n');

// Test cases
const testCases = [
	// MIO to TradingView
	{ input: 'WIPRO.NS', expected: 'NSE:WIPRO', test: 'MIO NSE to TV' },
	{ input: 'TCS.NS', expected: 'NSE:TCS', test: 'MIO NSE to TV' },
	{ input: 'TCS.BO', expected: 'BSE:TCS', test: 'MIO BSE to TV' },
	{ input: 'INFY.NS', expected: 'NSE:INFY', test: 'MIO NSE to TV' },
	
	// Already in TV format (should not change)
	{ input: 'NSE:WIPRO', expected: 'NSE:WIPRO', test: 'Already TV format' },
	{ input: 'BSE:TCS', expected: 'BSE:TCS', test: 'Already TV format' },
	
	// Plain symbol (defaults to NSE)
	{ input: 'WIPRO', expected: 'NSE:WIPRO', test: 'Plain symbol' },
	{ input: 'TCS', expected: 'NSE:TCS', test: 'Plain symbol' },
];

console.log('📊 MIO to TradingView Conversion Tests:\n');

let passed = 0;
let failed = 0;

for (const { input, expected, test } of testCases) {
	const result = mioToTv(input);
	const status = result === expected ? '✅' : '❌';
	
	if (result === expected) {
		passed++;
	} else {
		failed++;
	}
	
	console.log(`${status} ${test}`);
	console.log(`   Input:    "${input}"`);
	console.log(`   Expected: "${expected}"`);
	console.log(`   Got:      "${result}"`);
	console.log();
}

// Test reverse conversion
console.log('📊 TradingView to MIO Conversion Tests:\n');

const reverseCases = [
	{ input: 'NSE:WIPRO', expected: 'WIPRO.NS', test: 'TV NSE to MIO' },
	{ input: 'BSE:TCS', expected: 'TCS.BO', test: 'TV BSE to MIO' }, // BSE uses .BO suffix in MIO
	{ input: 'WIPRO.NS', expected: 'WIPRO.NS', test: 'Already MIO format' },
];

for (const { input, expected, test } of reverseCases) {
	const result = tvToMio(input);
	const status = result === expected ? '✅' : '❌';
	
	if (result === expected) {
		passed++;
	} else {
		failed++;
	}
	
	console.log(`${status} ${test}`);
	console.log(`   Input:    "${input}"`);
	console.log(`   Expected: "${expected}"`);
	console.log(`   Got:      "${result}"`);
	console.log();
}

// Test format validation
console.log('📊 Format Validation Tests:\n');

const validationCases = [
	{ input: 'WIPRO.NS', mioValid: true, tvValid: false },
	{ input: 'NSE:WIPRO', mioValid: false, tvValid: true },
	{ input: 'WIPRO', mioValid: false, tvValid: false },
];

for (const { input, mioValid, tvValid } of validationCases) {
	const mioResult = isValidMioSymbol(input);
	const tvResult = isValidTvSymbol(input);
	
	const mioStatus = mioResult === mioValid ? '✅' : '❌';
	const tvStatus = tvResult === tvValid ? '✅' : '❌';
	
	if (mioResult === mioValid && tvResult === tvValid) {
		passed += 2;
	} else {
		if (mioResult !== mioValid) failed++;
		if (tvResult !== tvValid) failed++;
	}
	
	console.log(`Symbol: "${input}"`);
	console.log(`   ${mioStatus} MIO Valid: Expected=${mioValid}, Got=${mioResult}`);
	console.log(`   ${tvStatus} TV Valid:  Expected=${tvValid}, Got=${tvResult}`);
	console.log();
}

// Test normalizeSymbol function
console.log('📊 Normalize Symbol Function Tests:\n');

const normalizeCases = [
	{ input: 'WIPRO.NS', format: 'tv', expected: 'NSE:WIPRO' },
	{ input: 'NSE:WIPRO', format: 'mio', expected: 'WIPRO.NS' },
	{ input: 'WIPRO', format: 'tv', expected: 'NSE:WIPRO' },
	{ input: 'WIPRO', format: 'mio', expected: 'WIPRO.NS' },
] as const;

for (const { input, format, expected } of normalizeCases) {
	const result = normalizeSymbol(input, format);
	const status = result === expected ? '✅' : '❌';
	
	if (result === expected) {
		passed++;
	} else {
		failed++;
	}
	
	console.log(`${status} normalizeSymbol("${input}", "${format}")`);
	console.log(`   Expected: "${expected}"`);
	console.log(`   Got:      "${result}"`);
	console.log();
}

// Summary
console.log('=== Summary ===\n');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}`);
console.log(`\n${failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed!'}`);

process.exit(failed === 0 ? 0 : 1);
