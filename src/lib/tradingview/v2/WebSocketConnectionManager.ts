/**
 * WebSocketConnectionManager - Connection Pool for v2 Architecture
 * 
 * Manages multiple v2 WebSocketConnection instances to support concurrent requests
 * (e.g., dual layout with different resolutions).
 * 
 * KEY DESIGN DECISIONS:
 * - Each v2 connection handles ONE symbol at a time (by design)
 * - For dual layout: Create 2 separate connections
 * - Connections are reused across requests (persistent)
 * - Automatic cleanup on idle timeout
 * 
 * USAGE:
 * ```typescript
 * const manager = await WebSocketConnectionManager.forUser(jwtToken, sessionId, sessionIdSign, userId);
 * 
 * // Fetch data (automatically assigns to available connection)
 * const data = await manager.fetchChartData({
 *   symbol: 'NSE:RELIANCE',
 *   resolution: '1D',
 *   barsCount: 300,
 *   cvdEnabled: true,
 *   cvdAnchorPeriod: '3M'
 * });
 * 
 * // Cleanup (call when user logs out or session ends)
 * await manager.dispose();
 * ```
 */

import { WebSocketConnection } from './WebSocketConnection';
import { TradingViewCVDProvider, MockCVDProvider } from './providers/CVDConfigProvider';
import type { CVDConfigProvider } from './providers/CVDConfigProvider';
import type { SymbolRequest } from './core/types';

export interface ConnectionManagerConfig {
	/** JWT token for TradingView authentication */
	jwtToken: string;
	
	/** Session ID for CVD requests */
	sessionId?: string;
	
	/** Session ID signature for CVD requests */
	sessionIdSign?: string;
	
	/** User ID for CVD requests */
	userId?: number;
	
	/** Maximum number of concurrent connections (default: 2 for dual layout) */
	maxConnections?: number;
	
	/** Connection timeout in milliseconds (default: 30000) */
	connectionTimeout?: number;
	
	/** Data fetch timeout in milliseconds (default: 15000) */
	dataTimeout?: number;
	
	/** CVD timeout in milliseconds (default: 45000) */
	cvdTimeout?: number;
	
	/** Enable debug logging (default: false) */
	enableLogging?: boolean;
	
	/** Use mock CVD provider for testing (default: false) */
	useMockCVD?: boolean;
}

export interface FetchChartDataRequest {
	symbol: string;
	resolution: string;
	barsCount: number;
	cvdEnabled?: boolean;
	cvdAnchorPeriod?: string;
	cvdTimeframe?: string;
}

export interface FetchChartDataResult {
	bars: Array<{
		time: number;
		open: number;
		high: number;
		low: number;
		close: number;
		volume: number;
	}>;
	metadata: {
		symbol: string;
		description?: string;
		exchange?: string;
		type?: string;
	};
	indicators?: {
		cvd?: {
			studyId: string;
			studyName: string;
			config: any;
			values: Array<{
				time: number;
				values: number[];
			}>;
		};
	};
}

interface ConnectionSlot {
	connection: WebSocketConnection;
	inUse: boolean;
	currentSymbol: string | null;
	lastUsed: number;
}

/**
 * Connection manager for v2 WebSocket architecture
 * 
 * Maintains a pool of v2 connections to support concurrent requests.
 */
export class WebSocketConnectionManager {
	private config: Required<ConnectionManagerConfig>;
	private cvdProvider: CVDConfigProvider;
	private slots: ConnectionSlot[] = [];
	private disposed = false;
	private idleCheckInterval: NodeJS.Timeout | null = null;
	
	// Singleton instances per JWT token
	private static instances = new Map<string, WebSocketConnectionManager>();
	
