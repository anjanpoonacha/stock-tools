/**
 * TradingView Integration Types
 */

// OHLCV Bar Data
export interface OHLCVBar {
	time: number;        // Unix timestamp in seconds
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

// Symbol Metadata from TradingView
export interface SymbolMetadata {
	name: string;
	full_name: string;
	description: string;
	exchange: string;
	currency_code: string;
	pricescale: number;
	minmov: number;
	minmove2: number;
	timezone: string;
	session: string;
	has_intraday: boolean;
	type?: string;
}

// Chart Data API Response
export interface ChartDataResponse {
	success: boolean;
	symbol: string;
	resolution: string;
	bars: OHLCVBar[];
	metadata: Partial<SymbolMetadata>;
	indicators?: {
		cvd?: StudyData;
	};
	error?: string;
}

// JWT Token Data
export interface JWTTokenData {
	token: string;
	userId: number;
	expiresAt: number;
	permissions: string;
}

// WebSocket Message Types
export interface TVMessage {
	m: string;           // Method name
	p: unknown[];        // Parameters array
	t?: number;          // Timestamp (seconds)
	t_ms?: number;       // Timestamp (milliseconds)
}

export interface TVHandshake {
	session_id: string;
	timestamp: number;
	timestampMs: number;
	release: string;
	protocol: string;
	studies_metadata_hash?: string;
	auth_scheme_vsn?: number;
}

// Data Update Message Types
export interface TVDataUpdate {
	m: 'du';
	p: [string, Record<string, { st: TVSeriesData[] }>];
}

export interface TVSeriesData {
	i: number;           // Index (negative for historical)
	v: number[];         // Values: [timestamp, open, high, low, close, volume]
}

// Backward compatibility alias
export type TVSymbolResolved = SymbolMetadata;

// ============================================================================
// Study/Indicator Types
// ============================================================================

/**
 * Study input parameter
 * Used to configure indicator parameters (e.g., resolution, boolean flags)
 */
export interface StudyInput {
	v: string | number | boolean;  // Value
	f: boolean;                     // Fixed flag
	t: string;                      // Type (e.g., "resolution", "bool", "integer", "text")
}

/**
 * Study configuration
 * Defines an indicator/study to be created in TradingView
 */
export interface StudyConfig {
	pineId: string;                 // e.g., "STD;Cumulative%1Volume%1Delta"
	pineVersion: string;            // e.g., "6.0"
	pineFeatures?: StudyInput;      // Feature flags (JSON string)
	[key: string]: StudyInput | string | undefined;  // Dynamic inputs (in_0, in_1, etc.)
}

/**
 * Study data point
 * Represents a single bar/data point from an indicator
 */
export interface StudyBar {
	time: number;                   // Unix timestamp in seconds
	values: number[];               // Indicator values (can be multiple plots)
}

/**
 * Study data container
 * Stores all data for a single indicator instance
 */
export interface StudyData {
	studyId: string;                // Instance ID (e.g., "cvd_1")
	studyName: string;              // Human-readable name
	config: StudyConfig;            // Configuration used
	values: StudyBar[];             // Time-series data
}

/**
 * CVD (Cumulative Volume Delta) configuration helper
 * Provides type-safe configuration for CVD indicator
 */
export interface CVDConfig {
	anchorPeriod: string;           // e.g., "3M", "1M", "1W"
	useCustomTimeframe: boolean;    // Whether to use custom timeframe (in_1)
	customTimeframe?: string;       // e.g., "30S", "15S" (when useCustomTimeframe=true)
}
