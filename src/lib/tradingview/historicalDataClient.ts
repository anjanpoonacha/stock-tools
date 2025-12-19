/**
 * TradingView Historical Data Client
 * 
 * Production-ready WebSocket client for fetching historical OHLCV bars from TradingView.
 * Based on validated POC implementation.
 */

import { BaseWebSocketClient, type BaseClientConfig } from './baseWebSocketClient';
import { createSymbolSpec } from './protocol';
import type { OHLCVBar, SymbolMetadata, StudyData, StudyConfig } from './types';
import { getCVDConfig, CVD_PINE_FEATURES, type CVDConfig } from './cvdConfigService';

interface HistoricalDataResult {
	bars: OHLCVBar[];
	metadata: Partial<SymbolMetadata>;
	indicators?: {
		cvd?: StudyData;
	};
}

interface ClientConfig extends BaseClientConfig {
	symbol: string;
	resolution: string;
	barsCount: number;
	// CVD indicator configuration (optional)
	cvdEnabled?: boolean;
	cvdAnchorPeriod?: string;
	cvdTimeframe?: string;
	// Session credentials for fetching dynamic CVD config
	sessionId?: string;
	sessionIdSign?: string;
}

class TradingViewWebSocketClient extends BaseWebSocketClient {
	private symbol: string;
	private resolution: string;
	private barsCount: number;
	private cvdEnabled: boolean;
	private cvdAnchorPeriod: string;
	private cvdTimeframe?: string;
	private sessionId?: string;
	private sessionIdSign?: string;
	private cvdConfigCache?: CVDConfig; // Cache fetched CVD config
	
	constructor(config: ClientConfig) {
		super(config);
		this.symbol = config.symbol;
		this.resolution = config.resolution;
		this.barsCount = config.barsCount;
		this.cvdEnabled = config.cvdEnabled ?? false;
		this.cvdAnchorPeriod = config.cvdAnchorPeriod ?? '3M';
		this.cvdTimeframe = config.cvdTimeframe;
		this.sessionId = config.sessionId;
		this.sessionIdSign = config.sessionIdSign;
	}
	
	/**
	 * Request historical bars from TradingView
	 * 
	 * Production implementation: creates sessions, resolves symbol,
	 * requests series data (and optionally CVD indicator), and waits for data to arrive.
	 */
	protected async requestHistoricalBars(): Promise<void> {
		// Create chart session
		await this.createChartSession();
		
		// Create quote session (optional but mimics real client flow)
		await this.createQuoteSession();
		
		// Create symbol specification
		const symbolSpec = createSymbolSpec(this.symbol, 'dividends');
		
		// Resolve symbol to get metadata
		await this.resolveSymbol(symbolSpec);
		
		// Request historical bars
		await this.createSeries(this.resolution, this.barsCount);
		
		// Request CVD indicator if enabled AND credentials are available
		// Skip CVD entirely if credentials missing to avoid timeout
		if (this.cvdEnabled) {
			
			if (!this.sessionId || !this.sessionIdSign) {
				// Don't add study, won't wait for timeout
			} else {
				try {
					const cvdConfig = await this.buildCVDConfig();
					const configText = typeof cvdConfig.text === 'string' ? cvdConfig.text : '';
					await this.createStudy('cvd_1', 'Script@tv-scripting-101!', cvdConfig);
				} catch (err) {
					// Don't propagate error, just skip CVD
				}
			}
		} else {
		}
		
		// Wait for data to arrive
		// TradingView sends data within 3-5 seconds typically
		await this.waitForData(5000);
	}
	
