/**
 * WebSocket Adapter Interface
 * 
 * Abstraction layer for WebSocket operations.
 * Enables dependency injection and unit testing with mock implementations.
 * 
 * Design Pattern: Adapter Pattern
 * - Production: NodeWebSocketAdapter (wraps 'ws' library)
 * - Testing: MockWebSocketAdapter (simulates server behavior)
 */

/**
 * WebSocket ready states (matches WebSocket spec)
 */
export enum ReadyState {
	CONNECTING = 0,
	OPEN = 1,
	CLOSING = 2,
	CLOSED = 3
}

/**
 * WebSocket connection options
 */
export interface WebSocketOptions {
	/** HTTP headers to send with connection */
	headers?: Record<string, string>;
	
	/** Connection timeout in milliseconds */
	timeout?: number;
	
	/** Additional protocol-specific options */
	[key: string]: unknown;
}

/**
 * WebSocket adapter interface
 * 
 * All WebSocket operations must go through this interface.
 * This enables swapping between real and mock implementations.
 */
export interface IWebSocketAdapter {
	/**
	 * Current connection state
	 * Matches WebSocket.readyState values
	 */
	readonly readyState: ReadyState;
	
	/**
	 * Connect to WebSocket server
	 * 
	 * @param url WebSocket URL (e.g., 'wss://...')
	 * @param options Connection options (headers, timeout, etc.)
	 * @returns Promise that resolves when connection opens
	 * @throws Error if connection fails or times out
	 */
	connect(url: string, options?: WebSocketOptions): Promise<void>;
	
	/**
	 * Send data through WebSocket
	 * 
	 * @param data Data to send (string or buffer)
	 * @throws Error if not connected
	 */
	send(data: string | Buffer): void;
	
	/**
	 * Close WebSocket connection
	 * 
	 * @param code Close code (default: 1000 = normal closure)
	 * @param reason Close reason (optional)
	 */
	close(code?: number, reason?: string): void;
	
	/**
	 * Register event handler
	 * 
	 * Events:
	 * - 'open': Connection established
	 * - 'message': Data received (payload: string | Buffer)
	 * - 'error': Error occurred (payload: Error)
	 * - 'close': Connection closed (payload: { code: number, reason: string })
	 * 
	 * @param event Event name
	 * @param handler Event handler function
	 */
	on(event: 'open', handler: () => void): void;
	on(event: 'message', handler: (data: string | Buffer) => void): void;
	on(event: 'error', handler: (error: Error) => void): void;
	on(event: 'close', handler: (code: number, reason: string) => void): void;
	on(event: string, handler: (...args: unknown[]) => void): void;
	
	/**
	 * Unregister event handler
	 * 
	 * @param event Event name
	 * @param handler Event handler function to remove
	 */
	off(event: 'open', handler: () => void): void;
	off(event: 'message', handler: (data: string | Buffer) => void): void;
	off(event: 'error', handler: (error: Error) => void): void;
	off(event: 'close', handler: (code: number, reason: string) => void): void;
	off(event: string, handler: (...args: unknown[]) => void): void;
	
	/**
	 * Register one-time event handler
	 * Handler is automatically removed after first invocation
	 * 
	 * @param event Event name
	 * @param handler Event handler function
	 */
	once(event: 'open', handler: () => void): void;
	once(event: 'message', handler: (data: string | Buffer) => void): void;
	once(event: 'error', handler: (error: Error) => void): void;
	once(event: 'close', handler: (code: number, reason: string) => void): void;
	once(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * WebSocket adapter factory function type
 * Used for dependency injection
 */
export type WebSocketFactory = () => IWebSocketAdapter;

/**
 * Create default production WebSocket factory
 * This will be implemented in NodeWebSocketAdapter
 */
export function createProductionWebSocketFactory(): WebSocketFactory {
	// Lazy import to avoid loading 'ws' in test environment
	return () => {
		// This will be implemented by NodeWebSocketAdapter
		throw new Error('Production WebSocket factory not initialized. Import NodeWebSocketAdapter.');
	};
}

/**
 * Create mock WebSocket factory for testing
 * This will be implemented in MockWebSocketAdapter
 */
export function createMockWebSocketFactory(): WebSocketFactory {
	// This will be implemented by MockWebSocketAdapter
	throw new Error('Mock WebSocket factory not initialized. Import MockWebSocketAdapter.');
}
