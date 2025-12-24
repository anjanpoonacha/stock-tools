/**
 * Request Tracker
 * 
 * Tracks pending requests and matches responses.
 * Supports request cancellation for symbol switching.
 * 
 * KEY FEATURES FOR CVD:
 * - Cancel previous symbol's requests when switching
 * - Separate timeouts for OHLCV vs CVD data
 * - Request deduplication
 * 
 * Use Case: When user switches from RELIANCE to TCS:
 * 1. Cancel pending RELIANCE requests (including slow CVD)
 * 2. Start TCS requests immediately
 * 3. Ignore any late RELIANCE responses
 */

import type { PendingRequest } from '../core/types';
import { RequestCancelledError, DataTimeoutError, CVDTimeoutError } from '../errors';

/**
 * Request type for timeout configuration
 */
export type RequestType = 'resolve_symbol' | 'create_series' | 'modify_series' | 'create_study';

/**
 * Request configuration with timeout
 */
export interface RequestConfig {
	type: RequestType;
	params: unknown[];
	timeout: number;
	isCVD?: boolean; // Special handling for CVD requests
	symbolId?: string; // For grouping requests by symbol
	turnaroundId?: string; // For matching responses to specific requests (race condition fix)
}

/**
 * Request tracker for managing pending WebSocket requests
 */
export class RequestTracker {
	private pendingRequests: Map<string, PendingRequest> = new Map();
	private requestIdCounter: number = 0;
	
	// Maximum number of pending requests to prevent memory leak
	private readonly MAX_PENDING_REQUESTS = 100;
	
	// Default timeouts (configurable)
	private defaultTimeouts: Record<RequestType, number> = {
		resolve_symbol: 5000,    // 5s for symbol resolution
		create_series: 15000,    // 15s for OHLCV data
		modify_series: 15000,    // 15s for OHLCV data
		create_study: 30000      // 30s for CVD (can be slower)
	};