	/**
	 * Build CVD indicator configuration (uses dynamic config if available)
	 */
	private async buildCVDConfig(): Promise<StudyConfig> {
		
		// Fetch dynamic CVD config if not cached
		if (!this.cvdConfigCache && this.sessionId) {
			this.cvdConfigCache = await getCVDConfig(this.sessionId, this.sessionIdSign);
		}
		
		// Use cached config or fall back to service defaults
		const cvdConfig = this.cvdConfigCache;
		if (!cvdConfig) {
			throw new Error('CVD config unavailable: no session credentials provided');
		}
		
		const configText = typeof cvdConfig.text === 'string' ? cvdConfig.text : '';
		
		return {
			text: cvdConfig.text,
			pineId: cvdConfig.pineId,
			pineVersion: cvdConfig.pineVersion,
			pineFeatures: CVD_PINE_FEATURES,
			in_0: { v: this.cvdAnchorPeriod, f: true, t: 'resolution' },
			in_1: { v: !!this.cvdTimeframe, f: true, t: 'bool' },
			in_2: { v: this.cvdTimeframe || '', f: true, t: 'resolution' },
			__profile: { v: false, f: true, t: 'bool' }
		};
	}
	
	/**
	 * Public method to fetch historical bars
	 * Calls the protected template method
	 */
	async fetchBars(): Promise<void> {
		await this.requestHistoricalBars();
	}
	
	getResult(): HistoricalDataResult {
		const cvd = this.getStudy('cvd_1');
		
		return {
			bars: this.getBars(),
			metadata: this.getMetadata(),
			indicators: cvd ? { cvd } : undefined
		};
	}
}

/**
 * Fetch historical OHLCV bars from TradingView with optional CVD indicator
 * 
 * @param symbol - Symbol to fetch (e.g., 'NSE:JUNIPER')
 * @param resolution - Time resolution ('1D', '1W', '1M', '1', '5', '15', '30', '60')
 * @param barsCount - Number of bars to fetch (max 300)
 * @param jwtToken - Valid JWT authentication token with data access permissions
 * @param options - Optional configuration including CVD settings
 * @returns Historical bars, symbol metadata, and optional CVD indicator data
 * 
 * @throws Error if connection fails, authentication fails, or no data received
 * 
 * @example Basic usage (OHLCV only)
 * ```typescript
 * const { bars, metadata } = await fetchHistoricalBars(
 *   'NSE:JUNIPER',
 *   '1D',
 *   300,
 *   jwtToken
 * );
 * ```
 * 
 * @example With CVD indicator
 * ```typescript
 * const { bars, metadata, indicators } = await fetchHistoricalBars(
 *   'NSE:JUNIPER',
 *   '1D',
 *   300,
 *   jwtToken,
 *   {
 *     cvdEnabled: true,
 *     cvdAnchorPeriod: '3M',
 *     cvdTimeframe: '30S'
 *   }
 * );
 * ```
 */
export async function fetchHistoricalBars(
	symbol: string,
	resolution: string,
	barsCount: number,
	jwtToken: string,
	options?: {
		timeout?: number;
		chartId?: string;
		cvdEnabled?: boolean;
		cvdAnchorPeriod?: string;
		cvdTimeframe?: string;
		useConnectionPool?: boolean;
		// Session credentials for dynamic CVD config
		sessionId?: string;
		sessionIdSign?: string;
	}
): Promise<HistoricalDataResult> {
	// Note: Connection pooling is implemented via getConnectionPool() in connectionPool.ts
	// This function creates a new connection per request (non-pooled mode)
	// For pooled mode, use fetchHistoricalDataPooled() in chartDataService.ts
	
	const client = new TradingViewWebSocketClient({
		jwtToken,
		symbol,
		resolution,
		barsCount,
		...options
	});
	
	try {
		await client.connect();
		await client.authenticate();
		await client.fetchBars();
		
		const result = client.getResult();
		
		// Validate that we received data
		if (result.bars.length === 0) {
			throw new Error(`No bars received for symbol ${symbol}. Check symbol format and data availability.`);
		}
		
		return result;
		
	} finally {
		client.disconnect();
	}
}

/**
 * Supported time resolutions for TradingView charts
 */
export const SUPPORTED_RESOLUTIONS = [
	'1',    // 1 minute
	'3',    // 3 minutes
	'5',    // 5 minutes
	'15',   // 15 minutes
	'30',   // 30 minutes
	'45',   // 45 minutes
	'60',   // 1 hour
	'120',  // 2 hours
	'180',  // 3 hours
	'240',  // 4 hours
	'1D',   // 1 day
	'1W',   // 1 week
	'1M'    // 1 month
] as const;

export type Resolution = typeof SUPPORTED_RESOLUTIONS[number];
