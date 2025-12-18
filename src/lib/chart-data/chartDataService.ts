/**
 * Chart Data Service
 * 
 * Business logic for fetching chart data from TradingView.
 * Handles session resolution, JWT token extraction, and data retrieval.
 */

import { SessionResolver } from '@/lib/SessionResolver';
import { getDataAccessToken } from '@/lib/tradingview/jwtService';
import { fetchHistoricalBars, type Resolution } from '@/lib/tradingview/historicalDataClient';
import { getConnectionPool } from '@/lib/tradingview/connectionPool';
import { getPersistentConnectionManager } from '@/lib/tradingview/persistentConnectionManager';
import type { 
	SessionResolutionResult, 
	JWTTokenResult, 
	HistoricalDataResult,
	ChartDataServiceResult 
} from './types';
import { validateChartDataRequest, validateUserCredentials } from './validators';
import { getCachedSession, cacheSession, getCachedJWT, cacheJWT } from './sessionCache';

/**
 * Configuration for chart data service (enables dependency injection)
 */
export interface ChartDataServiceConfig {
	sessionResolver: typeof SessionResolver;
	jwtService: { getDataAccessToken: typeof getDataAccessToken };
	dataClient: { fetchHistoricalBars: typeof fetchHistoricalBars };
}

/**
 * Creates chart data service configuration with defaults
 * Allows partial config for testing (dependency injection)
 */
export function createChartDataServiceConfig(
	config?: Partial<ChartDataServiceConfig>
): ChartDataServiceConfig {
	return {
		sessionResolver: config?.sessionResolver || SessionResolver,
		jwtService: config?.jwtService || { getDataAccessToken },
		dataClient: config?.dataClient || { fetchHistoricalBars },
	};
}

/**
 * Resolves TradingView session for a user
 * 
 * @param userEmail - User email address
 * @param userPassword - User password
 * @param config - Service configuration
 * @returns Session resolution result
 */
export async function resolveUserSession(
	userEmail: string,
	userPassword: string,
	config: ChartDataServiceConfig
): Promise<SessionResolutionResult> {
	// Check cache first
	const cached = getCachedSession(userEmail);
	if (cached) {
		return {
			success: true,
			sessionId: cached.sessionId,
			sessionIdSign: cached.sessionIdSign,
			userId: cached.userId
		};
	}

	// Get TradingView session from KV storage
	const sessionInfo = await config.sessionResolver.getLatestSessionForUser('tradingview', {
		userEmail,
		userPassword
	});
	
	if (!sessionInfo) {
		return {
			success: false,
			error: 'No TradingView session found for this user. Please log in via the browser extension.'
		};
	}
	
	// Extract session cookies
	const sessionId = sessionInfo.sessionData.sessionId;
	const sessionIdSign = sessionInfo.sessionData.sessionid_sign;
	
	// Validate sessionId is present
	if (!sessionId) {
		return {
			success: false,
			error: 'Invalid session data: missing sessionId'
		};
	}
	
	// Extract user ID (if available)
	const userId = sessionInfo.sessionData.userId 
		? parseInt(sessionInfo.sessionData.userId, 10)
		: 0; // Fallback to 0 (will need to be extracted from JWT)
	
	// Build warnings array
	const warnings: string[] = [];
	if (!sessionIdSign) {
		warnings.push('sessionid_sign cookie is missing. JWT extraction may fail.');
		warnings.push('Please update the browser extension to capture both sessionid and sessionid_sign cookies.');
	}
	
	// Cache the session for future requests
	cacheSession(userEmail, sessionId, sessionIdSign || '', userId);
	
	return {
		success: true,
		sessionId,
		sessionIdSign,
		userId,
		warnings: warnings.length > 0 ? warnings : undefined
	};
}

/**
 * Fetches JWT data access token from TradingView
 * 
 * @param sessionId - TradingView session ID
 * @param sessionIdSign - TradingView session ID signature
 * @param userId - TradingView user ID
 * @param config - Service configuration
 * @returns JWT token result
 */
