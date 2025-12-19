// src/lib/health/healthChecker.ts

import { MIOService } from '../mio';
import { SessionError, ErrorHandler, ErrorLogger, Platform } from '../sessionErrors';
import {
	SessionHealthStatus,
	SessionHealthMetrics,
	MonitoringStats,
	HealthAnalysis
} from './types';

/**
 * Health checker configuration constants
 */
export const HEALTH_CONFIG = {
	DEFAULT_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
	WARNING_CHECK_INTERVAL: 1 * 60 * 1000, // 1 minute
	CRITICAL_CHECK_INTERVAL: 30 * 1000, // 30 seconds
	MAX_CONSECUTIVE_FAILURES: 3,
	EXPONENTIAL_BACKOFF_BASE: 2,
	MAX_CHECK_INTERVAL: 15 * 60 * 1000, // 15 minutes
	MAX_ERROR_HISTORY: 100,
	MAX_RECENT_ERRORS: 50,
	RECENT_ERROR_WINDOW: 24 * 60 * 60 * 1000, // 24 hours
} as const;

/**
 * Creates initial health metrics for a new session/platform
 */
export function createHealthMetrics(
	internalSessionId: string,
	platform: string
): SessionHealthMetrics {
	return {
		internalSessionId,
		platform,
		status: 'healthy',
		lastSuccessfulCheck: null,
		lastFailedCheck: null,
		consecutiveFailures: 0,
		totalChecks: 0,
		totalFailures: 0,
		lastRefreshAttempt: null,
		lastSuccessfulRefresh: null,
		nextCheckTime: new Date(Date.now() + HEALTH_CONFIG.DEFAULT_CHECK_INTERVAL),
		checkInterval: HEALTH_CONFIG.DEFAULT_CHECK_INTERVAL,
		isMonitoring: true,
		errorHistory: [],
		recoveryAttempts: 0,
		lastRecoveryAttempt: null,
	};
}

/**
 * Performs platform-specific health check
 */
export async function performPlatformHealthCheck(
	platform: string,
	internalSessionId: string
): Promise<boolean> {
	switch (platform) {
		case 'marketinout':
			return await MIOService.validateSessionHealth(internalSessionId);
		case 'tradingview':
			return await checkTradingViewHealth(internalSessionId);
		default:
			return false;
	}
}

/**
 * TradingView health check (placeholder - needs implementation)
 * Enhanced with proper error handling structure.
 */
async function checkTradingViewHealth(internalSessionId: string): Promise<boolean> {
	try {
		// Validate input parameters
		if (!internalSessionId) {
			const error = ErrorHandler.createGenericError(
				Platform.TRADINGVIEW,
				'checkTradingViewHealth',
				'Missing required parameter: internalSessionId'
			);
			ErrorLogger.logError(error);
			throw error;
		}

		// TODO: Implement TradingView session health check
		return true; // Assume healthy for now
	} catch (error) {
		if (error instanceof SessionError) {
			throw error;
		}

		const sessionError = ErrorHandler.parseError(
			error,
			Platform.TRADINGVIEW,
			'checkTradingViewHealth',
			undefined,
			undefined
		);
		ErrorLogger.logError(sessionError);
		throw sessionError;
	}
}

/**
 * TradingView session refresh (placeholder - needs implementation)
 * Enhanced with proper error handling structure.
 */
export async function refreshTradingViewSession(internalSessionId: string): Promise<boolean> {
	try {
		// Validate input parameters
		if (!internalSessionId) {
			const error = ErrorHandler.createGenericError(
				Platform.TRADINGVIEW,
				'refreshTradingViewSession',
				'Missing required parameter: internalSessionId'
			);
			ErrorLogger.logError(error);
			throw error;
		}

		// TODO: Implement TradingView session refresh
		return true; // Assume success for now
	} catch (error) {
		if (error instanceof SessionError) {
			throw error;
		}

		const sessionError = ErrorHandler.parseError(
			error,
			Platform.TRADINGVIEW,
			'refreshTradingViewSession',
			undefined,
			undefined
		);
		ErrorLogger.logError(sessionError);
		throw sessionError;
	}
}

