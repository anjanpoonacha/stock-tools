/**
 * ErrorAlert Component
 *
 * Main error display component that orchestrates the display of session errors
 * with recovery actions and technical details. Simplified from original ErrorDisplay.
 */

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { getSeverityIcon, getPlatformConfig } from '@/lib/iconUtils';
import { RecoveryActions } from './RecoveryActions';
import { TechnicalDetails } from './TechnicalDetails';
import { ErrorSeverity, ErrorLogger, type SessionError } from '@/lib/sessionErrors';

interface ErrorAlertProps {
    error: SessionError;
    onRetry?: () => void;
    onDismiss?: () => void;
    showTechnicalDetails?: boolean;
    className?: string;
}

export function ErrorAlert({
    error,
    onRetry,
    onDismiss,
    showTechnicalDetails = false,
    className = '',
}: ErrorAlertProps) {
    const platformConfig = getPlatformConfig(error.platform);
    const Icon = getSeverityIcon(error.severity);

    // Log the error when displayed
    useEffect(() => {
        ErrorLogger.logError(error, { displayedAt: new Date() });
    }, [error]);

    const isDestructive = error.severity === ErrorSeverity.CRITICAL;

    return (
        <Alert variant={isDestructive ? 'destructive' : 'default'} className={className}>
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
                    <RecoveryActions error={error} onRetry={onRetry} />
                    {showTechnicalDetails && <TechnicalDetails error={error} />}
                </AlertDescription>
            </div>
        </Alert>
    );
}
