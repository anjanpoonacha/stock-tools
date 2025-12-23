/**
 * Persistent WebSocket Connection Manager
 * 
 * Manages long-lived WebSocket connections for the MIO Formulas section.
 * Connections stay open while user is on /mio-formulas/** pages and close
 * after an idle timeout when navigating away.
 * 
 * Features:
 * - Reference counting to prevent premature closure
 * - Idle timeout (5 minutes) for cleanup after inactivity
 * - Connection health monitoring with auto-reconnect
 * - Graceful shutdown on unmount
 * - Prevents memory leaks and orphan connections
 */

import { WebSocketConnectionPool } from './connectionPool';

interface ConnectionHealth {
	isHealthy: boolean;
	lastActivity: number;
	errorCount: number;
}

export class PersistentConnectionManager {
	private static instance: PersistentConnectionManager | null = null;
	
	private connectionPool: WebSocketConnectionPool | null = null;
	private jwtToken: string | null = null;
	private refCount: number = 0;
	private isActive: boolean = false;
	
	// Idle timeout (2 minutes)
	private readonly IDLE_TIMEOUT_MS = 2 * 60 * 1000;
	private idleTimer: NodeJS.Timeout | null = null;
	
	// Health monitoring
	private readonly HEALTH_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
	private healthCheckTimer: NodeJS.Timeout | null = null;
	private health: ConnectionHealth = {
		isHealthy: true,
		lastActivity: Date.now(),
		errorCount: 0,
	};
	
	// Reconnection
	private readonly MAX_RECONNECT_ATTEMPTS = 3;
	private readonly RECONNECT_BACKOFF_MS = 1000; // Start at 1 second
	private reconnectAttempts: number = 0;
	
	private constructor() {
	}
	
	/**
	 * Get singleton instance
	 */
	public static getInstance(): PersistentConnectionManager {
		if (!this.instance) {
			this.instance = new PersistentConnectionManager();
		}
		return this.instance;
	}
	
	/**
	 * Acquire connection manager (increment reference count)
	 * Should be called when making a request that needs persistent connections
	 * 
	 * @param jwtToken - JWT token for authentication (server-side only)
	 */
	public async acquire(jwtToken: string): Promise<void> {
		this.refCount++;
		
		// Cancel idle timer if it was running
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
		
		// Initialize on first acquire or if not active
		if (!this.isActive) {
			await this.initialize(jwtToken);
		} else if (jwtToken !== this.jwtToken) {
			// JWT token changed, reinitialize
			await this.closeAll();
			await this.initialize(jwtToken);
		}
	}
	
	/**
	 * Release connection manager (decrement reference count)
	 * Should be called when a component unmounts
	 */
	public release(): void {
		this.refCount = Math.max(0, this.refCount - 1);
		
		// Start idle timer when refCount reaches zero
		if (this.refCount === 0) {
			this.startIdleTimer();
		}
	}
	
	/**
	 * Initialize connection pool
	 */
	private async initialize(jwtToken: string): Promise<void> {
		
		this.jwtToken = jwtToken;
		this.isActive = true;
		
		// Create connection pool with persistence enabled
		this.connectionPool = new WebSocketConnectionPool(10, 10);
		this.connectionPool.enablePersistence();
		
		// Reset health
		this.health = {
			isHealthy: true,
			lastActivity: Date.now(),
			errorCount: 0,
		};
		this.reconnectAttempts = 0;
		
		// Start health monitoring
		this.startHealthMonitoring();
		
	}
	
	/**
	 * Start idle timeout timer
	 */
	private startIdleTimer(): void {
		
		this.idleTimer = setTimeout(() => {
			this.closeAll();
		}, this.IDLE_TIMEOUT_MS);
	}
	
	/**
	 * Start health monitoring
	 */
	private startHealthMonitoring(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
		}
		
		this.healthCheckTimer = setInterval(() => {
			this.performHealthCheck();
		}, this.HEALTH_CHECK_INTERVAL_MS);
		
	}
	
	/**
	 * Stop health monitoring
	 */
	private stopHealthMonitoring(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = null;
		}
	}
	
	/**
	 * Perform health check
	 */
	private performHealthCheck(): void {
		const now = Date.now();
		const timeSinceLastActivity = now - this.health.lastActivity;
		
		// Check if connection is stale (no activity for 2 minutes)
		const STALE_THRESHOLD_MS = 2 * 60 * 1000;
		if (timeSinceLastActivity > STALE_THRESHOLD_MS && this.isActive) {
			this.health.isHealthy = false;
		}
		
		// If unhealthy and we have active references, attempt reconnect
		if (!this.health.isHealthy && this.refCount > 0) {
			this.attemptReconnect();
		}
	}
	
	/**
	 * Attempt to reconnect with exponential backoff
	 */
	private async attemptReconnect(): Promise<void> {
		if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
			return;
		}
		
		this.reconnectAttempts++;
		const backoffMs = this.RECONNECT_BACKOFF_MS * Math.pow(2, this.reconnectAttempts - 1);
		
		
		await new Promise(resolve => setTimeout(resolve, backoffMs));
		
		try {
			await this.closeAll();
			if (this.jwtToken) {
				await this.initialize(this.jwtToken);
				this.reconnectAttempts = 0; // Reset on success
			}
		} catch (error) {
			this.health.errorCount++;
		}
	}
	
	/**
	 * Get connection pool (for making requests)
	 */
	public getConnectionPool(): WebSocketConnectionPool {
		if (!this.connectionPool || !this.isActive) {
			throw new Error('PersistentConnectionManager not initialized. Call acquire() first.');
		}
		
		// Update last activity time
		this.health.lastActivity = Date.now();
		
		return this.connectionPool;
	}
	
	/**
	 * Check if manager is active
	 */
	public isManagerActive(): boolean {
		return this.isActive && this.connectionPool !== null;
	}
	
	/**
	 * Check if connections are healthy
	 */
	public isHealthy(): boolean {
		return this.health.isHealthy;
	}
	
	/**
	 * Get current reference count
	 */
	public getRefCount(): number {
		return this.refCount;
	}
	
	/**
	 * Get health status
	 */
	public getHealth(): ConnectionHealth {
		return { ...this.health };
	}
	
	/**
	 * Close all connections and cleanup
	 */
	public async closeAll(): Promise<void> {
		
		this.isActive = false;
		
		// Stop health monitoring
		this.stopHealthMonitoring();
		
		// Cancel idle timer
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
		
		// Close connection pool
		if (this.connectionPool) {
			await this.connectionPool.closeAllPersistent();
			this.connectionPool = null;
		}
		
		this.jwtToken = null;
		
	}
	
	/**
	 * Force cleanup (called on window unload)
	 */
	public forceCleanup(): void {
		this.refCount = 0;
		this.closeAll();
	}
	
	/**
	 * Get statistics
	 */
	public getStats() {
		return {
			isActive: this.isActive,
			refCount: this.refCount,
			health: this.health,
			reconnectAttempts: this.reconnectAttempts,
			hasIdleTimer: this.idleTimer !== null,
			poolStats: this.connectionPool?.getStats() || null,
		};
	}
}

// Export singleton instance getter
export const getPersistentConnectionManager = () => PersistentConnectionManager.getInstance();
