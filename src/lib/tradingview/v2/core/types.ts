/**
 * Core Types for TradingView WebSocket Connection (v2)
 * 
 * Type-safe definitions for the entire connection layer.
 * These types form the foundation of the v2 architecture.
 */

/**
 * TradingView protocol message
 */
export interface TVMessage {
	m: string;           // Method name (e.g., 'set_auth_token', 'create_series')
	p: unknown[];        // Parameters array
	t?: number;          // Optional timestamp (seconds)
	t_ms?: number;       // Optional timestamp (milliseconds)
}

/**
 * Parsed WebSocket frame
 */
export interface ParsedFrame {
	messages: TVMessage[];     // Decoded JSON messages
	rawMessages: string[];     // Raw JSON strings
	heartbeats: string[];      // Heartbeat frames to echo back
}

/**
 * OHLCV bar data
 */
export interface OHLCVBar {
	time: number;        // Unix timestamp (seconds)
	open: number;        // Opening price
	high: number;        // High price
	low: number;         // Low price
	close: number;       // Closing price
	volume: number;      // Trading volume
}

/**
 * Symbol metadata from TradingView
 */
export interface SymbolMetadata {
	name: string;              // Symbol name (e.g., 'RELIANCE')
	full_name: string;         // Full name (e.g., 'NSE:RELIANCE')
	ticker: string;            // Ticker symbol
	exchange: string;          // Exchange (e.g., 'NSE')
	type: string;              // Instrument type (e.g., 'stock', 'futures')
	timezone: string;          // Timezone (e.g., 'Asia/Kolkata')
	minmov: number;            // Minimum price movement
	pricescale: number;        // Price scale (100 = 2 decimals)
	session: string;           // Trading session (e.g., '0915-1530')
	[key: string]: unknown;    // Additional metadata fields
}

/**
 * Indicator/study data
 */
export interface IndicatorBar {
	time: number;              // Unix timestamp
	values: number[];          // Indicator values (CVD, RSI, etc.)
}

export interface IndicatorData {
	indicatorId: string;       // Unique ID (e.g., 'cvd_1')
	type: string;              // Type (e.g., 'cvd', 'rsi')
	config: Record<string, unknown>; // Indicator configuration
	bars: IndicatorBar[];      // Time-series data
}

/**
 * Connection state enumeration
 */
export enum ConnectionState {
	DISCONNECTED = 'DISCONNECTED',       // Not connected
	CONNECTING = 'CONNECTING',           // Connection in progress
	CONNECTED = 'CONNECTED',             // WebSocket opened
	AUTHENTICATING = 'AUTHENTICATING',   // Sending auth
	AUTHENTICATED = 'AUTHENTICATED',     // Auth complete
	READY = 'READY',                     // Sessions created, ready for data
	ERROR = 'ERROR',                     // Error state
	CLOSED = 'CLOSED'                    // Connection closed
}

/**
 * Connection configuration
 */
export interface ConnectionConfig {
	/** JWT token for authentication */
	jwtToken: string;
	
	/** WebSocket URL (default: wss://prodata.tradingview.com/socket.io/websocket) */
	websocketUrl?: string;
	
	/** Chart ID for connection (default: S09yY40x) */
	chartId?: string;
	
	/** Connection timeout in milliseconds (default: 30000) */
	connectionTimeout?: number;
	
	/** Data fetch timeout in milliseconds (default: 10000) */
	dataTimeout?: number;
	
	/** Enable detailed logging (default: false) */
	enableLogging?: boolean;
	
	/** Maximum requests per connection before refresh (default: 20) */
	maxRequestsPerConnection?: number;
}

/**
 * Symbol fetch request
 */
export interface SymbolRequest {
	/** Symbol specification (e.g., 'NSE:RELIANCE') */
	symbol: string;
	
	/** Time resolution (e.g., '1D', '1', '5', '15', '60') */
	resolution: string;
	
	/** Number of bars to fetch */
	barsCount: number;
	
	/** Price adjustment type (default: 'dividends') */
	adjustment?: 'dividends' | 'splits' | 'none';
	
	/** Session type (optional) */
	session?: 'regular' | 'extended';
	
