#!/usr/bin/env tsx
/**
 * Example: MIOHttpClient Usage
 * 
 * Demonstrates how to use MIOHttpClient with session cookies from KV store
 */

import { MIOHttpClient } from './index.js';

async function main() {
  console.log('📘 MIOHttpClient Usage Examples\n');

  // ============================================================================
  // Example 1: Initialize client with session from environment/KV
  // ============================================================================
  
  console.log('Example 1: Initialize MIOHttpClient');
  console.log('─'.repeat(50));
  
  // In production, fetch from KV store
  // const session = await getFromKV('MIO_SESSION');
  
  // For demo purposes, using environment variables
  const sessionKey = process.env.MIO_SESSION_KEY || 'PHPSESSID';
  const sessionValue = process.env.MIO_SESSION_VALUE || 'dummy_session_value';
  
  const mioClient = new MIOHttpClient(sessionKey, sessionValue);
  console.log('✅ Client initialized with session cookie');
  console.log(`   Cookie: ${sessionKey}=${sessionValue.substring(0, 10)}...`);
  console.log();

  // ============================================================================
  // Example 2: Make a simple GET request
  // ============================================================================
  
  console.log('Example 2: GET Request - List Watchlists');
  console.log('─'.repeat(50));
  
  const listResponse = await mioClient.request<string>(
    'https://www.marketinout.com/wl/watch_list.php?mode=list',
    { method: 'GET' }
  );

  if (listResponse.success) {
    console.log(`✅ Request successful (${listResponse.meta.duration}ms)`);
    console.log(`   Status: ${listResponse.meta.statusCode}`);
    console.log(`   Type: ${listResponse.meta.responseType}`);
    
    // Check for login page (session expired)
    if (typeof listResponse.data === 'string' && mioClient.isLoginPage(listResponse.data)) {
      console.log('⚠️  Session expired - login page detected');
    } else {
      console.log('✅ Valid response received');
    }
  } else {
    console.log(`❌ Request failed: ${listResponse.error?.message}`);
    if (listResponse.error?.needsRefresh) {
      console.log('🔄 Session refresh required');
    }
  }
  console.log();

  // ============================================================================
  // Example 3: POST Request with URLSearchParams
  // ============================================================================
  
  console.log('Example 3: POST Request - Add Stocks to Watchlist');
  console.log('─'.repeat(50));
  
  const formData = new URLSearchParams({
    mode: 'add',
    wlid: '12345',
    overwrite: '0',
    name: '',
    stock_list: 'INFY.NS,TCS.NS,WIPRO.NS',
  });

  const addResponse = await mioClient.request<string>(
    'https://www.marketinout.com/wl/watch_list.php',
    {
      method: 'POST',
      body: formData,
    }
  );

  if (addResponse.success) {
    console.log(`✅ Request successful (${addResponse.meta.duration}ms)`);
    
    // Handle redirect response
    if (addResponse.meta.responseType === 'redirect') {
      console.log('🔀 Received redirect response');
      if (typeof addResponse.data === 'string') {
        const redirectUrl = mioClient.extractRedirectUrl(addResponse.data);
        if (redirectUrl) {
          console.log(`   Redirect URL: ${redirectUrl}`);
        }
      }
    }
    
    // Extract success message from HTML
    if (typeof addResponse.data === 'string') {
      const successMsg = mioClient.extractSuccessMessage(addResponse.data);
      if (successMsg) {
        console.log(`   Message: ${successMsg}`);
      }
    }
  } else {
    console.log(`❌ Request failed: ${addResponse.error?.message}`);
  }
  console.log();

  // ============================================================================
  // Example 4: Handling HTML Response Parsing
  // ============================================================================
  
  console.log('Example 4: HTML Response Parsing');
  console.log('─'.repeat(50));
  
  // Simulate HTML response
  const sampleHtml = `
    <html>
      <body>
        <p>INFY.NS has been added to the watch list!</p>
        <a HREF="watch_list.php?wlid=12345">here</a>
      </body>
    </html>
  `;

  console.log('Parsing sample HTML response:');
  console.log(`✅ Is login page? ${mioClient.isLoginPage(sampleHtml)}`);
  console.log(`✅ Success message: ${mioClient.extractSuccessMessage(sampleHtml)}`);
  console.log(`✅ Redirect URL: ${mioClient.extractRedirectUrl(sampleHtml)}`);
  console.log(`✅ Watchlist ID: ${mioClient.extractWatchlistId(sampleHtml)}`);
  console.log();

  // ============================================================================
  // Example 5: Error Handling with Retry Logic
  // ============================================================================
  
  console.log('Example 5: Automatic Retry on Transient Errors');
  console.log('─'.repeat(50));
  
  console.log('The client will automatically retry on:');
  console.log('  - HTTP 408 (Request Timeout)');
  console.log('  - HTTP 429 (Too Many Requests)');
  console.log('  - HTTP 500-504 (Server Errors)');
  console.log('  - Network errors');
  console.log();
  console.log('Retry strategy:');
  console.log('  - Max retries: 3');
  console.log('  - Exponential backoff: 1s, 2s, 4s');
  console.log();

  // ============================================================================
  // Summary
  // ============================================================================
  
  console.log('📋 Summary');
  console.log('─'.repeat(50));
  console.log('Key Features:');
  console.log('  ✅ Cookie-based authentication (constructor-injected)');
  console.log('  ✅ Automatic retry with exponential backoff');
  console.log('  ✅ Login page detection (session expiry)');
  console.log('  ✅ Success/error message extraction from HTML');
  console.log('  ✅ Redirect URL handling');
  console.log('  ✅ Support for both GET and POST requests');
  console.log('  ✅ URLSearchParams and JSON body support');
  console.log();
}

main().catch(console.error);