/**
 * Updates health metrics based on check result
 */
export function updateHealthMetrics(metrics: SessionHealthMetrics, isHealthy: boolean): void {
	metrics.totalChecks++;

	if (isHealthy) {
		updateHealthyMetrics(metrics);
	} else {
		updateUnhealthyMetrics(metrics);
	}

	metrics.nextCheckTime = new Date(Date.now() + metrics.checkInterval);
}

/**
 * Updates metrics for successful health check
 */
function updateHealthyMetrics(metrics: SessionHealthMetrics): void {
	metrics.lastSuccessfulCheck = new Date();
	metrics.consecutiveFailures = 0;

	const failureRate = metrics.totalFailures / metrics.totalChecks;
	if (failureRate < 0.1) {
		metrics.status = 'healthy';
		metrics.checkInterval = HEALTH_CONFIG.DEFAULT_CHECK_INTERVAL;
	} else if (failureRate < 0.3) {
		metrics.status = 'warning';
		metrics.checkInterval = HEALTH_CONFIG.WARNING_CHECK_INTERVAL;
	}
}

/**
 * Updates metrics for failed health check
 */
function updateUnhealthyMetrics(metrics: SessionHealthMetrics): void {
	metrics.lastFailedCheck = new Date();
	metrics.consecutiveFailures++;
	metrics.totalFailures++;

	if (metrics.consecutiveFailures >= HEALTH_CONFIG.MAX_CONSECUTIVE_FAILURES) {
		metrics.status = 'expired';
		metrics.isMonitoring = false;
	} else if (metrics.consecutiveFailures >= 2) {
		metrics.status = 'critical';
		metrics.checkInterval = HEALTH_CONFIG.CRITICAL_CHECK_INTERVAL;
	} else {
		metrics.status = 'warning';
		metrics.checkInterval = HEALTH_CONFIG.WARNING_CHECK_INTERVAL;
	}
}

/**
 * Updates metrics when health check throws an error
 */
export function updateHealthMetricsOnError(metrics: SessionHealthMetrics): void {
	metrics.lastFailedCheck = new Date();
	metrics.consecutiveFailures++;
	metrics.totalFailures++;
	metrics.totalChecks++;
	metrics.status = 'critical';
	metrics.checkInterval = HEALTH_CONFIG.CRITICAL_CHECK_INTERVAL;
	metrics.nextCheckTime = new Date(Date.now() + metrics.checkInterval);
}

/**
 * Records an error in the health check metrics
 * Enhanced error tracking with categorization and recovery suggestions.
 */
export function recordHealthCheckError(metrics: SessionHealthMetrics, error: SessionError): void {
	// Update last error
	metrics.lastError = error;

	// Add to error history (keep last 100 errors)
	metrics.errorHistory.push(error);
	if (metrics.errorHistory.length > HEALTH_CONFIG.MAX_ERROR_HISTORY) {
		metrics.errorHistory = metrics.errorHistory.slice(-HEALTH_CONFIG.MAX_ERROR_HISTORY);
	}

	// Log the error for monitoring
	ErrorLogger.logError(error);

}

/**
 * Collects all platform metrics for a session
 */
export function collectSessionPlatforms(
	healthMetrics: Map<string, SessionHealthMetrics>,
	internalSessionId: string
): { [platform: string]: SessionHealthMetrics } {
	const sessionPlatforms: { [platform: string]: SessionHealthMetrics } = {};

	for (const [, metrics] of healthMetrics.entries()) {
		if (metrics.internalSessionId === internalSessionId) {
			sessionPlatforms[metrics.platform] = metrics;
		}
	}

	return sessionPlatforms;
}

/**
 * Determines overall status from platform metrics (worst status wins)
 */
