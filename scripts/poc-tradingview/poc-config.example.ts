/**
 * POC Configuration Template
 * 
 * Copy this file to poc-config.ts and fill in your values
 */

export const config = {
	// TradingView session cookie (get from KV storage or browser)
	tradingViewSession: {
		sessionId: 'YOUR_SESSIONID_COOKIE_HERE',  // e.g., c21pcqky6leod5cjl2fh6i660sy411jb
		sessionIdSign: '',  // Optional: sessionid_sign cookie if available
	},
	
	// Chart configuration
	chart: {
		id: 'S09yY40x',           // Your TradingView chart ID (can use any valid chart ID)
		symbol: 'NSE:JUNIPER',    // Symbol to fetch (NSE:JUNIPER, NSE:TCS, etc.)
		resolution: '1D',         // Bar resolution: 1D (daily), 1W (weekly), 1M (monthly)
		barsCount: 300,           // Number of historical bars to fetch
	},
	
	// WebSocket configuration
	websocket: {
		url: 'wss://prodata.tradingview.com/socket.io/websocket',
		timeout: 30000,           // Connection timeout in milliseconds (30 seconds)
	},
	
	// Output configuration
	output: {
		directory: './scripts/poc-output',
		saveMessages: true,       // Save all WebSocket messages for debugging
		prettyPrint: true,        // Pretty-print JSON output
	}
};

// Example usage:
// 1. Copy this file: cp poc-config.example.ts poc-config.ts
// 2. Fill in sessionId from your TradingView session
// 3. Run: pnpm poc-1 (get user ID)
// 4. Run: pnpm poc-2 (get JWT token)
// 5. Run: pnpm poc-3 (fetch historical bars)
