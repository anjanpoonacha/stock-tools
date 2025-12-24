/**
 * CVD Config Provider
 * 
 * Abstraction for fetching CVD (Cumulative Volume Delta) configuration.
 * Follows v2 architecture principle: Dependency Injection for external services.
 * 
 * Design:
 * - Interface allows different implementations (real, mock, cached)
 * - TradingViewCVDProvider wraps existing cvdConfigService
 * - WebSocketConnection receives provider via DI (optional)
 * - If provider exists, CVD indicators work; otherwise they're skipped
 */

/**
 * CVD configuration returned by provider
 */
export interface CVDConfig {
	/** Encrypted Pine Script text (required by TradingView) */
	text: string;
	
	/** Pine Script ID (e.g., 'STD;Cumulative%1Volume%1Delta') */
	pineId: string;
	
	/** Pine Script version */
	pineVersion: string;
}

/**
 * CVD Config Provider Interface
 * 
 * Implementations must fetch CVD configuration based on anchor period.
 * Used by DataFetchService when creating CVD indicators.
 */
export interface CVDConfigProvider {
	/**
	 * Get CVD configuration for specified anchor period
	 * 
	 * @param anchorPeriod Anchor period (e.g., '3M', '6M', '1Y')
	 * @returns CVD configuration with encrypted Pine Script
	 * @throws Error if config cannot be fetched
	 */
	getCVDConfig(anchorPeriod: string): Promise<CVDConfig>;
}

/**
 * TradingView CVD Config Provider
 * 
 * Real implementation that fetches CVD config from TradingView.
 * Wraps existing cvdConfigService which handles:
 * - Caching in KV (24h TTL)
 * - Fallback to TradingView API
 * - Session-based authentication
 * 
 * @example
 * ```typescript
 * const provider = new TradingViewCVDProvider(sessionId, sessionIdSign);
 * const config = await provider.getCVDConfig('3M');
 * // Use config.text in create_study message
 * ```
 */
export class TradingViewCVDProvider implements CVDConfigProvider {
	constructor(
		private sessionId: string,
		private sessionIdSign: string | undefined
	) {
		if (!sessionId) {
			throw new Error('sessionId is required for TradingViewCVDProvider');
		}
	}

	async getCVDConfig(anchorPeriod: string): Promise<CVDConfig> {
		// Import here to avoid circular dependencies
		const { getCVDConfig } = await import('@/lib/tradingview/cvdConfigService');
		
		// Use existing cvdConfigService (handles caching, fallback, etc.)
		const config = await getCVDConfig(this.sessionId, this.sessionIdSign);
		
		// Return only what we need for create_study
		return {
			text: config.text,
			pineId: config.pineId,
			pineVersion: config.pineVersion
		};
	}
}

/**
 * Mock CVD Config Provider
 * 
 * For testing - returns dummy CVD config without hitting real API.
 * 
 * @example
 * ```typescript
 * const mockProvider = new MockCVDProvider();
 * const config = await mockProvider.getCVDConfig('3M');
 * // Returns test data
 * ```
 */
export class MockCVDProvider implements CVDConfigProvider {
	constructor(
		private mockConfig: CVDConfig = {
			text: 'MOCK_ENCRYPTED_CVD_SCRIPT_TEXT',
			pineId: 'STD;Cumulative%1Volume%1Delta',
			pineVersion: '1'
		}
	) {}

	async getCVDConfig(anchorPeriod: string): Promise<CVDConfig> {
		// Simulate async operation
		await new Promise(resolve => setTimeout(resolve, 10));
		return this.mockConfig;
	}
}
