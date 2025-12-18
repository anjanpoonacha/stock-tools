/**
 * POC: Analyze Data Key Patterns from HAR file
 * 
 * This script analyzes the actual WebSocket messages from the HAR file
 * to understand what data keys are used after modify_series
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WebSocketMessage {
	type: 'send' | 'receive';
	data: string;
}



function parseHAR(filePath: string): WebSocketMessage[] {
	const harContent = fs.readFileSync(filePath, 'utf-8');
	const har = JSON.parse(harContent);
	
	const messages: WebSocketMessage[] = [];
	
	for (const entry of har.log.entries) {
		if (entry._webSocketMessages) {
			messages.push(...entry._webSocketMessages);
		}
	}
	
	return messages;
}

function parseTVMessage(frame: string): any[] {
	const messages: any[] = [];
	let position = 0;

	while (position < frame.length) {
		const firstDelimiter = frame.indexOf('~m~', position);
		if (firstDelimiter === -1) break;

		position = firstDelimiter + 3;

		const secondDelimiter = frame.indexOf('~m~', position);
		if (secondDelimiter === -1) break;

		const lengthStr = frame.substring(position, secondDelimiter);
		const messageLength = parseInt(lengthStr, 10);

		if (isNaN(messageLength)) break;

		position = secondDelimiter + 3;

		const messagePayload = frame.substring(position, position + messageLength);

		try {
			const parsed = JSON.parse(messagePayload);
			messages.push(parsed);
		} catch (error) {
			// Skip invalid JSON
		}

		position += messageLength;
	}

	return messages;
}

function main() {
	console.log('🔍 Analyzing Data Key Patterns from HAR File\n');
	
	const harPath = path.join(__dirname, '../../tv-switch-charts.har');
	
	if (!fs.existsSync(harPath)) {
		console.error(`❌ HAR file not found: ${harPath}`);
		process.exit(1);
	}
	
	console.log(`📂 Reading HAR file: ${harPath}\n`);
	
	const messages = parseHAR(harPath);
	console.log(`📊 Total WebSocket messages: ${messages.length}\n`);
	
	// Track symbol switches
	let currentSymbol = '';
	const symbolSwitches: Array<{
		symbol: string;
		action: 'create_series' | 'modify_series';
		turnaroundId: string;
		dataKeys: string[];
	}> = [];
	
	for (const msg of messages) {
		if (msg.type === 'send') {
			const tvMessages = parseTVMessage(msg.data);
			
			for (const tvMsg of tvMessages) {
				// Track symbol resolution
				if (tvMsg.m === 'resolve_symbol' && tvMsg.p && tvMsg.p[2]) {
					try {
						const symbolSpec = JSON.parse(tvMsg.p[2].replace('=', ''));
						currentSymbol = symbolSpec.symbol;
					} catch (e) {
						// Skip
					}
				}
				
				// Track series creation/modification
				if (tvMsg.m === 'create_series') {
					const turnaroundId = tvMsg.p[2];
					console.log(`📝 create_series: symbol=${currentSymbol}, turnaroundId="${turnaroundId}"`);
					symbolSwitches.push({
						symbol: currentSymbol,
						action: 'create_series',
						turnaroundId,
						dataKeys: []
					});
				}
				
				if (tvMsg.m === 'modify_series') {
					const turnaroundId = tvMsg.p[2];
					console.log(`🔄 modify_series: symbol=${currentSymbol}, turnaroundId="${turnaroundId}"`);
					symbolSwitches.push({
						symbol: currentSymbol,
						action: 'modify_series',
						turnaroundId,
						dataKeys: []
					});
				}
			}
		}
		
		if (msg.type === 'receive') {
			const tvMessages = parseTVMessage(msg.data);
			
			for (const tvMsg of tvMessages) {
				// Track data updates
				if ((tvMsg.m === 'du' || tvMsg.m === 'timescale_update') && tvMsg.p && tvMsg.p[1]) {
					const dataObj = tvMsg.p[1];
					const dataKeys = Object.keys(dataObj);
					
					// Check if this has OHLCV data
					for (const dataKey of dataKeys) {
						const seriesData = dataObj[dataKey];
						const series = seriesData.s || seriesData.st;
						
						if (series && Array.isArray(series) && series.length > 0) {
							const firstBar = series[0];
							if (firstBar.v && firstBar.v.length === 6) {
								// This is OHLCV data
								const lastSwitch = symbolSwitches[symbolSwitches.length - 1];
								if (lastSwitch && !lastSwitch.dataKeys.includes(dataKey)) {
									lastSwitch.dataKeys.push(dataKey);
									console.log(`   📦 Data received: key="${dataKey}", bars=${series.length}`);
								}
							}
						}
					}
				}
			}
		}
	}
	
	console.log('\n' + '='.repeat(70));
	console.log('📊 Summary: Data Keys by Symbol Switch');
	console.log('='.repeat(70) + '\n');
	
	for (const sw of symbolSwitches) {
		if (sw.dataKeys.length > 0) {
			console.log(`${sw.action === 'create_series' ? '📝' : '🔄'} ${sw.action}:`);
			console.log(`   Symbol: ${sw.symbol}`);
			console.log(`   Turnaround ID: "${sw.turnaroundId}"`);
			console.log(`   Data Keys: ${sw.dataKeys.join(', ')}`);
			console.log('');
		}
	}
	
	// Analyze pattern
	console.log('='.repeat(70));
	console.log('🔍 Pattern Analysis');
	console.log('='.repeat(70) + '\n');
	
	const allDataKeys = symbolSwitches.flatMap(sw => sw.dataKeys);
	const uniqueDataKeys = [...new Set(allDataKeys)];
	
	console.log(`Unique data keys found: ${uniqueDataKeys.join(', ')}`);
	console.log('');
	
	// Check pattern matching
	const pattern = /^s\d+$/;
	console.log('Testing pattern: /^s\\d+$/');
	for (const key of uniqueDataKeys) {
		const matches = pattern.test(key);
		console.log(`   "${key}" → ${matches ? '✅ MATCHES' : '❌ DOES NOT MATCH'}`);
	}
	
	console.log('\n✅ Analysis Complete!\n');
}

main();
