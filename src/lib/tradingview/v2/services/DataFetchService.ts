/**
 * DataFetchService
 * 
 * Handles all data fetching operations for TradingView WebSocket connection:
 * - Symbol resolution
 * - OHLCV bar fetching
 * - Indicator data (CVD, RSI, etc.)
 * 
 * KEY FEATURES:
 * - CVD support via optional CVDConfigProvider
 * - Request tracking with timeouts
 * - Proper correlation with RequestTracker
 * 
 * Extracted from WebSocketConnection to promote:
 * - Single Responsibility Principle
 * - Testability (can mock data fetching)
 * - Dependency Injection (CVDConfigProvider is optional)
 */

import type { ServiceContext } from './ServiceContext.js';
import type { SymbolRequest, SymbolMetadata } from '../core/types.js';
import type { CVDConfigProvider } from '../providers/CVDConfigProvider.js';
import type { PendingSymbolData } from './MessageHandlerService.js';

/**
 * Service for fetching symbol data from TradingView
 */
export class DataFetchService {
	constructor(
		private ctx: ServiceContext,
		private cvdProvider?: CVDConfigProvider
	) {}

	/**
	 * Step 1: Resolve symbol and get metadata
	 * 
	 * Sends resolve_symbol message and waits for symbol_resolved response.
	 * 
	 * @param request Symbol fetch request
	 * @param pendingData Pending data structure to store metadata
	 * @returns Promise that resolves when symbol is resolved
	 * @throws SymbolError if symbol not found
	 * @throws DataTimeoutError if resolution times out
	 */
	async resolveSymbol(
		request: SymbolRequest,
		pendingData: PendingSymbolData
	): Promise<void> {
		const symbolSpec = this.ctx.protocol.createSymbolSpec(
			request.symbol,
			request.adjustment || 'dividends',
			request.session
		);

		// Store the symbolSessionId to verify response later
		const expectedSymbolSessionId = pendingData.symbolSessionId;

		const { promise } = this.ctx.requestTracker.createRequest({
			type: 'resolve_symbol',
			params: [
				this.ctx.sessions.chartSessionId,
				expectedSymbolSessionId,
				symbolSpec
			],
			timeout: 5000,
			symbolId: request.symbol
		});

		// Send resolve_symbol message
		this.sendMessage(
			this.ctx.protocol.createMessage('resolve_symbol', [
				this.ctx.sessions.chartSessionId,
				expectedSymbolSessionId,
				symbolSpec
			])
		);

		// Wait for response
		const metadata = (await promise) as Partial<SymbolMetadata>;
		
		// Store in local pendingData (not shared state)
		pendingData.metadata = metadata;
		this.ctx.events.emit('symbol:resolved', request.symbol, metadata);
	}

	/**
	 * Step 2: Fetch OHLCV bars
	 * 
	 * Sends create_series message and waits for timescale_update/du response.
	 * Uses turnaround ID for response correlation.
	 * 
	 * @param request Symbol fetch request
	 * @param pendingData Pending data structure to store bars
	 * @param registerSeriesFn Callback to register series (for cleanup tracking)
	 * @returns Promise that resolves when bars are received
	 * @throws DataTimeoutError if bars fetch times out
	 */
	async fetchBars(
		request: SymbolRequest,
		pendingData: PendingSymbolData,
		registerSeriesFn: (seriesId: string, requestId: string) => void
	): Promise<void> {
		const turnaround = `sds_${++this.ctx.sessions.turnaroundCounter}`;
		
		// Use local pendingData parameter
		const expectedSymbolSessionId = pendingData.symbolSessionId;

		const { requestId, promise } = this.ctx.requestTracker.createRequest({
			type: 'create_series',
			params: [
				this.ctx.sessions.chartSessionId,
				pendingData.seriesId,
				turnaround,
				expectedSymbolSessionId,
				request.resolution,
				request.barsCount
			],
			timeout: this.ctx.config.dataTimeout,
			symbolId: request.symbol,
			turnaroundId: turnaround // CRITICAL: Store turnaround ID for response matching
		});

		// Send create_series message
		this.sendMessage(
			this.ctx.protocol.createMessage('create_series', [
				this.ctx.sessions.chartSessionId,
				pendingData.seriesId,
				turnaround,
				expectedSymbolSessionId,
				request.resolution,
				request.barsCount
			])
		);
		
		// Register series for cleanup and correlation
		registerSeriesFn(pendingData.seriesId, requestId);

		// Wait for bars
		await promise;
		// Note: Bars are collected in message handler via pendingSymbolData
		// which might have changed if symbol switched, but that's OK - 
		// the request is tracked by RequestTracker and will be properly resolved/cancelled
	}

