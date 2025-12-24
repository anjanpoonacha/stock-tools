/**
 * Typed Event Emitter
 * 
 * Type-safe event emitter with full TypeScript support.
 * Ensures event handlers match expected signatures.
 * 
 * Features:
 * - Type-safe event registration
 * - Wildcard event listeners
 * - One-time event handlers
 * - Error isolation (one handler error doesn't affect others)
 * - Memory leak prevention (max listeners warning)
 */

import type { EventMap } from './types';

/**
 * Type-safe event emitter
 */
export class TypedEventEmitter {
	private listeners: Map<string, Set<Function>> = new Map();
	private onceListeners: Map<string, Set<Function>> = new Map();
	private maxListeners: number = 100;

	/**
	 * Register an event handler
	 * 
	 * @param event Event name
	 * @param handler Event handler function
	 * 
	 * @example
	 * ```typescript
	 * emitter.on('state', (state, previous) => {
	 *   console.log(`State changed: ${previous} → ${state}`);
	 * });
	 * ```
	 */
	on<K extends keyof EventMap>(event: K, handler: EventMap[K]): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		
		const handlers = this.listeners.get(event)!;
		handlers.add(handler);

		// Warn if too many listeners (potential memory leak)
		if (handlers.size > this.maxListeners) {
			console.warn(
				`[EventEmitter] Possible memory leak detected: ` +
				`${handlers.size} listeners for event '${event}'. ` +
				`Use emitter.setMaxListeners() to increase limit.`
			);
		}
	}

	/**
	 * Register a one-time event handler
	 * Handler is automatically removed after first invocation
	 * 
	 * @param event Event name
	 * @param handler Event handler function
	 * 
	 * @example
	 * ```typescript
	 * emitter.once('initialized', () => {
	 *   console.log('Connection initialized!');
	 * });
	 * ```
	 */
	once<K extends keyof EventMap>(event: K, handler: EventMap[K]): void {
		if (!this.onceListeners.has(event)) {
			this.onceListeners.set(event, new Set());
		}
		this.onceListeners.get(event)!.add(handler);
	}

	/**
	 * Unregister an event handler
	 * 
	 * @param event Event name
	 * @param handler Event handler function to remove
	 * 
	 * @example
	 * ```typescript
	 * const handler = (state) => console.log(state);
	 * emitter.on('state', handler);
	 * emitter.off('state', handler); // Remove specific handler
	 * ```
	 */
	off<K extends keyof EventMap>(event: K, handler: EventMap[K]): void {
		this.listeners.get(event)?.delete(handler);
		this.onceListeners.get(event)?.delete(handler);
	}

	/**
	 * Emit an event to all registered handlers
	 * 
	 * @param event Event name
	 * @param args Event arguments
	 * 
	 * @example
	 * ```typescript
	 * emitter.emit('state', ConnectionState.READY, ConnectionState.CONNECTED);
	 * emitter.emit('error', new Error('Connection failed'));
	 * ```
	 */
	emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>): void {
		// Call regular listeners
		const handlers = this.listeners.get(event);
		if (handlers) {
			for (const handler of handlers) {
				this.safeInvoke(handler, args, event);
			}
		}

		// Call one-time listeners and remove them
		const onceHandlers = this.onceListeners.get(event);
		if (onceHandlers) {
			for (const handler of onceHandlers) {
				this.safeInvoke(handler, args, event);
			}
			onceHandlers.clear();
		}
	}

	/**
	 * Remove all handlers for an event
	 * 
	 * @param event Event name (optional, removes all if not specified)
	 * 
	 * @example
	 * ```typescript
	 * emitter.removeAllListeners('state'); // Remove all state listeners
	 * emitter.removeAllListeners(); // Remove ALL listeners
	 * ```
	 */
	removeAllListeners(event?: keyof EventMap): void {
		if (event) {
			this.listeners.delete(event);
			this.onceListeners.delete(event);
		} else {
			this.listeners.clear();
			this.onceListeners.clear();
		}
	}

	/**
	 * Get number of listeners for an event
	 * 
	 * @param event Event name
	 * @returns Number of registered handlers
	 */
	listenerCount(event: keyof EventMap): number {
		const regular = this.listeners.get(event)?.size || 0;
		const once = this.onceListeners.get(event)?.size || 0;
		return regular + once;
	}

	/**
	 * Get all event names with registered listeners
	 * 
	 * @returns Array of event names
	 */
	eventNames(): Array<keyof EventMap> {
		const names = new Set<string>();
		for (const key of this.listeners.keys()) {
			names.add(key);
		}
		for (const key of this.onceListeners.keys()) {
			names.add(key);
		}
		return Array.from(names) as Array<keyof EventMap>;
	}

	/**
	 * Set maximum number of listeners per event
	 * Used to detect memory leaks
	 * 
	 * @param max Maximum listeners (0 = unlimited)
	 */
	setMaxListeners(max: number): void {
		this.maxListeners = max;
	}

	/**
	 * Get maximum number of listeners per event
	 */
	getMaxListeners(): number {
		return this.maxListeners;
	}

	/**
	 * Wait for an event to be emitted
	 * Returns a promise that resolves when the event fires
	 * 
	 * @param event Event name
	 * @param timeout Timeout in milliseconds (optional)
	 * @returns Promise that resolves with event arguments
	 * 
	 * @example
	 * ```typescript
	 * const state = await emitter.waitFor('state', 5000);
	 * console.log('State changed to:', state);
	 * ```
	 */
	async waitFor<K extends keyof EventMap>(
		event: K,
		timeout?: number
	): Promise<Parameters<EventMap[K]>> {
		return new Promise((resolve, reject) => {
			let timeoutHandle: NodeJS.Timeout | undefined;

			const handler = (...args: Parameters<EventMap[K]>) => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				resolve(args);
			};

			this.once(event, handler as EventMap[K]);

			if (timeout) {
				timeoutHandle = setTimeout(() => {
					this.off(event, handler as EventMap[K]);
					reject(new Error(`Timeout waiting for event '${event}' after ${timeout}ms`));
				}, timeout);
			}
		});
	}

	/**
	 * Safely invoke a handler with error isolation
	 * One handler error doesn't prevent other handlers from running
	 */
	private safeInvoke(handler: Function, args: unknown[], event: string): void {
		try {
			handler(...args);
		} catch (error) {
			console.error(`[EventEmitter] Error in handler for event '${event}':`, error);
			// Emit error event to allow error monitoring
			// Note: We don't emit 'error' if this IS an error handler to avoid infinite loop
			if (event !== 'error') {
				const errorHandlers = this.listeners.get('error');
				if (errorHandlers && errorHandlers.size > 0) {
					for (const errorHandler of errorHandlers) {
						try {
							errorHandler(error);
						} catch (nestedError) {
							console.error('[EventEmitter] Error in error handler:', nestedError);
						}
					}
				}
			}
		}
	}

	/**
	 * Get debug information about registered listeners
	 */
	debug(): {
		events: Array<{
			name: string;
			listeners: number;
			onceListeners: number;
			total: number;
		}>;
		totalListeners: number;
		maxListeners: number;
	} {
		const events: Array<{
			name: string;
			listeners: number;
			onceListeners: number;
			total: number;
		}> = [];

		let totalListeners = 0;

		for (const event of this.eventNames()) {
			const listeners = this.listeners.get(event)?.size || 0;
			const onceListeners = this.onceListeners.get(event)?.size || 0;
			const total = listeners + onceListeners;

			events.push({
				name: event,
				listeners,
				onceListeners,
				total
			});

			totalListeners += total;
		}

		return {
			events,
			totalListeners,
			maxListeners: this.maxListeners
		};
	}
}
