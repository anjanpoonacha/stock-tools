/**
 * Health monitoring integration and session refresh logic.
 * Contains functions that integrate session validation with health monitoring.
 */
import { MIOService } from '../mio';
import { sessionHealthMonitor } from '../health';
import { getSession } from '../sessionStore';
import {
	SessionError,
	ErrorHandler,
	Platform,
	ErrorLogger
} from '../errors';
import { validateSessionId } from './validators';

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
		return { success: false, error: errorMessage };
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

			} catch (error) {
				// Don't fail the entire operation if health check fails
			}
		} else {
			// Stop monitoring for failed refresh
			sessionHealthMonitor.stopMonitoring(internalSessionId, platform);

			if (refreshError) {
				ErrorLogger.logError(refreshError);
			}

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
		} else {
			// Stop monitoring for all platforms of this session
			const healthReport = sessionHealthMonitor.getSessionHealthReport(internalSessionId);
			if (healthReport) {
				for (const platformName of Object.keys(healthReport.platforms)) {
					sessionHealthMonitor.stopMonitoring(internalSessionId, platformName);
				}
			}
		}
	} catch (error) {
	}
}
