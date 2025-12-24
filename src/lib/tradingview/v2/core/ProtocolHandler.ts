/**
 * TradingView WebSocket Protocol Handler
 * 
 * Handles encoding and decoding of TradingView's custom WebSocket protocol.
 * Frame format: ~m~<length>~m~<json_payload>
 * 
 * Features:
 * - Message encoding/decoding
 * - Heartbeat detection
 * - Multiple message parsing
 * - Session ID generation
 */

import type { TVMessage, ParsedFrame } from './types';

/**
 * Protocol Handler class
 * Stateless utility for protocol operations
 */
export class ProtocolHandler {
	/**
	 * Parse a WebSocket frame containing one or more messages
	 * 
	 * @param frame Raw WebSocket frame string
	 * @returns Parsed messages and heartbeats
	 * 
	 * @example
	 * ```typescript
	 * const frame = '~m~54~m~{"m":"symbol_resolved","p":[...]}';
	 * const { messages, heartbeats } = handler.parseFrame(frame);
	 * ```
	 */
	parseFrame(frame: string): ParsedFrame {
		const messages: TVMessage[] = [];
		const rawMessages: string[] = [];
		const heartbeats: string[] = [];
		let position = 0;

		while (position < frame.length) {
			// Find the first delimiter
			const firstDelimiter = frame.indexOf('~m~', position);
			if (firstDelimiter === -1) break;

			// Move past the first ~m~
			position = firstDelimiter + 3;

			// Find the second delimiter
			const secondDelimiter = frame.indexOf('~m~', position);
			if (secondDelimiter === -1) break;

			// Extract the length
			const lengthStr = frame.substring(position, secondDelimiter);
			const messageLength = parseInt(lengthStr, 10);

			if (isNaN(messageLength)) {
				break;
			}

			// Move past the second ~m~
			position = secondDelimiter + 3;

			// Extract the message payload
			const messagePayload = frame.substring(position, position + messageLength);
			
			// Check if this is a heartbeat message (~h~N format)
			if (messagePayload.startsWith('~h~')) {
				// Extract the full heartbeat message including frame markers
				const heartbeatMessage = `~m~${messageLength}~m~${messagePayload}`;
				heartbeats.push(heartbeatMessage);
			} else {
				// Regular message - try to parse as JSON
				rawMessages.push(messagePayload);
				try {
					const parsed = JSON.parse(messagePayload);
					messages.push(parsed as TVMessage);
				} catch (error) {
					// Ignore malformed JSON (might be binary data or other format)
					console.warn('[ProtocolHandler] Failed to parse message:', messagePayload);
				}
			}

			// Move position forward by message length
			position += messageLength;
		}

		return { messages, rawMessages, heartbeats };
	}

	/**
	 * Encode a message in TradingView protocol format
	 * 
	 * @param message Message object to encode
	 * @returns Encoded frame string
	 * 
	 * @example
	 * ```typescript
	 * const message = { m: 'set_auth_token', p: ['jwt_token'] };
	 * const encoded = handler.encodeMessage(message);
	 * // Returns: '~m~45~m~{"m":"set_auth_token","p":["jwt_token"]}'
	 * ```
	 */
	encodeMessage(message: TVMessage): string {
		const payload = JSON.stringify(message);
		const length = payload.length;
		return `~m~${length}~m~${payload}`;
	}

	/**
	 * Encode multiple messages into a single frame
	 * 
	 * @param messages Array of messages to encode
	 * @returns Concatenated encoded frames
	 * 
	 * @example
	 * ```typescript
	 * const messages = [
	 *   { m: 'set_auth_token', p: ['token'] },
	 *   { m: 'set_locale', p: ['en', 'US'] }
	 * ];
	 * const encoded = handler.encodeMessages(messages);
	 * ```
	 */
	encodeMessages(messages: TVMessage[]): string {
		return messages.map(msg => this.encodeMessage(msg)).join('');
	}

	/**
	 * Create a standard TradingView message
	 * 
	 * @param method Method name (e.g., 'set_auth_token', 'quote_create_session')
	 * @param params Parameters array
	 * @returns Message object
	 * 
	 * @example
	 * ```typescript
	 * const msg = handler.createMessage('set_auth_token', ['my_jwt_token']);
	 * // Returns: { m: 'set_auth_token', p: ['my_jwt_token'] }
	 * ```
	 */
	createMessage(method: string, params: unknown[]): TVMessage {
		return {
			m: method,
			p: params
		};
	}

	/**
	 * Generate a random session ID for chart/quote sessions
	 * 
	 * @param prefix Prefix for the session ID (e.g., 'cs_', 'qs_')
	 * @returns Random session ID
	 * 
	 * @example
	 * ```typescript
	 * const chartSessionId = handler.generateSessionId('cs_');
	 * // Returns: 'cs_A1b2C3d4E5f6'
	 * ```
	 */
	generateSessionId(prefix: string): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = prefix;
		for (let i = 0; i < 12; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	/**
	 * Create a symbol specification string
	 * 
	 * @param symbol Symbol name (e.g., 'NSE:RELIANCE')
	 * @param adjustment Adjustment type ('dividends', 'splits', 'none')
	 * @param session Session type ('regular', 'extended') - optional
	 * @returns JSON-encoded symbol spec
	 * 
	 * @example
	 * ```typescript
	 * const symbolSpec = handler.createSymbolSpec('NSE:RELIANCE', 'dividends');
	 * // Returns: '={"symbol":"NSE:RELIANCE","adjustment":"dividends"}'
	 * ```
	 */
	createSymbolSpec(
		symbol: string,
		adjustment: 'dividends' | 'splits' | 'none' = 'dividends',
		session?: 'regular' | 'extended'
	): string {
		const spec: Record<string, string> = {
			symbol,
			adjustment
		};

		if (session) {
			spec.session = session;
		}

		return `=${JSON.stringify(spec)}`;
	}

	/**
	 * Check if a message is a heartbeat
	 * 
	 * @param messagePayload Raw message payload
	 * @returns True if this is a heartbeat message
	 */
	isHeartbeat(messagePayload: string): boolean {
		return messagePayload.startsWith('~h~');
	}

	/**
	 * Extract session ID from handshake message
	 * 
	 * @param message Handshake message
	 * @returns Session ID or null if not a handshake
	 * 
	 * @example
	 * ```typescript
	 * const handshake = { session_id: 'abc123xyz' };
	 * const sessionId = handler.extractSessionId(handshake);
	 * // Returns: 'abc123xyz'
	 * ```
	 */
	extractSessionId(message: unknown): string | null {
		if (typeof message === 'object' && message !== null && 'session_id' in message) {
			const handshake = message as { session_id: string };
			return handshake.session_id;
		}
		return null;
	}
}

/**
 * Singleton instance for convenience
 * Use this for stateless protocol operations
 */
export const protocolHandler = new ProtocolHandler();