export function determineOverallStatus(
	sessionPlatforms: { [platform: string]: SessionHealthMetrics }
): SessionHealthStatus {
	let overallStatus: SessionHealthStatus = 'healthy';

	for (const metrics of Object.values(sessionPlatforms)) {
		if (metrics.status === 'expired') {
			overallStatus = 'expired';
		} else if (metrics.status === 'critical' && overallStatus !== 'expired') {
			overallStatus = 'critical';
		} else if (metrics.status === 'warning' && (overallStatus === 'healthy' || overallStatus === 'warning')) {
			overallStatus = 'warning';
		}
	}

	return overallStatus;
}

/**
 * Analyzes session health and generates recommendations
 */
export function analyzeSessionHealth(
	sessionPlatforms: { [platform: string]: SessionHealthMetrics }
): HealthAnalysis {
	const criticalErrors: SessionError[] = [];
	const recommendedActions: string[] = [];
	let autoRecoveryAvailable = false;

	for (const metrics of Object.values(sessionPlatforms)) {
		if (metrics.lastError && (metrics.status === 'critical' || metrics.status === 'expired')) {
			criticalErrors.push(metrics.lastError);
		}

		// Add recommended actions based on status
		if (metrics.status === 'expired') {
			recommendedActions.push(`Re-authenticate ${metrics.platform} session`);
		} else if (metrics.status === 'critical') {
			recommendedActions.push(`Check ${metrics.platform} connection and credentials`);
			autoRecoveryAvailable = true;
		} else if (metrics.status === 'warning') {
			autoRecoveryAvailable = true;
		}
	}

	return { criticalErrors, recommendedActions, autoRecoveryAvailable };
}

/**
 * Calculates monitoring statistics from health metrics
 */
export function calculateMonitoringStats(
	healthMetrics: Map<string, SessionHealthMetrics>,
	isGlobalMonitoringActive: boolean
): MonitoringStats {
	const stats: MonitoringStats = {
		totalSessions: healthMetrics.size,
		activeSessions: 0,
		healthySessions: 0,
		warningSessions: 0,
		criticalSessions: 0,
		expiredSessions: 0,
		isGlobalMonitoringActive,
		totalErrors: 0,
		totalRecoveryAttempts: 0,
		successfulRecoveries: 0,
		recentErrors: [],
	};

	for (const metrics of healthMetrics.values()) {
		if (metrics.isMonitoring) stats.activeSessions++;

		// Count errors and recovery attempts
		stats.totalErrors += metrics.errorHistory.length;
		stats.totalRecoveryAttempts += metrics.recoveryAttempts;

		// Count successful recoveries (sessions that had errors but are now healthy)
		if (metrics.errorHistory.length > 0 && metrics.status === 'healthy') {
			stats.successfulRecoveries++;
		}

		// Collect recent errors (from last 24 hours)
		const oneDayAgo = new Date(Date.now() - HEALTH_CONFIG.RECENT_ERROR_WINDOW);
		const recentErrors = metrics.errorHistory.filter(error =>
			error.timestamp && new Date(error.timestamp) > oneDayAgo
		);
		stats.recentErrors.push(...recentErrors);

		switch (metrics.status) {
			case 'healthy': stats.healthySessions++; break;
			case 'warning': stats.warningSessions++; break;
			case 'critical': stats.criticalSessions++; break;
			case 'expired': stats.expiredSessions++; break;
		}
	}

	// Sort recent errors by timestamp (most recent first)
	stats.recentErrors.sort((a, b) => {
		const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
		const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
		return timeB - timeA;
	});

	// Limit to 50 most recent errors
	stats.recentErrors = stats.recentErrors.slice(0, HEALTH_CONFIG.MAX_RECENT_ERRORS);

	return stats;
}

/**
 * Calculates delay for next health check with exponential backoff
 */
export function calculateCheckDelay(metrics: SessionHealthMetrics): number {
	let delay = metrics.checkInterval;
	if (metrics.consecutiveFailures > 0) {
		delay = Math.min(
			delay * Math.pow(HEALTH_CONFIG.EXPONENTIAL_BACKOFF_BASE, metrics.consecutiveFailures - 1),
			HEALTH_CONFIG.MAX_CHECK_INTERVAL
		);
	}
	return delay;
}
