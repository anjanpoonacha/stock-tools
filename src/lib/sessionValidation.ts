/**
 * Enhanced session validation with proactive health monitoring integration.
 * Validates sessions and automatically starts health monitoring for valid sessions.
 * Now includes comprehensive error handling with SessionError system.
 */
import { MIOService } from './MIOService';
import { sessionHealthMonitor } from './sessionHealthMonitor';
import { getSession } from './sessionStore';
import {
	SessionError,
	ErrorHandler,
	Platform,
	ErrorLogger
} from './sessionErrors';

// Helper function to validate session ID parameter
function validateSessionId(sessionId: string, functionName: string, platform: Platform = Platform.UNKNOWN): void {
	if (!sessionId) {
		const error = ErrorHandler.createGenericError(
			platform,
			functionName,
			'Missing required parameter: internalSessionId'
		);
		ErrorLogger.logError(error);
		throw error;
	}
}

// Helper function to cleanup invalid session
async function cleanupInvalidSession(sessionId: string, platform?: string): Promise<void> {
	const { deleteSession } = await import('./sessionStore');
	deleteSession(sessionId);
	
	if (platform) {
		sessionHealthMonitor.stopMonitoring(sessionId, platform);
	}
}

// Helper function to handle validation errors consistently
function handleValidationError(
	error: unknown,
	sessionId: string,
	platform: Platform,
	functionName: string,
	platformName?: string
): SessionError {
	if (error instanceof SessionError) {
		return error;
	}
	
	return ErrorHandler.parseError(
		error,
		platform,
		functionName,
		undefined,
		undefined
	);
}

/**
 * Validate a MarketInOut session by attempting to fetch the watchlist.
 * If invalid, deletes the session and returns false.
 * Returns the watchlists array if valid, or throws SessionError if invalid.
 * Now integrates with proactive health monitoring and enhanced error handling.
 */
