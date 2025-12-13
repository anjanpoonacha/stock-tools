/**
 * Core Session Error Types and Classes
 *
 * Provides type definitions and base error class for session-related errors
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