	private constructor(config: ConnectionManagerConfig) {
		// Fill in defaults
		this.config = {
			jwtToken: config.jwtToken,
			sessionId: config.sessionId || '',
			sessionIdSign: config.sessionIdSign || '',
			userId: config.userId || 0,
			maxConnections: config.maxConnections || 2, // Default: 2 for dual layout
			connectionTimeout: config.connectionTimeout || 30000,
			dataTimeout: config.dataTimeout || 15000,
			cvdTimeout: config.cvdTimeout || 45000,
			enableLogging: config.enableLogging || false,
			useMockCVD: config.useMockCVD || false
		};
		
		// Create CVD provider
		if (this.config.useMockCVD) {
			this.cvdProvider = new MockCVDProvider();
		} else {
			this.cvdProvider = new TradingViewCVDProvider(
				this.config.sessionId,
				this.config.sessionIdSign
			);
		}
		
		// Start idle connection cleanup (every 5 minutes)
		this.idleCheckInterval = setInterval(() => {
			this.cleanupIdleConnections();
		}, 5 * 60 * 1000);
		
		if (this.config.enableLogging) {
			console.log('[ConnectionManager] Created with config:', {
				maxConnections: this.config.maxConnections,
				connectionTimeout: this.config.connectionTimeout,
				cvdTimeout: this.config.cvdTimeout
			});
		}
	}
	
	/**
	 * Get or create connection manager for a user
	 * 
	 * Uses singleton pattern - returns existing manager if already created for this JWT.
	 */
	static async forUser(
		jwtToken: string,
		sessionId?: string,
		sessionIdSign?: string,
		userId?: number,
		options?: Partial<ConnectionManagerConfig>
	): Promise<WebSocketConnectionManager> {
		// Check if manager already exists for this token
		let manager = WebSocketConnectionManager.instances.get(jwtToken);
		
		if (!manager) {
			// Create new manager
			manager = new WebSocketConnectionManager({
				jwtToken,
				sessionId,
				sessionIdSign,
				userId,
				...options
			});
			
			WebSocketConnectionManager.instances.set(jwtToken, manager);
		}
		
		return manager;
	}
	
	/**
	 * Fetch chart data using connection pool
	 * 
	 * Automatically assigns request to an available connection.
	 */
	async fetchChartData(request: FetchChartDataRequest): Promise<FetchChartDataResult> {
		if (this.disposed) {
			throw new Error('ConnectionManager has been disposed');
		}
		
		// Find or create available connection
		const slot = await this.getAvailableConnection();
		
		try {
			// Mark as in use
			slot.inUse = true;
			slot.currentSymbol = request.symbol;
			slot.lastUsed = Date.now();
			
			// Build symbol request
			const symbolRequest: SymbolRequest = {
				symbol: request.symbol,
				resolution: request.resolution,
				barsCount: request.barsCount,
				indicators: request.cvdEnabled ? [{
					type: 'cvd',
					config: {
						anchorPeriod: request.cvdAnchorPeriod || '3M',
						timeframe: request.cvdTimeframe
					}
				}] : undefined
			};
			
			// Fetch data
			const data = await slot.connection.fetchSymbol(symbolRequest);
			
			// Convert to FetchChartDataResult format
			const result: FetchChartDataResult = {
				bars: data.bars,
				metadata: {
					symbol: (data.metadata.symbol as string | undefined) || data.symbol,
					description: data.metadata.description as string | undefined,
					exchange: data.metadata.exchange as string | undefined,
					type: data.metadata.type as string | undefined
				}
			};
			
			// Convert indicators from Map<string, IndicatorData> to expected format
			if (data.indicators && data.indicators.size > 0) {
				const cvdIndicator = data.indicators.get('cvd');
				if (cvdIndicator) {
					// IndicatorData has bars array with time/values
					// Convert to StudyData format (StudyBar[] with time + values)
					// 
					// BUG FIX: Use bar.time directly from CVD data, NOT data.bars[index]
					// CVD bars already have correct timestamps from MessageHandlerService.ts
					// Using index mapping was causing 1970 dates when CVD has more bars than OHLCV
					result.indicators = {
						cvd: {
							studyId: cvdIndicator.indicatorId,
							studyName: 'CVD',
							config: cvdIndicator.config as any, // Config is Record<string, unknown>, matches StudyConfig
							values: cvdIndicator.bars.map(bar => ({
								time: bar.time, // Use CVD bar's own timestamp
								values: bar.values
							}))
						}
					};
				}
			}
			
			return result;
		} finally {
			// Mark as available
			slot.inUse = false;
		}
	}
	
