/**
 * Series Management Service
 * 
 * Manages TradingView series lifecycle to prevent "exceed limit of series" errors.
 * 
 * KEY RESPONSIBILITIES:
 * - Track active series IDs
 * - Map series IDs to request IDs (for correlation)
 * - Clean up series before creating new ones
 * - Send remove_series messages
 * 
 * WHY THIS MATTERS:
 * TradingView limits the number of concurrent series per connection.
 * Without proper cleanup, you'll get "exceed limit of series" errors
 * after ~10-20 symbol fetches.
 * 
 * Extracted from WebSocketConnection to promote:
 * - Single Responsibility Principle
 * - Testability (can verify cleanup logic)
 * - Reusability (can be used by connection pool)
 */

import type { ServiceContext } from './ServiceContext';

/**
 * Service for managing series lifecycle
 */
export class SeriesManagementService {
	private context: ServiceContext;
	
	// Series tracking
	private activeSeries: Set<string> = new Set();
	
	// Series ID → Request ID mapping (for correlation)
	private seriesIdMap: Map<string, string> = new Map();

	constructor(context: ServiceContext) {
		this.context = context;
	}

	/**
	 * Register a series ID and map it to a request ID
	 * 
	 * @param seriesId Series ID from create_series
	 * @param requestId Request ID from RequestTracker
	 */
	registerSeries(seriesId: string, requestId: string): void {
		this.activeSeries.add(seriesId);
		this.seriesIdMap.set(seriesId, requestId);

		if (this.context.config.enableLogging) {
			console.log(`[SeriesManagementService] ➕ Registered series: ${seriesId}`);
		}
	}

	/**
	 * Get request ID for a series ID (for response correlation)
	 * 
	 * @param seriesId Series ID
	 * @returns Request ID or undefined if not found
	 */
	getRequestId(seriesId: string): string | undefined {
		return this.seriesIdMap.get(seriesId);
	}

	/**
	 * Get the entire series ID map (for MessageHandlerService)
	 * 
	 * @returns Series ID to Request ID map
	 */
	getSeriesIdMap(): Map<string, string> {
		return this.seriesIdMap;
	}

	/**
	 * Check if a series is registered
	 * 
	 * @param seriesId Series ID
	 * @returns True if series is registered
	 */
	hasSeries(seriesId: string): boolean {
		return this.activeSeries.has(seriesId);
	}

	/**
	 * Get all active series IDs
	 * 
	 * @returns Array of series IDs
	 */
	getActiveSeries(): string[] {
		return Array.from(this.activeSeries);
	}

	/**
	 * Get count of active series
	 * 
	 * @returns Number of active series
	 */
	getActiveSeriesCount(): number {
		return this.activeSeries.size;
	}

	/**
	 * Clean up all active series to prevent "exceed limit of series" errors
	 * 
	 * CRITICAL: Call this before creating new series to avoid TradingView limits.
	 * 
	 * @returns Promise that resolves when all series are cleaned up
	 */
	async cleanupAllSeries(): Promise<void> {
		if (this.activeSeries.size === 0) {
			return;
		}

		if (this.context.config.enableLogging) {
			console.log(`[SeriesManagementService] 🧹 Cleaning up ${this.activeSeries.size} series...`);
		}

		for (const seriesId of this.activeSeries) {
			await this.cleanupSeries(seriesId);
		}

		this.activeSeries.clear();
		this.seriesIdMap.clear();

		if (this.context.config.enableLogging) {
			console.log('[SeriesManagementService] ✅ All series cleaned up');
		}
	}

	/**
	 * Clean up a single series
	 * 
	 * Sends remove_series message to TradingView.
	 * Non-fatal - errors are logged but don't throw.
	 * 
	 * @param seriesId Series ID to clean up
	 */
	async cleanupSeries(seriesId: string): Promise<void> {
		try {
			const message = this.context.protocol.createMessage('remove_series', [
				this.context.sessions.chartSessionId,
				seriesId
			]);

			if (this.context.ws) {
				this.context.ws.send(this.context.protocol.encodeMessage(message));
			}

			if (this.context.config.enableLogging) {
				console.log(`[SeriesManagementService] 🗑️  Removed series: ${seriesId}`);
			}
		} catch (error) {
			// Non-fatal - just log and continue
			if (this.context.config.enableLogging) {
				console.log(`[SeriesManagementService] ⚠️  Failed to cleanup series ${seriesId}:`, error);
			}
		}
	}

	/**
	 * Clear all tracking (for disposal)
	 * 
	 * Does NOT send remove_series messages - just clears local state.
	 * Use cleanupAllSeries() if you want to send cleanup messages.
	 */
	clear(): void {
		this.activeSeries.clear();
		this.seriesIdMap.clear();

		if (this.context.config.enableLogging) {
			console.log('[SeriesManagementService] 🧹 Cleared all tracking');
		}
	}
}