	/** Indicators to fetch (optional) */
	indicators?: IndicatorRequest[];
}

/**
 * Indicator request
 */
export interface IndicatorRequest {
	/** Indicator type */
	type: 'cvd' | 'rsi' | 'macd' | string;
	
	/** Indicator configuration */
	config: Record<string, unknown>;
}

/**
 * Symbol fetch result
 */
export interface SymbolData {
	/** Symbol requested */
	symbol: string;
	
	/** OHLCV bars */
	bars: OHLCVBar[];
	
	/** Symbol metadata */
	metadata: Partial<SymbolMetadata>;
	
	/** Indicator data (if requested) */
	indicators?: Map<string, IndicatorData>;
	
	/** Performance timing breakdown */
	timing: {
		resolveSymbol: number;      // ms to resolve symbol
		fetchBars: number;          // ms to fetch bars
		fetchIndicators: number;    // ms to fetch indicators
		total: number;              // total ms
	};
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
	/** Total requests made */
	requestCount: number;
	
	/** Successful requests */
	successCount: number;
	
	/** Failed requests */
	errorCount: number;
	
	/** Average response time (ms) */
	avgResponseTime: number;
	
	/** Last request timestamp */
	lastRequestAt: number;
	
	/** Connection uptime (ms) */
	uptime: number;
	
	/** Current state */
	state: ConnectionState;
}

/**
 * Heartbeat status
 */
export interface HeartbeatStatus {
	/** Last heartbeat received timestamp */
	lastReceived: number;
	
	/** Last heartbeat sent timestamp */
	lastSent: number;
	
	/** Total heartbeats received */
	receivedCount: number;
	
	/** Total heartbeats sent */
	sentCount: number;
	
	/** Is heartbeat active */
	isActive: boolean;
	
	/** Time since last heartbeat (ms) */
	timeSinceLastHeartbeat: number;
}

/**
 * Event map for typed event emitter
 */
export interface EventMap {
	// Lifecycle events
	'state': (state: ConnectionState, previous: ConnectionState) => void;
	'initialized': () => void;
	'disposed': () => void;
	
	// Protocol events
	'message:sent': (message: TVMessage, encoded: string) => void;
	'message:received': (message: TVMessage, raw: string) => void;
	'heartbeat:sent': (timestamp: number) => void;
	'heartbeat:received': (timestamp: number) => void;
	
	// Data events
	'symbol:resolved': (symbol: string, metadata: Partial<SymbolMetadata>) => void;
	'symbol:error': (symbol: string, reason: string) => void;
	'bars:received': (symbol: string, count: number) => void;
	'indicator:received': (type: string, indicatorId: string, count: number) => void;
	
	// Error events
	'error': (error: Error) => void;
	'warning': (message: string, context?: unknown) => void;
	'timeout': (operation: string, duration: number) => void;
	
	// Performance events
	'timing': (operation: string, duration: number) => void;
	'stats': (stats: ConnectionStats) => void;
}

/**
 * Request tracking information
 */
export interface PendingRequest {
	/** Request ID */
	id: string;
	
	/** Request type (symbol resolution, data fetch, etc.) */
	type: 'resolve_symbol' | 'create_series' | 'modify_series' | 'create_study';
	
	/** Request parameters */
	params: unknown[];
	
	/** Timestamp when request was sent */
	sentAt: number;
	
	/** Resolve function for promise */
	resolve: (value: unknown) => void;
	
	/** Reject function for promise */
	reject: (error: Error) => void;
	
	/** Timeout handle */
	timeout: NodeJS.Timeout;
}

/**
 * Session identifiers used in protocol
 */
export interface SessionIds {
	/** WebSocket session ID (from handshake) */
	websocketSessionId: string;
	
	/** Chart session ID (client-generated) */
	chartSessionId: string;
	
	/** Quote session ID (client-generated) */
	quoteSessionId: string;
	
	/** Current symbol session counter */
	symbolSessionCounter: number;
	
	/** Current series counter (for unique series IDs) */
	seriesCounter: number;
	
	/** Current series turnaround counter */
	turnaroundCounter: number;
}
