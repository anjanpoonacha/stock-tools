/**
 * TradingView WebSocket Connection Pool
 * 
 * Manages a pool of persistent WebSocket connections to TradingView
 * for efficient batch processing of chart data requests.
 * 
 * Benefits:
 * - Reuses connections (no repeated handshakes)
 * - Reduces server load
 * - 3-5x faster than creating new connections
 * - Processes requests in batches over same connection
 */

import { BaseWebSocketClient } from './baseWebSocketClient';
import { createSymbolSpec } from './protocol';
import type { OHLCVBar, SymbolMetadata, StudyData } from './types';
import { getCVDConfig, CVD_PINE_FEATURES } from './cvdConfigService';

interface ChartRequest {
	symbol: string;
	resolution: string;
	barsCount: number;
	cvdEnabled?: boolean;
	cvdAnchorPeriod?: string;
	cvdTimeframe?: string;
	sessionId?: string;
	sessionIdSign?: string;
	resolve: (result: ChartResult) => void;
	reject: (error: Error) => void;
}

interface ChartResult {
	bars: OHLCVBar[];
	metadata: Partial<SymbolMetadata>;
	indicators?: {
		cvd?: StudyData;
	};
}

/**
 * Pooled WebSocket client that can handle multiple chart requests
 * Extends BaseWebSocketClient to reuse connection infrastructure
 */
class PooledWebSocketClient extends BaseWebSocketClient {
	private requestCount = 0;  // Track number of requests for turnaroundId
	private seriesId = 'sds_1';  // Series ID stays constant across requests
	private readonly MAX_REQUESTS_PER_CONNECTION = 20;  // Refresh after 20 requests to prevent staleness
	
	constructor(jwtToken: string) {
		super({ jwtToken });
	}
	
	/**
	 * Check if connection should be refreshed (too many requests)
	 */
	public shouldRefresh(): boolean {
		return this.requestCount >= this.MAX_REQUESTS_PER_CONNECTION;
	}
	
	/**
	 * Get current request count
	 */
	public getRequestCount(): number {
		return this.requestCount;
	}
	
	/**
	 * Initialize the connection (called once per connection)
	 */
	async initialize(): Promise<void> {
		await this.connect();
		await this.authenticate();
		// Call protected methods via the template method pattern
		await this.requestHistoricalBars();
	}
	
