'use client';

import React, { useState } from 'react';
import { ErrorDisplay, ErrorBoundary } from '@/components/ErrorDisplay';
import { 
  SessionError, 
  SessionErrorType, 
  Platform, 
  ErrorSeverity,
  RecoveryAction 
} from '@/lib/sessionErrors';
import { Button } from '@/components/ui/button';

/**
 * Test Error Display Page
 * 
 * This page tests all error handling components and scenarios
 * to ensure the error system works correctly across the application.
 */
export default function TestErrorsPage() {
  const [currentError, setCurrentError] = useState<SessionError | Error | string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Test error scenarios
  const testErrors = {
    sessionExpired: new SessionError(
      SessionErrorType.SESSION_EXPIRED,
      'Your MarketInOut session has expired',
      'Session cookie expired after 24 hours of inactivity',
      {
        platform: Platform.MARKETINOUT,
        operation: 'fetch_watchlist',
        timestamp: new Date(),
        httpStatus: 401,
        requestUrl: 'https://marketinout.com/api/watchlist'
      },
      ErrorSeverity.WARNING,
      [
        {
          action: RecoveryAction.RE_AUTHENTICATE,
          description: 'Please log in to MarketInOut again to refresh your session',
          priority: 1,
          automated: false,
          estimatedTime: '1-2 minutes'
        },
        {
          action: RecoveryAction.CLEAR_CACHE,
          description: 'Clear browser cache if login issues persist',
          priority: 2,
          automated: false,
          estimatedTime: '30 seconds'
        }
      ]
    ),

    networkError: new SessionError(
      SessionErrorType.NETWORK_ERROR,
      'Unable to connect to TradingView',
      'Network request failed with timeout after 30 seconds',
      {
        platform: Platform.TRADINGVIEW,
        operation: 'sync_watchlist',
        timestamp: new Date(),
        httpStatus: 0,
        requestUrl: 'https://www.tradingview.com/api/v1/watchlists/'
      },
      ErrorSeverity.ERROR,
      [
        {
          action: RecoveryAction.CHECK_NETWORK,
          description: 'Check your internet connection and try again',
          priority: 1,
          automated: false,
          estimatedTime: '1 minute'
        },
        {
          action: RecoveryAction.WAIT_AND_RETRY,
          description: 'Wait a moment and retry the operation',
          priority: 2,
          automated: true,
          estimatedTime: '30 seconds'
        }
      ]
    ),

    invalidSession: new SessionError(
      SessionErrorType.INVALID_CREDENTIALS,
      'Invalid session data detected',
      'Session validation failed - corrupted session data',
      {
        platform: Platform.MARKETINOUT,
        operation: 'validate_session',
        timestamp: new Date(),
        additionalData: { sessionId: 'abc123', validationErrors: ['missing_csrf_token'] }
      },
      ErrorSeverity.CRITICAL,
      [
        {
          action: RecoveryAction.REFRESH_SESSION,
          description: 'Clear current session and authenticate again',
          priority: 1,
          automated: false,
          estimatedTime: '2-3 minutes'
        },
        {
          action: RecoveryAction.CONTACT_SUPPORT,
          description: 'Contact support if the issue persists',
          priority: 2,
          automated: false,
          estimatedTime: '5-10 minutes'
        }
      ]
    ),

    platformSpecific: new SessionError(
      SessionErrorType.API_RATE_LIMITED,
      'TradingView rate limit exceeded',
      'API rate limit of 100 requests per minute exceeded',
      {
        platform: Platform.TRADINGVIEW,
        operation: 'bulk_symbol_sync',
        timestamp: new Date(),
        httpStatus: 429,
        requestUrl: 'https://www.tradingview.com/api/v1/watchlists/append'
      },
      ErrorSeverity.WARNING,
      [
        {
          action: RecoveryAction.WAIT_AND_RETRY,
          description: 'Wait for rate limit to reset and try again',
          priority: 1,
          automated: true,
          estimatedTime: '1 minute'
        },
        {
          action: RecoveryAction.RETRY,
          description: 'Reduce batch size and retry with smaller chunks',
          priority: 2,
          automated: false,
          estimatedTime: '2-3 minutes'
        }
      ]
    ),

    genericError: new Error('A generic JavaScript error occurred'),
    
    stringError: 'A simple string error message'
  };

  const handleRetry = () => {
    console.log('Retry button clicked');
    setCurrentError(null);
  };

  const handleDismiss = () => {
    console.log('Dismiss button clicked');
    setCurrentError(null);
  };

  // Component that throws an error for testing ErrorBoundary
  const ErrorThrowingComponent = () => {
    throw new Error('This is a test error thrown by a React component');
  };

  const [showErrorBoundaryTest, setShowErrorBoundaryTest] = useState(false);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Error Handling Test Page</h1>
        <p className="text-gray-600 mb-4">
          This page tests all error handling components and scenarios to ensure 
          the error system works correctly across the application.
        </p>
        
        <div className="flex items-center gap-4 mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showTechnicalDetails}
              onChange={(e) => setShowTechnicalDetails(e.target.checked)}
              className="rounded"
            />
            Show Technical Details
          </label>
        </div>
      </div>

      {/* Current Error Display */}
      {currentError && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Current Error:</h2>
          <ErrorDisplay
            error={currentError}
            onRetry={handleRetry}
            onDismiss={handleDismiss}
            showTechnicalDetails={showTechnicalDetails}
          />
        </div>
      )}

      {/* Test Error Buttons */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Error Scenarios:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(testErrors).map(([key, error]) => (
            <div key={key} className="p-4 border rounded-lg bg-white shadow-sm">
              <h3 className="font-medium mb-2 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {error instanceof SessionError
                  ? error.getDisplayMessage()
                  : error instanceof Error
                    ? error.message
                    : error
                }
              </p>
              <Button
                onClick={() => setCurrentError(error)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Test This Error
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Error Boundary Test */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Error Boundary Test:</h2>
        <div className="space-y-4">
          <Button
            onClick={() => setShowErrorBoundaryTest(!showErrorBoundaryTest)}
            variant={showErrorBoundaryTest ? "destructive" : "default"}
          >
            {showErrorBoundaryTest ? 'Hide Error Component' : 'Show Error Component'}
          </Button>
          
          {showErrorBoundaryTest && (
            <ErrorBoundary>
              <div className="p-4 border rounded-lg bg-white shadow-sm">
                <p className="mb-4">This component will throw an error when rendered:</p>
                <ErrorThrowingComponent />
              </div>
            </ErrorBoundary>
          )}
        </div>
      </div>

      {/* Error Types Reference */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Error Types Reference:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="font-medium mb-2">Session Error Types</h3>
            <ul className="text-sm space-y-1">
              <li><code>SESSION_EXPIRED</code> - Session has expired</li>
              <li><code>INVALID_CREDENTIALS</code> - Invalid credentials</li>
              <li><code>NETWORK_ERROR</code> - Network connectivity issues</li>
              <li><code>API_RATE_LIMITED</code> - API rate limit exceeded</li>
              <li><code>OPERATION_FAILED</code> - General operation failures</li>
            </ul>
          </div>
          
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="font-medium mb-2">Error Severities</h3>
            <ul className="text-sm space-y-1">
              <li><code>INFO</code> - Informational messages</li>
              <li><code>WARNING</code> - Warning conditions</li>
              <li><code>ERROR</code> - Error conditions</li>
              <li><code>CRITICAL</code> - Critical failures</li>
            </ul>
          </div>
          
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="font-medium mb-2">Platforms</h3>
            <ul className="text-sm space-y-1">
              <li><code>MARKETINOUT</code> - MarketInOut platform</li>
              <li><code>TRADINGVIEW</code> - TradingView platform</li>
              <li><code>TELEGRAM</code> - Telegram integration</li>
              <li><code>UNKNOWN</code> - Unknown platform</li>
            </ul>
          </div>
          
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="font-medium mb-2">Recovery Actions</h3>
            <ul className="text-sm space-y-1">
              <li><code>RETRY</code> - Retry the operation</li>
              <li><code>WAIT_AND_RETRY</code> - Wait then retry</li>
              <li><code>REFRESH_SESSION</code> - Refresh session</li>
              <li><code>RE_AUTHENTICATE</code> - Re-authenticate</li>
              <li><code>CLEAR_CACHE</code> - Clear browser cache</li>
              <li><code>CHECK_NETWORK</code> - Check network</li>
              <li><code>UPDATE_CREDENTIALS</code> - Update credentials</li>
              <li><code>CONTACT_SUPPORT</code> - Contact support</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Clear All Button */}
      <div className="text-center">
        <Button
          onClick={() => {
            setCurrentError(null);
            setShowErrorBoundaryTest(false);
          }}
          variant="outline"
        >
          Clear All Errors
        </Button>
      </div>
    </div>
  );
}