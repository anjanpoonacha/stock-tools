/**
 * POC: Optimized WebSocket Client
 * 
 * NOTE: All optimizations have been applied to baseWebSocketClient.ts!
 * This file now just re-exports the base client for compatibility with tests.
 */

import { BaseWebSocketClient, type BaseClientConfig } from '../../src/lib/tradingview/baseWebSocketClient';
import { createSymbolSpec } from '../../src/lib/tradingview/protocol';
import type { OHLCVBar, SymbolMetadata, StudyData } from '../../src/lib/tradingview/types';

// Re-export interface for compatibility
export interface OptimizedClientConfig extends BaseClientConfig {}

/**
 * Optimized WebSocket client - now just an alias for BaseWebSocketClient
 * since all optimizations are in the base class
 */
export class OptimizedWebSocketClient extends BaseWebSocketClient {
	constructor(config: OptimizedClientConfig) {
		super(config);
	}
	
	/**
	 * Template method implementation (can be overridden)
	 */
	protected async requestHistoricalBars(): Promise<void> {
		// Default implementation - subclasses can override
	}
	
	/**
	 * Clear collected data (for connection reuse)
	 */
	clearData(): void {
		this.bars = [];
		this.symbolMetadata = {};
		this.studies = new Map();
	}
}

/**
 * Optimized Pooled Client for connection reuse
 */
export class OptimizedPooledClient extends OptimizedWebSocketClient {
	private requestCount = 0;
	private seriesId = 'sds_1';
	
	async initialize(): Promise<void> {
		await this.connect();
		await this.authenticate();
		await this.createChartSession();
		await this.createQuoteSession();
	}
	
	async fetchChartData(
		symbol: string,
		resolution: string,
		barsCount: number,
		options?: {
			cvdEnabled?: boolean;
			cvdAnchorPeriod?: string;
			cvdTimeframe?: string;
		}
	): Promise<{
		bars: OHLCVBar[];
		metadata: Partial<SymbolMetadata>;
		indicators?: { cvd?: StudyData };
	}> {
		// Clear previous data
		this.clearData();
		
		// Increment request count
		this.requestCount++;
		const symbolSessionId = `sds_sym_${this.requestCount}`;
		const turnaroundId = `s${this.requestCount}`;
		
		// Resolve symbol
		const symbolSpec = createSymbolSpec(symbol, 'dividends');
		await this.resolveSymbol(symbolSpec, symbolSessionId);
		
		// First request: create series, subsequent: modify series
		if (this.requestCount === 1) {
			await this.createSeries(resolution, barsCount);
		} else {
			await this.modifySeries(this.seriesId, turnaroundId, symbolSessionId, resolution);
		}
		
		// Request CVD if enabled
		if (options?.cvdEnabled) {
			const cvdId = `cvd_${this.requestCount}`;
			const cvdConfig = {
				text: '',
				pineId: 'PUB;ixVixhRxOlMl4Ro2B8WBP0Zt2HXRzh5Z',
				pineVersion: '1.0',
				in_0: { v: options.cvdAnchorPeriod || '3M', f: true, t: 'resolution' },
				in_1: { v: !!options.cvdTimeframe, f: true, t: 'bool' },
				in_2: { v: options.cvdTimeframe || '', f: true, t: 'resolution' },
			};
			await this.createStudy(cvdId, 'Script@tv-scripting-101!', cvdConfig);
		}
		
		// Wait for data (event-driven!)
		await this.waitForData();
		
		// Collect results
		const bars = this.getBars();
		const metadata = this.getMetadata();
		const cvdId = `cvd_${this.requestCount}`;
		const cvd = this.getStudy(cvdId);
		
		if (bars.length === 0) {
			throw new Error(`No bars received for symbol ${symbol}`);
		}
		
		return {
			bars,
			metadata,
			indicators: cvd ? { cvd } : undefined
		};
	}
	
	protected async requestHistoricalBars(): Promise<void> {
		// Not used in pooled mode
	}
}
