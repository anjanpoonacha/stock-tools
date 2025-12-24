/**
 * Mock WebSocket Adapter
 * 
 * Test adapter that simulates WebSocket behavior without actual network connection.
 * Enables unit testing of connection logic without running a real server.
 * 
 * Features:
 * - Simulate connection lifecycle (open, close, error)
 * - Simulate server messages
 * - Capture sent messages for assertions
 * - Configurable delays for realistic timing
 * - Simulate network failures
 */

import { IWebSocketAdapter, ReadyState, WebSocketOptions } from '../core/IWebSocketAdapter';

/**
 * Mock WebSocket configuration
 */
export interface MockWebSocketConfig {
	/** Simulate connection delay (ms) */
	connectionDelay?: number;
	
	/** Simulate connection failure */
	shouldFailConnection?: boolean;
	
	/** Connection failure error message */
	connectionError?: string;
	
	/** Auto-send handshake on connection */
	autoHandshake?: boolean;
	
	/** Handshake session ID */
	sessionId?: string;
}

/**
 * Mock WebSocket adapter for testing
 */
export class MockWebSocketAdapter implements IWebSocketAdapter {
	private state: ReadyState = ReadyState.CLOSED;
	private eventHandlers: Map<string, Set<Function>> = new Map();
	private config: MockWebSocketConfig;
	
	// Test helpers - public for assertions
	public sentMessages: string[] = [];
	public lastSentMessage: string | null = null;
	public url: string | null = null;
	public options: WebSocketOptions | null = null;

	constructor(config: MockWebSocketConfig = {}) {
		this.config = {
			connectionDelay: 10,
			shouldFailConnection: false,
			connectionError: 'Connection failed',
			autoHandshake: true,
			sessionId: 'mock_session_123',
			...config
		};
	}

	/**
	 * Get current connection state
	 */
	get readyState(): ReadyState {
		return this.state;
	}

	/**
	 * Simulate WebSocket connection
	 * 
	 * @param url WebSocket URL
	 * @param options Connection options
	 * @returns Promise that resolves when "connected"
	 */
	async connect(url: string, options: WebSocketOptions = {}): Promise<void> {
		this.url = url;
		this.options = options;
		this.state = ReadyState.CONNECTING;

		return new Promise((resolve, reject) => {
			// Simulate network delay
			setTimeout(() => {
				if (this.config.shouldFailConnection) {
					// Simulate connection failure
					const error = new Error(this.config.connectionError);
					this.state = ReadyState.CLOSED;
					this.triggerEvent('error', error);
					reject(error);
				} else {
					// Simulate successful connection
					this.state = ReadyState.OPEN;
					this.triggerEvent('open');
					
					// Auto-send handshake if configured
					if (this.config.autoHandshake) {
						this.simulateHandshake(this.config.sessionId!);
					}
					
					resolve();
				}
			}, this.config.connectionDelay);
		});
	}

	/**
	 * Simulate sending data
	 * Captures message for test assertions
	 * 
	 * @param data Data to send
	 */
	send(data: string | Buffer): void {
		if (this.state !== ReadyState.OPEN) {
			throw new Error(`Cannot send - WebSocket is ${this.state}`);
		}

		const message = typeof data === 'string' ? data : data.toString();
		this.sentMessages.push(message);
		this.lastSentMessage = message;
	}

	/**
	 * Simulate closing connection
	 * 
	 * @param code Close code
	 * @param reason Close reason
	 */
	close(code: number = 1000, reason?: string): void {
		if (this.state === ReadyState.CLOSED) return;

		this.state = ReadyState.CLOSING;
		
		// Simulate async close
		setTimeout(() => {
			this.state = ReadyState.CLOSED;
			this.triggerEvent('close', code, reason || '');
		}, 10);
	}

