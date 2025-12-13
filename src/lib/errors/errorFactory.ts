/**
 * Error Factory for Creating Session Errors
 *
 * Provides factory methods for creating specific error types with appropriate
 * context, recovery steps, and severity levels
 */

import {
  SessionError,
  SessionErrorType,
  ErrorSeverity,
  Platform,
  RecoveryAction,
  RecoveryStep,
  ErrorContext
} from './types';

/**
 * Error Handler utility class with predefined error patterns
 */
export class ErrorHandler {

  /**
   * Get platform display name
   */
  private static getPlatformName(platform: Platform): string {
    return platform === Platform.MARKETINOUT ? 'MarketInOut' : 'TradingView';
  }

  private static createRecoverySteps(actions: RecoveryAction[], descriptions: string[]): RecoveryStep[] {
    return actions.map((action, index) => ({
      action,
      description: descriptions[index] || 'Perform recovery action',
      priority: index + 1,
      automated: action === RecoveryAction.WAIT_AND_RETRY || action === RecoveryAction.RETRY,
      estimatedTime: this.getEstimatedTime(action)
    }));
  }

  private static getEstimatedTime(action: RecoveryAction): string {
    const timeMap: Record<RecoveryAction, string> = {
      [RecoveryAction.RETRY]: '30 seconds',
      [RecoveryAction.REFRESH_SESSION]: '1 minute',
      [RecoveryAction.RE_AUTHENTICATE]: '2-3 minutes',
      [RecoveryAction.CLEAR_CACHE]: '1-2 minutes',
      [RecoveryAction.WAIT_AND_RETRY]: '1-5 minutes',
      [RecoveryAction.CONTACT_SUPPORT]: 'Variable',
      [RecoveryAction.CHECK_NETWORK]: '1 minute',
      [RecoveryAction.UPDATE_CREDENTIALS]: '1 minute'
    };
    return timeMap[action] || '1 minute';
  }

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

    const platformName = this.getPlatformName(platform);

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

    const platformName = this.getPlatformName(platform);

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

    const platformName = this.getPlatformName(platform);

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

    const platformName = this.getPlatformName(platform);

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

    const platformName = this.getPlatformName(platform);
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

    const platformName = this.getPlatformName(platform);

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

    const platformName = this.getPlatformName(platform);

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
    const errorMessage = this.extractErrorMessage(error);
    const errorCategory = this.categorizeError(errorMessage, httpStatus);

    switch (errorCategory.type) {
      case SessionErrorType.SESSION_EXPIRED:
        return this.createSessionExpiredError(platform, operation);

      case SessionErrorType.INVALID_CREDENTIALS:
        return this.createInvalidCredentialsError(platform, operation, httpStatus);

      case SessionErrorType.NETWORK_ERROR:
        return this.createNetworkError(platform, operation, error instanceof Error ? error : new Error(errorMessage), requestUrl);

      case SessionErrorType.PLATFORM_UNAVAILABLE:
        return this.createPlatformUnavailableError(platform, operation, httpStatus);

      case SessionErrorType.API_RATE_LIMITED:
        return this.createRateLimitError(platform, operation);

      case SessionErrorType.COOKIE_INVALID:
        return this.createCookieError(platform, operation, errorMessage);

      case SessionErrorType.DATA_FORMAT_ERROR:
        return this.createDataFormatError(platform, operation, 'JSON', errorMessage);

      default:
        return this.createGenericError(platform, operation, error instanceof Error ? error : String(error), httpStatus);
    }
  }

  /**
   * Extract error message from various error types
   */
  private static extractErrorMessage(error: Error | string | unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return String(error);
  }

  /**
   * Categorize error based on message content and HTTP status
   */
  private static categorizeError(errorMessage: string, httpStatus?: number): { type: SessionErrorType; confidence: number } {
    const lowerMessage = errorMessage.toLowerCase();

    // Define error patterns with keywords and their associated types
    const errorPatterns = [
      {
        type: SessionErrorType.SESSION_EXPIRED,
        keywords: ['session expired', 'login', 'signin'],
        httpStatuses: [401],
        confidence: 0.9
      },
      {
        type: SessionErrorType.INVALID_CREDENTIALS,
        keywords: ['credentials', 'authentication failed', 'unauthorized'],
        httpStatuses: [403],
        confidence: 0.9
      },
      {
        type: SessionErrorType.NETWORK_ERROR,
        keywords: ['network', 'connection', 'timeout', 'fetch'],
        httpStatuses: [],
        confidence: 0.8
      },
      {
        type: SessionErrorType.PLATFORM_UNAVAILABLE,
        keywords: ['unavailable', 'maintenance'],
        httpStatuses: [500, 501, 502, 503, 504, 505],
        confidence: 0.8
      },
      {
        type: SessionErrorType.API_RATE_LIMITED,
        keywords: ['rate limit', 'too many requests'],
        httpStatuses: [429],
        confidence: 0.9
      },
      {
        type: SessionErrorType.COOKIE_INVALID,
        keywords: ['cookie', 'session storage'],
        httpStatuses: [],
        confidence: 0.7
      },
      {
        type: SessionErrorType.DATA_FORMAT_ERROR,
        keywords: ['format', 'parsing', 'json', 'unexpected response'],
        httpStatuses: [],
        confidence: 0.7
      }
    ];

    // Check each pattern for matches
    for (const pattern of errorPatterns) {
      // Check HTTP status match
      if (httpStatus && pattern.httpStatuses.includes(httpStatus)) {
        return { type: pattern.type, confidence: pattern.confidence };
      }

      // Check keyword matches
      const keywordMatch = pattern.keywords.some(keyword => lowerMessage.includes(keyword));
      if (keywordMatch) {
        return { type: pattern.type, confidence: pattern.confidence };
      }
    }

    // Special case for server errors (5xx range)
    if (httpStatus && httpStatus >= 500 && httpStatus < 600) {
      return { type: SessionErrorType.PLATFORM_UNAVAILABLE, confidence: 0.8 };
    }

    // Default to unknown error
    return { type: SessionErrorType.UNKNOWN_ERROR, confidence: 0.1 };
  }
}