	/**
	 * Fetch chart data for a single request (reuses existing connection)
	 */
	async fetchChartData(request: ChartRequest): Promise<ChartResult> {
		try {
			// Clear previous data before new request
			this.clearCollectedData();
			
			// Increment request count
			this.requestCount++;
			const symbolSessionId = `sds_sym_${this.requestCount}`;
			const turnaroundId = `s${this.requestCount}`;
			
			// Create symbol spec
			const symbolSpec = createSymbolSpec(request.symbol, 'dividends');
			
			// Resolve symbol with custom symbolSessionId
			await this.resolveSymbol(symbolSpec, symbolSessionId);
			
			// First request: create_series, subsequent: modify_series
			if (this.requestCount === 1) {
				// First request: create the series
				await this.createSeries(request.resolution, request.barsCount);
				console.log(`[PooledClient] Created series for ${request.symbol} (${turnaroundId})`);
			} else {
				// Subsequent requests: modify existing series
				await this.modifySeries(
					this.seriesId,
					turnaroundId,
					symbolSessionId,
					request.resolution
				);
				console.log(`[PooledClient] Modified series for ${request.symbol} (${turnaroundId})`);
			}
			
		// Request CVD if enabled
		if (request.cvdEnabled) {
			const cvdId = `cvd_${this.requestCount}`;
			
			// Validate session credentials
			if (!request.sessionId || !request.sessionIdSign) {
				console.error('[ConnectionPool] ⚠️ CVD requested but credentials missing - skipping CVD', {
					hasSessionId: !!request.sessionId,
					hasSessionIdSign: !!request.sessionIdSign
				});
			} else {
				try {
					console.log('[ConnectionPool] 🔍 CVD Diagnostic: fetching dynamic CVD config');
					
					// Fetch dynamic CVD config using session credentials
					const fetchedConfig = await getCVDConfig(request.sessionId, request.sessionIdSign);
					
					const cvdConfig = {
						text: fetchedConfig.text,
						pineId: fetchedConfig.pineId,
						pineVersion: fetchedConfig.pineVersion,
						pineFeatures: CVD_PINE_FEATURES,
						in_0: { v: request.cvdAnchorPeriod || '3M', f: true, t: 'resolution' },
						in_1: { v: !!request.cvdTimeframe, f: true, t: 'bool' },
						in_2: { v: request.cvdTimeframe || '', f: true, t: 'resolution' },
						__profile: { v: false, f: true, t: 'bool' }
					};
					
					console.log(`[ConnectionPool] 🔍 CVD Diagnostic: creating CVD study in pool`, {
						cvdId,
						textLength: fetchedConfig.text.length,
						pineVersion: fetchedConfig.pineVersion,
						source: fetchedConfig.source
					});
					
					await this.createStudy(cvdId, 'Script@tv-scripting-101!', cvdConfig);
				} catch (error) {
					console.error('[ConnectionPool] ❌ Failed to fetch CVD config - skipping CVD:', error instanceof Error ? error.message : String(error));
				}
			}
		}
			
			// Wait for data
			// Both create_series and modify_series take ~3-5 seconds for data
			// For high bar counts (1000-2000) with CVD, allow more time
			const waitTime = request.cvdEnabled && request.barsCount > 500 ? 8000 : 5000;
			await this.waitForData(waitTime);
			
			// Get results
			const bars = this.getBars();
			const metadata = this.getMetadata();
			const cvdId = `cvd_${this.requestCount}`;
			const cvd = this.getStudy(cvdId);
			
			console.log(`[PooledClient] CVD Study Retrieved:`, {
				cvdId,
				hasCvd: !!cvd,
				cvdValuesCount: cvd?.values?.length || 0,
				firstCvdBar: cvd?.values?.[0],
				lastCvdBar: cvd?.values?.[cvd.values.length - 1]
			});
			
			console.log(`[PooledClient] Results: ${bars.length} bars, metadata=${JSON.stringify(metadata).substring(0, 100)}`);
			
			// Validate bars received
			if (bars.length === 0) {
				console.error(`[PooledClient] ❌ No bars received! Request #${this.requestCount}, symbol=${request.symbol}`);
				console.error(`[PooledClient] Debug: chartSessionId=${this.chartSessionId}, seriesId=${this.seriesId}`);
				console.error(`[PooledClient] Possible causes: invalid symbol, delisted stock, or data unavailable for resolution`);
				throw new Error(`No bars received for symbol ${request.symbol}. Symbol may be invalid or delisted.`);
			}
			
			console.log(`[PooledClient] ✅ Collected ${bars.length} bars for ${request.symbol}`);
			
			return {
				bars,
				metadata,
				indicators: cvd ? { cvd } : undefined
			};
		} catch (error) {
			console.error(`[PooledClient] ❌ Error fetching ${request.symbol}:`, error);
			throw error;
		}
	}
	
	/**
	 * Clear collected data from base client
	 * Accesses protected properties via inheritance
	 */
	private clearCollectedData(): void {
		// Access protected properties from BaseWebSocketClient (inherited)
		this.bars = [];
		this.symbolMetadata = {};
		this.studies = new Map();
		this['expectedStudyCount'] = 0; // Reset study counter for next request
		
		console.log(`[PooledClient] Cleared data (request #${this.requestCount + 1})`);
	}
	
	/**
	 * Template method implementation (creates chart and quote sessions)
	 */
	protected async requestHistoricalBars(): Promise<void> {
		// Initialize chart and quote sessions (called once during connection setup)
		console.log('[PooledClient] Creating chart session...');
		await this.createChartSession();
		await this.createQuoteSession();
		console.log('[PooledClient] Chart session created');
	}
	
}

/**
 * WebSocket Connection Pool
 * Manages multiple persistent connections and processes requests in parallel
 */
export class WebSocketConnectionPool {
	private connections: PooledWebSocketClient[] = [];
	private maxConnections: number;
	private requestsPerConnection: number;
	private pendingRequests: Map<string, ChartRequest[]> = new Map();
	private processingTimer: NodeJS.Timeout | null = null;
	private readonly BATCH_DELAY_MS = 100; // Wait 100ms to accumulate requests
	
	// Persistence mode
	private persistentMode: boolean = false;
	private persistentConnections: PooledWebSocketClient[] = [];
	
	constructor(maxConnections = 10, requestsPerConnection = 10) {
		this.maxConnections = maxConnections;
		this.requestsPerConnection = requestsPerConnection;
	}
	
	/**
	 * Enable persistence mode - connections will not be automatically closed
	 */
	public enablePersistence(): void {
		console.log('[ConnectionPool] Enabling persistence mode');
		this.persistentMode = true;
	}
	
	/**
	 * Disable persistence mode - connections will be closed after use
	 */
	public disablePersistence(): void {
		console.log('[ConnectionPool] Disabling persistence mode');
		this.persistentMode = false;
		this.closeAllPersistent();
	}
	
