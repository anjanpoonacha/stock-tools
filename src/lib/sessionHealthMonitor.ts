// src/lib/sessionHealthMonitor.ts

import { MIOService } from './MIOService';
import { deleteSession } from './sessionStore';
import { SessionError, ErrorHandler, ErrorLogger, Platform } from './sessionErrors';

export type SessionHealthStatus = 'healthy' | 'warning' | 'critical' | 'expired';

export interface SessionHealthMetrics {
	internalSessionId: string;
	platform: string;
	status: SessionHealthStatus;
	lastSuccessfulCheck: Date | null;
	lastFailedCheck: Date | null;
	consecutiveFailures: number;
	totalChecks: number;
	totalFailures: number;
	lastRefreshAttempt: Date | null;
	lastSuccessfulRefresh: Date | null;
	nextCheckTime: Date;
	checkInterval: number; // in milliseconds
	isMonitoring: boolean;
	// Enhanced error tracking fields
	lastError?: SessionError;
	errorHistory: SessionError[];
	recoveryAttempts: number;
	lastRecoveryAttempt: Date | null;
}

export interface SessionHealthReport {
	sessionId: string;
	platforms: {
		[platform: string]: SessionHealthMetrics;
	};
	overallStatus: SessionHealthStatus;
	lastUpdated: Date;
	// Enhanced error reporting fields
	criticalErrors: SessionError[];
	recommendedActions: string[];
	autoRecoveryAvailable: boolean;
}

/**
 * Proactive Session Health Monitor
 * 
 * Monitors session health across platforms and automatically refreshes sessions
 * before they expire to prevent authentication issues.
 */
export class SessionHealthMonitor {
	private static instance: SessionHealthMonitor;
	private healthMetrics: Map<string, SessionHealthMetrics> = new Map();
	private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
	private isGlobalMonitoringActive = false;

	// Configuration constants
	private readonly DEFAULT_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
	private readonly WARNING_CHECK_INTERVAL = 1 * 60 * 1000; // 1 minute
	private readonly CRITICAL_CHECK_INTERVAL = 30 * 1000; // 30 seconds
	private readonly MAX_CONSECUTIVE_FAILURES = 3;
	private readonly EXPONENTIAL_BACKOFF_BASE = 2;
	private readonly MAX_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

	private constructor() {
		// Singleton pattern
	}

	public static getInstance(): SessionHealthMonitor {
		if (!SessionHealthMonitor.instance) {
			SessionHealthMonitor.instance = new SessionHealthMonitor();
		}
		return SessionHealthMonitor.instance;
	}

	/**
	 * Start monitoring a session for a specific platform
	 */
	public startMonitoring(internalSessionId: string, platform: string): void {
		const key = `${internalSessionId}:${platform}`;

		if (this.healthMetrics.has(key)) {
			console.log(`[SessionHealthMonitor] Already monitoring ${platform} for session ${internalSessionId}`);
			return;
		}

		const metrics: SessionHealthMetrics = {
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
			nextCheckTime: new Date(Date.now() + this.DEFAULT_CHECK_INTERVAL),
			checkInterval: this.DEFAULT_CHECK_INTERVAL,
			isMonitoring: true,
			errorHistory: [],
			recoveryAttempts: 0,
			lastRecoveryAttempt: null,
		};

		this.healthMetrics.set(key, metrics);
		this.scheduleHealthCheck(key);

		console.log(`[SessionHealthMonitor] Started monitoring ${platform} for session ${internalSessionId}`);

		// Start global monitoring if not already active
		if (!this.isGlobalMonitoringActive) {
			this.startGlobalMonitoring();
		}
	}

	/**
	 * Stop monitoring a specific session/platform combination
	 */
	public stopMonitoring(internalSessionId: string, platform: string): void {
		const key = `${internalSessionId}:${platform}`;

		// Clear the interval
		const intervalId = this.monitoringIntervals.get(key);
		if (intervalId) {
			clearTimeout(intervalId);
			this.monitoringIntervals.delete(key);
		}

		// Remove metrics
		this.healthMetrics.delete(key);

		console.log(`[SessionHealthMonitor] Stopped monitoring ${platform} for session ${internalSessionId}`);

		// Stop global monitoring if no sessions are being monitored
		if (this.healthMetrics.size === 0 && this.isGlobalMonitoringActive) {
			this.stopGlobalMonitoring();
		}
	}

