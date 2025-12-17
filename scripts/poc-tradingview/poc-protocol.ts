/**
 * TradingView WebSocket Protocol Helpers (POC Wrapper)
 * 
 * Re-exports shared protocol utilities from the main library.
 * This file provides backward compatibility for POC scripts.
 */

// Re-export all protocol utilities from shared library
export {
	parseFrame,
	encodeMessage,
	encodeMessages,
	generateSessionId,
	createSymbolSpec,
	createMessage,
	type TVMessage,
	type ParsedFrame
} from '../../src/lib/tradingview/protocol.js';
