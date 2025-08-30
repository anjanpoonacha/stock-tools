'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User } from 'lucide-react';

interface SessionStats {
    hasSession: boolean;
    sessionAvailable: boolean;
    availableUsers: string[];
    currentUser?: string;
    platforms?: {
        marketinout?: { hasSession: boolean; sessionAvailable: boolean };
        tradingview?: { hasSession: boolean; sessionAvailable: boolean };
    };
    message: string;
}

interface SessionDisplayProps {
    sessionStats: SessionStats;
    onLogout: () => void;
}

export function SessionDisplay({ sessionStats, onLogout }: SessionDisplayProps) {
    return (
        <Card className='w-full max-w-md'>
            <CardHeader className='pb-4'>
                <CardTitle className='flex items-center gap-2'>
                    <User className='h-5 w-5' />
                    Logged in as {sessionStats.currentUser}
                </CardTitle>
                <CardDescription>Session status for your accounts</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
                <div className='space-y-2'>
                    <div className='flex items-center justify-between p-3 bg-muted rounded-lg'>
                        <span className='font-medium'>MarketInOut</span>
                        <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                                sessionStats.platforms?.marketinout?.sessionAvailable
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive'
                            }`}
                        >
                            {sessionStats.platforms?.marketinout?.sessionAvailable ? 'Active' : 'No Session'}
                        </span>
                    </div>
                    <div className='flex items-center justify-between p-3 bg-muted rounded-lg'>
                        <span className='font-medium'>TradingView</span>
                        <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                                sessionStats.platforms?.tradingview?.sessionAvailable
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive'
                            }`}
                        >
                            {sessionStats.platforms?.tradingview?.sessionAvailable ? 'Active' : 'No Session'}
                        </span>
                    </div>
                </div>

                <Alert>
                    <AlertDescription>{sessionStats.message}</AlertDescription>
                </Alert>

                <Button onClick={onLogout} variant='outline' className='w-full'>
                    Switch User
                </Button>
            </CardContent>
        </Card>
    );
}
