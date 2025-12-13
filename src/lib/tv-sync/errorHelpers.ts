import { SessionError, SessionErrorType, Platform, ErrorSeverity, RecoveryAction } from '@/lib/sessionErrors';

export function createFetchWatchlistsError(status: number, statusText: string, sessionid: string): SessionError {
    return new SessionError(
        SessionErrorType.SESSION_EXPIRED,
        'Failed to fetch TradingView watchlists',
        `HTTP ${status}: ${statusText}`,
        {
            operation: 'fetch_tv_watchlists',
            platform: Platform.TRADINGVIEW,
            timestamp: new Date(),
            additionalData: { status, statusText, hasSessionId: !!sessionid, sessionIdLength: sessionid?.length || 0 },
        },
        ErrorSeverity.ERROR,
        [
            {
                action: RecoveryAction.UPDATE_CREDENTIALS,
                description: 'Verify your TradingView session cookie is correct and not expired',
                priority: 1,
                automated: false,
                estimatedTime: '3 minutes',
            },
            {
                action: RecoveryAction.REFRESH_SESSION,
                description: 'Log out and log back into TradingView to get a fresh session',
                priority: 2,
                automated: false,
                estimatedTime: '5 minutes',
            },
        ]
    );
}

export function createNetworkError(operation: string, message: string, additionalData?: Record<string, unknown>): SessionError {
    return new SessionError(
        SessionErrorType.NETWORK_ERROR,
        `Network error during ${operation}`,
        message,
        {
            operation,
            platform: Platform.TRADINGVIEW,
            timestamp: new Date(),
            additionalData: additionalData || {},
        },
        ErrorSeverity.ERROR,
        [
            {
                action: RecoveryAction.CHECK_NETWORK,
                description: 'Check your internet connection and try again',
                priority: 1,
                automated: false,
                estimatedTime: '1 minute',
            },
            {
                action: RecoveryAction.RETRY,
                description: 'Wait a moment and try again',
                priority: 2,
                automated: false,
                estimatedTime: '30 seconds',
            },
        ]
    );
}

export function createCleanupError(status: number, statusText: string, watchlistId: string): SessionError {
    return new SessionError(
        SessionErrorType.OPERATION_FAILED,
        'Failed to clean up TradingView watchlist',
        `HTTP ${status}: ${statusText}`,
        {
            operation: 'cleanup_tv_watchlist',
            platform: Platform.TRADINGVIEW,
            timestamp: new Date(),
            additionalData: { watchlistId, status, statusText },
        },
        ErrorSeverity.ERROR,
        [
            {
                action: RecoveryAction.RE_AUTHENTICATE,
                description: 'Verify you have permission to modify this watchlist',
                priority: 1,
                automated: false,
                estimatedTime: '1 minute',
            },
            {
                action: RecoveryAction.REFRESH_SESSION,
                description: 'Your session may have expired - refresh and try again',
                priority: 2,
                automated: false,
                estimatedTime: '3 minutes',
            },
        ]
    );
}

export function createAppendError(
    isSessionError: boolean,
    errorType: SessionErrorType,
    status: number,
    detailedError: string,
    watchlistId: string,
    symbolCount: number,
    apiError: unknown
): SessionError {
    return new SessionError(
        errorType,
        isSessionError ? 'Session authentication failed' : `Failed to append symbols: ${detailedError}`,
        `HTTP ${status}: ${detailedError}`,
        {
            operation: 'append_to_tv_watchlist',
            platform: Platform.TRADINGVIEW,
            timestamp: new Date(),
            additionalData: { watchlistId, symbolCount, status, statusText: detailedError, apiError },
        },
        isSessionError ? ErrorSeverity.ERROR : ErrorSeverity.WARNING,
        isSessionError
            ? [
                  {
                      action: RecoveryAction.RE_AUTHENTICATE,
                      description: 'Verify your TradingView session is valid',
                      priority: 1,
                      automated: false,
                      estimatedTime: '1 minute',
                  },
                  {
                      action: RecoveryAction.REFRESH_SESSION,
                      description: 'Refresh your session and try again',
                      priority: 2,
                      automated: false,
                      estimatedTime: '2 minutes',
                  },
              ]
            : [
                  {
                      action: RecoveryAction.RETRY,
                      description: 'Check data format and try again',
                      priority: 1,
                      automated: false,
                      estimatedTime: '1 minute',
                  },
                  {
                      action: RecoveryAction.CHECK_NETWORK,
                      description: 'Ensure symbols are in correct TradingView format (e.g., NSE:RELIANCE)',
                      priority: 2,
                      automated: false,
                      estimatedTime: '2 minutes',
                  },
              ]
    );
}
