/**
 * GenericErrorAlert Component
 *
 * Displays generic errors (non-session errors) with retry functionality.
 * Extracted from ErrorDisplay for better separation of concerns.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CommonIcons } from '@/lib/iconUtils';

interface GenericErrorAlertProps {
    error: Error | string;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
}

export function GenericErrorAlert({ error, onRetry, onDismiss, className = '' }: GenericErrorAlertProps) {
    const errorMessage = typeof error === 'string' ? error : error.message;

    return (
        <Alert variant='destructive' className={className}>
            <CommonIcons.alertCircle className='h-5 w-5' />
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
                                <CommonIcons.refresh className='h-4 w-4 mr-2' />
                                Try Again
                            </Button>
                        </div>
                    )}
                </AlertDescription>
            </div>
        </Alert>
    );
}
