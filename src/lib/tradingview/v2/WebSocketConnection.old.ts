/**
 * WebSocketConnection - Main Connection Class
 * 
 * Orchestrates all components to provide a complete WebSocket connection
 * to TradingView's API with support for:
 * 
 * KEY FEATURES:
 * - Eager initialization (starts in constructor)
 * - Symbol switching with automatic request cancellation
 * - CVD data support with configurable timeouts
 * - Heartbeat keep-alive mechanism
 * - Event-driven completion detection
 * - Comprehensive error handling
 * 
 * USAGE:
 * ```typescript
 * const connection = new WebSocketConnection({
 *   jwtToken: 'your_jwt_token',
 *   connectionTimeout: 30000,
 *   dataTimeout: 15000
 * });
 * 
 * // Initialize (starts in background)
 * await connection.initialize();
 * 
 * // Fetch symbol data
 * const data = await connection.fetchSymbol({
 *   symbol: 'NSE:RELIANCE',
 *   resolution: '1D',
 *   barsCount: 300,
 *   indicators: [{ type: 'cvd', config: { anchorPeriod: '3M' } }]
 * });
 * 
 * // Switch symbols (auto-cancels previous)
 * const tcsData = await connection.fetchSymbol({
 *   symbol: 'NSE:TCS',
 *   resolution: '1D',
 *   barsCount: 300
 * });
 * 
 * // Cleanup
 * await connection.dispose();
 * ```
 */

import type { IWebSocketAdapter, WebSocketFactory } from './core/IWebSocketAdapter';
import { ProtocolHandler } from './core/ProtocolHandler';
import { StateMachine } from './core/StateMachine';
import { TypedEventEmitter } from './core/EventEmitter';
import type {
	ConnectionConfig,
	SymbolRequest,
	SymbolData,
	SessionIds,
	TVMessage,
	OHLCVBar,
	SymbolMetadata,
	IndicatorData,
	IndicatorBar,
	ConnectionStats
} from './core/types';
import { ConnectionState } from './core/types';
import { RequestTracker } from './components/RequestTracker';
import { HeartbeatManager } from './components/HeartbeatManager';
import {
	ConnectionTimeoutError,
	ProtocolError,
	SymbolError,
	InvalidStateError,
	ConnectionClosedError,
	NetworkError
} from './errors/ConnectionError';
import { NodeWebSocketAdapter } from './adapters/NodeWebSocketAdapter';
import type { CVDConfigProvider } from './providers/index.js';

/**
 * Main WebSocket connection class
 * 
 * Orchestrates all components to provide a complete connection to TradingView
 */
export class WebSocketConnection {
	// Core components
	private ws: IWebSocketAdapter | null = null;
	private protocol: ProtocolHandler;
	private stateMachine: StateMachine;
	private events: TypedEventEmitter;
	private requestTracker: RequestTracker;
	private heartbeat: HeartbeatManager;
	
	// Configuration
	private config: Required<ConnectionConfig>;
	private wsFactory: WebSocketFactory;
	private cvdProvider?: CVDConfigProvider;
	
	// Session management
	private sessions: SessionIds = {
		websocketSessionId: '',
		chartSessionId: '',
		quoteSessionId: '',
		symbolSessionCounter: 0,
		seriesCounter: 0,
		turnaroundCounter: 0
	};
	
	// Symbol tracking (for cancellation)
	private currentSymbol: string | null = null;
	
	// Series tracking (for cleanup)
	private activeSeries: Set<string> = new Set();
	
	// Series ID mapping (for request correlation)
	private seriesIdMap: Map<string, string> = new Map(); // seriesId → requestId
	
	// Statistics
	private stats = {
		requestCount: 0,
		successCount: 0,
		errorCount: 0,
		responseTimes: [] as number[],
		lastRequestAt: 0,
		connectionStartTime: 0
	};
	
	// Initialization promise (eager initialization)
	private initPromise: Promise<void> | null = null;
	private isInitialized = false;
	private isDisposed = false;
	
	// Data collection state
	private pendingSymbolData: {
		bars: OHLCVBar[];
		metadata: Partial<SymbolMetadata>;
		indicators: Map<string, IndicatorData>;
		symbolSessionId: string;
		seriesId: string;
		studyIds: Map<string, string>;
	} | null = null;