	/**
	 * Get an available connection slot
	 * 
	 * Strategy:
	 * 1. Prefer idle connections (not in use)
	 * 2. Reuse connection with same symbol (no series cleanup needed)
	 * 3. Create new connection if under maxConnections
	 * 4. Wait for a connection to become available
	 */
	private async getAvailableConnection(): Promise<ConnectionSlot> {
		// 1. Check for idle connections
		const idleSlot = this.slots.find(s => !s.inUse);
		if (idleSlot) {
			return idleSlot;
		}
		
		// 2. Create new connection if under limit
		if (this.slots.length < this.config.maxConnections) {
			const newSlot = await this.createConnection();
			this.slots.push(newSlot);
			return newSlot;
		}
		
		// 3. Wait for a connection to become available
		// Poll every 100ms, timeout after 30s
		const maxWaitTime = 30000;
		const pollInterval = 100;
		const startTime = Date.now();
		
		while (Date.now() - startTime < maxWaitTime) {
			const freeSlot = this.slots.find(s => !s.inUse);
			if (freeSlot) {
				return freeSlot;
			}
			
			// Wait before next poll
			await new Promise(resolve => setTimeout(resolve, pollInterval));
		}
		
		throw new Error('Timeout waiting for available connection (all connections busy)');
	}
	
	/**
	 * Create a new WebSocket connection
	 */
	private async createConnection(): Promise<ConnectionSlot> {
		if (this.config.enableLogging) {
			console.log(`[ConnectionManager] Creating connection #${this.slots.length + 1}/${this.config.maxConnections}`);
		}
		
		// Create v2 connection
		const connection = new WebSocketConnection(
			{
				jwtToken: this.config.jwtToken,
				connectionTimeout: this.config.connectionTimeout,
				dataTimeout: this.config.dataTimeout,
				enableLogging: this.config.enableLogging
			},
			this.cvdProvider,
			undefined // wsFactory - use default
		);
		
		// Set CVD timeout
		connection.setRequestTimeout('create_study', this.config.cvdTimeout);
		
		// Initialize connection
		await connection.initialize();
		
		return {
			connection,
			inUse: false,
			currentSymbol: null,
			lastUsed: Date.now()
		};
	}
	
	/**
	 * Cleanup idle connections (called periodically)
	 * 
	 * Closes connections that haven't been used in the last 10 minutes.
	 */
	private async cleanupIdleConnections(): Promise<void> {
		const idleTimeout = 10 * 60 * 1000; // 10 minutes
		const now = Date.now();
		
		const idleSlots = this.slots.filter(
			s => !s.inUse && (now - s.lastUsed) > idleTimeout
		);
		
		if (idleSlots.length === 0) {
			return;
		}
		
		if (this.config.enableLogging) {
			console.log(`[ConnectionManager] Cleaning up ${idleSlots.length} idle connections`);
		}
		
		// Dispose idle connections
		await Promise.all(
			idleSlots.map(async slot => {
				await slot.connection.dispose();
			})
		);
		
		// Remove from slots array
		this.slots = this.slots.filter(s => !idleSlots.includes(s));
	}
	
	/**
	 * Get connection statistics
	 */
	getStats() {
		return {
			totalConnections: this.slots.length,
			maxConnections: this.config.maxConnections,
			activeConnections: this.slots.filter(s => s.inUse).length,
			idleConnections: this.slots.filter(s => !s.inUse).length,
			slots: this.slots.map((s, i) => ({
				index: i,
				inUse: s.inUse,
				currentSymbol: s.currentSymbol,
				lastUsed: new Date(s.lastUsed).toISOString()
			}))
		};
	}
	
	/**
	 * Dispose all connections and cleanup
	 */
	async dispose(): Promise<void> {
		if (this.disposed) {
			return;
		}
		
		this.disposed = true;
		
		// Clear idle check interval
		if (this.idleCheckInterval) {
			clearInterval(this.idleCheckInterval);
			this.idleCheckInterval = null;
		}
		
		// Dispose all connections
		await Promise.all(
			this.slots.map(slot => slot.connection.dispose())
		);
		
		this.slots = [];
		
		// Remove from singleton map
		WebSocketConnectionManager.instances.delete(this.config.jwtToken);
		
		if (this.config.enableLogging) {
			console.log('[ConnectionManager] Disposed');
		}
	}
	
	/**
	 * Global cleanup - dispose all managers
	 */
	static async disposeAll(): Promise<void> {
		const managers = Array.from(WebSocketConnectionManager.instances.values());
		await Promise.all(managers.map(m => m.dispose()));
		WebSocketConnectionManager.instances.clear();
	}
}
