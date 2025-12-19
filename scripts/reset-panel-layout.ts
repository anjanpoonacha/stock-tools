/**
 * Reset Panel Layout to New Defaults
 * 
 * This script resets the KV storage panel layout to use the new default sizes:
 * - Toolbar: 15% (was 5%)
 * - Chart: 65% (was 81%)
 * - Stock List: 20% (was 14%)
 */

import { DEFAULT_PANEL_SIZES } from '../src/lib/chart/panelConstants';

const API_URL = 'http://localhost:3000/api/kv/panel-layout';

async function resetPanelLayout() {
	const newLayout = {
		'toolbar-panel': DEFAULT_PANEL_SIZES.TOOLBAR,
		'chart-panel': DEFAULT_PANEL_SIZES.CHART,
		'stock-list-panel': DEFAULT_PANEL_SIZES.STOCK_LIST,
	};

	console.log('🔄 Resetting panel layout to new defaults...');
	console.log('New layout:', newLayout);

	try {
		const response = await fetch(API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newLayout),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const result = await response.json();
		console.log('✅ Panel layout reset successfully!');
		console.log('Response:', result);
		console.log('\n📊 New panel sizes:');
		console.log(`  - Toolbar:    ${DEFAULT_PANEL_SIZES.TOOLBAR}%`);
		console.log(`  - Chart:      ${DEFAULT_PANEL_SIZES.CHART}%`);
		console.log(`  - Stock List: ${DEFAULT_PANEL_SIZES.STOCK_LIST}%`);
		console.log('\n🔄 Please refresh your browser to see the changes.');
	} catch (error) {
		console.error('❌ Failed to reset panel layout:', error);
		process.exit(1);
	}
}

resetPanelLayout();
