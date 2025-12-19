/**
 * Verify KV Storage Reset
 * 
 * Checks that the panel layout was properly reset in KV storage
 */

const API_URL = 'http://localhost:3000/api/kv/panel-layout';

async function verifyKVReset() {
	console.log('🔍 Fetching current panel layout from KV...');

	try {
		const response = await fetch(API_URL);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const layout = await response.json();
		console.log('\n📊 Current panel layout in KV:');
		console.log(layout);

		// Check if values match expected defaults
		const expected = {
			'toolbar-panel': 15,
			'chart-panel': 65,
			'stock-list-panel': 20,
		};

		console.log('\n✅ Expected defaults:');
		console.log(expected);

		const matches = 
			layout['toolbar-panel'] === expected['toolbar-panel'] &&
			layout['chart-panel'] === expected['chart-panel'] &&
			layout['stock-list-panel'] === expected['stock-list-panel'];

		if (matches) {
			console.log('\n✅ VERIFIED: Panel layout matches expected defaults!');
		} else {
			console.log('\n❌ MISMATCH: Panel layout does not match expected defaults');
			console.log('Differences:');
			if (layout['toolbar-panel'] !== expected['toolbar-panel']) {
				console.log(`  - toolbar-panel: got ${layout['toolbar-panel']}, expected ${expected['toolbar-panel']}`);
			}
			if (layout['chart-panel'] !== expected['chart-panel']) {
				console.log(`  - chart-panel: got ${layout['chart-panel']}, expected ${expected['chart-panel']}`);
			}
			if (layout['stock-list-panel'] !== expected['stock-list-panel']) {
				console.log(`  - stock-list-panel: got ${layout['stock-list-panel']}, expected ${expected['stock-list-panel']}`);
			}
		}
	} catch (error) {
		console.error('❌ Failed to fetch panel layout:', error);
		process.exit(1);
	}
}

verifyKVReset();
