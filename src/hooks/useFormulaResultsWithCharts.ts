// TODO: Migrate to IndexedDB for progressive caching

/**
 * Hook for streaming formula results and chart data via SSE
 * 
 * This hook:
 * - Connects to SSE endpoint for progressive loading
 * - Receives formula results immediately (~250ms)
 * - Receives chart data in progressive batches
 * - Provides progress tracking
 * - Handles errors and reconnection
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Stock } from '@/types/stock';
import type { OHLCVBar, SymbolMetadata, StudyData } from '@/lib/tradingview/types';
import { useToast } from '@/components/ui/toast';

/**
 * Chart data for a single symbol × resolution
 */
interface ChartDataItem {
	bars: OHLCVBar[];
	metadata: Partial<SymbolMetadata>;
	indicators?: {
		cvd?: StudyData;
	};
}

/**
 * Streamed chart data structure (progressively populated)
 */
export interface StreamedChartData {
	[symbol: string]: {
		[resolution: string]: ChartDataItem;
	};
}

/**
 * Progress tracking
 */
export interface StreamProgress {
	loaded: number;
	total: number;
	percentage: number;
	batchesComplete: number;
	totalBatches: number;
}

/**
 * Hook return interface
 */
interface UseFormulaResultsWithChartsReturn {
	stocks: Stock[];
	formulaName: string;
	chartData: StreamedChartData;
	progress: StreamProgress;
	loading: boolean;
	isStreaming: boolean;
	error: string | null;
	refetch: () => void;
	cancelStream: () => void;
}

/**
 * SSE Event Types
 */
type SSEEventType = 'formula-results' | 'chart-batch' | 'complete' | 'error';

interface FormulaResultsEvent {
	formulaName: string;
	stocks: Stock[];
	totalCharts: number;
	resolutions: string[];
	barsCount: number;
}

interface ChartBatchEvent {
	batchIndex: number;
	totalBatches: number;
	symbols: string[];
	chartData: StreamedChartData;
	progress: {
		loaded: number;
		total: number;
		percentage: number;
	};
	timing: {
		startTime: number;
		endTime: number;
		durationMs: number;
	};
}

interface CompleteEvent {
	totalCharts: number;
	totalTime: number;
	avgTimePerChart: number;
}

interface ErrorEvent {
	message: string;
}



/**
 * Hook for streaming formula results with progressive chart data loading
 */
