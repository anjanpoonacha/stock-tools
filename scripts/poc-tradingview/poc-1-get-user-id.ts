#!/usr/bin/env tsx
/**
 * POC Step 1: Get TradingView User ID
 * 
 * Calls /api/v1/user/ endpoint with session cookie to extract user_id
 */

import { writeFileSync, mkdirSync } from 'fs';
import { config } from './poc-config.js';
import type { Step1Output } from './poc-types.js';

const OUTPUT_FILE = `${config.output.directory}/1-user-data.json`;

async function getUserId(): Promise<Step1Output> {
	console.log('🔍 POC Step 1: Fetching TradingView User ID\n');
	console.log('═'.repeat(60) + '\n');
	
	const sessionCookie = `sessionid=${config.tradingViewSession.sessionId}`;
	const url = 'https://www.tradingview.com/api/v1/user/';
	
	console.log(`📡 Request URL: ${url}`);
	console.log(`🍪 Cookie: sessionid=${config.tradingViewSession.sessionId.substring(0, 20)}...\n`);
	
	try {
		const response = await fetch(url, {
			headers: {
				'Cookie': sessionCookie,
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				'Accept': 'application/json',
			},
		});
		
		console.log(`📥 Response Status: ${response.status} ${response.statusText}\n`);
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		
		const data = await response.json();
		console.log('✅ User data received:\n');
		console.log(JSON.stringify(data, null, 2));
		
		const userId = data.id || data.user_id;
		const username = data.username;
		
		if (!userId) {
			throw new Error('No user_id found in response');
		}
		
		const output: Step1Output = {
			success: true,
			userId,
			username,
		};
		
		console.log('\n' + '═'.repeat(60));
		console.log(`\n🎯 User ID extracted: ${userId}`);
		if (username) console.log(`👤 Username: ${username}`);
		
		return output;
		
	} catch (error) {
		const output: Step1Output = {
			success: false,
			userId: 0,
			error: error instanceof Error ? error.message : String(error),
		};
		
		console.error('\n' + '═'.repeat(60));
		console.error('\n❌ Error:', output.error);
		console.error('\nTroubleshooting:');
		console.error('  - Check that sessionid cookie is valid');
		console.error('  - Try refreshing session with browser extension');
		console.error('  - Verify you can access TradingView.com in browser\n');
		
		return output;
	}
}

// Main execution
async function main() {
	// Ensure output directory exists
	mkdirSync(config.output.directory, { recursive: true });
	
	const result = await getUserId();
	
	// Save output
	writeFileSync(
		OUTPUT_FILE,
		JSON.stringify(result, null, config.output.prettyPrint ? 2 : 0)
	);
	
	console.log(`\n💾 Output saved to: ${OUTPUT_FILE}`);
	console.log('\n' + (result.success ? '✅ Step 1 Complete!' : '❌ Step 1 Failed'));
	
	if (result.success) {
		console.log('\n▶  Next step: Run `pnpm poc-2` to get JWT token\n');
	}
	
	process.exit(result.success ? 0 : 1);
}

main();