export async function validateAndCleanupMarketinoutSession(
	internalSessionId: string
): Promise<{ id: string; name: string }[]> {
	try {
		validateSessionId(internalSessionId, 'validateAndCleanupMarketinoutSession', Platform.MARKETINOUT);
		console.log(`[SessionValidation] Validating MIO session: ${internalSessionId}`);

		const watchlists = await MIOService.getWatchlistsWithSession(internalSessionId);
		if (!watchlists || watchlists.length === 0) {
			console.warn(`[SessionValidation] No watchlists found for session: ${internalSessionId}`);
			await cleanupInvalidSession(internalSessionId, 'marketinout');

			const error = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'validateAndCleanupMarketinoutSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		console.log(`[SessionValidation] Session validation successful for: ${internalSessionId}`);
		sessionHealthMonitor.startMonitoring(internalSessionId, 'marketinout');
		return watchlists;
	} catch (err: unknown) {
		console.error(`[SessionValidation] Session validation failed for: ${internalSessionId}`, err);
		
		// Always cleanup on any error
		await cleanupInvalidSession(internalSessionId, 'marketinout');
		
		// Handle and re-throw the error
		const sessionError = handleValidationError(err, internalSessionId, Platform.MARKETINOUT, 'validateAndCleanupMarketinoutSession');
		ErrorLogger.logError(sessionError);
		throw sessionError;
	}
}

/**
 * Validate TradingView session using the custom watchlists API endpoint.
 * Uses the new validateTradingViewSession function from tradingview.ts.
 */
async function validateTradingViewSession(internalSessionId: string): Promise<boolean> {
	try {
		validateSessionId(internalSessionId, 'validateTradingViewSession', Platform.TRADINGVIEW);

		const session = await getSession(internalSessionId);
		if (!session?.tradingview?.sessionId) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.TRADINGVIEW,
				'validateTradingViewSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		const { validateTradingViewSession: validateTVSession } = await import('./tradingview');
		const cookie = `sessionid=${session.tradingview.sessionId}`;

		console.log(`[SessionValidation] Validating TradingView session: ${internalSessionId}`);
		const validationResult = await validateTVSession(cookie);

		if (!validationResult.isValid) {
			console.warn(`[SessionValidation] TradingView session validation failed for ${internalSessionId}:`, validationResult.error);
			await cleanupInvalidSession(internalSessionId, 'tradingview');

			const error = ErrorHandler.createSessionExpiredError(
				Platform.TRADINGVIEW,
				'validateTradingViewSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		console.log(`[SessionValidation] TradingView session validation successful for ${internalSessionId}:`, {
			watchlistCount: validationResult.watchlistCount,
			hasValidIds: validationResult.hasValidIds
		});

		sessionHealthMonitor.startMonitoring(internalSessionId, 'tradingview');
		return true;
	} catch (error) {
		await cleanupInvalidSession(internalSessionId, 'tradingview');
		
		const sessionError = handleValidationError(error, internalSessionId, Platform.TRADINGVIEW, 'validateTradingViewSession');
		ErrorLogger.logError(sessionError);
		throw sessionError;
	}
}

/**
 * Validate all platforms for a session and start monitoring for valid ones.
 * This is useful when a session is first established or when doing comprehensive validation.
 * Enhanced with detailed error categorization and recovery information.
 */
export async function validateAndMonitorAllPlatforms(internalSessionId: string): Promise<{
	validPlatforms: string[];
	invalidPlatforms: string[];
	errors: { [platform: string]: SessionError };
	summary: {
		totalPlatforms: number;
		validCount: number;
		invalidCount: number;
		canAutoRecover: boolean;
		recoveryActions: string[];
	};
}> {
	try {
		validateSessionId(internalSessionId, 'validateAndMonitorAllPlatforms');

		const session = await getSession(internalSessionId);
		if (!session) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.UNKNOWN,
				'validateAndMonitorAllPlatforms',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		const results = {
			validPlatforms: [] as string[],
			invalidPlatforms: [] as string[],
			errors: {} as { [platform: string]: SessionError },
			summary: {
				totalPlatforms: 0,
				validCount: 0,
				invalidCount: 0,
				canAutoRecover: false,
				recoveryActions: [] as string[]
			}
		};

		const platforms = Object.keys(session);
		results.summary.totalPlatforms = platforms.length;
		console.log(`[SessionValidation] Validating ${platforms.length} platforms for session: ${internalSessionId}`);

		for (const platform of platforms) {
			try {
				let isValid = false;

				switch (platform) {
					case 'marketinout':
						// Use existing MIO validation
						await validateAndCleanupMarketinoutSession(internalSessionId);
						isValid = true;
						break;

					case 'tradingview':
						// Use TradingView validation
						isValid = await validateTradingViewSession(internalSessionId);
						break;

					default:
						console.warn(`[SessionValidation] Unknown platform: ${platform}`);
						isValid = false;
						const unknownPlatformError = ErrorHandler.createGenericError(
							Platform.UNKNOWN,
							'validateAndMonitorAllPlatforms',
							`Unknown platform: ${platform}`
						);
						results.errors[platform] = unknownPlatformError;
						ErrorLogger.logError(unknownPlatformError);
				}

				if (isValid) {
					results.validPlatforms.push(platform);
					results.summary.validCount++;
					// Start monitoring for valid platform
					sessionHealthMonitor.startMonitoring(internalSessionId, platform);
				} else {
					results.invalidPlatforms.push(platform);
					results.summary.invalidCount++;
				}

			} catch (error) {
				console.error(`[SessionValidation] Validation failed for ${platform}:`, error);

				results.invalidPlatforms.push(platform);
				results.summary.invalidCount++;

				// Handle SessionError instances
				if (error instanceof SessionError) {
					results.errors[platform] = error;

					// Check if this error can be auto-recovered
					if (error.canAutoRecover()) {
						results.summary.canAutoRecover = true;
						results.summary.recoveryActions.push(...error.getRecoveryInstructions());
					}
				} else {
					// Parse and categorize unknown errors
					const platformEnum = platform === 'marketinout' ? Platform.MARKETINOUT :
						platform === 'tradingview' ? Platform.TRADINGVIEW :
							Platform.UNKNOWN;

					const sessionError = ErrorHandler.parseError(
						error,
						platformEnum,
						'validateAndMonitorAllPlatforms',
						undefined,
						undefined
					);
					results.errors[platform] = sessionError;
					ErrorLogger.logError(sessionError);

					if (sessionError.canAutoRecover()) {
						results.summary.canAutoRecover = true;
						results.summary.recoveryActions.push(...sessionError.getRecoveryInstructions());
					}
				}

				// Stop monitoring for invalid platform
				sessionHealthMonitor.stopMonitoring(internalSessionId, platform);
			}
		}

		// Remove duplicate recovery actions
		results.summary.recoveryActions = [...new Set(results.summary.recoveryActions)];

		console.log(`[SessionValidation] Validation complete for session ${internalSessionId}:`, {
			valid: results.summary.validCount,
			invalid: results.summary.invalidCount,
			canAutoRecover: results.summary.canAutoRecover
		});

		return results;
	} catch (error) {
		// If it's already a SessionError, re-throw it
		if (error instanceof SessionError) {
			throw error;
		}

		// Parse and wrap the error
		const sessionError = ErrorHandler.parseError(
			error,
			Platform.UNKNOWN,
			'validateAndMonitorAllPlatforms',
			undefined,
			undefined
		);
		ErrorLogger.logError(sessionError);
		throw sessionError;
	}
}

/**
 * Get session health status with validation context
 * Enhanced with error handling and detailed health information.
 */
export async function getSessionHealthWithValidation(internalSessionId: string): Promise<{
	healthReport: {
		sessionId: string;
		platforms: {
			[platform: string]: {
				internalSessionId: string;
				platform: string;
				status: 'healthy' | 'warning' | 'critical' | 'expired';
				lastSuccessfulCheck: Date | null;
				lastFailedCheck: Date | null;
				consecutiveFailures: number;
				totalChecks: number;
				totalFailures: number;
				lastRefreshAttempt: Date | null;
				lastSuccessfulRefresh: Date | null;
				nextCheckTime: Date;
				checkInterval: number;
				isMonitoring: boolean;
				lastError?: SessionError;
				errorHistory: SessionError[];
				recoveryAttempts: number;
				lastRecoveryAttempt: Date | null;
			};
		};
		overallStatus: 'healthy' | 'warning' | 'critical' | 'expired';
		lastUpdated: Date;
		criticalErrors: SessionError[];
		recommendedActions: string[];
		autoRecoveryAvailable: boolean;
	} | null;
	sessionExists: boolean;
	platforms: string[];
	isBeingMonitored: boolean;
	timestamp: string;
	errors?: SessionError[];
	recommendations?: string[];
}> {
	try {
		validateSessionId(internalSessionId, 'getSessionHealthWithValidation');

		const healthReport = sessionHealthMonitor.getSessionHealthReport(internalSessionId);
		const session = await getSession(internalSessionId);

		const result = {
			healthReport,
			sessionExists: !!session,
			platforms: session ? Object.keys(session) : [],
			isBeingMonitored: !!healthReport,
			timestamp: new Date().toISOString(),
			errors: [] as SessionError[],
			recommendations: [] as string[]
		};

		// Add recommendations based on health status
		if (!session) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.UNKNOWN,
				'getSessionHealthWithValidation',
				internalSessionId
			);
			result.errors.push(error);
			result.recommendations.push(...error.getRecoveryInstructions());
		} else if (!healthReport) {
			result.recommendations.push('Consider starting health monitoring for this session');
		} else if (healthReport.overallStatus === 'critical' || healthReport.overallStatus === 'expired') {
			result.recommendations.push('Session appears unhealthy - consider refreshing or re-authenticating');
		}

		return result;
	} catch (error) {
		// If it's already a SessionError, include it in the response
		if (error instanceof SessionError) {
			return {
				healthReport: null,
				sessionExists: false,
				platforms: [],
				isBeingMonitored: false,
				timestamp: new Date().toISOString(),
				errors: [error],
				recommendations: error.getRecoveryInstructions()
			};
		}

		// Parse and wrap the error
		const sessionError = ErrorHandler.parseError(
			error,
			Platform.UNKNOWN,
			'getSessionHealthWithValidation',
			undefined,
			undefined
		);
		ErrorLogger.logError(sessionError);

		return {
			healthReport: null,
			sessionExists: false,
			platforms: [],
			isBeingMonitored: false,
			timestamp: new Date().toISOString(),
			errors: [sessionError],
			recommendations: sessionError.getRecoveryInstructions()
		};
	}
}

