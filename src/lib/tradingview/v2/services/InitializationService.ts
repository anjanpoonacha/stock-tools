/**
 * Initialization Service
 * 
 * Handles the 3-step WebSocket connection initialization sequence:
 * 1. Connect to WebSocket server
 * 2. Send authentication messages
 * 3. Create chart and quote sessions
 * 
 * Extracted from WebSocketConnection to promote:
 * - Single Responsibility Principle
 * - Testability (can mock connection init)
 * - Reusability (can be used by connection pool)
 */

import type { ServiceContext } from './ServiceContext';
import { ConnectionState } from '../core/types';
import {
	ConnectionTimeoutError,
	NetworkError
} from '../errors/ConnectionError';

/**
 * Service for initializing WebSocket connections
 */
export class InitializationService {
	private context: ServiceContext;

	constructor(context: ServiceContext) {
		this.context = context;
	}

	/**
	 * Execute full initialization sequence
	 * 
	 * @returns Promise that resolves when connection is READY
	 * @throws ConnectionTimeoutError if connection times out
	 * @throws NetworkError if connection fails
	 */
	async initialize(): Promise<void> {
		await this.connectWebSocket();
		await this.sendAuthentication();
		await this.createSessions();
	}

	/**
	 * Step 1: Connect to WebSocket server
	 * 
	 * Builds WebSocket URL with query parameters and establishes connection
	 * with timeout protection.
	 */
	async connectWebSocket(): Promise<void> {
		this.context.stateMachine.transition(ConnectionState.CONNECTING);

		// Build WebSocket URL
		const wsUrl = new URL(this.context.config.websocketUrl);
		wsUrl.searchParams.set('from', `chart/${this.context.config.chartId}/`);
		wsUrl.searchParams.set('date', new Date().toISOString());
		wsUrl.searchParams.set('type', 'chart');

		// Create WebSocket adapter (should be set by caller)
		if (!this.context.ws) {
			throw new Error('WebSocket adapter not initialized');
		}

		// Connect with timeout
		try {
			await Promise.race([
				this.context.ws.connect(wsUrl.toString(), {
					headers: {
						'Origin': 'https://www.tradingview.com',
						'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
					}
				}),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new ConnectionTimeoutError(this.context.config.connectionTimeout)),
						this.context.config.connectionTimeout
					)
				)
			]);

			this.context.stateMachine.transition(ConnectionState.CONNECTED);

			if (this.context.config.enableLogging) {
				console.log('[InitializationService] 🔌 Connected to WebSocket');
			}
		} catch (error) {
			throw new NetworkError('Failed to connect', error as Error);
		}
	}

	/**
	 * Step 2: Send authentication messages
	 * 
	 * Sends JWT token and locale settings to TradingView server.
	 */
	async sendAuthentication(): Promise<void> {
		this.context.stateMachine.transition(ConnectionState.AUTHENTICATING);

		// Send auth token
		this.sendMessage(
			this.context.protocol.createMessage('set_auth_token', [this.context.config.jwtToken])
		);

		// Send locale
		this.sendMessage(
			this.context.protocol.createMessage('set_locale', ['en', 'US'])
		);

		this.context.stateMachine.transition(ConnectionState.AUTHENTICATED);

		if (this.context.config.enableLogging) {
			console.log('[InitializationService] 🔑 Authenticated');
		}
	}

	/**
	 * Step 3: Create chart and quote sessions
	 * 
	 * Initializes TradingView sessions needed for data requests.
	 */
	async createSessions(): Promise<void> {
		// Create chart session
		this.sendMessage(
			this.context.protocol.createMessage('chart_create_session', [
				this.context.sessions.chartSessionId,
				''
			])
		);

		// Create quote session
		this.sendMessage(
			this.context.protocol.createMessage('quote_create_session', [
				this.context.sessions.quoteSessionId
			])
		);

		if (this.context.config.enableLogging) {
			console.log('[InitializationService] 📊 Sessions created');
		}
	}

	/**
	 * Helper: Send message through WebSocket
	 */
	private sendMessage(message: import('../core/types').TVMessage): void {
		if (!this.context.ws) {
			throw new Error('WebSocket not connected');
		}

		const encoded = this.context.protocol.encodeMessage(message);
		this.context.ws.send(encoded);

		this.context.events.emit('message:sent', message, encoded);
	}
}
