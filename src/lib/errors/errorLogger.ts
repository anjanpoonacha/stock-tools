/**
 * Error Logging Utility
 *
 * Provides centralized error logging with statistics and external service integration
 */

import { SessionError } from './types';

/**
 * Error logging utility
 */
export class ErrorLogger {
  private static logs: Array<{
    error: SessionError;
    timestamp: Date;
    context: Record<string, unknown>;
  }> = [];

  /**
   * Log a session error with context
   */
  static logError(error: SessionError, additionalContext?: Record<string, unknown>): void {
    const logEntry = {
      error,
      timestamp: new Date(),
      context: {
        ...error.getTechnicalDetails(),
        ...additionalContext
      }
    };

    this.logs.push(logEntry);

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[SessionError] ${error.errorCode}:`, {
        userMessage: error.userMessage,
        technicalMessage: error.technicalMessage,
        platform: error.platform,
        operation: error.context.operation,
        severity: error.severity,
        recoverySteps: error.getRecoveryInstructions(),
        context: logEntry.context
      });
    }

    // In production, you might want to send to external logging service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to external logging service (e.g., Sentry, LogRocket, etc.)
      this.sendToExternalLogger(logEntry);
    }
  }

  /**
   * Get recent error logs
   */
  static getRecentLogs(limit: number = 50): Array<{
    error: SessionError;
    timestamp: Date;
    context: Record<string, unknown>;
  }> {
    return this.logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByPlatform: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrorRate: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentErrors = this.logs.filter(log => log.timestamp.getTime() > oneHourAgo);

    const stats = {
      totalErrors: this.logs.length,
      errorsByType: {} as Record<string, number>,
      errorsByPlatform: {} as Record<string, number>,
      errorsBySeverity: {} as Record<string, number>,
      recentErrorRate: recentErrors.length
    };

    for (const log of this.logs) {
      const { error } = log;

      // Count by type
      stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;

      // Count by platform
      stats.errorsByPlatform[error.platform] = (stats.errorsByPlatform[error.platform] || 0) + 1;

      // Count by severity
      stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear old logs (keep only recent ones)
   */
  static clearOldLogs(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    this.logs = this.logs.filter(log => log.timestamp.getTime() > cutoff);
  }

  /**
   * Send error to external logging service (placeholder)
   */
  private static sendToExternalLogger(logEntry: {
    error: SessionError;
    timestamp: Date;
    context: Record<string, unknown>;
  }): void {
    // TODO: Implement external logging service integration
    // This could be Sentry, LogRocket, DataDog, etc.
    console.log('[ErrorLogger] Would send to external service:', logEntry);
  }
}
