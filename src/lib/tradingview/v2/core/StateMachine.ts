/**
 * Connection State Machine
 * 
 * Manages connection state transitions with validation.
 * Prevents invalid state transitions and provides clear error messages.
 * 
 * State Flow:
 * DISCONNECTED → CONNECTING → CONNECTED → AUTHENTICATING → 
 * AUTHENTICATED → READY → [READY loop] → CLOSED
 * 
 * Error Recovery:
 * Any state → ERROR → DISCONNECTED (reconnect) or CLOSED (give up)
 */

import { ConnectionState } from './types';

/**
 * State machine for connection lifecycle management
 */
export class StateMachine {
	private currentState: ConnectionState;
	private previousState: ConnectionState | null = null;
	private stateHistory: Array<{ state: ConnectionState; timestamp: number }> = [];
	private transitionCallbacks: Map<string, Array<(from: ConnectionState, to: ConnectionState) => void>> = new Map();

	// Valid state transitions map
	private readonly transitions: Map<ConnectionState, ConnectionState[]> = new Map([
		// Initial state can only connect
		[ConnectionState.DISCONNECTED, [ConnectionState.CONNECTING]],
		
		// Connecting can succeed or fail
		[ConnectionState.CONNECTING, [ConnectionState.CONNECTED, ConnectionState.ERROR]],
		
		// Connected must authenticate
		[ConnectionState.CONNECTED, [ConnectionState.AUTHENTICATING, ConnectionState.ERROR]],
		
		// Authenticating can succeed or fail
		[ConnectionState.AUTHENTICATING, [ConnectionState.AUTHENTICATED, ConnectionState.ERROR]],
		
		// Authenticated must become ready
		[ConnectionState.AUTHENTICATED, [ConnectionState.READY, ConnectionState.ERROR]],
		
		// Ready can stay ready (fetch data), error, or close
		[ConnectionState.READY, [ConnectionState.READY, ConnectionState.ERROR, ConnectionState.CLOSED]],
		
		// Error can reconnect or close
		[ConnectionState.ERROR, [ConnectionState.DISCONNECTED, ConnectionState.CLOSED]],
		
		// Closed is terminal
		[ConnectionState.CLOSED, []]
	]);

	constructor(initialState: ConnectionState = ConnectionState.DISCONNECTED) {
		this.currentState = initialState;
		this.recordState(initialState);
	}

	/**
	 * Get current state
	 */
	getState(): ConnectionState {
		return this.currentState;
	}

	/**
	 * Get previous state (if any)
	 */
	getPreviousState(): ConnectionState | null {
		return this.previousState;
	}

	/**
	 * Get state history
	 */
	getHistory(): Array<{ state: ConnectionState; timestamp: number }> {
		return [...this.stateHistory];
	}

	/**
	 * Check if a transition is valid
	 * 
	 * @param to Target state
	 * @returns True if transition is allowed
	 */
	canTransition(to: ConnectionState): boolean {
		const allowed = this.transitions.get(this.currentState) || [];
		return allowed.includes(to);
	}

	/**
	 * Transition to a new state
	 * 
	 * @param to Target state
	 * @throws Error if transition is invalid
	 * 
	 * @example
	 * ```typescript
	 * stateMachine.transition(ConnectionState.CONNECTING);
	 * if (connectionSucceeds) {
	 *   stateMachine.transition(ConnectionState.CONNECTED);
	 * } else {
	 *   stateMachine.transition(ConnectionState.ERROR);
	 * }
	 * ```
	 */
	transition(to: ConnectionState): void {
		if (!this.canTransition(to)) {
			throw new Error(
				`Invalid state transition: ${this.currentState} → ${to}. ` +
				`Allowed transitions from ${this.currentState}: ${this.getAllowedTransitions().join(', ')}`
			);
		}

		const from = this.currentState;
		this.previousState = from;
		this.currentState = to;
		this.recordState(to);

		// Notify listeners
		this.notifyTransition(from, to);
	}

	/**
	 * Force transition to any state (bypass validation)
	 * Use with caution - only for error recovery
	 * 
	 * @param to Target state
	 */
	forceTransition(to: ConnectionState): void {
		const from = this.currentState;
		this.previousState = from;
		this.currentState = to;
		this.recordState(to);
		this.notifyTransition(from, to);
	}

	/**
	 * Get allowed transitions from current state
	 */
	getAllowedTransitions(): ConnectionState[] {
		return this.transitions.get(this.currentState) || [];
	}

	/**
	 * Check if in terminal state (no transitions possible)
	 */
	isTerminal(): boolean {
		return this.getAllowedTransitions().length === 0;
	}

	/**
	 * Check if in error state
	 */
	isError(): boolean {
		return this.currentState === ConnectionState.ERROR;
	}

	/**
	 * Check if ready for data operations
	 */
	isReady(): boolean {
		return this.currentState === ConnectionState.READY;
	}

