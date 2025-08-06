/**
 * Centralized Session Error Handling System
 * 
 * Provides comprehensive error handling with specific, actionable error messages
 * for all session-related operations across MIO TV Scripts application.
 */

// Error severity levels
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Session error types with specific categorization
export enum SessionErrorType {
  // Authentication errors
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  
  // Platform-specific errors
  PLATFORM_UNAVAILABLE = 'PLATFORM_UNAVAILABLE',
  PLATFORM_MAINTENANCE = 'PLATFORM_MAINTENANCE',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  
  // Cookie/Session management errors
  COOKIE_INVALID = 'COOKIE_INVALID',
  COOKIE_EXPIRED = 'COOKIE_EXPIRED',
  SESSION_STORAGE_ERROR = 'SESSION_STORAGE_ERROR',
  
  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_PRIVILEGES = 'INSUFFICIENT_PRIVILEGES',
  
  // Data format errors
  DATA_FORMAT_ERROR = 'DATA_FORMAT_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  PARSING_ERROR = 'PARSING_ERROR',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED'
}

// Platform types
export enum Platform {
  MARKETINOUT = 'marketinout',
  TRADINGVIEW = 'tradingview',
  TELEGRAM = 'telegram',
  UNKNOWN = 'unknown'
}

// Recovery action types
export enum RecoveryAction {
  RETRY = 'retry',
  REFRESH_SESSION = 'refresh_session',
  RE_AUTHENTICATE = 're_authenticate',
  CLEAR_CACHE = 'clear_cache',
  WAIT_AND_RETRY = 'wait_and_retry',
  CONTACT_SUPPORT = 'contact_support',
  CHECK_NETWORK = 'check_network',
  UPDATE_CREDENTIALS = 'update_credentials'
}

// Error context interface
export interface ErrorContext {
  platform: Platform;
  operation: string;
  timestamp: Date;
  sessionId?: string;
  httpStatus?: number;
  requestUrl?: string;
  userAgent?: string;
  additionalData?: Record<string, unknown>;
}

// Recovery step interface
export interface RecoveryStep {
  action: RecoveryAction;
  description: string;
  priority: number;
  automated: boolean;
  estimatedTime?: string;
}

// Session error class
export class SessionError extends Error {
  public readonly type: SessionErrorType;
  public readonly severity: ErrorSeverity;
  public readonly platform: Platform;
  public readonly context: ErrorContext;
  public readonly recoverySteps: RecoveryStep[];
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly errorCode: string;
  public readonly timestamp: Date;
  public readonly code: string;

  constructor(
    type: SessionErrorType,
    userMessage: string,
    technicalMessage: string,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    recoverySteps: RecoveryStep[] = []
  ) {
    super(technicalMessage);
    
    this.type = type;
    this.severity = severity;
    this.platform = context.platform;
    this.context = context;
    this.recoverySteps = recoverySteps;
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage;
    this.errorCode = `${context.platform.toUpperCase()}_${type}`;
    this.timestamp = context.timestamp;
    this.code = this.errorCode; // Use errorCode as the code property
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionError);
    }
    
    this.name = 'SessionError';
  }

  /**
   * Get formatted error message for display to users
   */
  getDisplayMessage(): string {
    return this.userMessage;
  }

  /**
   * Get technical details for logging/debugging
   */
  getTechnicalDetails(): Record<string, unknown> {
    return {
      errorCode: this.errorCode,
      type: this.type,
      severity: this.severity,
      platform: this.platform,
      technicalMessage: this.technicalMessage,
      context: this.context,
      stack: this.stack
    };
  }

  /**
   * Get recovery instructions for users
   */
  getRecoveryInstructions(): string[] {
    return this.recoverySteps
      .sort((a, b) => a.priority - b.priority)
      .map(step => step.description);
  }

  /**
   * Check if error can be automatically recovered
   */
  canAutoRecover(): boolean {
    return this.recoverySteps.some(step => step.automated);
  }

  /**
   * Get automated recovery actions
   */
  getAutomatedRecoveryActions(): RecoveryStep[] {
    return this.recoverySteps.filter(step => step.automated);
  }
}

/**
 * Error Handler utility class with predefined error patterns
 */
export class ErrorHandler {
  