/**
 * Force refresh and revalidate a session
 */
export async function forceSessionRefreshAndValidation(
	internalSessionId: string,
	platform: string
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
	try {
		validateSessionId(internalSessionId, 'forceSessionRefreshAndValidation');
		
		if (!platform) {
			throw new Error('Missing required parameter: platform');
		}

		console.log(`[SessionValidation] Force refresh and validation for ${platform}:${internalSessionId}`);

		let refreshSuccess = false;

		switch (platform) {
			case 'marketinout':
				refreshSuccess = await MIOService.refreshSession(internalSessionId);
				break;
			case 'tradingview':
				// TODO: Implement TradingView refresh
				refreshSuccess = true;
				break;
			default:
				throw new Error(`Unknown platform: ${platform}`);
		}

		if (refreshSuccess) {
			// Perform health check after refresh
			const newStatus = await sessionHealthMonitor.checkSessionHealth(internalSessionId, platform);
			return { success: true, newStatus };
		} else {
			return { success: false, error: 'Session refresh failed' };
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[SessionValidation] Force refresh failed for ${platform}:${internalSessionId}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

/**
 * Validate session and start health monitoring automatically.
 * This is the new unified validation function that combines validation with health monitoring.
 */
export async function validateAndStartMonitoring(
	internalSessionId: string,
	platform: string
): Promise<{
	isValid: boolean;
	healthStatus?: string;
	watchlists?: { id: string; name: string }[];
	error?: SessionError;
	monitoringStarted: boolean;
}> {
	try {
		// Validate input parameters
		if (!internalSessionId || !platform) {
			const error = ErrorHandler.createGenericError(
				Platform.UNKNOWN,
				'validateAndStartMonitoring',
				`Missing required parameters: internalSessionId=${!!internalSessionId}, platform=${platform}`
			);
			ErrorLogger.logError(error);
			return { isValid: false, error, monitoringStarted: false };
		}

		console.log(`[SessionValidation] Validating and starting monitoring for ${platform}:${internalSessionId}`);

		let isValid = false;
		let watchlists: { id: string; name: string }[] | undefined;
		let validationError: SessionError | undefined;

		// Perform platform-specific validation
		switch (platform) {
			case 'marketinout':
				try {
					watchlists = await validateAndCleanupMarketinoutSession(internalSessionId);
					isValid = true;
				} catch (error) {
					if (error instanceof SessionError) {
						validationError = error;
					} else {
						validationError = ErrorHandler.parseError(
							error,
							Platform.MARKETINOUT,
							'validateAndStartMonitoring',
							undefined,
							undefined
						);
					}
					isValid = false;
				}
				break;

			case 'tradingview':
				try {
					isValid = await validateTradingViewSession(internalSessionId);
				} catch (error) {
					if (error instanceof SessionError) {
						validationError = error;
					} else {
						validationError = ErrorHandler.parseError(
							error,
							Platform.TRADINGVIEW,
							'validateAndStartMonitoring',
							undefined,
							undefined
						);
					}
					isValid = false;
				}
				break;

			default:
				validationError = ErrorHandler.createGenericError(
					Platform.UNKNOWN,
					'validateAndStartMonitoring',
					`Unknown platform: ${platform}`
				);
				isValid = false;
		}

		let monitoringStarted = false;
		let healthStatus: string | undefined;

		if (isValid) {
			// Start health monitoring for valid session
			sessionHealthMonitor.startMonitoring(internalSessionId, platform);
			monitoringStarted = true;

			// Get initial health status
			healthStatus = await sessionHealthMonitor.checkSessionHealth(internalSessionId, platform);

			console.log(`[SessionValidation] Session validated and monitoring started for ${platform}:${internalSessionId}`);
		} else {
			// Stop any existing monitoring for invalid session
			sessionHealthMonitor.stopMonitoring(internalSessionId, platform);
			monitoringStarted = false;

			if (validationError) {
				ErrorLogger.logError(validationError);
			}

			console.log(`[SessionValidation] Session validation failed for ${platform}:${internalSessionId}`);
		}

		return {
			isValid,
			healthStatus,
			watchlists,
			error: validationError,
			monitoringStarted
		};

	} catch (error) {
		// Handle unexpected errors
		const sessionError = ErrorHandler.parseError(
			error,
			platform === 'marketinout' ? Platform.MARKETINOUT :
				platform === 'tradingview' ? Platform.TRADINGVIEW : Platform.UNKNOWN,
			'validateAndStartMonitoring',
			undefined,
			undefined
		);
		ErrorLogger.logError(sessionError);

		// Ensure monitoring is stopped on error
		sessionHealthMonitor.stopMonitoring(internalSessionId, platform);

		return {
			isValid: false,
			error: sessionError,
			monitoringStarted: false
		};
	}
}

/**
 * Get session data with integrated health status.
 * This provides a unified view of session data including health information.
 */
export async function getHealthAwareSessionData(internalSessionId: string): Promise<{
	sessionExists: boolean;
	platforms: string[];
	healthReport: any; // eslint-disable-line @typescript-eslint/no-explicit-any
	overallStatus: 'healthy' | 'warning' | 'critical' | 'expired' | 'unknown';
	recommendations: string[];
	canAutoRecover: boolean;
	timestamp: string;
}> {
	try {
		validateSessionId(internalSessionId, 'getHealthAwareSessionData');

		const session = await getSession(internalSessionId);
		const healthReport = sessionHealthMonitor.getSessionHealthReport(internalSessionId);

		const result = {
			sessionExists: !!session,
			platforms: session ? Object.keys(session) : [],
			healthReport,
			overallStatus: healthReport?.overallStatus || (session ? 'unknown' : 'expired') as any, // eslint-disable-line @typescript-eslint/no-explicit-any
			recommendations: [] as string[],
			canAutoRecover: healthReport?.autoRecoveryAvailable || false,
			timestamp: new Date().toISOString()
		};

		// Add recommendations based on session and health status
		if (!session) {
			result.recommendations.push('Session not found - please re-authenticate');
		} else if (!healthReport) {
			result.recommendations.push('Health monitoring not active - consider starting monitoring');
		} else {
			result.recommendations.push(...healthReport.recommendedActions);
		}

		return result;

	} catch (error) {
		const sessionError = ErrorHandler.parseError(
			error,
			Platform.UNKNOWN,
			'getHealthAwareSessionData',
			undefined,
			undefined
		);
		ErrorLogger.logError(sessionError);

		return {
			sessionExists: false,
			platforms: [],
			healthReport: null,
			overallStatus: 'unknown',
			recommendations: ['Error retrieving session data'],
			canAutoRecover: false,
			timestamp: new Date().toISOString()
		};
	}
}

/**
 * Refresh session with integrated health check.
 * This combines session refresh with immediate health validation.
 */
export async function refreshSessionWithHealthCheck(
	internalSessionId: string,
	platform: string
): Promise<{
	refreshSuccess: boolean;
	healthStatus?: string;
	error?: SessionError;
	monitoringActive: boolean;
}> {
	try {
		validateSessionId(internalSessionId, 'refreshSessionWithHealthCheck');
		
		if (!platform) {
			const error = ErrorHandler.createGenericError(
				Platform.UNKNOWN,
				'refreshSessionWithHealthCheck',
				`Missing required parameter: platform=${platform}`
			);
			ErrorLogger.logError(error);
			return { refreshSuccess: false, error, monitoringActive: false };
		}

		console.log(`[SessionValidation] Refreshing session with health check for ${platform}:${internalSessionId}`);

		let refreshSuccess = false;
		let refreshError: SessionError | undefined;

		// Perform platform-specific refresh
		switch (platform) {
			case 'marketinout':
				try {
					refreshSuccess = await MIOService.refreshSession(internalSessionId);
				} catch (error) {
					if (error instanceof SessionError) {
						refreshError = error;
					} else {
						refreshError = ErrorHandler.parseError(
							error,
							Platform.MARKETINOUT,
							'refreshSessionWithHealthCheck',
							undefined,
							undefined
						);
					}
				}
				break;

			case 'tradingview':
				// TODO: Implement TradingView refresh
				refreshSuccess = true;
				break;

			default:
				refreshError = ErrorHandler.createGenericError(
					Platform.UNKNOWN,
					'refreshSessionWithHealthCheck',
					`Unknown platform: ${platform}`
				);
		}

		let healthStatus: string | undefined;
		let monitoringActive = false;

		if (refreshSuccess) {
			// Perform health check after successful refresh
			try {
				healthStatus = await sessionHealthMonitor.checkSessionHealth(internalSessionId, platform);
				monitoringActive = sessionHealthMonitor.getSessionHealth(internalSessionId, platform)?.isMonitoring || false;

				console.log(`[SessionValidation] Session refreshed and health checked for ${platform}:${internalSessionId} - Status: ${healthStatus}`);
			} catch (error) {
				console.warn(`[SessionValidation] Health check failed after refresh for ${platform}:${internalSessionId}:`, error);
				// Don't fail the entire operation if health check fails
			}
		} else {
			// Stop monitoring for failed refresh
			sessionHealthMonitor.stopMonitoring(internalSessionId, platform);

			if (refreshError) {
				ErrorLogger.logError(refreshError);
			}

			console.log(`[SessionValidation] Session refresh failed for ${platform}:${internalSessionId}`);
		}

		return {
			refreshSuccess,
			healthStatus,
			error: refreshError,
			monitoringActive
		};

	} catch (error) {
		const sessionError = ErrorHandler.parseError(
			error,
			platform === 'marketinout' ? Platform.MARKETINOUT :
				platform === 'tradingview' ? Platform.TRADINGVIEW : Platform.UNKNOWN,
			'refreshSessionWithHealthCheck',
			undefined,
			undefined
		);
		ErrorLogger.logError(sessionError);

		// Ensure monitoring is stopped on error
		sessionHealthMonitor.stopMonitoring(internalSessionId, platform);

		return {
			refreshSuccess: false,
			error: sessionError,
			monitoringActive: false
		};
	}
}

/**
 * Stop monitoring for invalid sessions.
 * This is used to clean up monitoring when sessions become invalid.
 */
export function stopMonitoringOnInvalidSession(
	internalSessionId: string,
	platform?: string
): void {
	try {
		validateSessionId(internalSessionId, 'stopMonitoringOnInvalidSession');

		if (platform) {
			// Stop monitoring for specific platform
			sessionHealthMonitor.stopMonitoring(internalSessionId, platform);
			console.log(`[SessionValidation] Stopped monitoring for ${platform}:${internalSessionId}`);
		} else {
			// Stop monitoring for all platforms of this session
			const healthReport = sessionHealthMonitor.getSessionHealthReport(internalSessionId);
			if (healthReport) {
				for (const platformName of Object.keys(healthReport.platforms)) {
					sessionHealthMonitor.stopMonitoring(internalSessionId, platformName);
				}
				console.log(`[SessionValidation] Stopped monitoring for all platforms of session ${internalSessionId}`);
			}
		}
	} catch (error) {
		console.error(`[SessionValidation] Error stopping monitoring for ${internalSessionId}:`, error);
	}
}