	/**
	 * Create a new WebSocket connection
	 * 
	 * @param config Connection configuration
	 * @param wsFactory WebSocket factory (for testing - optional)
	 * @param cvdProvider CVD config provider (for CVD indicators - optional)
	 * 
	 * NOTE: Constructor starts initialization in background!
	 * Use await connection.initialize() to wait for completion.
	 */
	constructor(
		config: ConnectionConfig,
		wsFactory?: WebSocketFactory,
		cvdProvider?: CVDConfigProvider
	) {
		// Validate required config
		if (!config.jwtToken) {
			throw new Error('jwtToken is required in ConnectionConfig');
		}

		// Set defaults
		this.config = {
			jwtToken: config.jwtToken,
			websocketUrl: config.websocketUrl || 'wss://prodata.tradingview.com/socket.io/websocket',
			chartId: config.chartId || 'S09yY40x',
			connectionTimeout: config.connectionTimeout || 30000,
			dataTimeout: config.dataTimeout || 15000,
			enableLogging: config.enableLogging || false,
			maxRequestsPerConnection: config.maxRequestsPerConnection || 20
		};

		// Use provided factory or default to production
		this.wsFactory = wsFactory || (() => new NodeWebSocketAdapter());
		
		// Store CVD provider if provided
		this.cvdProvider = cvdProvider;

		// Initialize components
		this.protocol = new ProtocolHandler();
		this.stateMachine = new StateMachine();
		this.events = new TypedEventEmitter();
		this.requestTracker = new RequestTracker();
		this.heartbeat = new HeartbeatManager({
			staleTimeout: 30000,
			enableLogging: this.config.enableLogging
		});

		// Generate session IDs
		this.sessions.chartSessionId = this.protocol.generateSessionId('cs_');
		this.sessions.quoteSessionId = this.protocol.generateSessionId('qs_');

		// Link state machine to event emitter
		this.stateMachine.onTransition('*', (from, to) => {
			this.events.emit('state', to, from);
		});

		// Start eager initialization in background (non-blocking!)
		this.initPromise = this.initialize().catch(error => {
			if (this.config.enableLogging) {
				console.error('[WebSocketConnection] Background initialization failed:', error);
			}
			this.events.emit('error', error);
			throw error;
		});
	}

	// ========================================================================
	// PUBLIC API
	// ========================================================================

	/**
	 * Initialize connection (connect → authenticate → create sessions)
	 * 
	 * This is called automatically in constructor but can be awaited
	 * to ensure connection is ready before making requests.
	 * 
	 * @returns Promise that resolves when connection is READY
	 * @throws ConnectionError if initialization fails
	 */
	async initialize(): Promise<void> {
		// Return existing promise if already initializing or initialized
		if (this.initPromise) {
			return this.initPromise;
		}

		if (this.isDisposed) {
			throw new Error('Cannot initialize disposed connection');
		}

		try {
			this.stats.connectionStartTime = Date.now();

			// Step 1: Connect to WebSocket
			await this.connectWebSocket();

			// Step 2: Authenticate
			await this.sendAuthentication();

			// Step 3: Create sessions
			await this.createSessions();

			// Mark as initialized
			this.isInitialized = true;
			this.stateMachine.transition(ConnectionState.READY);
			this.events.emit('initialized');

			if (this.config.enableLogging) {
				console.log('[WebSocketConnection] ✅ Initialized successfully');
			}
		} catch (error) {
			this.stateMachine.forceTransition(ConnectionState.ERROR);
			throw error;
		}
	}

