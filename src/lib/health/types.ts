// src/lib/health/types.ts

import { SessionError } from '../sessionErrors';

/**
 * Session health status levels
 */
export type SessionHealthStatus = 'healthy' | 'warning' | 'critical' | 'expired';

/**
 * Health metrics for a specific session/platform combination
 */
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

/**
 * Comprehensive health report for a session across all platforms
 */
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
 * Monitoring statistics summary
 */
export interface MonitoringStats {
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
}

/**
 * Health analysis result with recommendations
 */
export interface HealthAnalysis {
	criticalErrors: SessionError[];
	recommendedActions: string[];
	autoRecoveryAvailable: boolean;
}
