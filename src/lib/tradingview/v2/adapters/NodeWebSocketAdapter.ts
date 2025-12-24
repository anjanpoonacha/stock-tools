/**
 * Node WebSocket Adapter
 * 
 * Production adapter that wraps the 'ws' library.
 * Implements IWebSocketAdapter for use in production environments.
 * 
 * Features:
 * - WebSocket connection management
 * - Event forwarding
 * - Connection timeout handling
 * - Automatic cleanup
 */

import WebSocket from 'ws';
import { IWebSocketAdapter, ReadyState, WebSocketOptions } from '../core/IWebSocketAdapter';

/**
 * Production WebSocket adapter using 'ws' library
 */
export class NodeWebSocketAdapter implements IWebSocketAdapter {
	private ws: WebSocket | null = null;
	private eventHandlers: Map<string, Set<Function>> = new Map();
	private connectionTimeout: NodeJS.Timeout | null = null;

	/**
	 * Get current connection state
	 */
	get readyState(): ReadyState {
		if (!this.ws) return ReadyState.CLOSED;
		
		// Map WebSocket states to our enum
		switch (this.ws.readyState) {
			case WebSocket.CONNECTING:
				return ReadyState.CONNECTING;
			case WebSocket.OPEN:
				return ReadyState.OPEN;
			case WebSocket.CLOSING:
				return ReadyState.CLOSING;
			case WebSocket.CLOSED:
				return ReadyState.CLOSED;
			default:
				return ReadyState.CLOSED;
		}
	}

	/**
	 * Connect to WebSocket server
	 * 
	 * @param url WebSocket URL
	 * @param options Connection options
	 * @returns Promise that resolves when connected
	 */
	async connect(url: string, options: WebSocketOptions = {}): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Extract timeout from options (default: 30 seconds)
				const timeout = options.timeout || 30000;
				
				// Create WebSocket instance
				this.ws = new WebSocket(url, {
					headers: options.headers || {}
				});

				// Set connection timeout
				this.connectionTimeout = setTimeout(() => {
					if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
						const error = new Error(`WebSocket connection timeout after ${timeout}ms`);
						this.ws.terminate(); // Force close
						reject(error);
					}
				}, timeout);

				// Handle connection open
				this.ws.on('open', () => {
					if (this.connectionTimeout) {
						clearTimeout(this.connectionTimeout);
						this.connectionTimeout = null;
					}
					this.triggerEvent('open');
					resolve();
				});

				// Handle errors
				this.ws.on('error', (error: Error) => {
					if (this.connectionTimeout) {
						clearTimeout(this.connectionTimeout);
						this.connectionTimeout = null;
					}
					this.triggerEvent('error', error);
					// Reject if still connecting
					if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
						reject(error);
					}
				});

				// Handle messages
				this.ws.on('message', (data: WebSocket.Data) => {
					const message = data.toString();
					this.triggerEvent('message', message);
				});

				// Handle close
				this.ws.on('close', (code: number, reason: Buffer) => {
					const reasonString = reason.toString();
					this.triggerEvent('close', code, reasonString);
				});

			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Send data through WebSocket
	 * 
	 * @param data Data to send
	 * @throws Error if not connected
	 */
	send(data: string | Buffer): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket is not connected. Current state: ' + this.readyState);
		}
		this.ws.send(data);
	}

	/**
	 * Close WebSocket connection
	 * 
	 * @param code Close code (default: 1000 = normal)
	 * @param reason Close reason
	 */
	close(code: number = 1000, reason?: string): void {
		if (this.connectionTimeout) {
			clearTimeout(this.connectionTimeout);
			this.connectionTimeout = null;
		}

		if (this.ws) {
			this.ws.close(code, reason);
			this.ws = null;
		}
	}

	/**
	 * Register event handler
	 * 
	 * @param event Event name
	 * @param handler Event handler function
	 */
	on(event: string, handler: Function): void {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, new Set());
		}
		this.eventHandlers.get(event)!.add(handler);
	}

	/**
	 * Unregister event handler
	 * 
	 * @param event Event name
	 * @param handler Event handler function
	 */
	off(event: string, handler: Function): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	/**
	 * Register one-time event handler
	 * 
	 * @param event Event name
	 * @param handler Event handler function
	 */
	once(event: string, handler: Function): void {
		const wrappedHandler = (...args: unknown[]) => {
			handler(...args);
			this.off(event, wrappedHandler);
		};
		this.on(event, wrappedHandler);
	}

	/**
	 * Trigger event to all registered handlers
	 * 
	 * @param event Event name
	 * @param args Event arguments
	 */
	private triggerEvent(event: string, ...args: unknown[]): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(...args);
				} catch (error) {
					console.error(`[NodeWebSocketAdapter] Error in ${event} handler:`, error);
				}
			}
		}
	}
}

/**
 * Create production WebSocket factory
 * 
 * @returns Factory function that creates NodeWebSocketAdapter instances
 */
export function createNodeWebSocketFactory() {
	return () => new NodeWebSocketAdapter();
}