	/**
	 * Fetch symbol data (OHLCV bars + optional indicators)
	 * 
	 * KEY FEATURE: Automatically cancels previous symbol's requests if switching
	 * 
	 * @param request Symbol fetch request
	 * @returns Symbol data with timing breakdown
	 * @throws SymbolError if symbol not found
	 * @throws DataTimeoutError if data fetch times out
	 * @throws CVDTimeoutError if CVD indicator times out
	 * 
	 * @example
	 * ```typescript
	 * // Fetch RELIANCE
	 * const data1 = await connection.fetchSymbol({
	 *   symbol: 'NSE:RELIANCE',
	 *   resolution: '1D',
	 *   barsCount: 300,
	 *   indicators: [{ type: 'cvd', config: { anchorPeriod: '3M' } }]
	 * });
	 * 
	 * // Switch to TCS (auto-cancels RELIANCE requests)
	 * const data2 = await connection.fetchSymbol({
	 *   symbol: 'NSE:TCS',
	 *   resolution: '1D',
	 *   barsCount: 300
	 * });
	 * ```
	 */
	async fetchSymbol(request: SymbolRequest): Promise<SymbolData> {
		// Ensure initialized
		await this.initPromise;

		// Validate state
		if (!this.stateMachine.isReady()) {
			throw new InvalidStateError(
				'fetch symbol',
				this.stateMachine.getState(),
				'READY'
			);
		}

		const startTime = Date.now();
		const symbolId = request.symbol;
		
		// CRITICAL: Cancel previous symbol's requests if switching
		if (this.currentSymbol && this.currentSymbol !== symbolId) {
			const cancelled = this.requestTracker.cancelSymbolRequests(this.currentSymbol);
			if (cancelled > 0) {
				this.events.emit('warning', `Symbol switched: cancelled ${cancelled} requests for ${this.currentSymbol}`);
				if (this.config.enableLogging) {
					console.log(`[WebSocketConnection] 🔄 Cancelled ${cancelled} requests for ${this.currentSymbol}`);
				}
			}
		}

		this.currentSymbol = symbolId;
		
		// Clean up ALL previous series before creating new ones (prevents "exceed limit of series")
		await this.cleanupAllSeries();

		// Initialize pending data - store local reference to avoid race conditions
		const localPendingData = {
			bars: [],
			metadata: {},
			indicators: new Map(),
			symbolSessionId: `sds_sym_${++this.sessions.symbolSessionCounter}`,
			seriesId: `sds_${++this.sessions.seriesCounter}`, // Use unique series ID per request
			studyIds: new Map()
		};
		
		// Set shared state (for message handlers to find)
		this.pendingSymbolData = localPendingData;

		const timing = {
			resolveSymbol: 0,
			fetchBars: 0,
			fetchIndicators: 0,
			total: 0
		};

		try {
			// Step 1: Resolve symbol
			const resolveStart = Date.now();
			await this.resolveSymbol(request, localPendingData);
			timing.resolveSymbol = Date.now() - resolveStart;

			// Step 2: Fetch OHLCV bars
			const barsStart = Date.now();
			await this.fetchBars(request, localPendingData);
			timing.fetchBars = Date.now() - barsStart;

			// Step 3: Fetch indicators (if requested)
			if (request.indicators && request.indicators.length > 0) {
				const indicatorsStart = Date.now();
				await this.fetchIndicators(request, localPendingData);
				timing.fetchIndicators = Date.now() - indicatorsStart;
			}

			// Collect results from local data (not shared state)
			timing.total = Date.now() - startTime;
			
			const result: SymbolData = {
				symbol: symbolId,
				bars: localPendingData.bars,
				metadata: localPendingData.metadata,
				indicators: localPendingData.indicators.size > 0 
					? localPendingData.indicators 
					: undefined,
				timing
			};

			// Update stats
			this.stats.requestCount++;
			this.stats.successCount++;
			this.stats.responseTimes.push(timing.total);
			this.stats.lastRequestAt = Date.now();
			
			// Keep only last 100 response times
			if (this.stats.responseTimes.length > 100) {
				this.stats.responseTimes.shift();
			}

			// Emit events
			this.events.emit('bars:received', symbolId, result.bars.length);
			this.events.emit('timing', 'fetchSymbol', timing.total);

			if (this.config.enableLogging) {
				console.log(`[WebSocketConnection] ✅ Fetched ${symbolId}: ${result.bars.length} bars in ${timing.total}ms`);
			}

			return result;

		} catch (error) {
			this.stats.errorCount++;
			this.events.emit('error', error as Error);
			throw error;
		} finally {
			// Clear pending data ONLY if it's still our data
			// (prevent race condition where new symbol request has already started)
			if (this.pendingSymbolData === localPendingData) {
				this.pendingSymbolData = null;
			}
		}
	}

	/**
	 * Dispose connection and clean up resources
	 * 
	 * - Cancels all pending requests
	 * - Stops heartbeat
	 * - Closes WebSocket
	 * - Clears all resources
	 */
	async dispose(): Promise<void> {
		if (this.isDisposed) return;

		this.isDisposed = true;

		if (this.config.enableLogging) {
			console.log('[WebSocketConnection] 🔌 Disposing connection...');
		}

		// Cancel all pending requests
		const cancelled = this.requestTracker.cancelAllRequests('Connection disposed');
		if (cancelled > 0 && this.config.enableLogging) {
			console.log(`[WebSocketConnection] Cancelled ${cancelled} pending requests`);
		}

		// Stop heartbeat
		this.heartbeat.stop();

		// Close WebSocket
		if (this.ws) {
			this.ws.close(1000, 'Normal closure');
			this.ws = null;
		}

		// Clear resources
		this.requestTracker.clear();
		this.events.removeAllListeners();

		// Update state
		this.stateMachine.forceTransition(ConnectionState.CLOSED);
		this.events.emit('disposed');

		if (this.config.enableLogging) {
			console.log('[WebSocketConnection] ✅ Disposed successfully');
		}
	}