	/**
	 * Fetch chart data for a single symbol
	 * Accumulates requests and processes them in parallel batches
	 */
	async fetchChartData(
		jwtToken: string,
		symbol: string,
		resolution: string,
		barsCount: number,
		options?: {
			cvdEnabled?: boolean;
			cvdAnchorPeriod?: string;
			cvdTimeframe?: string;
			sessionId?: string;
			sessionIdSign?: string;
		}
	): Promise<ChartResult> {
		return new Promise((resolve, reject) => {
			// Add request to pending queue
			if (!this.pendingRequests.has(jwtToken)) {
				this.pendingRequests.set(jwtToken, []);
			}
			
			this.pendingRequests.get(jwtToken)!.push({
				symbol,
				resolution,
				barsCount,
				cvdEnabled: options?.cvdEnabled,
				cvdAnchorPeriod: options?.cvdAnchorPeriod,
				cvdTimeframe: options?.cvdTimeframe,
				sessionId: options?.sessionId,
				sessionIdSign: options?.sessionIdSign,
				resolve,
				reject,
			});
			
			// Schedule batch processing (debounced)
			if (this.processingTimer) {
				clearTimeout(this.processingTimer);
			}
			
			this.processingTimer = setTimeout(() => {
				this.processPendingRequests(jwtToken).catch(err => {
					console.error('[ConnectionPool] Error processing pending requests:', err);
				});
			}, this.BATCH_DELAY_MS);
		});
	}
	
	/**
	 * Process all pending requests in parallel batches
	 */
	private async processPendingRequests(jwtToken: string): Promise<void> {
		const requests = this.pendingRequests.get(jwtToken);
		if (!requests || requests.length === 0) return;
		
		// Clear pending queue
		this.pendingRequests.delete(jwtToken);
		
		console.log(`[ConnectionPool] Processing ${requests.length} accumulated requests in parallel`);
		
		// Convert to batch format
		const batchRequests = requests.map(r => ({
			symbol: r.symbol,
			resolution: r.resolution,
			barsCount: r.barsCount,
			cvdEnabled: r.cvdEnabled,
			cvdAnchorPeriod: r.cvdAnchorPeriod,
			cvdTimeframe: r.cvdTimeframe,
			sessionId: r.sessionId,
			sessionIdSign: r.sessionIdSign
		}));
		
		// Process in parallel
		const results = await this.fetchBatch(jwtToken, batchRequests);
		
		// Resolve/reject individual promises
		for (let i = 0; i < requests.length; i++) {
			const request = requests[i];
			const result = results[i];
			
			if (result.error) {
				request.reject(new Error(result.error));
			} else if (result.result) {
				request.resolve(result.result);
			} else {
				request.reject(new Error('No result returned'));
			}
		}
	}
	
