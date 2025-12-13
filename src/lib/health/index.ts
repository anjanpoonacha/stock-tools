// src/lib/health/index.ts

// Export types
export type {
	SessionHealthStatus,
	SessionHealthMetrics,
	SessionHealthReport,
	MonitoringStats,
	HealthAnalysis
} from './types';

// Export health checker utilities and config
export {
	HEALTH_CONFIG,
	createHealthMetrics,
	performPlatformHealthCheck,
	updateHealthMetrics,
	updateHealthMetricsOnError,
	recordHealthCheckError,
	collectSessionPlatforms,
	determineOverallStatus,
	analyzeSessionHealth,
	calculateMonitoringStats,
	calculateCheckDelay,
	refreshTradingViewSession
} from './healthChecker';

// Export SessionHealthMonitor class and singleton instance
export { SessionHealthMonitor, sessionHealthMonitor } from './SessionHealthMonitor';
