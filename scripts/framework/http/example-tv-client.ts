#!/usr/bin/env tsx
/**
 * Example: TVHttpClient Usage
 * 
 * Demonstrates how to use TVHttpClient for TradingView API calls
 */

import { TVHttpClient } from './index.js';

async function main() {
  console.log('📘 TVHttpClient Usage Examples\n');

  // ============================================================================
  // Example 1: Initialize client with session from environment/KV
  // ============================================================================
  
  console.log('Example 1: Initialize TVHttpClient');
  console.log('─'.repeat(50));
  
  // In production, fetch from KV store
  // const session = await getFromKV('TV_SESSION');
  
  // For demo purposes, using environment variables
  const sessionId = process.env.TV_SESSION_ID || 'dummy_session_id';
  const sessionIdSign = process.env.TV_SESSION_ID_SIGN; // Optional
  
  const tvClient = new TVHttpClient(sessionId, sessionIdSign);
  console.log('✅ Client initialized with session cookie');
  console.log(`   sessionid: ${sessionId.substring(0, 10)}...`);
  if (sessionIdSign) {
    console.log(`   sessionid_sign: ${sessionIdSign.substring(0, 10)}...`);
  }
  console.log();

  // ============================================================================
  // Example 2: Get User ID
  // ============================================================================
  
  console.log('Example 2: Get TradingView User ID');
  console.log('─'.repeat(50));
  
  const userResponse = await tvClient.getUserId();

  if (userResponse.success && userResponse.data) {
    console.log('✅ User ID fetched successfully');
    console.log(`   User ID: ${userResponse.data.userId}`);
    if (userResponse.data.username) {
      console.log(`   Username: ${userResponse.data.username}`);
    }
    console.log(`   Duration: ${userResponse.meta.duration}ms`);
  } else {
    console.log(`❌ Failed to get user ID: ${userResponse.error?.message}`);
    if (userResponse.error?.code === 'HTTP_401' || userResponse.error?.code === 'HTTP_403') {
      console.log('🔄 Session expired or invalid');
    }
  }
  console.log();

  // ============================================================================
  // Example 3: Get JWT Token for WebSocket
  // ============================================================================
  
  console.log('Example 3: Get JWT Token for WebSocket Authentication');
  console.log('─'.repeat(50));
  
  // Use user ID from previous step
  if (userResponse.success && userResponse.data) {
    const userId = userResponse.data.userId;
    const chartId = 'AbCdEfGh'; // Example chart ID
    
    const tokenResponse = await tvClient.getJWTToken(userId, chartId);
    
    if (tokenResponse.success && tokenResponse.data) {
      console.log('✅ JWT token fetched successfully');
      console.log(`   Token length: ${tokenResponse.data.length} characters`);
      console.log(`   Token preview: ${tokenResponse.data.substring(0, 30)}...`);
      console.log(`   Duration: ${tokenResponse.meta.duration}ms`);
      console.log();
      console.log('This token can be used for WebSocket authentication');
    } else {
      console.log(`❌ Failed to get JWT token: ${tokenResponse.error?.message}`);
    }
  } else {
    console.log('⚠️  Skipping JWT token fetch (no valid user ID)');
  }
  console.log();

  // ============================================================================
  // Example 4: Manual Request to Any TradingView Endpoint
  // ============================================================================
  
  console.log('Example 4: Make Manual Request to TradingView API');
  console.log('─'.repeat(50));
  
  const customResponse = await tvClient.request<any>(
    'https://www.tradingview.com/api/v1/user/',
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }
  );

  if (customResponse.success) {
    console.log(`✅ Request successful (${customResponse.meta.duration}ms)`);
    console.log(`   Status: ${customResponse.meta.statusCode}`);
    console.log(`   Type: ${customResponse.meta.responseType}`);
    console.log(`   Response keys: ${customResponse.data ? Object.keys(customResponse.data).slice(0, 5).join(', ') : 'N/A'}`);
  } else {
    console.log(`❌ Request failed: ${customResponse.error?.message}`);
  }
  console.log();

  // ============================================================================
  // Example 5: Error Handling
  // ============================================================================
  
  console.log('Example 5: Error Handling');
  console.log('─'.repeat(50));
  
  // Try to fetch with an invalid endpoint to demonstrate error handling
  const errorResponse = await tvClient.request<any>(
    'https://www.tradingview.com/api/v1/invalid-endpoint',
    { method: 'GET' }
  );

  console.log('Testing error handling with invalid endpoint:');
  console.log(`  Success: ${errorResponse.success}`);
  if (!errorResponse.success && errorResponse.error) {
    console.log(`  Error code: ${errorResponse.error.code}`);
    console.log(`  Error message: ${errorResponse.error.message}`);
    console.log(`  Needs refresh: ${errorResponse.error.needsRefresh || false}`);
  }
  console.log();

  // ============================================================================
  // Example 6: Retry Logic Demonstration
  // ============================================================================
  
  console.log('Example 6: Automatic Retry on Transient Errors');
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
  // Example 7: Complete Workflow - Get User ID then JWT Token
  // ============================================================================
  
  console.log('Example 7: Complete Workflow');
  console.log('─'.repeat(50));
  
  async function getTradingViewAuth(chartId: string) {
    // Step 1: Get user ID
    const userResp = await tvClient.getUserId();
    if (!userResp.success || !userResp.data) {
      throw new Error(`Failed to get user ID: ${userResp.error?.message}`);
    }

    // Step 2: Get JWT token
    const tokenResp = await tvClient.getJWTToken(userResp.data.userId, chartId);
    if (!tokenResp.success || !tokenResp.data) {
      throw new Error(`Failed to get JWT token: ${tokenResp.error?.message}`);
    }

    return {
      userId: userResp.data.userId,
      username: userResp.data.username,
      jwtToken: tokenResp.data,
    };
  }

  console.log('Complete auth workflow function created.');
  console.log('Usage: const auth = await getTradingViewAuth("chart123")');
  console.log('  1. Fetch user ID from /api/v1/user/');
  console.log('  2. Fetch JWT token using user ID');
  console.log('  3. Return complete auth credentials');
  
  // Mark function as used
  void getTradingViewAuth;
  console.log();

  // ============================================================================
  // Summary
  // ============================================================================
  
  console.log('📋 Summary');
  console.log('─'.repeat(50));
  console.log('Key Features:');
  console.log('  ✅ Session cookie authentication (constructor-injected)');
  console.log('  ✅ Automatic retry with exponential backoff');
  console.log('  ✅ User ID fetching (getUserId)');
  console.log('  ✅ JWT token fetching (getJWTToken)');
  console.log('  ✅ Support for both JSON and text responses');
  console.log('  ✅ Session expiry detection (401/403)');
  console.log('  ✅ Strongly typed responses');
  console.log();
}

main().catch(console.error);
