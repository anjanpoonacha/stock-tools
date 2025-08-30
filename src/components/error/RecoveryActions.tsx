/**
 * RecoveryActions Component
 *
 * Handles the display and interaction of recovery steps for session errors.
 * Extracted from ErrorDisplay for better separation of concerns.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getRecoveryActionIcon, CommonIcons } from '@/lib/iconUtils';
import type { SessionError } from '@/lib/sessionErrors';

interface RecoveryActionsProps {
    error: SessionError;
    onRetry?: () => void;
}

export function RecoveryActions({ error, onRetry }: RecoveryActionsProps) {
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
                        <CommonIcons.refresh className='h-4 w-4' />
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
                        {isExpanded ? (
                            <CommonIcons.chevronUp className='h-4 w-4' />
                        ) : (
                            <CommonIcons.chevronDown className='h-4 w-4' />
                        )}
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
