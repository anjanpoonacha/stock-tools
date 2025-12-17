#!/usr/bin/env tsx
/**
 * POC Step 2: Get JWT Token
 * 
 * Calls /chart-token/ endpoint with user_id to get JWT for WebSocket authentication
 */

import { readFileSync, writeFileSync } from 'fs';
import { config } from './poc-config.js';
import type { Step1Output, Step2Output } from './poc-types.js';

const INPUT_FILE = `${config.output.directory}/1-user-data.json`;
const OUTPUT_FILE = `${config.output.directory}/2-jwt-token.json`;

async function getJWTToken(userId: number): Promise<Step2Output> {
	console.log('🔐 POC Step 2: Fetching JWT Token\n');
	console.log('═'.repeat(60) + '\n');
	
	const sessionCookie = `sessionid=${config.tradingViewSession.sessionId}`;
	const chartId = config.chart.id;
	const url = `https://www.tradingview.com/chart-token/?image_url=${chartId}&user_id=${userId}`;
	
	console.log(`📡 Request URL: ${url}`);
	console.log(`👤 User ID: ${userId}`);
	console.log(`📊 Chart ID: ${chartId}`);
	console.log(`🍪 Cookie: sessionid=${config.tradingViewSession.sessionId.substring(0, 20)}...\n`);
	
	try {
		const response = await fetch(url, {
			headers: {
				'Cookie': sessionCookie,
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				'Accept': '*/*',
			},
		});
		
		console.log(`📥 Response Status: ${response.status} ${response.statusText}\n`);
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		
		const contentType = response.headers.get('content-type') || '';
		let jwtToken: string;
		
		if (contentType.includes('application/json')) {
			const data = await response.json();
			console.log('📦 JSON Response:\n', JSON.stringify(data, null, 2));
			jwtToken = data.token || data.auth_token || data.jwt || '';
		} else {
			jwtToken = await response.text();
			console.log('📦 Text Response (first 200 chars):\n', jwtToken.substring(0, 200) + '...');
		}
		
		if (!jwtToken || !jwtToken.startsWith('eyJ')) {
			throw new Error('Invalid JWT token format');
		}
		
		// Decode JWT payload to get expiry
		const payloadBase64 = jwtToken.split('.')[1];
		const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
		console.log('\n🔓 JWT Payload:\n', JSON.stringify(payload, null, 2));
		
		const output: Step2Output = {
			success: true,
			jwtToken,
			userId,
			chartId,
			expiresAt: payload.exp,
		};
		
		const expiresIn = Math.round((payload.exp * 1000 - Date.now()) / 60000);
		console.log('\n' + '═'.repeat(60));
		console.log(`\n⏰ Token expires in: ${expiresIn} minutes`);
		console.log(`🎯 JWT Token obtained (${jwtToken.length} characters)`);
		console.log(`🔑 Token preview: ${jwtToken.substring(0, 50)}...`);
		
		return output;
		
	} catch (error) {
		const output: Step2Output = {
			success: false,
			jwtToken: '',
			userId,
			chartId,
			expiresAt: 0,
			error: error instanceof Error ? error.message : String(error),
		};
		
		console.error('\n' + '═'.repeat(60));
		console.error('\n❌ Error:', output.error);
		console.error('\nTroubleshooting:');
		console.error('  - Verify user_id is correct (from Step 1)');
		console.error('  - Check that session cookie is still valid');
		console.error('  - Try refreshing session with browser extension');
		console.error('  - Ensure chart_id exists in config\n');
		
		return output;
	}
}

// Main execution
async function main() {
	// Read user ID from Step 1
	let userId: number;
	try {
		const step1Data = JSON.parse(readFileSync(INPUT_FILE, 'utf-8')) as Step1Output;
		if (!step1Data.success) {
			throw new Error('Step 1 failed - cannot proceed');
		}
		userId = step1Data.userId;
		console.log(`📂 Loaded User ID from Step 1: ${userId}\n`);
	} catch (error) {
		console.error(`\n❌ Error reading ${INPUT_FILE}:`, error);
		console.error('   Run: pnpm poc-1 first\n');
		process.exit(1);
	}
	
	const result = await getJWTToken(userId);
	
	// Save output
	writeFileSync(
		OUTPUT_FILE,
		JSON.stringify(result, null, config.output.prettyPrint ? 2 : 0)
	);
	
	console.log(`\n💾 Output saved to: ${OUTPUT_FILE}`);
	console.log('\n' + (result.success ? '✅ Step 2 Complete!' : '❌ Step 2 Failed'));
	
	if (result.success) {
		console.log('\n▶  Next step: Run `pnpm poc-3` to fetch historical bars\n');
	}
	
	process.exit(result.success ? 0 : 1);
}

main();