  /**
   * Create a session expired error
   */
  static createSessionExpiredError(
    platform: Platform,
    operation: string,
    sessionId?: string
  ): SessionError {
    const context: ErrorContext = {
      platform,
      operation,
      timestamp: new Date(),
      sessionId
    };

    const recoverySteps: RecoveryStep[] = [
      {
        action: RecoveryAction.RE_AUTHENTICATE,
        description: `Please log in to ${platform === Platform.MARKETINOUT ? 'MarketInOut' : 'TradingView'} again`,
        priority: 1,
        automated: false,
        estimatedTime: '2-3 minutes'
      },
      {
        action: RecoveryAction.CLEAR_CACHE,
        description: 'Clear your browser cache and cookies if the problem persists',
        priority: 2,
        automated: false,
        estimatedTime: '1 minute'
      }
    ];

    const platformName = platform === Platform.MARKETINOUT ? 'MarketInOut' : 'TradingView';
    
    return new SessionError(
      SessionErrorType.SESSION_EXPIRED,
      `Your ${platformName} session has expired. Please log in again to continue.`,
      `Session expired for platform ${platform} during operation ${operation}`,
      context,
      ErrorSeverity.WARNING,
      recoverySteps
    );
  }

  /**
   * Create an invalid credentials error
   */
  static createInvalidCredentialsError(
    platform: Platform,
    operation: string,
    httpStatus?: number
  ): SessionError {
    const context: ErrorContext = {
      platform,
      operation,
      timestamp: new Date(),
      httpStatus
    };

    const recoverySteps: RecoveryStep[] = [
      {
        action: RecoveryAction.UPDATE_CREDENTIALS,
        description: 'Verify your login credentials are correct',
        priority: 1,
        automated: false,
        estimatedTime: '1 minute'
      },
      {
        action: RecoveryAction.RE_AUTHENTICATE,
        description: 'Log out and log back in with correct credentials',
        priority: 2,
        automated: false,
        estimatedTime: '2-3 minutes'
      }
    ];

    const platformName = platform === Platform.MARKETINOUT ? 'MarketInOut' : 'TradingView';
    
    return new SessionError(
      SessionErrorType.INVALID_CREDENTIALS,
      `Authentication failed for ${platformName}. Please check your login credentials and try again.`,
      `Invalid credentials for platform ${platform} during operation ${operation} (HTTP ${httpStatus})`,
      context,
      ErrorSeverity.ERROR,
      recoverySteps
    );
  }

  /**
   * Create a network error
   */
  static createNetworkError(
    platform: Platform,
    operation: string,
    originalError: Error,
    requestUrl?: string
  ): SessionError {
    const context: ErrorContext = {
      platform,
      operation,
      timestamp: new Date(),
      requestUrl,
      additionalData: { originalError: originalError.message }
    };

    const recoverySteps: RecoveryStep[] = [
      {
        action: RecoveryAction.CHECK_NETWORK,
        description: 'Check your internet connection',
        priority: 1,
        automated: false,
        estimatedTime: '1 minute'
      },
      {
        action: RecoveryAction.WAIT_AND_RETRY,
        description: 'Wait a moment and try again',
        priority: 2,
        automated: true,
        estimatedTime: '30 seconds'
      },
      {
        action: RecoveryAction.RETRY,
        description: 'Retry the operation',
        priority: 3,
        automated: false,
        estimatedTime: '30 seconds'
      }
    ];

    return new SessionError(
      SessionErrorType.NETWORK_ERROR,
      'Connection failed. Please check your internet connection and try again.',
      `Network error during ${operation} for platform ${platform}: ${originalError.message}`,
      context,
      ErrorSeverity.ERROR,
      recoverySteps
    );
  }

  /**
   * Create a platform unavailable error
   */
  static createPlatformUnavailableError(
    platform: Platform,
    operation: string,
    httpStatus?: number
  ): SessionError {
    const context: ErrorContext = {
      platform,
      operation,
      timestamp: new Date(),
      httpStatus
    };

    const recoverySteps: RecoveryStep[] = [
      {
        action: RecoveryAction.WAIT_AND_RETRY,
        description: 'Wait a few minutes and try again',
        priority: 1,
        automated: true,
        estimatedTime: '5-10 minutes'
      },
      {
        action: RecoveryAction.CONTACT_SUPPORT,
        description: 'Contact support if the issue persists',
        priority: 2,
        automated: false,
        estimatedTime: 'Variable'
      }
    ];

    const platformName = platform === Platform.MARKETINOUT ? 'MarketInOut' : 'TradingView';
    
    return new SessionError(
      SessionErrorType.PLATFORM_UNAVAILABLE,
      `${platformName} is currently unavailable. Please try again later.`,
      `Platform ${platform} unavailable during operation ${operation} (HTTP ${httpStatus})`,
      context,
      ErrorSeverity.WARNING,
      recoverySteps
    );
  }