	/**
	 * Get current connection state
	 */
	getState(): ConnectionState {
		return this.stateMachine.getState();
	}

	/**
	 * Check if connection is ready for data requests
	 */
	isReady(): boolean {
		return this.stateMachine.isReady() && !this.isDisposed;
	}

	/**
	 * Check if connection should be refreshed (stale)
	 */
	shouldRefresh(): boolean {
		return this.stats.requestCount >= this.config.maxRequestsPerConnection;
	}

	/**
	 * Get connection statistics
	 */
	getStats(): ConnectionStats {
		const avgResponseTime = this.stats.responseTimes.length > 0
			? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
			: 0;

		return {
			requestCount: this.stats.requestCount,
			successCount: this.stats.successCount,
			errorCount: this.stats.errorCount,
			avgResponseTime,
			lastRequestAt: this.stats.lastRequestAt,
			uptime: Date.now() - this.stats.connectionStartTime,
			state: this.stateMachine.getState()
		};
	}

	/**
	 * Register event listener
	 */
	on<K extends keyof import('./core/types').EventMap>(
		event: K,
		handler: import('./core/types').EventMap[K]
	): void {
		this.events.on(event, handler);
	}

	/**
	 * Unregister event listener
	 */
	off<K extends keyof import('./core/types').EventMap>(
		event: K,
		handler: import('./core/types').EventMap[K]
	): void {
		this.events.off(event, handler);
	}

	/**
	 * Register one-time event listener
	 */
	once<K extends keyof import('./core/types').EventMap>(
		event: K,
		handler: import('./core/types').EventMap[K]
	): void {
		this.events.once(event, handler);
	}

	/**
	 * Set default timeout for a request type
	 * 
	 * Useful for configuring longer CVD timeouts on slow connections
	 * 
	 * @param type Request type ('create_study' for CVD)
	 * @param timeout Timeout in milliseconds
	 * 
	 * @example
	 * ```typescript
	 * // Set 60s timeout for CVD on slow connection
	 * connection.setRequestTimeout('create_study', 60000);
	 * ```
	 */
	setRequestTimeout(
		type: 'resolve_symbol' | 'create_series' | 'modify_series' | 'create_study',
		timeout: number
	): void {
		this.requestTracker.setDefaultTimeout(type, timeout);
	}

	/**
	 * Get default timeout for a request type
	 * 
	 * @param type Request type
	 * @returns Timeout in milliseconds
	 */
	getRequestTimeout(
		type: 'resolve_symbol' | 'create_series' | 'modify_series' | 'create_study'
	): number {
		return this.requestTracker.getDefaultTimeout(type);
	}

	// ========================================================================
	// INITIALIZATION STEPS
	// ========================================================================