	/**
	 * Check if connected (WebSocket open)
	 */
	isConnected(): boolean {
		return [
			ConnectionState.CONNECTED,
			ConnectionState.AUTHENTICATING,
			ConnectionState.AUTHENTICATED,
			ConnectionState.READY
		].includes(this.currentState);
	}

	/**
	 * Register callback for state transitions
	 * 
	 * @param event Transition event ('*' for all transitions, or specific state)
	 * @param callback Function to call on transition
	 * 
	 * @example
	 * ```typescript
	 * // Listen to all transitions
	 * stateMachine.onTransition('*', (from, to) => {
	 *   console.log(`State: ${from} → ${to}`);
	 * });
	 * 
	 * // Listen to specific state
	 * stateMachine.onTransition(ConnectionState.READY, (from, to) => {
	 *   console.log('Connection ready!');
	 * });
	 * ```
	 */
	onTransition(
		event: '*' | ConnectionState,
		callback: (from: ConnectionState, to: ConnectionState) => void
	): void {
		const key = event === '*' ? '*' : event;
		if (!this.transitionCallbacks.has(key)) {
			this.transitionCallbacks.set(key, []);
		}
		this.transitionCallbacks.get(key)!.push(callback);
	}

	/**
	 * Unregister transition callback
	 */
	offTransition(
		event: '*' | ConnectionState,
		callback: (from: ConnectionState, to: ConnectionState) => void
	): void {
		const key = event === '*' ? '*' : event;
		const callbacks = this.transitionCallbacks.get(key);
		if (callbacks) {
			const index = callbacks.indexOf(callback);
			if (index !== -1) {
				callbacks.splice(index, 1);
			}
		}
	}

	/**
	 * Reset state machine to initial state
	 */
	reset(): void {
		this.currentState = ConnectionState.DISCONNECTED;
		this.previousState = null;
		this.stateHistory = [];
		this.recordState(ConnectionState.DISCONNECTED);
	}

	/**
	 * Get human-readable state description
	 */
	getStateDescription(): string {
		const descriptions: Record<ConnectionState, string> = {
			[ConnectionState.DISCONNECTED]: 'Not connected to server',
			[ConnectionState.CONNECTING]: 'Establishing WebSocket connection...',
			[ConnectionState.CONNECTED]: 'WebSocket connected, awaiting authentication',
			[ConnectionState.AUTHENTICATING]: 'Sending authentication credentials...',
			[ConnectionState.AUTHENTICATED]: 'Authenticated, creating sessions...',
			[ConnectionState.READY]: 'Ready to fetch data',
			[ConnectionState.ERROR]: 'Error occurred, connection unusable',
			[ConnectionState.CLOSED]: 'Connection closed'
		};

		return descriptions[this.currentState] || 'Unknown state';
	}

	/**
	 * Record state in history
	 */
	private recordState(state: ConnectionState): void {
		this.stateHistory.push({
			state,
			timestamp: Date.now()
		});

		// Keep only last 50 states to prevent memory leak
		if (this.stateHistory.length > 50) {
			this.stateHistory.shift();
		}
	}

	/**
	 * Notify registered callbacks of state transition
	 */
	private notifyTransition(from: ConnectionState, to: ConnectionState): void {
		// Notify wildcard listeners
		const wildcardCallbacks = this.transitionCallbacks.get('*') || [];
		for (const callback of wildcardCallbacks) {
			try {
				callback(from, to);
			} catch (error) {
				console.error('[StateMachine] Error in transition callback:', error);
			}
		}

		// Notify specific state listeners
		const stateCallbacks = this.transitionCallbacks.get(to) || [];
		for (const callback of stateCallbacks) {
			try {
				callback(from, to);
			} catch (error) {
				console.error('[StateMachine] Error in transition callback:', error);
			}
		}
	}

	/**
	 * Get time in current state (milliseconds)
	 */
	getTimeInState(): number {
		if (this.stateHistory.length === 0) return 0;
		const lastTransition = this.stateHistory[this.stateHistory.length - 1];
		return Date.now() - lastTransition.timestamp;
	}

	/**
	 * Get total uptime (time since first state)
	 */
	getUptime(): number {
		if (this.stateHistory.length === 0) return 0;
		return Date.now() - this.stateHistory[0].timestamp;
	}

	/**
	 * Create debug snapshot of current state
	 */
	debug(): {
		current: ConnectionState;
		previous: ConnectionState | null;
		allowed: ConnectionState[];
		isTerminal: boolean;
		timeInState: number;
		uptime: number;
		history: Array<{ state: ConnectionState; timestamp: number }>;
	} {
		return {
			current: this.currentState,
			previous: this.previousState,
			allowed: this.getAllowedTransitions(),
			isTerminal: this.isTerminal(),
			timeInState: this.getTimeInState(),
			uptime: this.getUptime(),
			history: this.getHistory()
		};
	}
}
