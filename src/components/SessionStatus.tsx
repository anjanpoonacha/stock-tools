// src/components/SessionStatus.tsx
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    // Don't render anything if session is connected and no errors
    if (sessionId && !error && !loading) {
        return null;
    }

    // Determine the status and styling
    const getStatusConfig = () => {
        if (loading) {
            return {
                status: 'Checking...',
                variant: 'default' as const,
                badgeVariant: 'secondary' as const,
                icon: <Loader2 className='h-4 w-4 animate-spin' />,
                alertClass: 'border-border bg-muted/30 dark:border-border dark:bg-muted/20',
                needsAttention: false,
            };
        }

        if (error) {
            // Treat MIO errors as warnings, TradingView errors as errors
            const isMIOError = platform === 'MarketInOut';

            if (isMIOError) {
                return {
                    status: 'Not connected',
                    variant: 'default' as const,
                    badgeVariant: 'outline' as const,
                    icon: <AlertTriangle className='h-4 w-4 text-amber-600' />,
                    alertClass: 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50',
                    needsAttention: true,
                };
            } else {
                return {
                    status: 'Not connected',
                    variant: 'default' as const,
                    badgeVariant: 'outline' as const,
                    icon: <AlertTriangle className='h-4 w-4 text-amber-600' />,
                    alertClass: 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50',
                    needsAttention: true,
                };
            }
        }

        if (sessionId) {
            return {
                status: 'Connected',
                variant: 'default' as const,
                badgeVariant: 'default' as const,
                icon: <CheckCircle className='h-4 w-4 text-green-600' />,
                alertClass: 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50',
                needsAttention: false,
            };
        }

        // Not connected - needs attention
        return {
            status: 'Not connected',
            variant: 'default' as const,
            badgeVariant: 'outline' as const,
            icon: <AlertTriangle className='h-4 w-4 text-amber-600' />,
            alertClass:
                'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50 ring-2 ring-amber-200/50 dark:ring-amber-800/50',
            needsAttention: true,
        };
    };

    const config = getStatusConfig();

    return (
        <Alert className={cn(config.alertClass, config.needsAttention && 'animate-pulse', className)}>
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                    {config.icon}
                    <div>
                        <div className='flex items-center gap-2'>
                            <span className='text-sm font-medium text-foreground'>{platform} Session</span>
                            <Badge
                                variant={config.badgeVariant}
                                className={cn(
                                    config.needsAttention && !loading && 'animate-pulse',
                                    sessionId &&
                                        'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
                                )}
                            >
                                {config.status}
                            </Badge>
                        </div>

                        <AlertDescription className='mt-1'>
                            {error && (
                                <span
                                    className={cn(
                                        'font-medium',
                                        platform === 'MarketInOut'
                                            ? 'text-amber-700 dark:text-amber-400'
                                            : 'text-destructive'
                                    )}
                                >
                                    {error}
                                </span>
                            )}
                            {!loading && !sessionId && !error && (
                                <span className='text-amber-700 dark:text-amber-400 font-medium'>
                                    Visit {platform} and log in to automatically capture your session
                                </span>
                            )}
                            {sessionId && (
                                <span className='text-green-700 dark:text-green-400'>
                                    Session automatically detected from browser extension
                                </span>
                            )}
                            {loading && <span className='text-muted-foreground'>Checking for active session...</span>}
                        </AlertDescription>
                    </div>
                </div>

                {config.needsAttention && !loading && (
                    <div className='flex-shrink-0'>
                        <div className='h-3 w-3 bg-amber-400 rounded-full animate-ping'></div>
                    </div>
                )}
            </div>
        </Alert>
    );
}