	/**
	 * Step 1: Connect to WebSocket server
	 */
	private async connectWebSocket(): Promise<void> {
		this.stateMachine.transition(ConnectionState.CONNECTING);

		// Build WebSocket URL
		const wsUrl = new URL(this.config.websocketUrl);
		wsUrl.searchParams.set('from', `chart/${this.config.chartId}/`);
		wsUrl.searchParams.set('date', new Date().toISOString());
		wsUrl.searchParams.set('type', 'chart');

		// Create WebSocket adapter
		this.ws = this.wsFactory();

		// Register event handlers
		this.ws.on('open', () => this.handleOpen());
		this.ws.on('message', (data) => this.handleMessage(data as string));
		this.ws.on('error', (error) => this.handleError(error));
		this.ws.on('close', (code, reason) => this.handleClose(code, reason));

		// Connect with timeout
		try {
			await Promise.race([
				this.ws.connect(wsUrl.toString(), {
					headers: {
						'Origin': 'https://www.tradingview.com',
						'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
					}
				}),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new ConnectionTimeoutError(this.config.connectionTimeout)),
						this.config.connectionTimeout
					)
				)
			]);

			this.stateMachine.transition(ConnectionState.CONNECTED);

			if (this.config.enableLogging) {
				console.log('[WebSocketConnection] 🔌 Connected to WebSocket');
			}
		} catch (error) {
			throw new NetworkError('Failed to connect', error as Error);
		}
	}

	/**
	 * Step 2: Send authentication messages
	 */
	private async sendAuthentication(): Promise<void> {
		this.stateMachine.transition(ConnectionState.AUTHENTICATING);

		// Send auth token
		this.sendMessage(
			this.protocol.createMessage('set_auth_token', [this.config.jwtToken])
		);

		// Send locale
		this.sendMessage(
			this.protocol.createMessage('set_locale', ['en', 'US'])
		);

		this.stateMachine.transition(ConnectionState.AUTHENTICATED);

		if (this.config.enableLogging) {
			console.log('[WebSocketConnection] 🔑 Authenticated');
		}
	}

	/**
	 * Step 3: Create chart and quote sessions
	 */
	private async createSessions(): Promise<void> {
		// Create chart session
		this.sendMessage(
			this.protocol.createMessage('chart_create_session', [
				this.sessions.chartSessionId,
				''
			])
		);

		// Create quote session
		this.sendMessage(
			this.protocol.createMessage('quote_create_session', [
				this.sessions.quoteSessionId
			])
		);

		if (this.config.enableLogging) {
			console.log('[WebSocketConnection] 📊 Sessions created');
		}
	}

	// ========================================================================
	// DATA FETCHING STEPS
	// ========================================================================

	/**
	 * Step 1: Resolve symbol and get metadata
	 */
	private async resolveSymbol(
		request: SymbolRequest,
		pendingData: typeof this.pendingSymbolData
	): Promise<void> {
		if (!pendingData) {
			throw new Error('Pending symbol data not initialized');
		}

		const symbolSpec = this.protocol.createSymbolSpec(
			request.symbol,
			request.adjustment || 'dividends',
			request.session
		);

		// Store the symbolSessionId to verify response later
		const expectedSymbolSessionId = pendingData.symbolSessionId;

		const { requestId, promise } = this.requestTracker.createRequest({
			type: 'resolve_symbol',
			params: [
				this.sessions.chartSessionId,
				expectedSymbolSessionId,
				symbolSpec
			],
			timeout: 5000,
			symbolId: request.symbol
		});

		// Send resolve_symbol message
		this.sendMessage(
			this.protocol.createMessage('resolve_symbol', [
				this.sessions.chartSessionId,
				expectedSymbolSessionId,
				symbolSpec
			])
		);

		// Wait for response
		const metadata = await promise as Partial<SymbolMetadata>;
		
		// Store in local pendingData (not shared state)
		pendingData.metadata = metadata;
		this.events.emit('symbol:resolved', request.symbol, metadata);
	}

	/**
	 * Step 2: Fetch OHLCV bars
	 */
	private async fetchBars(
		request: SymbolRequest,
		pendingData: typeof this.pendingSymbolData
	): Promise<void> {
		if (!pendingData) {
			throw new Error('Pending symbol data not initialized');
		}

		const turnaround = `sds_${++this.sessions.turnaroundCounter}`;
		
		// Use local pendingData parameter
		const expectedSymbolSessionId = pendingData.symbolSessionId;

		const { requestId, promise } = this.requestTracker.createRequest({
			type: 'create_series',
			params: [
				this.sessions.chartSessionId,
				pendingData.seriesId,
				turnaround,
				expectedSymbolSessionId,
				request.resolution,
				request.barsCount
			],
			timeout: this.config.dataTimeout,
			symbolId: request.symbol,
			turnaroundId: turnaround // CRITICAL: Store turnaround ID for response matching
		});

		// Send create_series message
		this.sendMessage(
			this.protocol.createMessage('create_series', [
				this.sessions.chartSessionId,
				pendingData.seriesId,
				turnaround,
				expectedSymbolSessionId,
				request.resolution,
				request.barsCount
			])
		);
		
		// Track series ID for cleanup and correlation
		this.activeSeries.add(pendingData.seriesId);
		this.seriesIdMap.set(pendingData.seriesId, requestId);

		// Wait for bars
		await promise;
		// Note: Bars are collected in message handler via this.pendingSymbolData
		// which might have changed if symbol switched, but that's OK - 
		// the request is tracked by RequestTracker and will be properly resolved/cancelled
	}

	/**
	 * Step 3: Fetch indicators (CVD, RSI, etc.)
	 */
	private async fetchIndicators(
		request: SymbolRequest,
		pendingData: typeof this.pendingSymbolData
	): Promise<void> {
		if (!pendingData || !request.indicators) {
			return;
		}

		const indicatorPromises: Promise<void>[] = [];

		for (const indicator of request.indicators) {
			const studyId = `${indicator.type}_${Date.now()}`;
			const turnaround = `sds_${++this.sessions.turnaroundCounter}`;

			// Determine timeout based on indicator type
			const isCVD = indicator.type === 'cvd';
			
			// Check if CVD is requested but provider not available
			if (isCVD && !this.cvdProvider) {
				if (this.config.enableLogging) {
					console.warn('[WebSocketConnection] CVD indicator requested but no CVDConfigProvider provided - skipping');
				}
				continue;
			}
			
			// ✅ FIX: Use configured CVD timeout instead of hardcoded 30000
			const timeout = isCVD 
				? this.requestTracker.getDefaultTimeout('create_study')
				: this.config.dataTimeout;

			// Get CVD config if needed
			let cvdConfig;
			if (isCVD && this.cvdProvider) {
				const anchorPeriod = (indicator.config as any)?.anchorPeriod || '3M';
				cvdConfig = await this.cvdProvider.getCVDConfig(anchorPeriod);
				if (this.config.enableLogging) {
					console.log(`[WebSocketConnection] Got CVD config for anchor period: ${anchorPeriod}`);
				}
			}

			const { requestId, promise } = this.requestTracker.createRequest({
				type: 'create_study',
				params: [
					this.sessions.chartSessionId,
					studyId,
					turnaround,
					pendingData.seriesId,
					indicator.type,
					indicator.config
				],
				timeout,
				isCVD,
				symbolId: request.symbol
			});

			// Build create_study message parameters
			const studyParams: any[] = [
				this.sessions.chartSessionId,
				studyId,
				turnaround,
				pendingData.seriesId,
				indicator.type,
				request.barsCount,
				indicator.config
			];
			
			// Add CVD-specific params if available
			if (cvdConfig) {
				studyParams.push(cvdConfig.text);
				studyParams.push(cvdConfig.pineId);
				studyParams.push(cvdConfig.pineVersion);
			}

			// Send create_study message
			this.sendMessage(
				this.protocol.createMessage('create_study', studyParams)
			);

			pendingData.studyIds.set(indicator.type, studyId);
			indicatorPromises.push(promise as Promise<void>);
		}

		// Wait for all indicators
		await Promise.all(indicatorPromises);
	}
	
	/**
	 * Clean up all active series to prevent "exceed limit of series" errors
	 */
	private async cleanupAllSeries(): Promise<void> {
		if (this.activeSeries.size === 0) {
			return;
		}
		
		if (this.config.enableLogging) {
			console.log(`[WebSocketConnection] 🧹 Cleaning up ${this.activeSeries.size} series...`);
		}
		
		for (const seriesId of this.activeSeries) {
			await this.cleanupSeries(seriesId);
		}
		
		this.activeSeries.clear();
		this.seriesIdMap.clear();
	}
	
	/**
	 * Clean up a single series
	 */
	private async cleanupSeries(seriesId: string): Promise<void> {
		try {
			const message = this.protocol.createMessage('remove_series', [
				this.sessions.chartSessionId,
				seriesId
			]);
			
			if (this.ws) {
				this.ws.send(this.protocol.encodeMessage(message));
			}
			
			if (this.config.enableLogging) {
				console.log(`[WebSocketConnection] 🗑️  Removed series: ${seriesId}`);
			}
		} catch (error) {
			// Non-fatal - just log and continue
			if (this.config.enableLogging) {
				console.log(`[WebSocketConnection] ⚠️  Failed to cleanup series ${seriesId}:`, error);
			}
		}
	}

	// ========================================================================
	// MESSAGE HANDLING
	// ========================================================================

	/**
	 * Handle incoming WebSocket message
	 */
	private handleMessage(data: string): void {
		const { messages, heartbeats } = this.protocol.parseFrame(data);

		// Handle heartbeats FIRST (critical priority!)
		for (const heartbeat of heartbeats) {
			const echo = this.heartbeat.handleHeartbeat(heartbeat);
			if (this.ws) {
				this.ws.send(echo);
				this.heartbeat.recordSent();
				this.events.emit('heartbeat:sent', Date.now());
			}
		}

		// Process protocol messages
		for (const message of messages) {
			this.events.emit('message:received', message, data);

			// Dispatch to specific handlers
			switch (message.m) {
				case 'protocol_error':
					this.handleProtocolError(message);
					break;

				case 'critical_error':
					this.handleProtocolError(message); // Treat critical_error same as protocol_error
					break;

				case 'symbol_resolved':
					this.handleSymbolResolved(message);
					break;

				case 'symbol_error':
					this.handleSymbolError(message);
					break;

				case 'timescale_update':
				case 'du':
					this.handleDataUpdate(message);
					break;

				default:
					// Ignore unknown messages
					if (this.config.enableLogging) {
						console.log(`[WebSocketConnection] Unknown message: ${message.m}`);
					}
			}
		}
	}

	/**
	 * Handle WebSocket open event
	 */
	private handleOpen(): void {
		// Start heartbeat monitoring
		this.heartbeat.start(() => {
			this.events.emit('warning', 'Connection stale - no heartbeat received');
		});

		this.events.emit('heartbeat:received', Date.now());
	}

	/**
	 * Handle WebSocket error
	 */
	private handleError(error: Error): void {
		this.events.emit('error', new NetworkError('WebSocket error', error));
	}

	/**
	 * Handle WebSocket close
	 */
	private handleClose(code: number, reason: string): void {
		this.heartbeat.stop();
		
		const closeError = new ConnectionClosedError(code, reason);
		this.events.emit('error', closeError);

		if (!this.isDisposed) {
			this.stateMachine.forceTransition(ConnectionState.CLOSED);
		}
	}

	/**
	 * Handle protocol error message
	 */
	private handleProtocolError(message: TVMessage): void {
		const turnaroundId = message.p[0] as string;
		const errorMessage = (message.p[1] || message.p[0]) as string;
		
		// Classify error severity
		const isRecoverable = this.isRecoverableError(errorMessage);
		
		if (isRecoverable) {
			// Request-level error - fail only this request
			if (this.config.enableLogging) {
				console.log(`[WebSocketConnection] ⚠️  Recoverable Error: ${errorMessage}`);
			}
			
			// Find and cancel only the specific request
			const request = this.requestTracker.getRequestByTurnaround(turnaroundId);
			if (request) {
				this.requestTracker.cancelRequest(request.id, `Protocol error: ${errorMessage}`);
			}
			
			// Emit warning, NOT error (keeps connection alive)
			this.events.emit('warning', errorMessage);
			
			// Connection stays READY - no state transition
		} else {
			// Connection-level error - fatal
			if (this.config.enableLogging) {
				console.log(`[WebSocketConnection] ❌ Fatal Error: ${errorMessage}`);
				console.log(`[WebSocketConnection] Full message:`, JSON.stringify(message));
			}
			
			const error = new ProtocolError(errorMessage);
			this.stateMachine.forceTransition(ConnectionState.ERROR);
			this.events.emit('error', error);
			this.requestTracker.cancelAllRequests('Fatal protocol error');
		}
	}
	
	/**
	 * Determine if an error is recoverable (request-level) vs fatal (connection-level)
	 */
	private isRecoverableError(errorMessage: string): boolean {
		const recoverablePatterns = [
			'exceed limit of series',
			'symbol not found',
			'invalid resolution',
			'invalid timeframe',
			'invalid period',
			'symbol error',
			'study error',
			'series error'
		];
		
		return recoverablePatterns.some(pattern => 
			errorMessage.toLowerCase().includes(pattern)
		);
	}

	/**
	 * Handle symbol_resolved message
	 */
	private handleSymbolResolved(message: TVMessage): void {
		const [chartSession, symbolSession, metadata] = message.p as [string, string, SymbolMetadata];
		
		// Find and resolve the resolve_symbol request
		const requests = this.requestTracker.getAllRequests();
		for (const request of requests) {
			if (request.type === 'resolve_symbol' && 
				request.params[1] === symbolSession) {
				this.requestTracker.resolveRequest(request.id, metadata);
				break;
			}
		}
		
		// Only update metadata if this is for the CURRENT symbol request
		// This prevents stale responses from overwriting current data
		if (this.pendingSymbolData && 
			this.pendingSymbolData.symbolSessionId === symbolSession) {
			this.pendingSymbolData.metadata = metadata;
		}
	}

	/**
	 * Handle symbol_error message
	 */
	private handleSymbolError(message: TVMessage): void {
		const [chartSession, symbol, reason] = message.p as [string, string, string];
		
		const error = new SymbolError(symbol, reason);
		this.events.emit('symbol:error', symbol, reason);

		// Find and reject the resolve_symbol request
		const requests = this.requestTracker.getAllRequests();
		for (const request of requests) {
			if (request.type === 'resolve_symbol') {
				this.requestTracker.rejectRequest(request.id, error);
				break;
			}
		}
	}

	/**
	 * Handle timescale_update or du (data update) message
	 */
	private handleDataUpdate(message: TVMessage): void {
		// Extract series data
		const [chartSession, data] = message.p as [string, Record<string, any>];
		
		// RACE CONDITION DEBUG: Log all data update messages
		if (this.config.enableLogging) {
			console.log('[WebSocketConnection] 📥 Data update received:', {
				messageType: message.m,
				seriesKeys: Object.keys(data),
				dataPreview: JSON.stringify(data).substring(0, 200)
			});
		}
		
		// Check if we have pending data and look for its series ID in the response
		// Series ID is dynamic (sds_1, sds_2, etc.) to support symbol switching
		if (this.pendingSymbolData) {
			const seriesKey = this.pendingSymbolData.seriesId;
			
			if (data[seriesKey]) {
				const seriesData = data[seriesKey];
				
				// Parse OHLCV bars
				if (seriesData.s) {
					for (const bar of seriesData.s) {
						const ohlcvBar: OHLCVBar = {
							time: bar.v[0],
							open: bar.v[1],
							high: bar.v[2],
							low: bar.v[3],
							close: bar.v[4],
							volume: bar.v[5]
						};
						this.pendingSymbolData.bars.push(ohlcvBar);
					}
				}

				// ENHANCED: Multi-tier request correlation strategy
				// Priority 1: Series ID mapping (most precise for concurrent requests)
				if (this.seriesIdMap.has(seriesKey)) {
					const requestId = this.seriesIdMap.get(seriesKey)!;
					const request = this.requestTracker.getRequest(requestId);
					
					if (request) {
						this.requestTracker.resolveRequest(request.id, true);
						
						if (this.config.enableLogging) {
							console.log(`[WebSocketConnection] ✅ Resolved create_series via seriesId: ${seriesKey}`);
						}
					} else {
						if (this.config.enableLogging) {
							console.log(`[WebSocketConnection] ⚠️  Series ID ${seriesKey} mapped but request not found (may be cancelled)`);
						}
					}
				} else {
					// Priority 2: Turnaround ID (good for single requests)
					const turnaround = seriesData.ns?.d || seriesData.lbs?.d;
					
					if (turnaround) {
						const matchingRequest = this.requestTracker.getRequestByTurnaround(turnaround);
						
						if (matchingRequest) {
							this.requestTracker.resolveRequest(matchingRequest.id, true);
							
							if (this.config.enableLogging) {
								console.log(`[WebSocketConnection] ✅ Resolved create_series via turnaround: ${turnaround}`);
							}
						} else {
							if (this.config.enableLogging) {
								console.log(`[WebSocketConnection] ⚠️  Turnaround ${turnaround} not found (may be cancelled)`);
							}
						}
					} else {
						// Priority 3: Fallback to oldest pending request (last resort)
						const requests = this.requestTracker.getAllRequests();
						for (const request of requests) {
							if (request.type === 'create_series') {
								this.requestTracker.resolveRequest(request.id, true);
								
								if (this.config.enableLogging) {
									console.log(`[WebSocketConnection] ⚠️  No correlation ID, resolved oldest create_series`);
								}
								break;
							}
						}
					}
				}
			}
		}

		// Check for study data (only if we have pending data)
		if (this.pendingSymbolData) {
			for (const [studyType, studyId] of this.pendingSymbolData.studyIds.entries()) {
				if (data[studyId]) {
					const studyData = data[studyId];
					
					const indicatorBars: IndicatorBar[] = [];
					if (studyData.st) {
						for (const bar of studyData.st) {
							indicatorBars.push({
								time: bar.v[0],
								values: bar.v.slice(1)
							});
						}
					}

					this.pendingSymbolData.indicators.set(studyType, {
						indicatorId: studyId,
						type: studyType,
						config: {},
						bars: indicatorBars
					});

					this.events.emit('indicator:received', studyType, studyId, indicatorBars.length);

					// Resolve create_study request
					const requests = this.requestTracker.getAllRequests();
					for (const request of requests) {
						if (request.type === 'create_study' && 
							request.params[1] === studyId) {
							this.requestTracker.resolveRequest(request.id, true);
							break;
						}
					}
				}
			}
		}
	}

	/**
	 * Send message through WebSocket
	 */
	private sendMessage(message: TVMessage): void {
		if (!this.ws) {
			throw new Error('WebSocket not connected');
		}

		const encoded = this.protocol.encodeMessage(message);
		this.ws.send(encoded);

		this.events.emit('message:sent', message, encoded);
	}
}
