/**
 * Heartbeat Manager
 * 
 * Manages WebSocket keep-alive heartbeat mechanism.
 * TradingView sends ~h~N messages every ~5 seconds.
 * Client must echo them back immediately to keep connection alive.
 * 
 * Features:
 * - Automatic heartbeat detection
 * - Echo back heartbeats
 * - Connection health monitoring
 * - Stale connection detection (no heartbeat for 30s)
 */

import type { HeartbeatStatus } from '../core/types';

/**
 * Heartbeat manager configuration
 */
export interface HeartbeatConfig {
	/** Maximum time without heartbeat before considering connection stale (ms) */
	staleTimeout?: number;
	
	/** Enable heartbeat logging */
	enableLogging?: boolean;
}

/**
 * Heartbeat manager for WebSocket keep-alive
 */
export class HeartbeatManager {
	private isActive: boolean = false;
	private lastReceived: number = 0;
	private lastSent: number = 0;
	private receivedCount: number = 0;
	private sentCount: number = 0;
	private staleTimeout: number;
	private staleCheckInterval: NodeJS.Timeout | null = null;
	private enableLogging: boolean;
	private onStaleCallback: (() => void) | null = null;

	constructor(config: HeartbeatConfig = {}) {
		this.staleTimeout = config.staleTimeout || 30000; // 30s default
		this.enableLogging = config.enableLogging || false;
	}

	/**
	 * Start heartbeat monitoring
	 * 
	 * @param onStale Callback when connection becomes stale (no heartbeat)
	 */
	start(onStale?: () => void): void {
		if (this.isActive) return;

		this.isActive = true;
		this.lastReceived = Date.now();
		this.onStaleCallback = onStale || null;

		// Check for stale connection every 5 seconds
		this.staleCheckInterval = setInterval(() => {
			this.checkStaleConnection();
		}, 5000);

		if (this.enableLogging) {
			console.log('[Heartbeat] Started monitoring');
		}
	}

	/**
	 * Stop heartbeat monitoring
	 */
	stop(): void {
		if (!this.isActive) return;

		this.isActive = false;

		if (this.staleCheckInterval) {
			clearInterval(this.staleCheckInterval);
			this.staleCheckInterval = null;
		}

		if (this.enableLogging) {
			console.log('[Heartbeat] Stopped monitoring');
		}
	}

	/**
	 * Handle received heartbeat from server
	 * 
	 * @returns Heartbeat message to echo back
	 * 
	 * @example
	 * ```typescript
	 * ws.on('message', (data) => {
	 *   const { heartbeats } = parseFrame(data);
	 *   for (const heartbeat of heartbeats) {
	 *     const echo = heartbeatManager.handleHeartbeat(heartbeat);
	 *     if (echo) {
	 *       ws.send(echo); // Echo back immediately
	 *     }
	 *   }
	 * });
	 * ```
	 */
	handleHeartbeat(heartbeatMessage: string): string {
		this.lastReceived = Date.now();
		this.receivedCount++;

		if (this.enableLogging) {
			console.log(`[Heartbeat] Received #${this.receivedCount}`);
		}

		// Return the same message to echo back
		return heartbeatMessage;
	}

	/**
	 * Record that a heartbeat was sent
	 * Call this after echoing heartbeat to server
	 */
	recordSent(): void {
		this.lastSent = Date.now();
		this.sentCount++;

		if (this.enableLogging) {
			console.log(`[Heartbeat] Sent #${this.sentCount}`);
		}
	}

	/**
	 * Get current heartbeat status
	 * 
	 * @returns Heartbeat status information
	 */
	getStatus(): HeartbeatStatus {
		return {
			lastReceived: this.lastReceived,
			lastSent: this.lastSent,
			receivedCount: this.receivedCount,
			sentCount: this.sentCount,
			isActive: this.isActive,
			timeSinceLastHeartbeat: this.isActive 
				? Date.now() - this.lastReceived 
				: 0
		};
	}

	/**
	 * Check if connection is healthy
	 * 
	 * @returns True if heartbeats are active and recent
	 */
	isHealthy(): boolean {
		if (!this.isActive) return false;
		
		const timeSinceLastHeartbeat = Date.now() - this.lastReceived;
		return timeSinceLastHeartbeat < this.staleTimeout;
	}

	/**
	 * Check if connection is stale (no heartbeat for too long)
	 * 
	 * @returns True if connection is stale
	 */
	isStale(): boolean {
		if (!this.isActive) return false;

		const timeSinceLastHeartbeat = Date.now() - this.lastReceived;
		return timeSinceLastHeartbeat >= this.staleTimeout;
	}

	/**
	 * Get time since last heartbeat in milliseconds
	 * 
	 * @returns Milliseconds since last heartbeat
	 */
	getTimeSinceLastHeartbeat(): number {
		if (!this.isActive) return 0;
		return Date.now() - this.lastReceived;
	}

	/**
	 * Reset heartbeat counters and timers
	 */
	reset(): void {
		this.lastReceived = Date.now();
		this.lastSent = 0;
		this.receivedCount = 0;
		this.sentCount = 0;
	}

	/**
	 * Set stale timeout
	 * 
	 * @param timeout Timeout in milliseconds
	 */
	setStaleTimeout(timeout: number): void {
		this.staleTimeout = timeout;
	}

	/**
	 * Get stale timeout
	 * 
	 * @returns Timeout in milliseconds
	 */
	getStaleTimeout(): number {
		return this.staleTimeout;
	}

	/**
	 * Check for stale connection and invoke callback if needed
	 */
	private checkStaleConnection(): void {
		if (this.isStale()) {
			if (this.enableLogging) {
				console.warn(
					`[Heartbeat] Connection stale! ` +
					`No heartbeat for ${this.getTimeSinceLastHeartbeat()}ms ` +
					`(threshold: ${this.staleTimeout}ms)`
				);
			}

			// Invoke callback if set
			if (this.onStaleCallback) {
				try {
					this.onStaleCallback();
				} catch (error) {
					console.error('[Heartbeat] Error in stale callback:', error);
				}
			}
		}
	}

	/**
	 * Get debug information
	 */
	debug(): {
		isActive: boolean;
		isHealthy: boolean;
		isStale: boolean;
		receivedCount: number;
		sentCount: number;
		lastReceived: number;
		lastSent: number;
		timeSinceLastHeartbeat: number;
		staleTimeout: number;
	} {
		return {
			isActive: this.isActive,
			isHealthy: this.isHealthy(),
			isStale: this.isStale(),
			receivedCount: this.receivedCount,
			sentCount: this.sentCount,
			lastReceived: this.lastReceived,
			lastSent: this.lastSent,
			timeSinceLastHeartbeat: this.getTimeSinceLastHeartbeat(),
			staleTimeout: this.staleTimeout
		};
	}
}
