/**
 * TechnicalDetails Component
 *
 * Displays collapsible technical information for session errors.
 * Extracted from ErrorDisplay for better maintainability.
 */

import React, { useState } from 'react';
import { CommonIcons } from '@/lib/iconUtils';
import type { SessionError } from '@/lib/sessionErrors';

interface TechnicalDetailsProps {
    error: SessionError;
}

interface TechnicalDetailRowProps {
    label: string;
    value: string | number;
}

function TechnicalDetailRow({ label, value }: TechnicalDetailRowProps) {
    return (
        <div>
            <span className='text-gray-600'>{label}:</span> <span className='text-gray-900'>{value}</span>
        </div>
    );
}

export function TechnicalDetails({ error }: TechnicalDetailsProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className='mt-4 border-t pt-3'>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className='flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors'
            >
                {isExpanded ? (
                    <CommonIcons.chevronUp className='h-4 w-4' />
                ) : (
                    <CommonIcons.chevronDown className='h-4 w-4' />
                )}
                {isExpanded ? 'Hide' : 'Show'} technical details
            </button>

            {isExpanded && (
                <div className='mt-3 bg-gray-50 rounded-md p-3 text-sm font-mono'>
                    <div className='space-y-2'>
                        <TechnicalDetailRow label='Error Code' value={error.errorCode} />
                        <TechnicalDetailRow label='Type' value={error.type} />
                        <TechnicalDetailRow label='Operation' value={error.context.operation} />
                        <TechnicalDetailRow label='Timestamp' value={error.context.timestamp.toISOString()} />
                        {error.context.httpStatus && (
                            <TechnicalDetailRow label='HTTP Status' value={error.context.httpStatus} />
                        )}
                        {error.context.requestUrl && (
                            <div>
                                <span className='text-gray-600'>URL:</span>{' '}
                                <span className='text-gray-900 break-all'>{error.context.requestUrl}</span>
                            </div>
                        )}
                        <TechnicalDetailRow label='Technical Message' value={error.technicalMessage} />
                    </div>
                </div>
            )}
        </div>
    );
}
