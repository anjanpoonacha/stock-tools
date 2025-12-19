/**
 * TradingView WebSocket Protocol Parser
 * 
 * Handles the custom frame format: ~m~<length>~m~<json_payload>
 * Multiple messages can be concatenated in a single WebSocket frame
 */

export interface TVMessage {
	m: string;           // Method name
	p: unknown[];        // Parameters array
	t?: number;          // Optional timestamp (seconds)
	t_ms?: number;       // Optional timestamp (milliseconds)
}

export interface ParsedFrame {
	messages: TVMessage[];
	rawMessages: string[];
	heartbeats: string[];  // Heartbeat messages that need to be echoed back
}

/**
 * Parse a single TradingView message from the ~m~ protocol
 * @param frame Raw WebSocket frame data
 * @returns Parsed messages array
 */
export function parseFrame(frame: string): ParsedFrame {
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
			console.warn('[TV Protocol] Invalid message length:', lengthStr);
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
			console.log('[TV Protocol] 💓 Heartbeat received:', messagePayload);
		} else {
			// Regular message - try to parse as JSON
			rawMessages.push(messagePayload);
			try {
				const parsed = JSON.parse(messagePayload);
				messages.push(parsed as TVMessage);
			} catch (error) {
				console.warn('[TV Protocol] Failed to parse message JSON:', messagePayload.substring(0, 100));
			}
		}

		// Move position forward by message length
		position += messageLength;
	}

	return { messages, rawMessages, heartbeats };
}

/**
 * Encode a message in TradingView protocol format
 * @param message Message object to encode
 * @returns Encoded frame string
 */
export function encodeMessage(message: TVMessage): string {
	const payload = JSON.stringify(message);
	const length = payload.length;
	return `~m~${length}~m~${payload}`;
}

/**
 * Encode multiple messages into a single frame
 * @param messages Array of messages to encode
 * @returns Concatenated encoded frames
 */
export function encodeMessages(messages: TVMessage[]): string {
	return messages.map(encodeMessage).join('');
}

/**
 * Create a standard TradingView message
 * @param method Method name (e.g., 'set_auth_token', 'quote_create_session')
 * @param params Parameters array
 * @returns Message object
 */
export function createMessage(method: string, params: unknown[]): TVMessage {
	return {
		m: method,
		p: params
	};
}

/**
 * Generate a random session ID for chart/quote sessions
 * @param prefix Prefix for the session ID (e.g., 'cs_', 'qs_')
 * @returns Random session ID
 */
export function generateSessionId(prefix: string): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = prefix;
	for (let i = 0; i < 12; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Create a symbol specification string
 * @param symbol Symbol name (e.g., 'NSE:JUNIPER')
 * @param adjustment Adjustment type ('dividends', 'splits', 'none')
 * @param session Session type ('regular', 'extended')
 * @returns JSON-encoded symbol spec
 */
export function createSymbolSpec(
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