	/**
	 * Get health status for a specific session/platform
	 */
	public getSessionHealth(internalSessionId: string, platform: string): SessionHealthMetrics | null {
		const key = `${internalSessionId}:${platform}`;
		return this.healthMetrics.get(key) || null;
	}

	/**
	 * Get comprehensive health report for a session across all platforms
	 */
	public getSessionHealthReport(internalSessionId: string): SessionHealthReport | null {
		const sessionPlatforms = this.collectSessionPlatforms(internalSessionId);

		if (Object.keys(sessionPlatforms).length === 0) {
			return null;
		}

		const overallStatus = this.determineOverallStatus(sessionPlatforms);
		const { criticalErrors, recommendedActions, autoRecoveryAvailable } = this.analyzeSessionHealth(sessionPlatforms);

		return {
			sessionId: internalSessionId,
			platforms: sessionPlatforms,
			overallStatus,
			lastUpdated: new Date(),
			criticalErrors,
			recommendedActions,
			autoRecoveryAvailable,
		};
	}

	/**
	 * Collect all platform metrics for a session
	 */
	private collectSessionPlatforms(internalSessionId: string): { [platform: string]: SessionHealthMetrics } {
		const sessionPlatforms: { [platform: string]: SessionHealthMetrics } = {};

		for (const [, metrics] of this.healthMetrics.entries()) {
			if (metrics.internalSessionId === internalSessionId) {
				sessionPlatforms[metrics.platform] = metrics;
			}
		}

		return sessionPlatforms;
	}

