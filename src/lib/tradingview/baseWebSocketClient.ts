/**
 * Base WebSocket Client for TradingView Integration
 * 
 * Abstract base class providing common WebSocket functionality for both
 * production and POC TradingView clients. Uses the Template Method pattern
 * to allow subclasses to customize behavior while maintaining consistent
 * connection management and protocol handling.
 * 
 * @example Production Usage
 * ```typescript
 * class ProductionClient extends BaseWebSocketClient {
 *   protected async requestHistoricalBars(): Promise<void> {
 *     // Production-specific implementation
 *   }
 * }
 * ```
 * 
 * @example POC Usage with Logging
 * ```typescript
 * class POCClient extends BaseWebSocketClient {
 *   constructor(config) {
 *     super({ ...config, enableLogging: true });
 *   }
 *   
 *   protected onMessageSent(message: TVMessage): void {
 *     console.log('📤 Sent:', message.m);
 *   }
 * }
 * ```
 */

import WebSocket from 'ws';
import {
	parseFrame,
	encodeMessage,
	generateSessionId,
	createMessage,
	type TVMessage
} from './protocol';
import type { OHLCVBar, SymbolMetadata, StudyConfig, StudyData, StudyBar } from './types';

/**
 * Configuration for WebSocket client
 */
export interface BaseClientConfig {
	/** JWT token for authentication */
	jwtToken: string;
	/** Connection timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** TradingView chart ID (default: 'S09yY40x') */
	chartId?: string;
	/** WebSocket URL (default: 'wss://prodata.tradingview.com/socket.io/websocket') */
	websocketUrl?: string;
	/** Enable message tracking and stats (default: false) */
	enableLogging?: boolean;
}

/**
 * Message statistics for debugging
 */
export interface MessageStats {
	sent: number;
	received: number;
}

/**
 * Abstract base class for TradingView WebSocket clients
 * 
 * Provides common functionality for connecting, authenticating, and
 * handling messages from TradingView's WebSocket API. Subclasses must
 * implement `requestHistoricalBars()` to define their data fetching strategy.
 * 
 * **Core Features:**
 * - WebSocket connection management with timeout
 * - JWT authentication flow
 * - Protocol message parsing and encoding
 * - Session ID management (chart, quote, symbol)
 * - Data collection (bars, metadata)
 * - Optional logging and statistics
 * 
 * **Template Methods (Must Override):**
 * - `requestHistoricalBars()` - Implement data fetching logic
 * 
 * **Protected Methods (Can Override):**
 * - `createChartSession()` - Create chart session
 * - `createQuoteSession()` - Create quote session
 * - `resolveSymbol()` - Resolve symbol to get metadata
 * - `createSeries()` - Create series to request bars
 * - `waitForData()` - Wait for data to arrive
 * - Message handlers: `handleHandshake()`, `handleSymbolResolved()`, etc.
 * 
 * **Lifecycle Hooks (Optional):**
 * - `onBeforeConnect()` - Before WebSocket connection
 * - `onConnected()` - After successful connection
 * - `onAuthenticated()` - After authentication sent
 * - `onMessageSent()` - After each message sent
 * - `onMessageReceived()` - After each message received
 * - `onProtocolError()` - On protocol error
 * - `onBeforeDisconnect()` - Before disconnection
 * - `onDisconnected()` - After disconnection
 */
export abstract class BaseWebSocketClient {
	// WebSocket connection
	protected ws: WebSocket | null = null;
	
	// Session identifiers
	protected chartSessionId: string;
	protected quoteSessionId: string;
	protected symbolSessionId: string;
	protected websocketSessionId = '';
	
	// Configuration
	protected config: Required<BaseClientConfig>;
	
	// Data storage
	protected bars: OHLCVBar[] = [];
	protected symbolMetadata: Partial<SymbolMetadata> = {};
	protected studies: Map<string, StudyData> = new Map();
	
	// Connection management
	private resolveConnection: ((value: void) => void) | null = null;
	private rejectConnection: ((reason: Error) => void) | null = null;
	
	// Logging (optional)
	private messageStats: MessageStats | null = null;
	
