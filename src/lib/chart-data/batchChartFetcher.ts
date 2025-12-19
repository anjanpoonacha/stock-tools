/**
 * Batch Chart Fetcher Service
 * 
 * Reusable service that fetches chart data in optimized batches using connection pooling.
 * Supports progressive callbacks for streaming scenarios.
 */

import { getConnectionPool, WebSocketConnectionPool } from '@/lib/tradingview/connectionPool';
import type { OHLCVBar, SymbolMetadata, StudyData } from '@/lib/tradingview/types';

/**
 * Result for a single chart data fetch
 */
export interface ChartResult {
	symbol: string;
	resolution: string;
	bars?: OHLCVBar[];
	metadata?: Partial<SymbolMetadata>;
	indicators?: {
		cvd?: StudyData;
	};
	error?: string;
}

/**
 * Result for a batch of charts
 */
export interface ChartBatchResult {
	batchIndex: number;
	totalBatches: number;
	symbols: string[];
	charts: ChartResult[];
	timing: {
		startTime: number;
		endTime: number;
		durationMs: number;
	};
	errors: string[];
}

/**
 * Options for batch chart fetching
 */
export interface BatchChartOptions {
	symbols: string[];
	resolutions: string[];
	barsCount: number;
	cvdEnabled?: boolean;
	cvdAnchorPeriod?: string;
	cvdTimeframe?: string;
	parallelConnections?: number;
	batchSize?: number;
	onBatchComplete?: (batch: ChartBatchResult) => void | Promise<void>;
	connectionPool?: WebSocketConnectionPool; // Optional: use specific pool instance
}

/**
 * Complete result with all batches
 */
export interface BatchChartCompleteResult {
	batches: ChartBatchResult[];
	summary: {
		totalSymbols: number;
		totalCharts: number;
		successfulCharts: number;
		failedCharts: number;
		totalDurationMs: number;
		avgChartDurationMs: number;
	};
}

/**
 * Fetch chart data for multiple symbols in optimized batches
 * 
 * This function:
 * - Splits symbols into batches (default 18 per batch = optimal for connection pool)
 * - Fetches each resolution for each symbol
 * - Uses connection pool for parallel processing
 * - Calls onBatchComplete callback after each batch
 * - Returns complete results with timing metrics
 * 
 * @param jwtToken - JWT authentication token
 * @param options - Batch fetch options
 * @returns Complete batch results with timing
 */
export async function fetchChartsInBatches(
	jwtToken: string,
	options: BatchChartOptions
): Promise<BatchChartCompleteResult> {
	const startTime = Date.now();
	const {
		symbols,
		resolutions,
		barsCount,
		cvdEnabled = false,
		cvdAnchorPeriod = '3M',
		cvdTimeframe,
		parallelConnections = 5,
		batchSize = 18, // 18 symbols = optimal batch size for connection pool
		onBatchComplete,
		connectionPool, // Use provided pool or get global
	} = options;



	// Split symbols into batches
	const symbolBatches: string[][] = [];
	for (let i = 0; i < symbols.length; i += batchSize) {
		symbolBatches.push(symbols.slice(i, i + batchSize));
	}

	const totalBatches = symbolBatches.length;

	const allBatchResults: ChartBatchResult[] = [];
	const pool = connectionPool || getConnectionPool(); // Use provided or get global

	// Process each batch sequentially (but charts within batch are parallel)
	for (let batchIndex = 0; batchIndex < symbolBatches.length; batchIndex++) {
		const batch = symbolBatches[batchIndex];
		const batchStartTime = Date.now();
		
		// Create requests for all combinations of symbols × resolutions in this batch
		const batchRequests = batch.flatMap(symbol =>
			resolutions.map(resolution => ({
				symbol,
				resolution,
				barsCount,
				cvdEnabled,
				cvdAnchorPeriod,
				cvdTimeframe,
			}))
		);

		// Fetch all charts in this batch using connection pool
		const results = await pool.fetchBatch(jwtToken, batchRequests);

		// Convert to ChartResult format
		const charts: ChartResult[] = results.map(r => ({
			symbol: r.symbol,
			resolution: batchRequests.find(req => req.symbol === r.symbol)?.resolution || '1D',
			bars: r.result?.bars,
			metadata: r.result?.metadata,
			indicators: r.result?.indicators,
			error: r.error,
		}));

		const batchEndTime = Date.now();
		const batchDuration = batchEndTime - batchStartTime;

		// Collect errors
		const errors = charts
			.filter(c => c.error)
			.map(c => `${c.symbol} (${c.resolution}): ${c.error}`);

		const batchResult: ChartBatchResult = {
			batchIndex: batchIndex + 1,
			totalBatches,
			symbols: batch,
			charts,
			timing: {
				startTime: batchStartTime,
				endTime: batchEndTime,
				durationMs: batchDuration,
			},
			errors,
		};

		allBatchResults.push(batchResult);

		const successCount = charts.filter(c => !c.error).length;

		// Call progress callback if provided
		if (onBatchComplete) {
			try {
				await onBatchComplete(batchResult);
			} catch (err) {
				// Silently handle callback errors
			}
		}
	}

	const totalDuration = Date.now() - startTime;
	const totalCharts = allBatchResults.reduce((sum, batch) => sum + batch.charts.length, 0);
	const successfulCharts = allBatchResults.reduce(
		(sum, batch) => sum + batch.charts.filter(c => !c.error).length,
		0
	);
	const failedCharts = totalCharts - successfulCharts;

	const summary = {
		totalSymbols: symbols.length,
		totalCharts,
		successfulCharts,
		failedCharts,
		totalDurationMs: totalDuration,
		avgChartDurationMs: Math.round(totalDuration / totalCharts),
	};

	return {
		batches: allBatchResults,
		summary,
	};
}
