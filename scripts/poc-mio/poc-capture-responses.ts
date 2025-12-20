#!/usr/bin/env tsx
/**
 * POC: Capture Actual MIO Response Structures
 * 
 * This script captures raw HTML/redirect responses from all endpoints
 * to analyze response patterns and design proper validation.
 */

import { writeFileSync } from 'fs';
import { SessionResolver } from '../../src/lib/SessionResolver.js';
import {
  MIOWatchlistClient,
  type SessionKeyValue,
} from './poc-mio-watchlist-client.js';

// ============================================================================
// RESPONSE CAPTURE UTILITIES
// ============================================================================

interface CapturedResponse {
  endpoint: string;
  method: string;
  url: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timestamp: string;
  notes?: string;
}

const capturedResponses: CapturedResponse[] = [];

function captureResponse(
  endpoint: string,
  response: any,
  notes?: string
): void {
  const captured: CapturedResponse = {
    endpoint,
    method: response.meta?.responseType || 'unknown',
    url: response.meta?.url || '',
    statusCode: response.meta?.statusCode || 0,
    statusText: response.success ? 'OK' : 'ERROR',
    headers: {},
    body: response.meta?.rawResponse || JSON.stringify(response.data || {}),
    timestamp: new Date().toISOString(),
    notes,
  };

  capturedResponses.push(captured);
  
  console.log(`\n📸 Captured response for: ${endpoint}`);
  console.log(`   Status: ${captured.statusCode}`);
  console.log(`   Body length: ${captured.body.length} chars`);
}

function saveResponses(): void {
  const outputPath = '/tmp/mio-responses.json';
  const markdown = generateMarkdownReport();
  
  writeFileSync(outputPath, JSON.stringify(capturedResponses, null, 2));
  writeFileSync('/tmp/mio-responses-report.md', markdown);
  
  console.log(`\n💾 Saved ${capturedResponses.length} responses to:`);
  console.log(`   ${outputPath}`);
  console.log(`   /tmp/mio-responses-report.md`);
}

function generateMarkdownReport(): string {
  let md = '# MIO API Response Structure Analysis\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `**Total Endpoints Tested:** ${capturedResponses.length}\n\n`;
  md += '---\n\n';

  capturedResponses.forEach((resp, idx) => {
    md += `## ${idx + 1}. ${resp.endpoint}\n\n`;
    md += `**URL:** \`${resp.url}\`\n\n`;
    md += `**Method:** ${resp.method}\n\n`;
    md += `**Status:** ${resp.statusCode} ${resp.statusText}\n\n`;
    
    if (resp.notes) {
      md += `**Notes:** ${resp.notes}\n\n`;
    }

    // Analyze response type
    const isRedirect = resp.statusCode === 302 || resp.statusCode === 301;
    const isHTML = resp.body.includes('<html') || resp.body.includes('<HTML');
    const hasForm = resp.body.includes('<form');
    const hasTable = resp.body.includes('<table');
    const hasSelect = resp.body.includes('<select');
    
    md += '**Response Type:**\n';
    md += isRedirect ? '- ✅ Redirect (302)\n' : '- ❌ Not a redirect\n';
    md += isHTML ? '- ✅ HTML Document\n' : '- ❌ Not HTML\n';
    md += hasForm ? '- ✅ Contains Form\n' : '';
    md += hasTable ? '- ✅ Contains Table\n' : '';
    md += hasSelect ? '- ✅ Contains Select\n' : '';
    md += '\n';

    // Extract key patterns
    md += '**Key Patterns Found:**\n';
    
    // Check for success indicators
    const successPatterns = [
      { pattern: /has been added/i, label: 'Success: Stock added' },
      { pattern: /has been removed/i, label: 'Success: Stock removed' },
      { pattern: /successfully/i, label: 'Success: Generic' },
      { pattern: /created/i, label: 'Success: Created' },
    ];
    
    successPatterns.forEach(({ pattern, label }) => {
      if (pattern.test(resp.body)) {
        md += `- ✅ ${label}\n`;
      }
    });

    // Check for error indicators
    const errorPatterns = [
      { pattern: /login/i, label: 'Error: Login required' },
      { pattern: /error/i, label: 'Error: Generic error' },
      { pattern: /invalid/i, label: 'Error: Invalid input' },
      { pattern: /failed/i, label: 'Error: Operation failed' },
    ];
    
    errorPatterns.forEach(({ pattern, label }) => {
      if (pattern.test(resp.body)) {
        md += `- ❌ ${label}\n`;
      }
    });

    // Extract redirect URL
    if (isRedirect) {
      const redirectMatch = resp.body.match(/<a\s+HREF="([^"]+)">(?:here|click here)/i);
      if (redirectMatch) {
        md += `\n**Redirect To:** \`${redirectMatch[1]}\`\n`;
      }
    }

    // Show response preview (first 500 chars)
    md += '\n**Response Preview:**\n```html\n';
    md += resp.body.substring(0, 500);
    if (resp.body.length > 500) {
      md += '\n... (truncated)';
    }
    md += '\n```\n\n';
    
    md += '---\n\n';
  });

  return md;
}