  /**
   * Create a rate limiting error
   */
  static createRateLimitError(
    platform: Platform,
    operation: string,
    retryAfter?: number
  ): SessionError {
    const context: ErrorContext = {
      platform,
      operation,
      timestamp: new Date(),
      additionalData: { retryAfter }
    };

    const waitTime = retryAfter ? `${retryAfter} seconds` : '1-2 minutes';
    
    const recoverySteps: RecoveryStep[] = [
      {
        action: RecoveryAction.WAIT_AND_RETRY,
        description: `Wait ${waitTime} before trying again`,
        priority: 1,
        automated: true,
        estimatedTime: waitTime
      }
    ];

    return new SessionError(
      SessionErrorType.API_RATE_LIMITED,
      `Too many requests. Please wait ${waitTime} before trying again.`,
      `Rate limit exceeded for platform ${platform} during operation ${operation}`,
      context,
      ErrorSeverity.WARNING,
      recoverySteps
    );
  }

  /**
   * Create a cookie/session storage error
   */
  static createCookieError(
    platform: Platform,
    operation: string,
    cookieIssue: string
  ): SessionError {
    const context: ErrorContext = {
      platform,
      operation,
      timestamp: new Date(),
      additionalData: { cookieIssue }
    };

    const recoverySteps: RecoveryStep[] = [
      {
        action: RecoveryAction.CLEAR_CACHE,
        description: 'Clear your browser cache and cookies',
        priority: 1,
        automated: false,
        estimatedTime: '1-2 minutes'
      },
      {
        action: RecoveryAction.RE_AUTHENTICATE,
        description: 'Log in again to create fresh session cookies',
        priority: 2,
        automated: false,
        estimatedTime: '2-3 minutes'
      }
    ];

    const platformName = platform === Platform.MARKETINOUT ? 'MarketInOut' : 'TradingView';
    
    return new SessionError(
      SessionErrorType.COOKIE_INVALID,
      `Session cookies are invalid for ${platformName}. Please clear your browser cache and log in again.`,
      `Cookie error for platform ${platform} during operation ${operation}: ${cookieIssue}`,
      context,
      ErrorSeverity.ERROR,
      recoverySteps
    );
  }

  /**
   * Create a permission denied error
   */
  static createPermissionError(
    platform: Platform,
    operation: string,
    requiredPermission?: string
  ): SessionError {
    const context: ErrorContext = {
      platform,
      operation,
      timestamp: new Date(),
      additionalData: { requiredPermission }
    };

    const recoverySteps: RecoveryStep[] = [
      {
        action: RecoveryAction.RE_AUTHENTICATE,
        description: 'Log in with an account that has the necessary permissions',
        priority: 1,
        automated: false,
        estimatedTime: '2-3 minutes'
      },
      {
        action: RecoveryAction.CONTACT_SUPPORT,
        description: 'Contact support to request access permissions',
        priority: 2,
        automated: false,
        estimatedTime: 'Variable'
      }
    ];

    const platformName = platform === Platform.MARKETINOUT ? 'MarketInOut' : 'TradingView';
    const permissionText = requiredPermission ? ` (${requiredPermission})` : '';
    
    return new SessionError(
      SessionErrorType.PERMISSION_DENIED,
      `Access denied${permissionText}. Please ensure you have the necessary permissions for ${platformName}.`,
      `Permission denied for platform ${platform} during operation ${operation}`,
      context,
      ErrorSeverity.ERROR,
      recoverySteps
    );
  }

  /**
   * Create a data format error
   */
  static createDataFormatError(
    platform: Platform,
    operation: string,
    expectedFormat: string,
    receivedData?: string
  ): SessionError {
    const context: ErrorContext = {
      platform,
      operation,
      timestamp: new Date(),
      additionalData: { expectedFormat, receivedData: receivedData?.substring(0, 200) }
    };

    const recoverySteps: RecoveryStep[] = [
      {
        action: RecoveryAction.RETRY,
        description: 'Try the operation again',
        priority: 1,
        automated: true,
        estimatedTime: '30 seconds'
      },
      {
        action: RecoveryAction.CONTACT_SUPPORT,
        description: 'Contact support if this error persists',
        priority: 2,
        automated: false,
        estimatedTime: 'Variable'
      }
    ];

    const platformName = platform === Platform.MARKETINOUT ? 'MarketInOut' : 'TradingView';
    
    return new SessionError(
      SessionErrorType.DATA_FORMAT_ERROR,
      `Invalid data format received from ${platformName}. Please try again or contact support if this persists.`,
      `Data format error for platform ${platform} during operation ${operation}: expected ${expectedFormat}`,
      context,
      ErrorSeverity.ERROR,
      recoverySteps
    );
  }

