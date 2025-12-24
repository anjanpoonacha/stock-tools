/**
 * WebSocketConnection - Main Connection Class (Refactored with Service Architecture)
 * 
 * Orchestrates services to provide a complete WebSocket connection to TradingView's API.
 * Refactored from 1186 lines to ~400-500 lines by extracting functionality into services.
 * 
 * KEY FEATURES:
 * - Eager initialization (starts in constructor)
 * - Symbol switching with automatic request cancellation
 * - CVD data support via CVDConfigProvider
 * - Heartbeat keep-alive mechanism
 * - Event-driven completion detection
 * - Comprehensive error handling
 * 
 * SERVICE ARCHITECTURE:
 * - InitializationService: Connection setup (connect → authenticate → create sessions)
 * - DataFetchService: Symbol/bar/indicator fetching
 * - MessageHandlerService: Incoming message processing
 * - SeriesManagementService: Series lifecycle management
 * 
 * USAGE:
 * ```typescript
 * const connection = new WebSocketConnection({
 *   jwtToken: 'your_jwt_token',
 *   connectionTimeout: 30000,
 *   dataTimeout: 15000
 * }, cvdProvider);
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
	ConnectionStats
} from './core/types';
import { ConnectionState } from './core/types';
import { RequestTracker } from './components/RequestTracker';
import { HeartbeatManager } from './components/HeartbeatManager';
import { InvalidStateError } from './errors/ConnectionError';
import { NodeWebSocketAdapter } from './adapters/NodeWebSocketAdapter';
import type { CVDConfigProvider } from './providers/CVDConfigProvider';
import type { ServiceContext } from './services/ServiceContext';
import { InitializationService } from './services/InitializationService';
import { DataFetchService } from './services/DataFetchService';
import { MessageHandlerService, type PendingSymbolData } from './services/MessageHandlerService';
import { SeriesManagementService } from './services/SeriesManagementService';

/**
 * Main WebSocket connection class
 * 
 * Now acts as a lightweight coordinator that delegates to services
 */
export class WebSocketConnection {
	// Core components
	private ws: IWebSocketAdapter | null = null;
	private protocol: ProtocolHandler;
	private stateMachine: StateMachine;
	private events: TypedEventEmitter;
	private requestTracker: RequestTracker;
	private heartbeat: HeartbeatManager;
	
	// Services (NEW!)
	private initService: InitializationService;
	private dataService: DataFetchService;
	private messageService: MessageHandlerService;
	private seriesService: SeriesManagementService;
	
	// Configuration
	private config: Required<ConnectionConfig>;
	private wsFactory: WebSocketFactory;
	
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
	
	// Data collection state
	private pendingSymbolData: PendingSymbolData | null = null;
	
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
	private isDisposed = false;
	
	/**
	 * Create a new WebSocket connection
	 * 
	 * @param config Connection configuration
	 * @param cvdProvider CVD config provider (optional - for CVD indicators)
	 * @param wsFactory WebSocket factory (for testing - optional)
	 * 
	 * NOTE: Constructor starts initialization in background!
	 * Use await connection.initialize() to wait for completion.
	 */
	constructor(
		config: ConnectionConfig,
		cvdProvider?: CVDConfigProvider,
		wsFactory?: WebSocketFactory
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

		// Create ServiceContext
		const context: ServiceContext = {
			protocol: this.protocol,
			requestTracker: this.requestTracker,
			heartbeat: this.heartbeat,
			stateMachine: this.stateMachine,
			ws: this.ws,
			events: this.events as any, // TypedEventEmitter is compatible with EventEmitter
			sessions: this.sessions,
			config: this.config
		};

		// Initialize services
		this.initService = new InitializationService(context);
		this.dataService = new DataFetchService(context, cvdProvider);
		this.messageService = new MessageHandlerService(
			context,
			() => this.pendingSymbolData,
			() => this.seriesService.getSeriesIdMap()
		);
		this.seriesService = new SeriesManagementService(context);

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
	 * Delegates to InitializationService.
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

			// Create WebSocket adapter
			this.ws = this.wsFactory();

			// Register event handlers
			this.ws.on('open', () => this.handleOpen());
			this.ws.on('message', (data) => this.messageService.handleMessage(data as string));
			this.ws.on('error', (error) => this.handleError(error));
			this.ws.on('close', (code, reason) => this.handleClose(code, reason));

			// Update context with ws instance
			(this.initService as any).context.ws = this.ws;
			(this.dataService as any).ctx.ws = this.ws;
			(this.messageService as any).ctx.ws = this.ws;
			(this.seriesService as any).context.ws = this.ws;

			// Delegate to InitializationService
			await this.initService.connectWebSocket();
			await this.initService.sendAuthentication();
			await this.initService.createSessions();

			// Mark as ready
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
	 * Delegates data fetching to DataFetchService and series cleanup to SeriesManagementService.
	 * 
	 * @param request Symbol fetch request
	 * @returns Symbol data with timing breakdown
	 * @throws SymbolError if symbol not found
	 * @throws DataTimeoutError if data fetch times out
	 * @throws CVDTimeoutError if CVD indicator times out
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
		
		// Clean up ALL previous series before creating new ones (delegates to SeriesManagementService)
		await this.seriesService.cleanupAllSeries();

		// Initialize pending data - store local reference to avoid race conditions
		const localPendingData: PendingSymbolData = {
			bars: [],
			metadata: {},
			indicators: new Map(),
			symbolSessionId: `sds_sym_${++this.sessions.symbolSessionCounter}`,
			seriesId: `sds_${++this.sessions.seriesCounter}`,
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
			// Step 1: Resolve symbol (delegates to DataFetchService)
			const resolveStart = Date.now();
			await this.dataService.resolveSymbol(request, localPendingData);
			timing.resolveSymbol = Date.now() - resolveStart;

			// Step 2: Fetch OHLCV bars (delegates to DataFetchService)
			const barsStart = Date.now();
			await this.dataService.fetchBars(
				request, 
				localPendingData,
				(seriesId, requestId) => this.seriesService.registerSeries(seriesId, requestId)
			);
			timing.fetchBars = Date.now() - barsStart;

			// Step 3: Fetch indicators (if requested) (delegates to DataFetchService)
			if (request.indicators && request.indicators.length > 0) {
				const indicatorsStart = Date.now();
				await this.dataService.fetchIndicators(request, localPendingData);
				timing.fetchIndicators = Date.now() - indicatorsStart;
			}

			// Collect results from local data
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
		this.seriesService.clear();
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
	 */
	setRequestTimeout(
		type: 'resolve_symbol' | 'create_series' | 'modify_series' | 'create_study',
		timeout: number
	): void {
		this.requestTracker.setDefaultTimeout(type, timeout);
	}

	/**
	 * Get default timeout for a request type
	 */
	getRequestTimeout(
		type: 'resolve_symbol' | 'create_series' | 'modify_series' | 'create_study'
	): number {
		return this.requestTracker.getDefaultTimeout(type);
	}

	// ========================================================================
	// PRIVATE EVENT HANDLERS
	// ========================================================================

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
		this.events.emit('error', error);
	}

	/**
	 * Handle WebSocket close
	 */
	private handleClose(code: number, reason: string): void {
		this.heartbeat.stop();
		
		if (!this.isDisposed) {
			this.stateMachine.forceTransition(ConnectionState.CLOSED);
		}
		
		this.events.emit('error', new Error(`Connection closed: ${code} ${reason}`));
	}
}
