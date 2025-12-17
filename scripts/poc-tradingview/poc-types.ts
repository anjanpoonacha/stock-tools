/**
 * TradingView POC Type Definitions
 * 
 * Imports shared types from production and defines POC-specific types
 */

// Import shared types from production
import type {
	TVMessage,
	TVHandshake,
	SymbolMetadata,
	TVDataUpdate,
	TVSeriesData,
	OHLCVBar,
	TVSymbolResolved,
	StudyData
} from '../../src/lib/tradingview/types.js';

// Re-export shared types for backward compatibility
export type {
	TVMessage,
	TVHandshake,
	SymbolMetadata,
	TVDataUpdate,
	TVSeriesData,
	OHLCVBar,
	TVSymbolResolved,
	StudyData
};

// POC-specific Output Types
export interface Step1Output {
	success: boolean;
	userId: number;
	username?: string;
	error?: string;
}

export interface Step2Output {
	success: boolean;
	jwtToken: string;
	userId: number;
	chartId: string;
	expiresAt: number;
	error?: string;
}

export interface Step3Output {
	success: boolean;
	symbol: string;
	resolution: string;
	bars: OHLCVBar[];
	symbolMetadata: Partial<TVSymbolResolved>;
	websocketSession: string;
	messagesExchanged: {
		sent: number;
		received: number;
	};
	indicators?: {
		cvd?: StudyData;  // CVD indicator data (optional)
	};
	error?: string;
}
