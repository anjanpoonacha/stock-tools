/**
 * ErrorDisplay Component (Refactored)
 *
 * Main error display component that routes to appropriate sub-components.
 * Significantly simplified from the original 400+ line implementation.
 */

import React from 'react';
import { ErrorAlert } from './ErrorAlert';
import { GenericErrorAlert } from './GenericErrorAlert';
import { SessionError } from '@/lib/sessionErrors';

interface ErrorDisplayProps {
    error: SessionError | Error | string;
    onRetry?: () => void;
    onDismiss?: () => void;
    showTechnicalDetails?: boolean;
    className?: string;
}

export function ErrorDisplay({
    error,
    onRetry,
    onDismiss,
    showTechnicalDetails = false,
    className = '',
}: ErrorDisplayProps) {
    if (error instanceof SessionError) {
        return (
            <ErrorAlert
                error={error}
                onRetry={onRetry}
                onDismiss={onDismiss}
                showTechnicalDetails={showTechnicalDetails}
                className={className}
            />
        );
    }

    return <GenericErrorAlert error={error} onRetry={onRetry} onDismiss={onDismiss} className={className} />;
}
