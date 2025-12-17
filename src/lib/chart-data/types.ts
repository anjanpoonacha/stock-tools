/**
 * Chart Data Service Types
 * 
 * Type definitions for the chart data service layer.
 */

import type { OHLCVBar, SymbolMetadata, StudyData } from '@/lib/tradingview/types';

/**
 * Result of session resolution for a user
 */
export interface SessionResolutionResult {
	success: boolean;
	error?: string;
	sessionId?: string;
	sessionIdSign?: string;
	userId?: number;
	warnings?: string[];
}

/**
 * Result of JWT token extraction
 */
export interface JWTTokenResult {
	success: boolean;
	error?: string;
	token?: string;
}

/**
 * Result of historical data fetch
 */
export interface HistoricalDataResult {
	success: boolean;
	error?: string;
	bars?: OHLCVBar[];
	metadata?: Partial<SymbolMetadata>;
	indicators?: {
		cvd?: StudyData;
	};
}

/**
 * Complete result of chart data service operation
 */
export interface ChartDataServiceResult {
	success: boolean;
	data?: {
		symbol: string;
		resolution: string;
		bars: OHLCVBar[];
		metadata: Partial<SymbolMetadata>;
		indicators?: {
			cvd?: StudyData;
		};
	};
	error?: string;
	statusCode: number;
}
