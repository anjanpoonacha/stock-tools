#!/usr/bin/env tsx
/**
 * Verify CVD Fixes - Check that all code changes are in place
 */

import fs from 'fs';
import path from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(msg: string, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

console.log('\n🔍 Verifying CVD Fixes\n');

let allGood = true;

// Check 1: Connection pool imports cvdConfigService
const poolFile = fs.readFileSync('src/lib/tradingview/connectionPool.ts', 'utf-8');

log('✓ Check 1: Connection pool imports', colors.cyan);
if (poolFile.includes('getCVDConfig') && poolFile.includes('CVD_PINE_FEATURES')) {
  log('  ✅ getCVDConfig imported', colors.green);
} else {
  log('  ❌ Missing getCVDConfig import', colors.red);
  allGood = false;
}

// Check 2: Connection pool calls getCVDConfig
if (poolFile.includes('await getCVDConfig(request.sessionId, request.sessionIdSign)')) {
  log('  ✅ Dynamic CVD config fetch implemented', colors.green);
} else {
  log('  ❌ Still using empty CVD text', colors.red);
  allGood = false;
}

// Check 3: Connection pool validates credentials
if (poolFile.includes('if (!request.sessionId || !request.sessionIdSign)')) {
  log('  ✅ Credential validation added', colors.green);
} else {
  log('  ⚠️  No credential validation', colors.yellow);
}

// Check 4: Connection pool uses fetched text
if (poolFile.includes('text: fetchedConfig.text')) {
  log('  ✅ Using dynamic encrypted text', colors.green);
} else {
  log('  ❌ Not using fetched config text', colors.red);
  allGood = false;
}

// Check 5: fetchBatch includes session credentials
if (poolFile.match(/sessionId\?\s*:\s*string/g) && poolFile.match(/sessionIdSign\?\s*:\s*string/g)) {
  log('  ✅ fetchBatch signature includes credentials', colors.green);
} else {
  log('  ❌ fetchBatch missing credential types', colors.red);
  allGood = false;
}

// Check 6: Timeout increased
log('\n✓ Check 2: Timeout configuration', colors.cyan);
const baseFile = fs.readFileSync('src/lib/tradingview/baseWebSocketClient.ts', 'utf-8');

if (baseFile.includes('Math.min(timeout, 2000)')) {
  log('  ✅ CVD timeout increased to 2000ms', colors.green);
} else if (baseFile.includes('Math.min(timeout, 800)')) {
  log('  ⚠️  Still using 800ms timeout', colors.yellow);
} else {
  log('  ❌ Timeout configuration unclear', colors.red);
  allGood = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allGood) {
  log('✅ All CVD fixes verified!', colors.green);
  log('\nNext steps:', colors.cyan);
  log('1. Ensure TradingView session is in KV (via browser extension)');
  log('2. Start dev server: pnpm dev');
  log('3. Test CVD in chart component');
  log('4. Check console for CVD diagnostic logs');
} else {
  log('❌ Some fixes are missing or incomplete', colors.red);
  log('\nPlease review the changes above.', colors.yellow);
}
console.log('='.repeat(50) + '\n');

process.exit(allGood ? 0 : 1);