export function useFormulaResultsWithCharts(
	formulaId: string | null
): UseFormulaResultsWithChartsReturn {
	const [stocks, setStocks] = useState<Stock[]>([]);
	const [formulaName, setFormulaName] = useState<string>('');
	const [chartData, setChartData] = useState<StreamedChartData>({});
	const [progress, setProgress] = useState<StreamProgress>({
		loaded: 0,
		total: 0,
		percentage: 0,
		batchesComplete: 0,
		totalBatches: 0,
	});
	const [loading, setLoading] = useState<boolean>(false);
	const [isStreaming, setIsStreaming] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const showToast = useToast();

	const eventSourceRef = useRef<EventSource | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const isStreamingRef = useRef<boolean>(false);

	/**
	 * Cancel active stream
	 */
	const cancelStream = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		isStreamingRef.current = false;
		setIsStreaming(false);
	}, []);

	/**
	 * Fetch results using SSE streaming
	 */
	const fetchResults = useCallback(async () => {
		if (!formulaId) {
			setError('No formula ID provided');
			return;
		}

		// Get credentials using centralized utility
		const { getStoredCredentials } = await import('@/lib/auth/authUtils');
		const credentials = getStoredCredentials();
		
		if (!credentials) {
			console.error('[useFormulaResultsWithCharts] No credentials found');
			setError('Not authenticated. Please log in first.');
			setLoading(false);
			return;
		}

		// Cancel any existing stream
		cancelStream();

		// Prevent multiple simultaneous streams
		if (isStreamingRef.current) {
			return;
		}

		isStreamingRef.current = true;
		setLoading(true);
		setIsStreaming(true);
		setError(null);
		setChartData({});
		setProgress({ loaded: 0, total: 0, percentage: 0, batchesComplete: 0, totalBatches: 0 });

		try {

			// Create abort controller for fetch
			abortControllerRef.current = new AbortController();

			// Build request body
			const requestBody = {
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
				formulaId,
				resolutions: ['1W', '1D'],
				barsCount: 300,
			};

			// Make POST request to initiate SSE stream
			const response = await fetch('/api/formula-results-with-charts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
				signal: abortControllerRef.current.signal,
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to start stream');
			}

			// Read SSE stream
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				throw new Error('No response body');
			}

			let buffer = '';
			let currentStocks: Stock[] = [];
			let currentFormulaName = '';
			const accumulatedChartData: StreamedChartData = {};

			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					break;
				}

				// Decode chunk and add to buffer
				buffer += decoder.decode(value, { stream: true });

				// Process complete messages (separated by \n\n)
				const messages = buffer.split('\n\n');
				buffer = messages.pop() || ''; // Keep incomplete message in buffer

				for (const message of messages) {
					if (!message.trim() || !message.startsWith('data: ')) continue;

					try {
						const jsonStr = message.replace('data: ', '');
						const parsed: { type: SSEEventType; data: unknown } = JSON.parse(jsonStr);

						switch (parsed.type) {
							case 'formula-results': {
								const data = parsed.data as FormulaResultsEvent;
								currentStocks = data.stocks;
								currentFormulaName = data.formulaName;
								setStocks(data.stocks);
								setFormulaName(data.formulaName);
								setProgress(prev => ({
									...prev,
									total: data.totalCharts,
									totalBatches: Math.ceil(data.stocks.length / 18), // Estimate
								}));
								setLoading(false);
								showToast(`Loaded ${data.stocks.length} stocks`, 'success');
								break;
							}

							case 'chart-batch': {
								const data = parsed.data as ChartBatchEvent;

								// Merge batch chart data into accumulated data
								for (const [symbol, resolutions] of Object.entries(data.chartData)) {
									if (!accumulatedChartData[symbol]) {
										accumulatedChartData[symbol] = {};
									}
									Object.assign(accumulatedChartData[symbol], resolutions);
								}

								setChartData({ ...accumulatedChartData });
								setProgress({
									loaded: data.progress.loaded,
									total: data.progress.total,
									percentage: data.progress.percentage,
									batchesComplete: data.batchIndex,
									totalBatches: data.totalBatches,
								});

								break;
							}

							case 'complete': {
								const data = parsed.data as CompleteEvent;
								
								setIsStreaming(false);
								showToast(`Loaded ${data.totalCharts} charts in ${(data.totalTime / 1000).toFixed(1)}s`, 'success');
								break;
							}

							case 'error': {
								const data = parsed.data as ErrorEvent;
								console.error('[useFormulaResultsWithCharts] Stream error:', data.message);
								throw new Error(data.message);
							}
						}
					} catch (err) {
						console.error('[useFormulaResultsWithCharts] Failed to parse SSE message:', err);
					}
				}
			}

		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}

			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			setError(errorMessage);
			showToast(errorMessage, 'error');
			console.error('[useFormulaResultsWithCharts] Error:', err);
		} finally {
			isStreamingRef.current = false;
			setLoading(false);
			setIsStreaming(false);
			cancelStream();
		}
	}, [formulaId, cancelStream, showToast]);

	// Auto-fetch on mount/formulaId change
	useEffect(() => {
		// Only fetch if formulaId is valid (not null, not empty string)
		if (formulaId && formulaId.trim() !== '') {
			// Add small debounce to prevent rapid re-triggers during Fast Refresh
			const timeoutId = setTimeout(() => {
				fetchResults();
			}, 100);
			
			return () => {
				clearTimeout(timeoutId);
				// Only cancel if we're actually leaving the page, not just re-rendering
				if (!document.hidden) {
					cancelStream();
				}
			};
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [formulaId]);

	return {
		stocks,
		formulaName,
		chartData,
		progress,
		loading,
		isStreaming,
		error,
		refetch: fetchResults,
		cancelStream,
	};
}