	/**
	 * Determine overall status from platform metrics (worst status wins)
	 */
	private determineOverallStatus(sessionPlatforms: { [platform: string]: SessionHealthMetrics }): SessionHealthStatus {
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
	 * Analyze session health and generate recommendations
	 */
	private analyzeSessionHealth(sessionPlatforms: { [platform: string]: SessionHealthMetrics }): {
		criticalErrors: SessionError[];
		recommendedActions: string[];
		autoRecoveryAvailable: boolean;
	} {
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
	 * Get all health reports for all monitored sessions
	 */
	public getAllHealthReports(): SessionHealthReport[] {
		const sessionIds = new Set<string>();

		// Collect all unique session IDs
		for (const metrics of this.healthMetrics.values()) {
			sessionIds.add(metrics.internalSessionId);
		}

		// Generate reports for each session
		const reports: SessionHealthReport[] = [];
		for (const sessionId of sessionIds) {
			const report = this.getSessionHealthReport(sessionId);
			if (report) {
				reports.push(report);
			}
		}

		return reports;
	}

	/**
	 * Perform a comprehensive health check for a specific session/platform
	 */
	public async checkSessionHealth(internalSessionId: string, platform: string): Promise<SessionHealthStatus> {
		const key = `${internalSessionId}:${platform}`;
		const metrics = this.healthMetrics.get(key);

		if (!metrics) {
			console.warn(`[SessionHealthMonitor] No metrics found for ${key}`);
			return 'expired';
		}

		console.log(`[SessionHealthMonitor] Checking health for ${platform} session ${internalSessionId}`);

		try {
			const isHealthy = await this.performPlatformHealthCheck(platform, internalSessionId);
			this.updateHealthMetrics(metrics, isHealthy);
			this.healthMetrics.set(key, metrics);

			// Retry logic removed - no automatic refresh attempts

			console.log(`[SessionHealthMonitor] Health check completed for ${platform}:${internalSessionId} - Status: ${metrics.status}`);
			return metrics.status;

		} catch (error) {
			console.error(`[SessionHealthMonitor] Health check failed for ${platform}:${internalSessionId}:`, error);
			this.updateHealthMetricsOnError(metrics);
			this.healthMetrics.set(key, metrics);
			return 'critical';
		}
	}

	/**
	 * Perform platform-specific health check
	 */
	private async performPlatformHealthCheck(platform: string, internalSessionId: string): Promise<boolean> {
		switch (platform) {
			case 'marketinout':
				return await MIOService.validateSessionHealth(internalSessionId);
			case 'tradingview':
				return await this.checkTradingViewHealth(internalSessionId);
			default:
				console.warn(`[SessionHealthMonitor] Unknown platform: ${platform}`);
				return false;
		}
	}

	/**
	 * Update health metrics based on check result
	 */
	private updateHealthMetrics(metrics: SessionHealthMetrics, isHealthy: boolean): void {
		metrics.totalChecks++;

		if (isHealthy) {
			this.updateHealthyMetrics(metrics);
		} else {
			this.updateUnhealthyMetrics(metrics);
		}

		metrics.nextCheckTime = new Date(Date.now() + metrics.checkInterval);
	}

	/**
	 * Update metrics for successful health check
	 */
	private updateHealthyMetrics(metrics: SessionHealthMetrics): void {
		metrics.lastSuccessfulCheck = new Date();
		metrics.consecutiveFailures = 0;

		const failureRate = metrics.totalFailures / metrics.totalChecks;
		if (failureRate < 0.1) {
			metrics.status = 'healthy';
			metrics.checkInterval = this.DEFAULT_CHECK_INTERVAL;
		} else if (failureRate < 0.3) {
			metrics.status = 'warning';
			metrics.checkInterval = this.WARNING_CHECK_INTERVAL;
		}
	}

	/**
	 * Update metrics for failed health check
	 */
	private updateUnhealthyMetrics(metrics: SessionHealthMetrics): void {
		metrics.lastFailedCheck = new Date();
		metrics.consecutiveFailures++;
		metrics.totalFailures++;

		if (metrics.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
			metrics.status = 'expired';
			metrics.isMonitoring = false;
			console.error(`[SessionHealthMonitor] Session ${metrics.internalSessionId} for ${metrics.platform} marked as expired`);
		} else if (metrics.consecutiveFailures >= 2) {
			metrics.status = 'critical';
			metrics.checkInterval = this.CRITICAL_CHECK_INTERVAL;
		} else {
			metrics.status = 'warning';
			metrics.checkInterval = this.WARNING_CHECK_INTERVAL;
		}
	}

	/**
	 * Update metrics when health check throws an error
	 */
	private updateHealthMetricsOnError(metrics: SessionHealthMetrics): void {
		metrics.lastFailedCheck = new Date();
		metrics.consecutiveFailures++;
		metrics.totalFailures++;
		metrics.totalChecks++;
		metrics.status = 'critical';
		metrics.checkInterval = this.CRITICAL_CHECK_INTERVAL;
		metrics.nextCheckTime = new Date(Date.now() + metrics.checkInterval);
	}

	// Retry/refresh logic removed - sessions fail immediately on expiration

	/**
	 * Schedule the next health check for a session/platform
	 */
	private scheduleHealthCheck(key: string): void {
		const metrics = this.healthMetrics.get(key);
		if (!metrics || !metrics.isMonitoring) return;

		// Clear existing timeout
		const existingTimeout = this.monitoringIntervals.get(key);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Calculate delay with exponential backoff for failed checks
		let delay = metrics.checkInterval;
		if (metrics.consecutiveFailures > 0) {
			delay = Math.min(
				delay * Math.pow(this.EXPONENTIAL_BACKOFF_BASE, metrics.consecutiveFailures - 1),
				this.MAX_CHECK_INTERVAL
			);
		}

		const timeoutId = setTimeout(async () => {
			await this.checkSessionHealth(metrics.internalSessionId, metrics.platform);

			// Schedule next check if still monitoring
			if (metrics.isMonitoring && metrics.status !== 'expired') {
				this.scheduleHealthCheck(key);
			} else if (metrics.status === 'expired') {
				// Clean up expired session
				this.cleanupExpiredSession(metrics.internalSessionId, metrics.platform);
			}
		}, delay);

		this.monitoringIntervals.set(key, timeoutId);

		console.log(`[SessionHealthMonitor] Scheduled next health check for ${key} in ${Math.round(delay / 1000)}s`);
	}

	/**
	 * Clean up expired session data
	 */
	private cleanupExpiredSession(internalSessionId: string, platform: string): void {
		console.log(`[SessionHealthMonitor] Cleaning up expired session for ${platform}:${internalSessionId}`);

		// Remove from monitoring
		this.stopMonitoring(internalSessionId, platform);

		// Delete session data if all platforms are expired
		const remainingPlatforms = Array.from(this.healthMetrics.values())
			.filter(m => m.internalSessionId === internalSessionId && m.status !== 'expired');

		if (remainingPlatforms.length === 0) {
			console.log(`[SessionHealthMonitor] All platforms expired for session ${internalSessionId}, deleting session`);
			deleteSession(internalSessionId);
		}
	}

	/**
	 * Start global monitoring process
	 */
	private startGlobalMonitoring(): void {
		if (this.isGlobalMonitoringActive) return;

		this.isGlobalMonitoringActive = true;
		console.log('[SessionHealthMonitor] Started global session health monitoring');

		// Discover existing sessions and start monitoring them
		this.discoverAndMonitorExistingSessions();
	}

	/**
	 * Stop global monitoring process
	 */
	private stopGlobalMonitoring(): void {
		if (!this.isGlobalMonitoringActive) return;

		// Clear all intervals
		for (const [, intervalId] of this.monitoringIntervals.entries()) {
			clearTimeout(intervalId);
		}
		this.monitoringIntervals.clear();
		this.healthMetrics.clear();

		this.isGlobalMonitoringActive = false;
		console.log('[SessionHealthMonitor] Stopped global session health monitoring');
	}

	/**
	 * Discover existing sessions and start monitoring them
	 */
	private discoverAndMonitorExistingSessions(): void {
		try {
			// This would need to be implemented to scan the session store
			// For now, sessions will be added to monitoring when they're used
			console.log('[SessionHealthMonitor] Session discovery not yet implemented');
		} catch (error) {
			console.error('[SessionHealthMonitor] Error discovering existing sessions:', error);
		}
	}

	/**
	 * TradingView health check (placeholder - needs implementation)
	 * Enhanced with proper error handling structure.
	 */
	private async checkTradingViewHealth(internalSessionId: string): Promise<boolean> {
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
			console.log(`[SessionHealthMonitor] TradingView health check not yet implemented for ${internalSessionId}`);
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
	private async refreshTradingViewSession(internalSessionId: string): Promise<boolean> {
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
			console.log(`[SessionHealthMonitor] TradingView session refresh not yet implemented for ${internalSessionId}`);
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
	 * Get monitoring statistics
	 * Enhanced with error statistics and recovery information.
	 */
	public getMonitoringStats(): {
		totalSessions: number;
		activeSessions: number;
		healthySessions: number;
		warningSessions: number;
		criticalSessions: number;
		expiredSessions: number;
		isGlobalMonitoringActive: boolean;
		totalErrors: number;
		totalRecoveryAttempts: number;
		successfulRecoveries: number;
		recentErrors: SessionError[];
	} {
		const stats = {
			totalSessions: this.healthMetrics.size,
			activeSessions: 0,
			healthySessions: 0,
			warningSessions: 0,
			criticalSessions: 0,
			expiredSessions: 0,
			isGlobalMonitoringActive: this.isGlobalMonitoringActive,
			totalErrors: 0,
			totalRecoveryAttempts: 0,
			successfulRecoveries: 0,
			recentErrors: [] as SessionError[],
		};

		for (const metrics of this.healthMetrics.values()) {
			if (metrics.isMonitoring) stats.activeSessions++;

			// Count errors and recovery attempts
			stats.totalErrors += metrics.errorHistory.length;
			stats.totalRecoveryAttempts += metrics.recoveryAttempts;

			// Count successful recoveries (sessions that had errors but are now healthy)
			if (metrics.errorHistory.length > 0 && metrics.status === 'healthy') {
				stats.successfulRecoveries++;
			}

			// Collect recent errors (from last 24 hours)
			const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
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
		stats.recentErrors = stats.recentErrors.slice(0, 50);

		return stats;
	}

	/**
		* Record an error in the health check metrics
		* Enhanced error tracking with categorization and recovery suggestions.
		*/
	private recordHealthCheckError(metrics: SessionHealthMetrics, error: SessionError): void {
		// Update last error
		metrics.lastError = error;

		// Add to error history (keep last 100 errors)
		metrics.errorHistory.push(error);
		if (metrics.errorHistory.length > 100) {
			metrics.errorHistory = metrics.errorHistory.slice(-100);
		}

		// Log the error for monitoring
		ErrorLogger.logError(error);

		console.error(`[SessionHealthMonitor] Recorded error for ${metrics.platform}:${metrics.internalSessionId}:`, {
			errorType: error.type,
			errorCode: error.code,
			message: error.message,
			timestamp: error.timestamp
		});
	}
}

// Export singleton instance
export const sessionHealthMonitor = SessionHealthMonitor.getInstance();