export async function fetchJWTToken(
	sessionId: string,
	sessionIdSign: string,
	userId: number,
	config: ChartDataServiceConfig
): Promise<JWTTokenResult> {
	// Check cache first
	const cachedToken = getCachedJWT(sessionId);
	if (cachedToken) {
		return {
			success: true,
			token: cachedToken
		};
	}

	try {
		const token = await config.jwtService.getDataAccessToken(
			sessionId,
			sessionIdSign || '', // Pass empty string if missing (will fail but with better error)
			userId
		);
		
		// Cache the JWT token
		cacheJWT(sessionId, token);
		
		return {
			success: true,
			token
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to get data access token: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Fetches historical bars from TradingView with optional CVD indicator
 * 
 * @param symbol - Stock symbol (e.g., 'NSE:JUNIPER')
 * @param resolution - Time resolution (e.g., '1D', '1W')
 * @param barsCount - Number of bars to fetch
 * @param jwtToken - JWT authentication token
 * @param cvdOptions - CVD indicator configuration
 * @param config - Service configuration
 * @returns Historical data result
 */
export async function fetchHistoricalData(
	symbol: string,
	resolution: string,
	barsCount: number,
	jwtToken: string,
	cvdOptions: {
		cvdEnabled?: boolean;
		cvdAnchorPeriod?: string;
		cvdTimeframe?: string;
		sessionId?: string;
		sessionIdSign?: string;
	},
	config: ChartDataServiceConfig
): Promise<HistoricalDataResult> {
	try {
		const { bars, metadata, indicators } = await config.dataClient.fetchHistoricalBars(
			symbol,
			resolution as Resolution,
			barsCount,
			jwtToken,
			{
				cvdEnabled: cvdOptions.cvdEnabled,
				cvdAnchorPeriod: cvdOptions.cvdAnchorPeriod,
				cvdTimeframe: cvdOptions.cvdTimeframe,
				sessionId: cvdOptions.sessionId,
				sessionIdSign: cvdOptions.sessionIdSign
			}
		);
		
		return {
			success: true,
			bars,
			metadata,
			indicators
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to fetch chart data: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Fetches historical bars using connection pool (for better performance)
 * 
 * Reuses WebSocket connections across multiple requests, eliminating handshake overhead.
 * Uses modify_series to switch symbols on the same connection.
 * 
 * @param symbol - Stock symbol (e.g., 'NSE:JUNIPER')
 * @param resolution - Time resolution (e.g., '1D', '1W')
 * @param barsCount - Number of bars to fetch
 * @param jwtToken - JWT authentication token
 * @param cvdOptions - CVD indicator configuration
 * @returns Historical data result
 */
export async function fetchHistoricalDataPooled(
	symbol: string,
	resolution: string,
	barsCount: number,
	jwtToken: string,
	cvdOptions: {
		cvdEnabled?: boolean;
		cvdAnchorPeriod?: string;
		cvdTimeframe?: string;
		sessionId?: string;
		sessionIdSign?: string;
	}
): Promise<HistoricalDataResult> {
	try {
		// Try to use persistent connection manager if active, otherwise fall back to regular pool
		const persistentManager = getPersistentConnectionManager();
		const pool = persistentManager.isManagerActive()
			? persistentManager.getConnectionPool()
			: getConnectionPool();
		
		if (persistentManager.isManagerActive()) {
			console.log('[ChartDataService] Using persistent connection pool');
		} else {
			console.log('[ChartDataService] Using regular connection pool (persistent not active)');
		}
		
		const result = await pool.fetchChartData(
			jwtToken,
			symbol,
			resolution,
			barsCount,
			{
				cvdEnabled: cvdOptions.cvdEnabled,
				cvdAnchorPeriod: cvdOptions.cvdAnchorPeriod,
				cvdTimeframe: cvdOptions.cvdTimeframe,
				sessionId: cvdOptions.sessionId,
				sessionIdSign: cvdOptions.sessionIdSign
			}
		);
		
		return {
			success: true,
			bars: result.bars,
			metadata: result.metadata,
			indicators: result.indicators
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to fetch chart data: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Main orchestrator: Get chart data from TradingView
 * 
 * @param params - Request parameters
 * @param config - Service configuration (optional, uses defaults if not provided)
 * @returns Chart data service result
 */
export async function getChartData(
	params: {
		symbol: string | null;
		resolution: string | null;
		barsCount: string | null;
		cvdEnabled?: string | null;
		cvdAnchorPeriod?: string | null;
		cvdTimeframe?: string | null;
		userEmail: unknown;
		userPassword: unknown;
	},
	config?: Partial<ChartDataServiceConfig>
): Promise<ChartDataServiceResult> {
	// Create service config with defaults
	const serviceConfig = createChartDataServiceConfig(config);
	
	try {
		const startTime = Date.now();
		
		// 1. Validate chart data request parameters
		const requestValidation = validateChartDataRequest(
			params.symbol,
			params.resolution,
			params.barsCount
		);
		
		if (!requestValidation.valid) {
			return {
				success: false,
				error: requestValidation.error,
				statusCode: 400
			};
		}
		
		const { symbol, resolution, barsCount } = requestValidation.params!;
		
		// 2. Validate user credentials
		const credentialsValidation = validateUserCredentials(
			params.userEmail,
			params.userPassword
		);
		
		if (!credentialsValidation.valid) {
			return {
				success: false,
				error: credentialsValidation.error,
				statusCode: 401
			};
		}
		
		const { userEmail, userPassword } = credentialsValidation.credentials!;
		
		// 3. Resolve user session
		const sessionStart = Date.now();
		const sessionResult = await resolveUserSession(
			userEmail,
			userPassword,
			serviceConfig
		);
		
		if (!sessionResult.success) {
			return {
				success: false,
				error: sessionResult.error,
				statusCode: 401
			};
		}
		const sessionDuration = Date.now() - sessionStart;
		console.log(`[Chart Data Service] Session resolved in ${sessionDuration}ms`);
		
		// Log warnings if any
		if (sessionResult.warnings) {
			for (const warning of sessionResult.warnings) {
				console.warn(`[Chart Data Service] WARNING: ${warning}`);
			}
		}
		
		// 4. Fetch JWT token
		const jwtStart = Date.now();
		const jwtResult = await fetchJWTToken(
			sessionResult.sessionId!,
			sessionResult.sessionIdSign || '',
			sessionResult.userId || 0,
			serviceConfig
		);
		
		if (!jwtResult.success) {
			return {
				success: false,
				error: jwtResult.error,
				statusCode: 401
			};
		}
		const jwtDuration = Date.now() - jwtStart;
		console.log(`[Chart Data Service] JWT fetched in ${jwtDuration}ms`);
		
		// 5. Fetch historical data
		// Use connection pooling by default for better performance (3-5x faster)
		// Set DISABLE_CONNECTION_POOL=true to disable
		const useConnectionPool = !process.env.DISABLE_CONNECTION_POOL;
		const dataStart = Date.now();
		
		// Warn if CVD is requested but credentials missing
		if (params.cvdEnabled === 'true' && (!sessionResult.sessionId || !sessionResult.sessionIdSign)) {
			console.warn('[Chart Data Service] ⚠️ CVD enabled but missing credentials (sessionId or sessionIdSign) - CVD will be skipped automatically');
		}
		
		const dataResult = useConnectionPool
			? await fetchHistoricalDataPooled(
				symbol,
				resolution,
				barsCount,
				jwtResult.token!,
				{
					cvdEnabled: params.cvdEnabled === 'true',
					cvdAnchorPeriod: params.cvdAnchorPeriod || undefined,
					cvdTimeframe: params.cvdTimeframe || undefined,
					sessionId: sessionResult.sessionId,
					sessionIdSign: sessionResult.sessionIdSign
				}
			)
			: await fetchHistoricalData(
				symbol,
				resolution,
				barsCount,
				jwtResult.token!,
				{
					cvdEnabled: params.cvdEnabled === 'true',
					cvdAnchorPeriod: params.cvdAnchorPeriod || undefined,
					cvdTimeframe: params.cvdTimeframe || undefined,
					sessionId: sessionResult.sessionId,
					sessionIdSign: sessionResult.sessionIdSign
				},
				serviceConfig
			);
		
		if (!dataResult.success) {
			return {
				success: false,
				error: dataResult.error,
				statusCode: 500
			};
		}
		const dataDuration = Date.now() - dataStart;
		console.log(`[Chart Data Service] Data fetched in ${dataDuration}ms`);
		
		// 6. Return successful response
		const duration = Date.now() - startTime;
		console.log(`[Chart Data Service] ✅ Success: ${symbol} ${resolution} - Total: ${duration}ms (Session: ${sessionDuration}ms, JWT: ${jwtDuration}ms, Data: ${dataDuration}ms)`);
		
		return {
			success: true,
			data: {
				symbol,
				resolution,
				bars: dataResult.bars!,
				metadata: dataResult.metadata!,
				indicators: dataResult.indicators
			},
			statusCode: 200
		};
		
	} catch (error) {
		console.error('[Chart Data Service] Unexpected error:', error);
		return {
			success: false,
			error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			statusCode: 500
		};
	}
}
