/**
 * Enhanced session validation with proactive health monitoring integration.
 * Main orchestration and barrel exports for session validation functionality.
 *
 * This module combines platform-specific validators with health monitoring
 * to provide comprehensive session management.
 */

// Re-export platform-specific validators
export {
	validateAndCleanupMarketinoutSession,
	validateTradingViewSession,
	validateAndMonitorAllPlatforms,
	validateAndStartMonitoring,
	validateSessionId,
	cleanupInvalidSession,
	handleValidationError
} from './validators';

// Re-export health integration functions
export {
	getSessionHealthWithValidation,
	forceSessionRefreshAndValidation,
	getHealthAwareSessionData,
	refreshSessionWithHealthCheck,
	stopMonitoringOnInvalidSession
} from './healthIntegration';