	/**
	 * Create a new WebSocket client
	 * 
	 * @param config Client configuration
	 */
	constructor(config: BaseClientConfig) {
		this.config = {
			timeout: 30000,
			chartId: 'S09yY40x',
			websocketUrl: 'wss://prodata.tradingview.com/socket.io/websocket',
			enableLogging: false,
			...config
		};
		
		// Generate session IDs
		this.chartSessionId = generateSessionId('cs_');
		this.quoteSessionId = generateSessionId('qs_');
		this.symbolSessionId = 'sds_sym_1';
		
		// Initialize logging if enabled
		if (this.config.enableLogging) {
			this.messageStats = { sent: 0, received: 0 };
		}
	}
	
	// ========================================================================
	// CORE METHODS (Final - Not Overridable)
	// ========================================================================
	
	/**
	 * Connect to TradingView WebSocket
	 * 
	 * Establishes WebSocket connection with proper headers and query parameters.
	 * Handles connection timeout and error cases.
	 * 
	 * @throws Error if connection fails or times out
	 */
	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.resolveConnection = resolve;
			this.rejectConnection = reject;
			
			// Build WebSocket URL
			const wsUrl = new URL(this.config.websocketUrl);
			wsUrl.searchParams.set('from', `chart/${this.config.chartId}/`);
			wsUrl.searchParams.set('date', new Date().toISOString());
			wsUrl.searchParams.set('type', 'chart');
			
			// Call lifecycle hook
			this.onBeforeConnect?.(wsUrl.toString());
			
			// Create WebSocket connection
			this.ws = new WebSocket(wsUrl.toString(), {
				headers: {
					'Origin': 'https://www.tradingview.com',
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				},
			});
			
			// Set connection timeout
			const timeout = setTimeout(() => {
				reject(new Error('WebSocket connection timeout'));
			}, this.config.timeout);
			
			// Handle connection events
			this.ws.on('open', () => {
				clearTimeout(timeout);
				this.onConnected?.();
				resolve();
			});
			
			this.ws.on('error', (error) => {
				clearTimeout(timeout);
				reject(error);
			});
			
			this.ws.on('close', () => {
				this.onDisconnected?.();
			});
			