	/**
	 * Batch fetch multiple symbols in parallel
	 * 
	 * Splits requests across multiple WebSocket connections for maximum speed
	 */
	async fetchBatch(
		jwtToken: string,
		requests: Array<{
			symbol: string;
			resolution: string;
			barsCount: number;
			cvdEnabled?: boolean;
			cvdAnchorPeriod?: string;
			cvdTimeframe?: string;
			sessionId?: string;
			sessionIdSign?: string;
		}>
	): Promise<Array<{ symbol: string; result?: ChartResult; error?: string }>> {
		const startTime = Date.now();
		console.log(`[ConnectionPool] Batch fetch: ${requests.length} symbols across ${Math.min(this.maxConnections, Math.ceil(requests.length / this.requestsPerConnection))} connections`);
		
		// Split requests into batches for parallel processing
		const batchSize = this.requestsPerConnection;
		const batches: typeof requests[] = [];
		for (let i = 0; i < requests.length; i += batchSize) {
			batches.push(requests.slice(i, i + batchSize));
		}
		
		// Limit number of parallel connections
		const connectionsNeeded = Math.min(this.maxConnections, batches.length);
		console.log(`[ConnectionPool] Using ${connectionsNeeded} parallel connections (${batchSize} symbols each)`);
		
		// Process batches in parallel
		const batchPromises = batches.map(async (batch, batchIndex) => {
			// REUSE existing persistent connection if available, otherwise create new
			let connection: PooledWebSocketClient;
			let isExistingConnection = false;
			let needsRefresh = false;
			
			if (this.persistentMode && this.persistentConnections.length > 0) {
				// Check if existing connection should be refreshed
				const existingConnection = this.persistentConnections[0];
				if (existingConnection.shouldRefresh()) {
					needsRefresh = true;
					console.log(`[ConnectionPool] 🔄 Connection stale (${existingConnection.getRequestCount()} requests), refreshing...`);
					// Remove stale connection
					this.persistentConnections.shift();
					existingConnection.disconnect();
					// Create fresh connection
					connection = new PooledWebSocketClient(jwtToken);
				} else {
					// Reuse healthy connection
					connection = existingConnection;
					isExistingConnection = true;
					console.log(`[ConnectionPool] ♻️ Reusing persistent connection (${existingConnection.getRequestCount()} requests)`);
				}
			} else {
				// Create new connection
				connection = new PooledWebSocketClient(jwtToken);
				console.log(`[ConnectionPool] 🆕 Creating new connection for batch ${batchIndex + 1}`);
			}
			
			try {
				// Only initialize if it's a new connection or being refreshed
				if (!isExistingConnection || needsRefresh) {
					const connStart = Date.now();
					await connection.initialize();
					console.log(`[ConnectionPool] Connection ${batchIndex + 1} established in ${Date.now() - connStart}ms`);
				}
				
				// Process symbols on this connection sequentially (using modify_series)
				const results: Array<{ symbol: string; result?: ChartResult; error?: string }> = [];
				
				for (const req of batch) {
					try {
						const reqStart = Date.now();
						const result = await connection.fetchChartData({
							symbol: req.symbol,
							resolution: req.resolution,
							barsCount: req.barsCount,
							cvdEnabled: req.cvdEnabled,
							cvdAnchorPeriod: req.cvdAnchorPeriod,
							cvdTimeframe: req.cvdTimeframe,
							sessionId: req.sessionId,
							sessionIdSign: req.sessionIdSign,
							resolve: () => {},
							reject: () => {},
						});
						
						console.log(`[ConnectionPool] ✅ ${req.symbol} in ${Date.now() - reqStart}ms (conn ${batchIndex + 1})`);
						results.push({ symbol: req.symbol, result });
					} catch (error) {
						console.error(`[ConnectionPool] ❌ ${req.symbol}:`, error);
						results.push({ 
							symbol: req.symbol, 
							error: error instanceof Error ? error.message : String(error) 
						});
					}
				}
				
				return results;
			} finally {
				// In persistent mode, keep connections open (but only add if it's new or refreshed)
				if (this.persistentMode && (!isExistingConnection || needsRefresh)) {
					this.persistentConnections.push(connection);
					console.log(`[ConnectionPool] Keeping connection ${batchIndex + 1} alive (persistent mode)`);
				} else if (!this.persistentMode) {
					connection.disconnect();
				}
				// If reusing, connection stays in array - no action needed
			}
		});
		
		// Wait for all batches to complete
		const allResults = await Promise.all(batchPromises);
		const flatResults = allResults.flat();
		
		const duration = Date.now() - startTime;
		const successful = flatResults.filter(r => r.result).length;
		
		console.log(`[ConnectionPool] Batch complete: ${successful}/${requests.length} successful in ${duration}ms (${Math.round(duration / requests.length)}ms avg)`);
		
		return flatResults;
	}
	
	/**
	 * Close all connections in the pool
	 */
	async closeAll(): Promise<void> {
		console.log('[ConnectionPool] Closing all connections...');
		for (const connection of this.connections) {
			try {
				connection.disconnect();
			} catch (err) {
				console.warn(`[ConnectionPool] Error closing connection:`, err);
			}
		}
		this.connections = [];
	}
	
	/**
	 * Close all persistent connections
	 */
	async closeAllPersistent(): Promise<void> {
		console.log(`[ConnectionPool] Closing ${this.persistentConnections.length} persistent connections...`);
		for (const connection of this.persistentConnections) {
			try {
				connection.disconnect();
			} catch (err) {
				console.warn(`[ConnectionPool] Error closing persistent connection:`, err);
			}
		}
		this.persistentConnections = [];
		this.persistentMode = false;
	}
	
	/**
	 * Get pool statistics
	 */
	getStats() {
		return {
			maxConnections: this.maxConnections,
			requestsPerConnection: this.requestsPerConnection,
			persistentMode: this.persistentMode,
			persistentConnections: this.persistentConnections.length,
		};
	}
}

// Global singleton pool
let globalPool: WebSocketConnectionPool | null = null;

/**
 * Get or create the global connection pool
 */
export function getConnectionPool(): WebSocketConnectionPool {
	if (!globalPool) {
		// Default: 10 parallel connections, 10 requests per connection
		// This allows 100 symbols to be fetched in parallel (10 connections × 10 symbols each)
		globalPool = new WebSocketConnectionPool(10, 10);
	}
	return globalPool;
}

/**
 * Close the global connection pool
 */
export async function closeConnectionPool(): Promise<void> {
	if (globalPool) {
		await globalPool.closeAll();
		globalPool = null;
	}
}
