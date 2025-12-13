/**
 * Error Categorization Utility
 * 
 * Helps distinguish between session-level errors (authentication/authorization)
 * and operation-level errors (API constraints, data format, etc.)
 */

import { SessionErrorType } from './sessionErrors';

export interface ErrorCategory {
    isSessionError: boolean;
    errorType: SessionErrorType;
}

/**
 * Categorize an HTTP error based on status code and message content
 * 
 * @param status - HTTP status code
 * @param message - Error message from the API or error object
 * @returns Category information including whether it's a session error and the specific error type
 */
export function categorizeHttpError(status: number, message: string): ErrorCategory {
    const lowerMessage = message.toLowerCase();
    
    // Session/Authentication errors (401, 403)
    if (
        status === 401 || 
        status === 403 ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('forbidden') ||
        lowerMessage.includes('session expired') ||
        lowerMessage.includes('authentication failed')
    ) {
        return {
            isSessionError: true,
            errorType: status === 401 ? 
                SessionErrorType.SESSION_EXPIRED : 
                SessionErrorType.INVALID_CREDENTIALS
        };
    }
    
    // Rate limiting (429)
    if (status === 429 || lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
        return {
            isSessionError: false,
            errorType: SessionErrorType.API_RATE_LIMITED
        };
    }
    
    // Data format errors (400, 422)
    if (
        status === 422 || 
        status === 400 ||
        lowerMessage.includes('expected') ||
        lowerMessage.includes('invalid data') ||
        lowerMessage.includes('invalid_data') ||
        lowerMessage.includes('format')
    ) {
        return {
            isSessionError: false,
            errorType: SessionErrorType.DATA_FORMAT_ERROR
        };
    }
    
    // Server errors (5xx)
    if (status >= 500) {
        return {
            isSessionError: false,
            errorType: SessionErrorType.PLATFORM_UNAVAILABLE
        };
    }
    
    // Permission errors (specific 403 cases)
    if (lowerMessage.includes('permission') || lowerMessage.includes('access denied')) {
        return {
            isSessionError: false,
            errorType: SessionErrorType.PERMISSION_DENIED
        };
    }
    
    // Default: operation error
    return {
        isSessionError: false,
        errorType: SessionErrorType.OPERATION_FAILED
    };
}

/**
 * Extract detailed error message from TradingView API response
 * 
 * @param responseData - Parsed JSON response from TradingView API
 * @returns Formatted error message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractTradingViewError(responseData: any): string {
    if (!responseData) return 'Unknown error';
    
    // Check for non_field_errors array
    if (responseData.non_field_errors && Array.isArray(responseData.non_field_errors)) {
        return responseData.non_field_errors.join(', ');
    }
    
    // Check for __code__ with structured error
    if (responseData.__code__) {
        const code = responseData.__code__;
        const details = responseData.non_field_errors || responseData.detail || '';
        return `${code}: ${JSON.stringify(details)}`;
    }
    
    // Check for generic error field
    if (responseData.error) {
        return typeof responseData.error === 'string' ? 
            responseData.error : 
            JSON.stringify(responseData.error);
    }
    
    // Check for detail field
    if (responseData.detail) {
        return typeof responseData.detail === 'string' ? 
            responseData.detail : 
            JSON.stringify(responseData.detail);
    }
    
    // Fallback to stringified response
    return JSON.stringify(responseData).substring(0, 200);
}

/**
 * Extract detailed error message from MarketInOut API response
 * 
 * @param responseData - Parsed JSON response from MarketInOut API
 * @returns Formatted error message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractMarketInOutError(responseData: any): string {
    if (!responseData) return 'Unknown error';
    
    // Check for message field
    if (responseData.message) {
        return responseData.message;
    }
    
    // Check for error field
    if (responseData.error) {
        return typeof responseData.error === 'string' ? 
            responseData.error : 
            JSON.stringify(responseData.error);
    }
    
    // Check for errors array
    if (responseData.errors && Array.isArray(responseData.errors)) {
        return responseData.errors.join(', ');
    }
    
    // Fallback to stringified response
    return JSON.stringify(responseData).substring(0, 200);
}