	/**
	 * Create a new pending request
	 * 
	 * @param config Request configuration
	 * @returns Request ID and promise
	 * 
	 * @example
	 * ```typescript
	 * const { requestId, promise } = tracker.createRequest({
	 *   type: 'create_study',
	 *   params: [...],
	 *   timeout: 30000,
	 *   isCVD: true,
	 *   symbolId: 'NSE:RELIANCE'
	 * });
	 * 
	 * // Send request to server...
	 * 
	 * const result = await promise; // Waits for response or timeout
	 * ```
	 */
	createRequest<T = unknown>(config: RequestConfig): {
		requestId: string;
		promise: Promise<T>;
	} {
		// ✅ Check if queue is full before accepting new requests
		if (this.pendingRequests.size >= this.MAX_PENDING_REQUESTS) {
			throw new Error(
				`Request queue full (${this.pendingRequests.size}/${this.MAX_PENDING_REQUESTS}). ` +
				`Connection overloaded, please retry later.`
			);
		}
		
		const requestId = this.generateRequestId();
		const timeout = config.timeout || this.defaultTimeouts[config.type];

		let timeoutHandle!: NodeJS.Timeout;
		let resolveFunc!: (value: T) => void;
		let rejectFunc!: (error: Error) => void;

		const promise = new Promise<T>((resolve, reject) => {
			resolveFunc = resolve;
			rejectFunc = reject;

			// Set timeout
			timeoutHandle = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				
				// Use CVD-specific error if applicable
				if (config.isCVD) {
					const barsCount = this.extractBarsCountFromParams(config.params);
					reject(new CVDTimeoutError(timeout, barsCount));
				} else {
					reject(new DataTimeoutError(config.type, timeout));
				}
			}, timeout);
		});

		// Store pending request
		this.pendingRequests.set(requestId, {
			id: requestId,
			type: config.type,
			params: config.params,
			sentAt: Date.now(),
			resolve: resolveFunc,
			reject: rejectFunc,
			timeout: timeoutHandle,
			symbolId: config.symbolId,
			isCVD: config.isCVD,
			turnaroundId: config.turnaroundId
		} as PendingRequest & { symbolId?: string; isCVD?: boolean; turnaroundId?: string });

		return { requestId, promise };
	}

	/**
	 * Resolve a pending request
	 * 
	 * @param requestId Request ID
	 * @param result Result data
	 * @returns True if request was found and resolved
	 */
	resolveRequest(requestId: string, result: unknown): boolean {
		const request = this.pendingRequests.get(requestId);
		if (!request) {
			return false; // Request not found (may have timed out or been cancelled)
		}

		// Clear timeout
		clearTimeout(request.timeout);
		
		// Remove from pending
		this.pendingRequests.delete(requestId);
		
		// Resolve promise
		request.resolve(result);
		
		return true;
	}

	/**
	 * Reject a pending request
	 * 
	 * @param requestId Request ID
	 * @param error Error object
	 * @returns True if request was found and rejected
	 */
	rejectRequest(requestId: string, error: Error): boolean {
		const request = this.pendingRequests.get(requestId);
		if (!request) {
			return false;
		}

		// Clear timeout
		clearTimeout(request.timeout);
		
		// Remove from pending
		this.pendingRequests.delete(requestId);
		
		// Reject promise
		request.reject(error);
		
		return true;
	}

	/**
	 * Cancel a specific request
	 * 
	 * @param requestId Request ID to cancel
	 * @param reason Cancellation reason
	 * @returns True if request was cancelled
	 */
	cancelRequest(requestId: string, reason: string = 'Request cancelled'): boolean {
		const error = new RequestCancelledError(reason, requestId);
		return this.rejectRequest(requestId, error);
	}

	/**
	 * Cancel all pending requests for a specific symbol
	 * 
	 * **KEY FEATURE**: When user switches from RELIANCE to TCS,
	 * this cancels all RELIANCE requests (including slow CVD).
	 * 
	 * @param symbolId Symbol ID to cancel
	 * @returns Number of requests cancelled
	 * 
	 * @example
	 * ```typescript
	 * // User switches from RELIANCE to TCS
	 * const cancelled = tracker.cancelSymbolRequests('NSE:RELIANCE');
	 * console.log(`Cancelled ${cancelled} requests for RELIANCE`);
	 * 
	 * // Now start TCS requests
	 * tracker.createRequest({ ...tcsConfig });
	 * ```
	 */
	cancelSymbolRequests(symbolId: string): number {
		// ✅ FIX: Collect request IDs first to avoid iterator issues
		// when cancelling (which modifies the map)
		const requestIdsToCancel: string[] = [];

		for (const [requestId, request] of this.pendingRequests.entries()) {
			const req = request as PendingRequest & { symbolId?: string };
			if (req.symbolId === symbolId) {
				requestIdsToCancel.push(requestId);
			}
		}

		// Cancel all collected requests
		let cancelledCount = 0;
		for (const requestId of requestIdsToCancel) {
			if (this.cancelRequest(requestId, `Symbol switched from ${symbolId}`)) {
				cancelledCount++;
			}
		}

		return cancelledCount;
	}

	/**
	 * Cancel all CVD requests (useful for slow networks)
	 * 
	 * @param reason Cancellation reason
	 * @returns Number of CVD requests cancelled
	 */
	cancelAllCVDRequests(reason: string = 'CVD requests cancelled'): number {
		let cancelledCount = 0;

		for (const [requestId, request] of this.pendingRequests.entries()) {
			const req = request as PendingRequest & { isCVD?: boolean };
			if (req.isCVD) {
				this.cancelRequest(requestId, reason);
				cancelledCount++;
			}
		}

		return cancelledCount;
	}

	/**
	 * Cancel all pending requests
	 * 
	 * @param reason Cancellation reason
	 * @returns Number of requests cancelled
	 */
	cancelAllRequests(reason: string = 'All requests cancelled'): number {
		const count = this.pendingRequests.size;

		for (const requestId of this.pendingRequests.keys()) {
			this.cancelRequest(requestId, reason);
		}

		return count;
	}

	/**
	 * Get pending request by ID
	 * 
	 * @param requestId Request ID
	 * @returns Pending request or undefined
	 */
	getRequest(requestId: string): PendingRequest | undefined {
		return this.pendingRequests.get(requestId);
	}

	/**
	 * Get pending request by turnaround ID (for race condition handling)
	 * 
	 * @param turnaroundId Turnaround ID from create_series/modify_series
	 * @returns Pending request or undefined
	 */
	getRequestByTurnaround(turnaroundId: string): PendingRequest | undefined {
		for (const request of this.pendingRequests.values()) {
			const req = request as PendingRequest & { turnaroundId?: string };
			if (req.turnaroundId === turnaroundId) {
				return request;
			}
		}
		return undefined;
	}

	/**
	 * Get all pending requests
	 * 
	 * @returns Array of pending requests
	 */
	getAllRequests(): PendingRequest[] {
		return Array.from(this.pendingRequests.values());
	}

	/**
	 * Get pending requests for a symbol
	 * 
	 * @param symbolId Symbol ID
	 * @returns Array of pending requests for symbol
	 */
	getSymbolRequests(symbolId: string): PendingRequest[] {
		return Array.from(this.pendingRequests.values()).filter(
			req => (req as PendingRequest & { symbolId?: string }).symbolId === symbolId
		);
	}

	/**
	 * Check if a request is pending
	 * 
	 * @param requestId Request ID
	 * @returns True if request is pending
	 */
	isPending(requestId: string): boolean {
		return this.pendingRequests.has(requestId);
	}

	/**
	 * Get number of pending requests
	 * 
	 * @returns Count of pending requests
	 */
	getPendingCount(): number {
		return this.pendingRequests.size;
	}

	/**
	 * Get number of pending CVD requests
	 * 
	 * @returns Count of pending CVD requests
	 */
	getPendingCVDCount(): number {
		let count = 0;
		for (const request of this.pendingRequests.values()) {
			if ((request as PendingRequest & { isCVD?: boolean }).isCVD) {
				count++;
			}
		}
		return count;
	}

	/**
	 * Get current queue depth for monitoring
	 * 
	 * @returns Number of pending requests in queue
	 */
	public getQueueDepth(): number {
		return this.pendingRequests.size;
	}

	/**
	 * Set default timeout for a request type
	 * 
	 * @param type Request type
	 * @param timeout Timeout in milliseconds
	 * 
	 * @example
	 * ```typescript
	 * // Increase CVD timeout for slow connections
	 * tracker.setDefaultTimeout('create_study', 60000); // 60s
	 * ```
	 */
	setDefaultTimeout(type: RequestType, timeout: number): void {
		this.defaultTimeouts[type] = timeout;
	}

	/**
	 * Get default timeout for a request type
	 * 
	 * @param type Request type
	 * @returns Timeout in milliseconds
	 */
	getDefaultTimeout(type: RequestType): number {
		return this.defaultTimeouts[type];
	}

	/**
	 * Clear all pending requests (cleanup on disconnect)
	 */
	clear(): void {
		for (const request of this.pendingRequests.values()) {
			clearTimeout(request.timeout);
		}
		this.pendingRequests.clear();
	}

	/**
	 * Get statistics
	 */
	getStats(): {
		pending: number;
		cvdPending: number;
		oldestRequestAge: number | null;
		requestsByType: Record<string, number>;
	} {
		const stats = {
			pending: this.pendingRequests.size,
			cvdPending: this.getPendingCVDCount(),
			oldestRequestAge: null as number | null,
			requestsByType: {} as Record<string, number>
		};

		const now = Date.now();
		let oldestAge = 0;

		for (const request of this.pendingRequests.values()) {
			// Track by type
			stats.requestsByType[request.type] = (stats.requestsByType[request.type] || 0) + 1;
			
			// Find oldest
			const age = now - request.sentAt;
			if (age > oldestAge) {
				oldestAge = age;
			}
		}

		if (this.pendingRequests.size > 0) {
			stats.oldestRequestAge = oldestAge;
		}

		return stats;
	}

	/**
	 * Generate unique request ID
	 */
	private generateRequestId(): string {
		return `req_${++this.requestIdCounter}_${Date.now()}`;
	}

	/**
	 * Extract bars count from request params (for CVD timeout error)
	 */
	private extractBarsCountFromParams(params: unknown[]): number {
		// For create_series/modify_series, bars count is typically at index 5
		// For create_study, we estimate based on series bars
		if (Array.isArray(params) && typeof params[5] === 'number') {
			return params[5];
		}
		return 300; // Default estimate
	}
}
