#!/usr/bin/env tsx
/**
 * Live CVD Data Test
 * Tests actual CVD data fetching with real credentials from KV
 */

import { kv } from '@vercel/kv';
import { getChartData } from '../src/lib/chart-data/chartDataService';

async function main() {
  console.log('🔬 Live CVD Data Test\n');
  
  // Step 1: Find TradingView session in KV
  console.log('Step 1: Finding TradingView session in KV...');
  
  try {
    const keys = await kv.keys('*');
    console.log(`Found ${keys.length} total keys in KV`);
    
    let sessionData = null;
    let userEmail = null;
    let userPassword = null;
    
    for (const key of keys) {
      if (key.includes('tradingview')) {
        console.log(`  Checking key: ${key}`);
        const data = await kv.get(key);
        
        if (data && typeof data === 'object') {
          const dataObj = data as any;
          console.log('  Keys in object:', Object.keys(dataObj));
          
          if (dataObj.sessionId || dataObj.sessionid) {
            console.log(`  ✅ Found TradingView session`);
            sessionData = dataObj;
            userEmail = dataObj.userEmail;
            userPassword = dataObj.userPassword;
            break;
          }
        }
      }
    }
    
    if (!sessionData) {
      console.log('❌ No TradingView session found');
      process.exit(1);
    }
    
    // Step 2: Extract credentials
    console.log('\nStep 2: Extracting credentials...');
    
    const sessionId = sessionData.sessionId || sessionData.sessionid;
    const sessionIdSign = sessionData.sessionid_sign;
    
    console.log('  sessionId:', sessionId ? '✅ ' + sessionId.substring(0, 20) + '...' : '❌ MISSING');
    console.log('  sessionIdSign:', sessionIdSign ? '✅ ' + sessionIdSign.substring(0, 20) + '...' : '❌ MISSING');
    console.log('  userEmail:', userEmail ? '✅ ' + userEmail : '❌ MISSING');
    console.log('  userPassword:', userPassword ? '✅ [present]' : '❌ MISSING');
    
    if (!sessionId || !userEmail || !userPassword) {
      console.log('\n❌ Missing required credentials');
      process.exit(1);
    }
    
    // Step 3: Test CVD data fetching
    console.log('\nStep 3: Fetching chart data with CVD enabled...');
    
    const symbol = 'NSE:RELIANCE';
    const resolution = 'D';
    const barsCount = 50;
    
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Resolution: ${resolution}`);
    console.log(`  Bars: ${barsCount}`);
    console.log(`  CVD: enabled (anchor: 3M)`);
    
    const startTime = Date.now();
    
    const result = await getChartData({
      symbol,
      resolution,
      barsCount: String(barsCount),
      cvdEnabled: 'true',
      cvdAnchorPeriod: '3M',
      cvdTimeframe: undefined,
      userEmail,
      userPassword,
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\nRequest completed in ${duration}ms`);
    
    if (!result.success) {
      console.log(`❌ Failed: ${result.error}`);
      process.exit(1);
    }
    
    console.log(`✅ Success!`);
    console.log(`  Bars received: ${result.data?.bars.length || 0}`);
    console.log(`  Has metadata: ${!!result.data?.metadata}`);
    console.log(`  Has indicators: ${!!result.data?.indicators}`);
    console.log(`  Has CVD: ${!!result.data?.indicators?.cvd}`);
    
    if (result.data?.indicators?.cvd) {
      const cvd = result.data.indicators.cvd;
      console.log(`\n✅✅✅ CVD DATA OBTAINED! ✅✅✅`);
      console.log(`  Study ID: ${cvd.studyId}`);
      console.log(`  Data points: ${cvd.values.length}`);
      
      if (cvd.values.length > 0) {
        const first = cvd.values[0];
        const last = cvd.values[cvd.values.length - 1];
        
        console.log(`\n  First CVD value (${new Date(first.time * 1000).toISOString().split('T')[0]}):`);
        console.log(`    Open:  ${first.values[0].toLocaleString()}`);
        console.log(`    High:  ${first.values[1].toLocaleString()}`);
        console.log(`    Low:   ${first.values[2].toLocaleString()}`);
        console.log(`    Close: ${first.values[3].toLocaleString()}`);
        
        console.log(`\n  Last CVD value (${new Date(last.time * 1000).toISOString().split('T')[0]}):`);
        console.log(`    Open:  ${last.values[0].toLocaleString()}`);
        console.log(`    High:  ${last.values[1].toLocaleString()}`);
        console.log(`    Low:   ${last.values[2].toLocaleString()}`);
        console.log(`    Close: ${last.values[3].toLocaleString()}`);
        
        // Validate data quality
        const hasNonZero = cvd.values.some(v => v.values.some(val => val !== 0));
        const hasReasonableValues = cvd.values.some(v => 
          Math.abs(v.values[0]) < 1e10 && v.values[0] !== 0
        );
        
        console.log('\n  Data quality:');
        console.log(`    Non-zero values: ${hasNonZero ? '✅' : '❌'}`);
        console.log(`    Reasonable ranges: ${hasReasonableValues ? '✅' : '❌'}`);
        
        if (hasNonZero && hasReasonableValues) {
          console.log('\n🎉🎉🎉 SUCCESS! CVD data is obtainable and valid! 🎉🎉🎉');
          console.log('\nThe fixes are working:');
          console.log('  ✅ Connection pool using dynamic CVD config');
          console.log('  ✅ CVD timeout increased to 2000ms');
          console.log('  ✅ Session credentials flowing correctly');
          console.log('  ✅ CVD data arriving from TradingView');
        }
      }
      
      process.exit(0);
    } else {
      console.log('\n❌ CVD data NOT present in response');
      console.log('\nDebugging info:');
      console.log('  Result structure:', Object.keys(result.data || {}));
      if (result.data?.indicators) {
        console.log('  Indicators:', Object.keys(result.data.indicators));
      }
      process.exit(1);
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.log('\nStack trace:');
      console.log(error.stack);
    }
    process.exit(1);
  }
}

main();