// ============================================================================
// MAIN TEST
// ============================================================================

async function main() {
  console.log('🔬 POC: Capture MIO Response Structures\n');
  console.log('This will capture raw responses from all endpoints for analysis.\n');

  // Get session
  const sessionInfo = await SessionResolver.getLatestSession('marketinout');
  if (!sessionInfo) {
    console.error('❌ No session found');
    process.exit(1);
  }

  let aspSessionKey: string | undefined;
  let aspSessionValue: string | undefined;

  for (const [key, value] of Object.entries(sessionInfo.sessionData)) {
    if (key.startsWith('ASPSESSION')) {
      aspSessionKey = key;
      aspSessionValue = value as string;
      break;
    }
  }

  if (!aspSessionKey || !aspSessionValue) {
    console.error('❌ No ASPSESSION found');
    process.exit(1);
  }

  const session: SessionKeyValue = { key: aspSessionKey, value: aspSessionValue };
  const client = new MIOWatchlistClient(session);

  console.log('✅ Session loaded\n');

  // Test 1: Get watchlists
  console.log('📋 Test 1: Get Watchlists...');
  const watchlistsResp = await client.getWatchlists();
  captureResponse(
    'GET_WATCHLISTS',
    watchlistsResp,
    'Returns HTML page with <select id="sel_wlid"> containing watchlist options'
  );
  
  const watchlists = watchlistsResp.data || [];
  console.log(`   Found ${watchlists.length} watchlists`);

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Create watchlist
  console.log('\n📋 Test 2: Create Watchlist...');
  const testName = `RESPONSE_TEST_${Date.now()}`;
  const createResp = await client.createWatchlist(testName);
  captureResponse(
    'CREATE_WATCHLIST',
    createResp,
    '302 redirect with watchlist ID in Location header or redirect URL'
  );
  
  const testWlid = createResp.data?.wlid;
  console.log(`   Created: ${testWlid || 'unknown'}`);

  if (!testWlid) {
    console.error('❌ Could not create watchlist, stopping tests');
    saveResponses();
    process.exit(1);
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Add stocks (bulk)
  console.log('\n📋 Test 3: Add Stocks (Bulk)...');
  const bulkAddResp = await client.addStocksBulk(testWlid, ['TCS.NS', 'INFY.NS']);
  captureResponse(
    'ADD_STOCKS_BULK',
    bulkAddResp,
    'POST request, returns 302 redirect to watchlist page'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Add single stock (NEW)
  console.log('\n📋 Test 4: Add Single Stock (NEW endpoint)...');
  const singleAddResp = await client.addSingleStock(testWlid, 'WIPRO.NS');
  captureResponse(
    'ADD_SINGLE_STOCK',
    singleAddResp,
    'GET wl_add_all.php?action=add - returns 302 to wl_add_all_done.php'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 5: Remove single stock (NEW)
  console.log('\n📋 Test 5: Remove Single Stock (NEW endpoint)...');
  const removeResp = await client.removeSingleStock(testWlid, 'INFY.NS');
  captureResponse(
    'REMOVE_SINGLE_STOCK',
    removeResp,
    'GET wl_add_all.php?action=remove - returns 302 to wl_add_all_done.php'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 6: Delete watchlist
  console.log('\n📋 Test 6: Delete Watchlist...');
  const deleteResp = await client.deleteWatchlists([testWlid]);
  captureResponse(
    'DELETE_WATCHLIST',
    deleteResp,
    'Returns 302 redirect to my_watch_lists.php'
  );

  console.log('\n✅ All responses captured!');

  // Save all responses
  saveResponses();

  // Print analysis summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESPONSE STRUCTURE ANALYSIS');
  console.log('='.repeat(80));

  console.log('\n🔍 Response Types:');
  const redirectCount = capturedResponses.filter(r => r.statusCode === 302).length;
  const htmlCount = capturedResponses.filter(r => r.body.includes('<html')).length;
  console.log(`   - Redirects (302): ${redirectCount}/${capturedResponses.length}`);
  console.log(`   - HTML Pages: ${htmlCount}/${capturedResponses.length}`);

  console.log('\n🎯 Key Findings:');
  console.log('   1. Most operations return 302 redirects');
  console.log('   2. Success messages in redirect target pages');
  console.log('   3. Watchlist list returns full HTML with <select> element');
  console.log('   4. New watchlist ID available in redirect URL');

  console.log('\n📁 Files saved:');
  console.log('   - /tmp/mio-responses.json (raw data)');
  console.log('   - /tmp/mio-responses-report.md (analysis report)');
}

main().catch(err => {
  console.error('Error:', err);
  saveResponses();
  process.exit(1);
});