	/**
	 * Register event handler
	 */
	on(event: string, handler: Function): void {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, new Set());
		}
		this.eventHandlers.get(event)!.add(handler);
	}

	/**
	 * Unregister event handler
	 */
	off(event: string, handler: Function): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	/**
	 * Register one-time event handler
	 */
	once(event: string, handler: Function): void {
		const wrappedHandler = (...args: unknown[]) => {
			handler(...args);
			this.off(event, wrappedHandler);
		};
		this.on(event, wrappedHandler);
	}

	// ========================================================================
	// TEST SIMULATION METHODS (public for tests)
	// ========================================================================

	/**
	 * Simulate receiving a message from server
	 * 
	 * @param message Message data (frame format)
	 * 
	 * @example
	 * ```typescript
	 * mockWs.simulateMessage('~m~25~m~{"m":"symbol_resolved","p":[...]}');
	 * ```
	 */
	simulateMessage(message: string): void {
		if (this.state !== ReadyState.OPEN) {
			throw new Error('Cannot simulate message - connection not open');
		}
		this.triggerEvent('message', message);
	}

	/**
	 * Simulate server handshake
	 * 
	 * @param sessionId Session ID to send
	 */
	simulateHandshake(sessionId: string): void {
		const handshake = JSON.stringify({ session_id: sessionId });
		const frame = `~m~${handshake.length}~m~${handshake}`;
		this.simulateMessage(frame);
	}

	/**
	 * Simulate symbol resolution response
	 * 
	 * @param chartSessionId Chart session ID
	 * @param symbolSessionId Symbol session ID
	 * @param metadata Symbol metadata
	 */
	simulateSymbolResolved(
		chartSessionId: string,
		symbolSessionId: string,
		metadata: Record<string, unknown>
	): void {
		const message = {
			m: 'symbol_resolved',
			p: [chartSessionId, symbolSessionId, metadata]
		};
		const payload = JSON.stringify(message);
		const frame = `~m~${payload.length}~m~${payload}`;
		this.simulateMessage(frame);
	}

	/**
	 * Simulate symbol error response
	 * 
	 * @param chartSessionId Chart session ID
	 * @param symbol Symbol that failed
	 * @param reason Error reason
	 */
	simulateSymbolError(
		chartSessionId: string,
		symbol: string,
		reason: string
	): void {
		const message = {
			m: 'symbol_error',
			p: [chartSessionId, symbol, reason]
		};
		const payload = JSON.stringify(message);
		const frame = `~m~${payload.length}~m~${payload}`;
		this.simulateMessage(frame);
	}

	/**
	 * Simulate timescale update (bars data)
	 * 
	 * @param chartSessionId Chart session ID
	 * @param bars Array of OHLCV bars
	 * @param seriesId Optional series ID (defaults to 'sds_1')
	 */
	simulateTimescaleUpdate(
		chartSessionId: string,
		bars: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>,
		seriesId: string = 'sds_1'
	): void {
		const dataObj = {
			[seriesId]: {
				s: bars.map((bar, i) => ({
					i,
					v: [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume]
				}))
			}
		};

		const message = {
			m: 'timescale_update',
			p: [chartSessionId, dataObj]
		};
		const payload = JSON.stringify(message);
		const frame = `~m~${payload.length}~m~${payload}`;
		this.simulateMessage(frame);
	}

	/**
	 * Simulate CVD indicator data update
	 * 
	 * @param chartSessionId Chart session ID
	 * @param indicatorId Indicator ID (e.g., 'cvd_1')
	 * @param values Array of indicator values
	 */
	simulateCVDUpdate(
		chartSessionId: string,
		indicatorId: string,
		values: Array<{ time: number; value: number }>
	): void {
		const dataObj: Record<string, unknown> = {
			[indicatorId]: {
				st: values.map((v, i) => ({
					i,
					v: [v.time, v.value]
				}))
			}
		};

		const message = {
			m: 'du',
			p: [chartSessionId, dataObj]
		};
		const payload = JSON.stringify(message);
		const frame = `~m~${payload.length}~m~${payload}`;
		this.simulateMessage(frame);
	}

	/**
	 * Simulate heartbeat from server
	 */
	simulateHeartbeat(): void {
		this.simulateMessage('~m~3~m~~h~1');
	}

	/**
	 * Simulate protocol error
	 * 
	 * @param errorMessage Error message
	 */
	simulateProtocolError(errorMessage: string): void {
		const message = {
			m: 'protocol_error',
			p: [errorMessage]
		};
		const payload = JSON.stringify(message);
		const frame = `~m~${payload.length}~m~${payload}`;
		this.simulateMessage(frame);
	}

	/**
	 * Simulate connection error
	 * 
	 * @param error Error object
	 */
	simulateError(error: Error): void {
		this.triggerEvent('error', error);
	}

	/**
	 * Simulate connection close
	 * 
	 * @param code Close code
	 * @param reason Close reason
	 */
	simulateClose(code: number = 1000, reason: string = ''): void {
		this.state = ReadyState.CLOSED;
		this.triggerEvent('close', code, reason);
	}

	// ========================================================================
	// TEST ASSERTION HELPERS
	// ========================================================================

	/**
	 * Get all sent messages
	 */
	getSentMessages(): string[] {
		return [...this.sentMessages];
	}

	/**
	 * Clear sent messages history
	 */
	clearSentMessages(): void {
		this.sentMessages = [];
		this.lastSentMessage = null;
	}

	/**
	 * Check if a specific message was sent
	 * 
	 * @param method Method name to check (e.g., 'set_auth_token')
	 * @returns True if message was sent
	 */
	wasMessageSent(method: string): boolean {
		return this.sentMessages.some(msg => {
			try {
				// Parse frame to get message
				const matches = msg.match(/~m~\d+~m~(.+)/);
				if (matches) {
					const parsed = JSON.parse(matches[1]);
					return parsed.m === method;
				}
			} catch {
				return false;
			}
			return false;
		});
	}

	/**
	 * Get parsed messages (for assertions)
	 */
	getParsedMessages(): Array<{ m: string; p: unknown[] }> {
		return this.sentMessages.map(msg => {
			try {
				const matches = msg.match(/~m~\d+~m~(.+)/);
				if (matches) {
					return JSON.parse(matches[1]);
				}
			} catch {
				return null;
			}
			return null;
		}).filter(Boolean) as Array<{ m: string; p: unknown[] }>;
	}

	// ========================================================================
	// PRIVATE HELPERS
	// ========================================================================

	/**
	 * Trigger event to all registered handlers
	 */
	private triggerEvent(event: string, ...args: unknown[]): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(...args);
				} catch (error) {
					console.error(`[MockWebSocketAdapter] Error in ${event} handler:`, error);
				}
			}
		}
	}
}

/**
 * Create mock WebSocket factory
 * 
 * @param config Mock configuration
 * @returns Factory function that creates MockWebSocketAdapter instances
 */
export function createMockWebSocketFactory(config: MockWebSocketConfig = {}) {
	return () => new MockWebSocketAdapter(config);
}

/**
 * Create mock WebSocket adapter directly (convenience)
 * 
 * @param config Mock configuration
 * @returns MockWebSocketAdapter instance
 */
export function createMockWebSocket(config: MockWebSocketConfig = {}): MockWebSocketAdapter {
	return new MockWebSocketAdapter(config);
}
