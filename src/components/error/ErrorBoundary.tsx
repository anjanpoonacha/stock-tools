/**
 * ErrorBoundary Component
 *
 * React Error Boundary for catching and displaying component errors.
 * Extracted from the original ErrorDisplay for better separation of concerns.
 */

import React from 'react';
import { ErrorDisplay } from './ErrorDisplay';
import { ErrorLogger, SessionError, SessionErrorType, Platform } from '@/lib/sessionErrors';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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