			this.ws.on('message', (data: Buffer) => {
				this.handleMessage(data.toString());
			});
		});
	}
	
	/**
	 * Close WebSocket connection
	 */
	disconnect(): void {
		this.onBeforeDisconnect?.();
		
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}
	
	/**
	 * Send a message through WebSocket
	 * 
	 * @param message Message to send
	 * @throws Error if WebSocket is not connected
	 */
	protected send(message: TVMessage): void {
		if (!this.ws) {
			throw new Error('WebSocket not connected');
		}
		
		const encoded = encodeMessage(message);
		this.ws.send(encoded);
		
		// Update stats
		if (this.messageStats) {
			this.messageStats.sent++;
		}
		
		// Call lifecycle hook
		this.onMessageSent?.(message);
	}
	
	/**
	 * Authenticate with JWT token
	 * 
	 * Sends authentication token and locale settings to TradingView.
	 * This must be called after connection but before requesting data.
	 */
	async authenticate(): Promise<void> {
		this.send(createMessage('set_auth_token', [this.config.jwtToken]));
		await this.sleep(500);
		
		this.send(createMessage('set_locale', ['en', 'US']));
		await this.sleep(200);
		
		this.onAuthenticated?.();
	}
	
	/**
	 * Handle incoming WebSocket message
	 * 
	 * Parses frame, dispatches to message handlers, and updates stats.
	 * 
	 * @param frame Raw WebSocket frame
	 */
	private handleMessage(frame: string): void {
		const { messages } = parseFrame(frame);
		
		// Update stats
		if (this.messageStats) {
			this.messageStats.received += messages.length;
		}
		
		for (const msg of messages) {
			// Call lifecycle hook
			this.onMessageReceived?.(msg);
			
			// Handshake - extract WebSocket session ID
			if ('session_id' in msg) {
				const handshake = msg as unknown as { session_id: string };
				this.websocketSessionId = handshake.session_id;
				this.handleHandshake(msg);
				continue;
			}
			
			// Dispatch based on message type
			switch (msg.m) {
				case 'symbol_resolved':
					this.handleSymbolResolved(msg);
					break;
					
				case 'study_loading':
					this.handleStudyLoading(msg);
					break;
					
				case 'du':
				case 'timescale_update':
					this.handleDataUpdate(msg);
					break;
					
				case 'protocol_error':
					this.handleProtocolError(msg);
					break;
					
				default:
					this.handleOtherMessage(msg);
					break;
			}
		}
	}
	
	/**
	 * Sleep for specified milliseconds
	 * 
	 * @param ms Milliseconds to sleep
	 */
	protected sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	// ========================================================================
	// DATA ACCESS METHODS
	// ========================================================================
	
	/**
	 * Get collected bars sorted by time (ascending)
	 * 
	 * @returns Array of OHLCV bars
	 */
	getBars(): OHLCVBar[] {
		return this.bars.sort((a, b) => a.time - b.time);
	}
	
	/**
	 * Get symbol metadata
	 * 
	 * @returns Symbol metadata (may be partial if not yet resolved)
	 */
	getMetadata(): Partial<SymbolMetadata> {
		return this.symbolMetadata;
	}
	
	/**
	 * Get WebSocket session ID
	 * 
	 * @returns WebSocket session ID (empty if not connected)
	 */
	getSessionId(): string {
		return this.websocketSessionId;
	}
	
	/**
	 * Get message statistics (if logging enabled)
	 * 
	 * @returns Message stats or null if logging disabled
	 */
	getMessageStats(): MessageStats | null {
		return this.messageStats;
	}
	
	/**
	 * Get all studies/indicators
	 * 
	 * @returns Map of study ID to study data
	 */
	getStudies(): Map<string, StudyData> {
		return this.studies;
	}
	
	/**
	 * Get a specific study by ID
	 * 
	 * @param studyId Study instance ID
	 * @returns Study data or undefined if not found
	 */
	getStudy(studyId: string): StudyData | undefined {
		return this.studies.get(studyId);
	}
	
	// ========================================================================
	// TEMPLATE METHODS (Must be Implemented by Subclasses)
	// ========================================================================
	
	/**
	 * Request historical bars from TradingView
	 * 
	 * Subclasses must implement this to define their data fetching strategy.
	 * This typically involves creating sessions, resolving symbols, and
	 * requesting series data.
	 * 
	 * @example
	 * ```typescript
	 * protected async requestHistoricalBars(): Promise<void> {
	 *   await this.createChartSession();
	 *   await this.resolveSymbol('NSE:JUNIPER');
	 *   await this.createSeries('1D', 300);
	 *   await this.waitForData(5000);
	 * }
	 * ```
	 */
	protected abstract requestHistoricalBars(): Promise<void>;
	
	// ========================================================================
	// PROTECTED TEMPLATE METHODS (Can be Overridden)
	// ========================================================================
	
	/**
	 * Create chart session
	 * 
	 * Default implementation sends chart_create_session message.
	 * Override to customize chart session creation.
	 */
	protected async createChartSession(): Promise<void> {
		this.send(createMessage('chart_create_session', [this.chartSessionId, '']));
		await this.sleep(200);
	}
	
	/**
	 * Create quote session
	 * 
	 * Default implementation sends quote_create_session message.
	 * Override to customize quote session creation.
	 */
	protected async createQuoteSession(): Promise<void> {
		this.send(createMessage('quote_create_session', [this.quoteSessionId]));
		await this.sleep(200);
	}
	
	/**
	 * Resolve symbol to get metadata
	 * 
	 * Default implementation uses 'dividends' adjustment.
	 * Override to customize symbol resolution.
	 * 
	 * @param symbolSpec Symbol specification string
	 */
	protected async resolveSymbol(symbolSpec: string): Promise<void> {
		this.send(createMessage('resolve_symbol', [
			this.chartSessionId,
			this.symbolSessionId,
			symbolSpec
		]));
		await this.sleep(500);
	}
	
	/**
	 * Create series to request bars
	 * 
	 * Default implementation requests bars with standard parameters.
	 * Override to customize series creation.
	 * 
	 * @param resolution Time resolution (e.g., '1D', '1', '5')
	 * @param barsCount Number of bars to request
	 */
	protected async createSeries(resolution: string, barsCount: number): Promise<void> {
		this.send(createMessage('create_series', [
			this.chartSessionId,
			'sds_1',
			's1',
			this.symbolSessionId,
			resolution,
			barsCount,
			''
		]));
	}
	
	/**
	 * Create study/indicator
	 * 
	 * Requests an indicator (e.g., CVD, RSI) to be added to the chart.
	 * 
	 * @param studyId Study instance ID (e.g., 'cvd_1')
	 * @param studyName Study name for server reference (e.g., 'Script@tv-scripting-101!')
	 * @param config Study configuration (pineId, inputs, etc.)
	 */
	protected async createStudy(
		studyId: string,
		studyName: string,
		config: StudyConfig
	): Promise<void> {
		// Initialize study data storage
		this.studies.set(studyId, {
			studyId,
			studyName,
			config,
			values: []
		});
		
		// Send create_study message
		this.send(createMessage('create_study', [
			this.chartSessionId,
			studyId,
			'st1',
			'sds_1',
			studyName,
			config
		]));
		
		await this.sleep(500);
	}
	
	/**
	 * Wait for data to arrive
	 * 
	 * Default implementation waits 5 seconds.
	 * Override to customize wait time or implement smarter waiting logic.
	 * 
	 * @param ms Milliseconds to wait (default: 5000)
	 */
	protected async waitForData(ms: number = 5000): Promise<void> {
		await this.sleep(ms);
	}
	
	// ========================================================================
	// MESSAGE HANDLERS (Can be Overridden)
	// ========================================================================
	
	/**
	 * Handle handshake message
	 * 
	 * Default implementation extracts session ID (already done by handleMessage).
	 * Override to add custom handshake handling.
	 * 
	 * @param _msg Handshake message
	 */
	protected handleHandshake(_msg: unknown): void {
		// Default: no-op (session ID already extracted)
	}
	
	/**
	 * Handle symbol_resolved message
	 * 
	 * Default implementation extracts and stores symbol metadata.
	 * Override to add custom symbol resolution handling.
	 * 
	 * @param msg Symbol resolved message
	 */
	protected handleSymbolResolved(msg: TVMessage): void {
		const [, , metadata] = msg.p as [string, string, SymbolMetadata];
		this.symbolMetadata = metadata;
	}
	
	/**
	 * Handle study_loading message
	 * 
	 * Default implementation is no-op (confirmation that study is loading).
	 * Override to add custom study loading handling.
	 * 
	 * @param _msg Study loading message
	 */
	protected handleStudyLoading(_msg: TVMessage): void {
		// Default: no-op (study creation confirmed)
	}
	
	/**
	 * Handle data update message (du or timescale_update)
	 * 
	 * Default implementation extracts OHLCV bars and study values.
	 * Override to add custom data handling or validation.
	 * 
	 * @param msg Data update message
	 */
	protected handleDataUpdate(msg: TVMessage): void {
		const [sessionKey, dataObj] = msg.p as [string, Record<string, unknown>];
		
		// Iterate through all data series in the data object
		for (const [dataKey, dataValue] of Object.entries(dataObj)) {
			// Check for both 's' array (timescale_update) and 'st' array (du messages)
			const seriesData = dataValue as Record<string, unknown>;
			const series = seriesData.s || seriesData.st;
			
			if (!series || !Array.isArray(series)) continue;
			
			// Determine if this is OHLCV data or study data
			const isOHLCVData = this.isOHLCVSeries(dataKey, series);
			
			if (isOHLCVData) {
				// Extract OHLCV bars
				for (const bar of series) {
					if (!bar.v || bar.v.length < 6) continue;
					
					const [time, open, high, low, close, volume] = bar.v;
					
					// Validate bar data
					if (
						typeof time === 'number' &&
						typeof open === 'number' &&
						typeof high === 'number' &&
						typeof low === 'number' &&
						typeof close === 'number' &&
						typeof volume === 'number'
					) {
						this.bars.push({ time, open, high, low, close, volume });
					}
				}
			} else {
				// Extract study data
				this.extractStudyData(dataKey, series);
			}
		}
	}
	
	/**
	 * Check if series contains OHLCV data
	 * 
	 * @param dataKey Data key from message
	 * @param series Series array
	 * @returns True if this is OHLCV data
	 */
	private isOHLCVSeries(dataKey: string, series: unknown[]): boolean {
		// OHLCV data typically has 6 values per bar
		const firstBar = series[0] as { v?: number[] } | undefined;
		if (!firstBar?.v || firstBar.v.length !== 6) {
			return false;
		}
		
		// Additional heuristic: study data keys often contain study IDs
		// OHLCV data keys are usually simple (e.g., "sds_1", "s1")
		return dataKey === 'sds_1' || dataKey === 's1' || !dataKey.includes('_');
	}
	
	/**
	 * Extract study/indicator data from series
	 * 
	 * @param dataKey Data key (may contain study ID)
	 * @param series Series array
	 */
	private extractStudyData(dataKey: string, series: unknown[]): void {
		// Try to find matching study
		for (const [studyId, studyData] of this.studies.entries()) {
			// Check if data key matches this study
			if (dataKey.includes(studyId) || dataKey === studyId) {
				// Extract values
				for (const bar of series) {
					const barData = bar as { i?: number; v?: number[] };
					
					if (!barData.v || barData.v.length === 0) continue;
					
					// First value is timestamp, rest are indicator values
					const [time, ...values] = barData.v;
					
					if (typeof time === 'number' && values.every(v => typeof v === 'number')) {
						const studyBar: StudyBar = {
							time,
							values: values as number[]
						};
						
						studyData.values.push(studyBar);
					}
				}
				
				break;
			}
		}
	}
	
	/**
	 * Handle protocol_error message
	 * 
	 * Default implementation rejects connection promise if active.
	 * Override to add custom error handling.
	 * 
	 * @param msg Protocol error message
	 */
	protected handleProtocolError(msg: TVMessage): void {
		const [error] = msg.p as [string];
		const errorObj = new Error(`Protocol error: ${error}`);
		
		if (this.rejectConnection) {
			this.rejectConnection(errorObj);
			this.rejectConnection = null;
		}
		
		this.onProtocolError?.(errorObj);
	}
	
	/**
	 * Handle other message types
	 * 
	 * Default implementation is no-op.
	 * Override to handle additional message types.
	 * 
	 * @param _msg Other message
	 */
	protected handleOtherMessage(_msg: TVMessage): void {
		// Default: no-op
	}
	
	// ========================================================================
	// LIFECYCLE HOOKS (Optional - Override as Needed)
	// ========================================================================
	
	/**
	 * Called before WebSocket connection
	 * Override to add pre-connection logic (e.g., logging URL)
	 * 
	 * @param url WebSocket URL
	 */
	protected onBeforeConnect?(url: string): void;
	
	/**
	 * Called after successful WebSocket connection
	 * Override to add post-connection logic (e.g., logging success)
	 */
	protected onConnected?(): void;
	
	/**
	 * Called after authentication messages sent
	 * Override to add post-authentication logic (e.g., logging)
	 */
	protected onAuthenticated?(): void;
	
	/**
	 * Called after each message is sent
	 * Override to add message logging or tracking
	 * 
	 * @param message Message that was sent
	 */
	protected onMessageSent?(message: TVMessage): void;
	
	/**
	 * Called after each message is received
	 * Override to add message logging or tracking
	 * 
	 * @param message Message that was received
	 */
	protected onMessageReceived?(message: TVMessage): void;
	
	/**
	 * Called when protocol error is encountered
	 * Override to add error logging or recovery logic
	 * 
	 * @param error Protocol error
	 */
	protected onProtocolError?(error: Error): void;
	
	/**
	 * Called before WebSocket disconnection
	 * Override to add pre-disconnection logic (e.g., cleanup)
	 */
	protected onBeforeDisconnect?(): void;
	
	/**
	 * Called after WebSocket disconnection
	 * Override to add post-disconnection logic (e.g., logging)
	 */
	protected onDisconnected?(): void;
}
