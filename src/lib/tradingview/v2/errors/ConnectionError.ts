/**
 * Connection Error Hierarchy
 * 
 * Defines all error types for WebSocket connection operations.
 * Each error has:
 * - Unique error code
 * - Recoverable flag (can retry or not)
 * - Context data for debugging
 */

/**
 * Base class for all connection errors
 */
export class ConnectionError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly recoverable: boolean = false,
		public readonly context?: unknown
	) {
		super(message);
		this.name = 'ConnectionError';
		
		// Maintain proper stack trace in V8 engines
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Get user-friendly error message
	 */
	getUserMessage(): string {
		return this.message;
	}

	/**
	 * Get technical details for debugging
	 */
	getDebugInfo(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			recoverable: this.recoverable,
			context: this.context,
			stack: this.stack
		};
	}
}

/**
 * WebSocket connection timeout
 */
export class ConnectionTimeoutError extends ConnectionError {
	constructor(timeout: number) {
		super(
			`WebSocket connection timeout after ${timeout}ms`,
			'CONNECTION_TIMEOUT',
			true, // Can retry
			{ timeout }
		);
		this.name = 'ConnectionTimeoutError';
	}

	getUserMessage(): string {
		const timeout = (this.context as { timeout: number }).timeout;
		return `Failed to connect to server (timeout after ${timeout / 1000}s). Please check your internet connection.`;
	}
}

/**
 * Protocol-level error from TradingView server
 */
export class ProtocolError extends ConnectionError {
	constructor(serverMessage: string) {
		super(
			`Protocol error from server: ${serverMessage}`,
			'PROTOCOL_ERROR',
			false, // Cannot retry with same credentials
			{ serverMessage }
		);
		this.name = 'ProtocolError';
	}

	getUserMessage(): string {
		const serverMessage = (this.context as { serverMessage: string }).serverMessage;
		
		// Provide user-friendly messages for common errors
		if (serverMessage.includes('auth')) {
			return 'Authentication failed. Please log in again.';
		}
		if (serverMessage.includes('rate limit')) {
			return 'Too many requests. Please wait a moment and try again.';
		}
		return `Server error: ${serverMessage}`;
	}
}

/**
 * Symbol not found or invalid
 */
export class SymbolError extends ConnectionError {
	constructor(symbol: string, reason: string) {
		super(
			`Symbol error for "${symbol}": ${reason}`,
			'SYMBOL_ERROR',
			false, // Cannot retry with same symbol
			{ symbol, reason }
		);
		this.name = 'SymbolError';
	}

	getUserMessage(): string {
		const { symbol, reason } = this.context as { symbol: string; reason: string };
		
		if (reason.toLowerCase().includes('not found')) {
			return `Symbol "${symbol}" not found. Please check the symbol name.`;
		}
		if (reason.toLowerCase().includes('delisted')) {
			return `Symbol "${symbol}" has been delisted and is no longer available.`;
		}
		return `Cannot load data for "${symbol}": ${reason}`;
	}
}

/**
 * Data fetch timeout
 */
export class DataTimeoutError extends ConnectionError {
	constructor(operation: string, timeout: number, details?: string) {
		super(
			`Data timeout: ${operation} after ${timeout}ms` + (details ? ` (${details})` : ''),
			'DATA_TIMEOUT',
			true, // Can retry
			{ operation, timeout, details }
		);
		this.name = 'DataTimeoutError';
	}

	getUserMessage(): string {
		const { operation, timeout } = this.context as { operation: string; timeout: number; details?: string };
		return `Data fetch timed out after ${timeout / 1000}s. Your internet connection may be slow. Please try again.`;
	}
}

/**
 * CVD data timeout (special case - longer wait is acceptable)
 */
export class CVDTimeoutError extends ConnectionError {
	constructor(timeout: number, barsCount: number) {
		super(
			`CVD data timeout after ${timeout}ms for ${barsCount} bars`,
			'CVD_TIMEOUT',
			true, // Can retry with longer timeout
			{ timeout, barsCount }
		);
		this.name = 'CVDTimeoutError';
	}

	getUserMessage(): string {
		const { timeout } = this.context as { timeout: number; barsCount: number };
		return `CVD indicator data timed out after ${timeout / 1000}s. This may occur on slow connections or with large datasets.`;
	}
}

/**
 * Connection is stale and needs refresh
 */
export class StaleConnectionError extends ConnectionError {
	constructor(requestCount: number) {
		super(
			`Connection stale after ${requestCount} requests`,
			'STALE_CONNECTION',
			true, // Can create new connection
			{ requestCount }
		);
		this.name = 'StaleConnectionError';
	}

	getUserMessage(): string {
		return 'Connection needs refresh. Reconnecting automatically...';
	}
}

/**
 * Request was cancelled (e.g., user switched symbols)
 */
export class RequestCancelledError extends ConnectionError {
	constructor(reason: string, requestId?: string) {
		super(
			`Request cancelled: ${reason}`,
			'REQUEST_CANCELLED',
			false, // Don't retry cancelled requests
			{ reason, requestId }
		);
		this.name = 'RequestCancelledError';
	}

	getUserMessage(): string {
		const { reason } = this.context as { reason: string };
		return `Request cancelled: ${reason}`;
	}
}

/**
 * WebSocket connection closed unexpectedly
 */
export class ConnectionClosedError extends ConnectionError {
	constructor(code: number, reason: string) {
		super(
			`WebSocket closed: [${code}] ${reason || 'No reason provided'}`,
			'CONNECTION_CLOSED',
			code === 1006, // 1006 = abnormal closure, can retry
			{ code, reason }
		);
		this.name = 'ConnectionClosedError';
	}

	getUserMessage(): string {
		const { code, reason } = this.context as { code: number; reason: string };
		
		// Provide user-friendly messages for common close codes
		if (code === 1000) {
			return 'Connection closed normally.';
		}
		if (code === 1006) {
			return 'Connection lost. Please check your internet connection.';
		}
		if (code === 1008) {
			return 'Connection closed due to policy violation. Please refresh the page.';
		}
		return `Connection closed: ${reason || 'Unknown reason'}`;
	}
}

/**
 * Invalid state for operation
 */
export class InvalidStateError extends ConnectionError {
	constructor(operation: string, currentState: string, requiredState: string) {
		super(
			`Cannot ${operation} in state ${currentState}. Required state: ${requiredState}`,
			'INVALID_STATE',
			false, // Cannot retry without state change
			{ operation, currentState, requiredState }
		);
		this.name = 'InvalidStateError';
	}

	getUserMessage(): string {
		const { operation } = this.context as { operation: string };
		return `Cannot ${operation} right now. Please wait for the connection to be ready.`;
	}
}

/**
 * Network error (generic)
 */
export class NetworkError extends ConnectionError {
	constructor(message: string, originalError?: Error) {
		super(
			`Network error: ${message}`,
			'NETWORK_ERROR',
			true, // Network errors are usually transient
			{ originalError: originalError?.message, stack: originalError?.stack }
		);
		this.name = 'NetworkError';
	}

	getUserMessage(): string {
		return 'Network error occurred. Please check your internet connection and try again.';
	}
}
