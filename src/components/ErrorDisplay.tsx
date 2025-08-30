/**
 * ErrorDisplay Component
 *
 * Provides consistent, user-friendly error display across the application
 * with specific handling for session errors and recovery guidance.
 */

import React, { useState } from 'react';
import { AlertCircle, RefreshCw, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    SessionError,
    ErrorSeverity,
    Platform,
    RecoveryAction,
    ErrorLogger,
    SessionErrorType,
} from '@/lib/sessionErrors';

interface ErrorDisplayProps {
    error: SessionError | Error | string;
    onRetry?: () => void;
    onDismiss?: () => void;
    showTechnicalDetails?: boolean;
    className?: string;
}

interface SessionErrorDisplayProps {
    error: SessionError;
    onRetry?: () => void;
    onDismiss?: () => void;
    showTechnicalDetails?: boolean;
    className?: string;
}

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

/**
 * Get appropriate icon based on error severity
 */
function getSeverityIcon(severity: ErrorSeverity) {
    switch (severity) {
        case ErrorSeverity.INFO:
            return AlertCircle;
        case ErrorSeverity.WARNING:
            return AlertCircle;
        case ErrorSeverity.ERROR:
            return AlertCircle;
        case ErrorSeverity.CRITICAL:
            return AlertCircle;
        default:
            return AlertCircle;
    }
}

/**
 * Get platform display name and color
 */
function getPlatformConfig(platform: Platform) {
    switch (platform) {
        case Platform.MARKETINOUT:
            return {
                name: 'MarketInOut',
            };
        case Platform.TRADINGVIEW:
            return {
                name: 'TradingView',
            };
        case Platform.TELEGRAM:
            return {
                name: 'Telegram',
            };
        default:
            return {
                name: 'Unknown',
            };
    }
}

/**
 * Get recovery action icon
 */
function getRecoveryActionIcon(action: RecoveryAction) {
    switch (action) {
        case RecoveryAction.RETRY:
            return RefreshCw;
        case RecoveryAction.WAIT_AND_RETRY:
            return Clock;
        case RecoveryAction.REFRESH_SESSION:
            return RefreshCw;
        case RecoveryAction.RE_AUTHENTICATE:
            return ExternalLink;
        case RecoveryAction.CLEAR_CACHE:
            return RefreshCw;
        case RecoveryAction.CHECK_NETWORK:
            return AlertCircle;
        case RecoveryAction.UPDATE_CREDENTIALS:
            return ExternalLink;
        case RecoveryAction.CONTACT_SUPPORT:
            return ExternalLink;
        default:
            return AlertCircle;
    }
}

/**
 * Recovery Steps Component
 */
