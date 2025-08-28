// src/components/SessionStatus.tsx
import React from 'react';

interface SessionStatusProps {
    platform: 'TradingView' | 'MarketInOut';
    sessionId: string | null;
    loading?: boolean;
    error?: string | null;
    className?: string;
}

export function SessionStatus({
    platform,
    sessionId,
    loading = false,
    error = null,
    className = '',
}: SessionStatusProps) {
    return (
        <div className={`p-4 bg-muted/50 border border-border rounded-lg ${className}`}>
            <div className='text-sm font-medium text-foreground'>
                {platform} Session: {loading ? 'Checking...' : sessionId ? 'Connected' : 'Not connected'}
            </div>
            {error && <div className='text-xs text-destructive mt-2'>Error: {error}</div>}
            {!loading && !sessionId && !error && (
                <div className='text-xs text-muted-foreground mt-2'>
                    Visit {platform} and log in to automatically capture your session
                </div>
            )}
            {sessionId && (
                <div className='text-xs text-muted-foreground mt-2'>
                    Session automatically detected from browser extension
                </div>
            )}
        </div>
    );
}
