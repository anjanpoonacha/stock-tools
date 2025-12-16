// src/lib/health/SessionHealthMonitor.ts

import { deleteSession } from '../sessionStore';
import {
	SessionHealthStatus,
	SessionHealthMetrics,
	SessionHealthReport,
	MonitoringStats
} from './types';
import {
	createHealthMetrics,
	performPlatformHealthCheck,
	updateHealthMetrics,
	updateHealthMetricsOnError,
	collectSessionPlatforms,
	determineOverallStatus,
	analyzeSessionHealth,
	calculateMonitoringStats,
	calculateCheckDelay
} from './healthChecker';

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
			return;
		}

		const metrics = createHealthMetrics(internalSessionId, platform);
		this.healthMetrics.set(key, metrics);
		this.scheduleHealthCheck(key);

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
		const sessionPlatforms = collectSessionPlatforms(this.healthMetrics, internalSessionId);

		if (Object.keys(sessionPlatforms).length === 0) {
			return null;
		}

		const overallStatus = determineOverallStatus(sessionPlatforms);
		const { criticalErrors, recommendedActions, autoRecoveryAvailable } = analyzeSessionHealth(sessionPlatforms);

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
			return 'expired';
		}

		try {
			const isHealthy = await performPlatformHealthCheck(platform, internalSessionId);
			updateHealthMetrics(metrics, isHealthy);
			this.healthMetrics.set(key, metrics);

			return metrics.status;

		} catch (error) {
			updateHealthMetricsOnError(metrics);
			this.healthMetrics.set(key, metrics);
			return 'critical';
		}
	}

	/**
	 * Get monitoring statistics
	 * Enhanced with error statistics and recovery information.
	 */
	public getMonitoringStats(): MonitoringStats {
		return calculateMonitoringStats(this.healthMetrics, this.isGlobalMonitoringActive);
	}

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
		const delay = calculateCheckDelay(metrics);

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
	}

	/**
	 * Clean up expired session data
	 */
	private cleanupExpiredSession(internalSessionId: string, platform: string): void {
		// Remove from monitoring
		this.stopMonitoring(internalSessionId, platform);

		// Delete session data if all platforms are expired
		const remainingPlatforms = Array.from(this.healthMetrics.values())
			.filter(m => m.internalSessionId === internalSessionId && m.status !== 'expired');

		if (remainingPlatforms.length === 0) {
			deleteSession(internalSessionId);
		}
	}

	/**
	 * Start global monitoring process
	 */
	private startGlobalMonitoring(): void {
		if (this.isGlobalMonitoringActive) return;

		this.isGlobalMonitoringActive = true;

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
	}

	/**
	 * Discover existing sessions and start monitoring them
	 */
	private discoverAndMonitorExistingSessions(): void {
		// This would need to be implemented to scan the session store
		// For now, sessions will be added to monitoring when they're used
	}
}

// Export singleton instance
export const sessionHealthMonitor = SessionHealthMonitor.getInstance();