  /**
   * Create a generic error from an unknown error
   */
  static createGenericError(
    platform: Platform,
    operation: string,
    originalError: Error | string,
    httpStatus?: number
  ): SessionError {
    const errorMessage = typeof originalError === 'string' ? originalError : originalError.message;
    
    const context: ErrorContext = {
      platform,
      operation,
      timestamp: new Date(),
      httpStatus,
      additionalData: { originalError: errorMessage }
    };

    const recoverySteps: RecoveryStep[] = [
      {
        action: RecoveryAction.RETRY,
        description: 'Try the operation again',
        priority: 1,
        automated: false,
        estimatedTime: '30 seconds'
      },
      {
        action: RecoveryAction.REFRESH_SESSION,
        description: 'Refresh your session and try again',
        priority: 2,
        automated: true,
        estimatedTime: '1 minute'
      },
      {
        action: RecoveryAction.CONTACT_SUPPORT,
        description: 'Contact support if the problem continues',
        priority: 3,
        automated: false,
        estimatedTime: 'Variable'
      }
    ];

    const platformName = platform === Platform.MARKETINOUT ? 'MarketInOut' : 'TradingView';
    
    return new SessionError(
      SessionErrorType.OPERATION_FAILED,
      `Operation failed for ${platformName}. Please try again or contact support if the issue persists.`,
      `Generic error for platform ${platform} during operation ${operation}: ${errorMessage}`,
      context,
      ErrorSeverity.ERROR,
      recoverySteps
    );
  }

  /**
   * Parse and categorize an error from various sources
   */
  static parseError(
    error: Error | string | unknown,
    platform: Platform,
    operation: string,
    httpStatus?: number,
    requestUrl?: string
  ): SessionError {
    const errorMessage = typeof error === 'string' ? error : 
                        error instanceof Error ? error.message : 
                        String(error);

    // Session expired patterns
    if (errorMessage.toLowerCase().includes('session expired') ||
        errorMessage.toLowerCase().includes('login') ||
        errorMessage.toLowerCase().includes('signin') ||
        httpStatus === 401) {
      return this.createSessionExpiredError(platform, operation);
    }

    // Invalid credentials patterns
    if (errorMessage.toLowerCase().includes('credentials') ||
        errorMessage.toLowerCase().includes('authentication failed') ||
        errorMessage.toLowerCase().includes('unauthorized') ||
        httpStatus === 403) {
      return this.createInvalidCredentialsError(platform, operation, httpStatus);
    }

    // Network error patterns
    if (errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('fetch')) {
      return this.createNetworkError(platform, operation, error instanceof Error ? error : new Error(errorMessage), requestUrl);
    }

    // Platform unavailable patterns
    if (httpStatus && (httpStatus >= 500 && httpStatus < 600) ||
        errorMessage.toLowerCase().includes('unavailable') ||
        errorMessage.toLowerCase().includes('maintenance')) {
      return this.createPlatformUnavailableError(platform, operation, httpStatus);
    }

    // Rate limiting patterns
    if (httpStatus === 429 ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('too many requests')) {
      return this.createRateLimitError(platform, operation);
    }

    // Cookie/session issues
    if (errorMessage.toLowerCase().includes('cookie') ||
        errorMessage.toLowerCase().includes('session storage')) {
      return this.createCookieError(platform, operation, errorMessage);
    }

    // Data format issues
    if (errorMessage.toLowerCase().includes('format') ||
        errorMessage.toLowerCase().includes('parsing') ||
        errorMessage.toLowerCase().includes('json') ||
        errorMessage.toLowerCase().includes('unexpected response')) {
      return this.createDataFormatError(platform, operation, 'JSON', errorMessage);
    }

    // Default to generic error
    return this.createGenericError(platform, operation, error instanceof Error ? error : String(error), httpStatus);
  }
}

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