function RecoverySteps({ error, onRetry }: { error: SessionError; onRetry?: () => void }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const recoverySteps = error.recoverySteps;

    if (recoverySteps.length === 0) {
        return null;
    }

    const primaryStep = recoverySteps[0];
    const additionalSteps = recoverySteps.slice(1);

    return (
        <div className='mt-4 space-y-3'>
            {/* Primary Recovery Action */}
            <div className='flex items-start gap-3'>
                {primaryStep.automated && onRetry ? (
                    <Button onClick={onRetry} size='sm' variant='outline' className='flex items-center gap-2'>
                        <RefreshCw className='h-4 w-4' />
                        Try Again
                    </Button>
                ) : (
                    <div className='flex items-center gap-2 text-sm'>
                        {React.createElement(getRecoveryActionIcon(primaryStep.action), {
                            className: 'h-4 w-4 text-blue-600',
                        })}
                        <span className='font-medium'>Next Step:</span>
                    </div>
                )}
                <div className='flex-1'>
                    <p className='text-sm text-gray-700'>{primaryStep.description}</p>
                    {primaryStep.estimatedTime && (
                        <p className='text-xs text-gray-500 mt-1'>Estimated time: {primaryStep.estimatedTime}</p>
                    )}
                </div>
            </div>

            {/* Additional Recovery Steps */}
            {additionalSteps.length > 0 && (
                <div className='border-t pt-3'>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className='flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors'
                    >
                        {isExpanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
                        {isExpanded ? 'Hide' : 'Show'} additional steps ({additionalSteps.length})
                    </button>

                    {isExpanded && (
                        <div className='mt-3 space-y-2'>
                            {additionalSteps.map((step, index) => (
                                <div key={index} className='flex items-start gap-2 text-sm'>
                                    <span className='text-gray-400 font-mono text-xs mt-0.5'>{index + 2}.</span>
                                    <div className='flex-1'>
                                        <p className='text-gray-700'>{step.description}</p>
                                        {step.estimatedTime && (
                                            <p className='text-xs text-gray-500 mt-1'>Time: {step.estimatedTime}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Technical Details Component
 */
function TechnicalDetails({ error }: { error: SessionError }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className='mt-4 border-t pt-3'>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className='flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors'
            >
                {isExpanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
                {isExpanded ? 'Hide' : 'Show'} technical details
            </button>

            {isExpanded && (
                <div className='mt-3 bg-gray-50 rounded-md p-3 text-sm font-mono'>
                    <div className='space-y-2'>
                        <div>
                            <span className='text-gray-600'>Error Code:</span>{' '}
                            <span className='text-gray-900'>{error.errorCode}</span>
                        </div>
                        <div>
                            <span className='text-gray-600'>Type:</span>{' '}
                            <span className='text-gray-900'>{error.type}</span>
                        </div>
                        <div>
                            <span className='text-gray-600'>Operation:</span>{' '}
                            <span className='text-gray-900'>{error.context.operation}</span>
                        </div>
                        <div>
                            <span className='text-gray-600'>Timestamp:</span>{' '}
                            <span className='text-gray-900'>{error.context.timestamp.toISOString()}</span>
                        </div>
                        {error.context.httpStatus && (
                            <div>
                                <span className='text-gray-600'>HTTP Status:</span>{' '}
                                <span className='text-gray-900'>{error.context.httpStatus}</span>
                            </div>
                        )}
                        {error.context.requestUrl && (
                            <div>
                                <span className='text-gray-600'>URL:</span>{' '}
                                <span className='text-gray-900 break-all'>{error.context.requestUrl}</span>
                            </div>
                        )}
                        <div>
                            <span className='text-gray-600'>Technical Message:</span>{' '}
                            <span className='text-gray-900'>{error.technicalMessage}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Session Error Display Component
 */
function SessionErrorDisplay({
    error,
    onRetry,
    onDismiss,
    showTechnicalDetails = false,
    className = '',
}: SessionErrorDisplayProps) {
    const platformConfig = getPlatformConfig(error.platform);
    const Icon = getSeverityIcon(error.severity);

    // Log the error when displayed
    React.useEffect(() => {
        ErrorLogger.logError(error, { displayedAt: new Date() });
    }, [error]);

    return (
        <Alert variant={error.severity === ErrorSeverity.CRITICAL ? 'destructive' : 'default'} className={className}>
            <Icon className='h-5 w-5' />
            <div className='flex-1 min-w-0'>
                <div className='flex items-center justify-between mb-2'>
                    <div className='flex items-center gap-2'>
                        <AlertTitle>Error in {platformConfig.name}</AlertTitle>
                        <Badge variant='secondary'>{error.severity.toUpperCase()}</Badge>
                    </div>
                    {onDismiss && (
                        <Button variant='ghost' size='sm' onClick={onDismiss} className='h-6 w-6 p-0'>
                            ×
                        </Button>
                    )}
                </div>
                <AlertDescription>
                    <p>{error.getDisplayMessage()}</p>
                    <RecoverySteps error={error} onRetry={onRetry} />
                    {showTechnicalDetails && <TechnicalDetails error={error} />}
                </AlertDescription>
            </div>
        </Alert>
    );
}

/**
 * Generic Error Display Component
 */
function GenericErrorDisplay({
    error,
    onRetry,
    onDismiss,
    className = '',
}: {
    error: Error | string;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
}) {
    const errorMessage = typeof error === 'string' ? error : error.message;

    return (
        <Alert variant='destructive' className={className}>
            <AlertCircle className='h-5 w-5' />
            <div className='flex-1 min-w-0'>
                <div className='flex items-center justify-between mb-2'>
                    <AlertTitle>Error</AlertTitle>
                    {onDismiss && (
                        <Button variant='ghost' size='sm' onClick={onDismiss} className='h-6 w-6 p-0'>
                            ×
                        </Button>
                    )}
                </div>
                <AlertDescription>
                    <p>{errorMessage}</p>
                    {onRetry && (
                        <div className='mt-3'>
                            <Button onClick={onRetry} size='sm' variant='outline'>
                                <RefreshCw className='h-4 w-4 mr-2' />
                                Try Again
                            </Button>
                        </div>
                    )}
                </AlertDescription>
            </div>
        </Alert>
    );
}

/**
 * Main ErrorDisplay Component
 */
export function ErrorDisplay({
    error,
    onRetry,
    onDismiss,
    showTechnicalDetails = false,
    className = '',
}: ErrorDisplayProps) {
    if (error instanceof SessionError) {
        return (
            <SessionErrorDisplay
                error={error}
                onRetry={onRetry}
                onDismiss={onDismiss}
                showTechnicalDetails={showTechnicalDetails}
                className={className}
            />
        );
    }

    return <GenericErrorDisplay error={error} onRetry={onRetry} onDismiss={onDismiss} className={className} />;
}

/**
 * Error Boundary Component for React Error Handling
 */
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<
    React.PropsWithChildren<{
        fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
        onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    }>,
    ErrorBoundaryState
> {
    constructor(
        props: React.PropsWithChildren<{
            fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
            onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
        }>
    ) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Log to our error system
        ErrorLogger.logError(
            new SessionError(SessionErrorType.UNKNOWN_ERROR, 'An unexpected error occurred', error.message, {
                platform: Platform.UNKNOWN,
                operation: 'component_render',
                timestamp: new Date(),
                additionalData: { errorInfo },
            }),
            { componentStack: errorInfo.componentStack }
        );

        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    retry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                const FallbackComponent = this.props.fallback;
                return <FallbackComponent error={this.state.error} retry={this.retry} />;
            }

            return (
                <ErrorDisplay
                    error={this.state.error}
                    onRetry={this.retry}
                    showTechnicalDetails={process.env.NODE_ENV === 'development'}
                />
            );
        }

        return this.props.children;
    }
}

export default ErrorDisplay;
