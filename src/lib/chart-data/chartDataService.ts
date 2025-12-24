/**
 * Chart Data Service
 * 
 * Business logic for fetching chart data from TradingView.
 * Handles session resolution, JWT token extraction, and data retrieval.
 */

import { SessionResolver } from '@/lib/SessionResolver';
import { getDataAccessToken } from '@/lib/tradingview/jwtService';
import { WebSocketConnectionManager } from '@/lib/tradingview/v2/WebSocketConnectionManager';
import type { 
	SessionResolutionResult, 
	JWTTokenResult, 
	HistoricalDataResult,
	ChartDataServiceResult 
} from './types';
import { validateChartDataRequest, validateUserCredentials } from './validators';
import { getCachedSession, cacheSession, getCachedJWT, cacheJWT } from './sessionCache';
import { isSessionJWTCacheEnabled } from '@/lib/cache/cacheConfig';
import { debugService, debugSession, debugJwt } from '@/lib/utils/chartDebugLogger';

/**
 * Configuration for chart data service (enables dependency injection)
 */
export interface ChartDataServiceConfig {
	sessionResolver: typeof SessionResolver;
	jwtService: { getDataAccessToken: typeof getDataAccessToken };
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
	// Check cache first (only if enabled via env var)
	const cacheEnabled = isSessionJWTCacheEnabled();
	
	if (cacheEnabled) {
		const cached = getCachedSession(userEmail);
		if (cached) {
			debugSession.cacheHit(userEmail);
			return {
				success: true,
				sessionId: cached.sessionId,
				sessionIdSign: cached.sessionIdSign,
				userId: cached.userId
			};
		}
	}

	// Get TradingView session from KV storage
	debugSession.kvLookupStart('tradingview', userEmail);
	const kvStart = Date.now();
	const sessionInfo = await config.sessionResolver.getLatestSessionForUser('tradingview', {
		userEmail,
		userPassword
	});
	const kvDuration = Date.now() - kvStart;
	debugSession.kvLookupComplete(kvDuration, !!sessionInfo);
	
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
	
	// Cache the session for future requests (only if enabled)
	if (cacheEnabled) {
		cacheSession(userEmail, sessionId, sessionIdSign || '', userId);
	}
	
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
	// Check cache first (only if enabled via env var)
	const cacheEnabled = isSessionJWTCacheEnabled();
	
	if (cacheEnabled) {
		const cachedToken = getCachedJWT(sessionId);
		if (cachedToken) {
			debugJwt.cacheHit(sessionId);
			return {
				success: true,
				token: cachedToken
			};
		}
	}

	try {
		debugJwt.apiCallStart();
		const jwtApiStart = Date.now();
		const token = await config.jwtService.getDataAccessToken(
			sessionId,
			sessionIdSign || '', // Pass empty string if missing (will fail but with better error)
			userId
		);
		const jwtApiDuration = Date.now() - jwtApiStart;
		debugJwt.apiCallComplete(jwtApiDuration);
		
		// Cache the JWT token (only if enabled)
		if (cacheEnabled) {
			cacheJWT(sessionId, token);
		}
		
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

// REMOVED: fetchHistoricalData - Now using v2 WebSocketConnectionManager

/**
 * Fetches historical bars using v2 WebSocket connection manager
 * 
 * Uses v2 architecture with automatic connection management.
 * Supports concurrent requests via connection pooling (for dual layout).
 * 
 * @param symbol - Stock symbol (e.g., 'NSE:JUNIPER')
 * @param resolution - Time resolution (e.g., '1D', '1W')
 * @param barsCount - Number of bars to fetch
 * @param jwtToken - JWT authentication token
 * @param cvdOptions - CVD indicator configuration
 * @returns Historical data result
 */
export async function fetchHistoricalDataV2(
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
		// Get connection manager for this user (singleton pattern)
		const manager = await WebSocketConnectionManager.forUser(
			jwtToken,
			cvdOptions.sessionId,
			cvdOptions.sessionIdSign,
			undefined, // userId not needed
			{
				cvdTimeout: 45000, // 45s for CVD (tested and validated)
				enableLogging: process.env.NODE_ENV === 'development'
			}
		);
		
		// Fetch chart data
		const result = await manager.fetchChartData({
			symbol,
			resolution,
			barsCount,
			cvdEnabled: cvdOptions.cvdEnabled,
			cvdAnchorPeriod: cvdOptions.cvdAnchorPeriod,
			cvdTimeframe: cvdOptions.cvdTimeframe
		});
		
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
 * Now uses v2 WebSocket architecture with connection manager.
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
		debugService.sessionStart();
		const sessionStart = Date.now();
		// Check if session will be cached before calling
		const sessionWasCached = isSessionJWTCacheEnabled() && !!getCachedSession(userEmail);
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
		debugService.sessionComplete(sessionDuration, sessionWasCached);
		
		// Log warnings if any
		if (sessionResult.warnings) {
			for (const warning of sessionResult.warnings) {
			}
		}
		
		// 4. Fetch JWT token
		debugService.jwtStart();
		const jwtStart = Date.now();
		// Check if JWT will be cached before calling
		const jwtWasCached = isSessionJWTCacheEnabled() && !!getCachedJWT(sessionResult.sessionId!);
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
		debugService.jwtComplete(jwtDuration, jwtWasCached);
		
		// 5. Fetch historical data using v2 WebSocket architecture
		debugService.dataStart(true); // Always using v2 connection manager
		const dataStart = Date.now();
		
		// Warn if CVD is requested but credentials missing
		if (params.cvdEnabled === 'true' && (!sessionResult.sessionId || !sessionResult.sessionIdSign)) {
			console.warn('[Chart Data Service] CVD requested but session credentials missing');
		}
		
		const dataResult = await fetchHistoricalDataV2(
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
		);
		
		if (!dataResult.success) {
			return {
				success: false,
				error: dataResult.error,
				statusCode: 500
			};
		}
		const dataDuration = Date.now() - dataStart;
		debugService.dataComplete(dataDuration);
		
		// 6. Return successful response
		const duration = Date.now() - startTime;
		debugService.breakdown(sessionDuration, jwtDuration, dataDuration, duration);
		
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
		return {
			success: false,
			error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			statusCode: 500
		};
	}
}