	/**
	 * Step 3: Fetch indicators (CVD, RSI, etc.)
	 * 
	 * Sends create_study messages for each requested indicator.
	 * CVD indicators use CVDConfigProvider if available.
	 * 
	 * @param request Symbol fetch request with indicators array
	 * @param pendingData Pending data structure to store indicator data
	 * @returns Promise that resolves when all indicators are fetched
	 * @throws CVDTimeoutError if CVD fetch times out
	 * @throws Error if CVD requested but no provider available
	 */
	async fetchIndicators(
		request: SymbolRequest,
		pendingData: PendingSymbolData
	): Promise<void> {
		if (!request.indicators || request.indicators.length === 0) {
			return;
		}

		const indicatorPromises: Promise<void>[] = [];

		for (const indicator of request.indicators) {
			const studyId = `${indicator.type}_${Date.now()}`;
			const turnaround = `sds_${++this.ctx.sessions.turnaroundCounter}`;

			// Check if this is CVD and we need to fetch config
			const isCVD = indicator.type === 'cvd';
			let studyConfig = indicator.config;
			let studyName = indicator.type; // Default to indicator type

			if (isCVD) {
				if (!this.cvdProvider) {
					throw new Error('CVD indicator requested but no CVDConfigProvider available');
				}

				// Fetch CVD config from provider
				const anchorPeriod = (indicator.config?.anchorPeriod as string) || '3M';
				const timeframe = (indicator.config?.timeframe as string) || '';
				const cvdConfig = await this.cvdProvider.getCVDConfig(anchorPeriod);

				// Import CVD_PINE_FEATURES for complete config
				const { CVD_PINE_FEATURES } = await import('@/lib/tradingview/cvdConfigService');

				// Build complete CVD config matching v1 format
				// CRITICAL: Must include pineFeatures and input parameters (in_0, in_1, in_2, __profile)
				studyConfig = {
					text: cvdConfig.text,
					pineId: cvdConfig.pineId,
					pineVersion: cvdConfig.pineVersion,
					pineFeatures: CVD_PINE_FEATURES,
					in_0: { v: anchorPeriod, f: true, t: 'resolution' },
					in_1: { v: !!timeframe, f: true, t: 'bool' },
					in_2: { v: timeframe, f: true, t: 'resolution' },
					__profile: { v: false, f: true, t: 'bool' }
				};

				// CRITICAL: Use correct study name for CVD
				// TradingView requires 'Script@tv-scripting-101!' for custom Pine scripts
				studyName = 'Script@tv-scripting-101!';
			}

			// Determine timeout based on indicator type
			// CVD uses configured timeout (default 30s), others use dataTimeout
			const timeout = isCVD 
				? this.ctx.requestTracker.getDefaultTimeout('create_study')
				: this.ctx.config.dataTimeout;

			const { promise } = this.ctx.requestTracker.createRequest({
				type: 'create_study',
				params: [
					this.ctx.sessions.chartSessionId,
					studyId,
					turnaround,
					pendingData.seriesId,
					studyName,
					studyConfig
				],
				timeout,
				isCVD,
				symbolId: request.symbol
			});

			// Send create_study message
			// Format: ['chart_session', 'study_id', 'turnaround', 'series_id', 'study_name', config]
			// NO barsCount parameter! That was causing study_error from TradingView
			this.sendMessage(
				this.ctx.protocol.createMessage('create_study', [
					this.ctx.sessions.chartSessionId,
					studyId,
					turnaround,
					pendingData.seriesId,
					studyName,
					studyConfig
				])
			);

			pendingData.studyIds.set(indicator.type, studyId);
			indicatorPromises.push(promise as Promise<void>);
		}

		// Wait for all indicators
		await Promise.all(indicatorPromises);
	}

	/**
	 * Helper: Send message through WebSocket
	 */
	private sendMessage(message: import('../core/types').TVMessage): void {
		if (!this.ctx.ws) {
			throw new Error('WebSocket not connected');
		}

		const encoded = this.ctx.protocol.encodeMessage(message);
		this.ctx.ws.send(encoded);

		this.ctx.events.emit('message:sent', message, encoded);
	}
}
