'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, LogIn, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface AuthGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    showLoginPrompt?: boolean;
}

/**
 * AuthGuard component that protects routes requiring authentication
 * Shows authentication prompt if user is not authenticated
 */
export function AuthGuard({ children, fallback, showLoginPrompt = true }: AuthGuardProps) {
    const { isAuthenticated, isLoading, error, authStatus } = useAuth();

    // Show loading state
    if (isLoading) {
        return (
            <div className='flex items-center justify-center min-h-[400px]'>
                <div className='text-center space-y-4'>
                    <Loader2 className='h-8 w-8 animate-spin mx-auto text-primary' />
                    <p className='text-muted-foreground'>Checking authentication...</p>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className='max-w-md mx-auto mt-8'>
                <Alert variant='destructive'>
                    <Shield className='h-4 w-4' />
                    <AlertDescription>Authentication Error: {error}</AlertDescription>
                </Alert>
                {showLoginPrompt && (
                    <div className='mt-4 text-center'>
                        <Button asChild>
                            <Link href='/user-authentication'>
                                <LogIn className='h-4 w-4 mr-2' />
                                Go to Authentication
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    // Show authentication required prompt
    if (!isAuthenticated()) {
        if (fallback) {
            return <>{fallback}</>;
        }

        if (!showLoginPrompt) {
            return null;
        }

        return (
            <div className='max-w-md mx-auto mt-8'>
                <Card>
                    <CardHeader className='text-center'>
                        <CardTitle className='flex items-center justify-center gap-2'>
                            <Shield className='h-5 w-5' />
                            Authentication Required
                        </CardTitle>
                        <CardDescription>You need to authenticate to access this feature</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <div className='text-sm text-muted-foreground space-y-2'>
                            <p>To access watchlists and trading features, you need to:</p>
                            <ul className='list-disc list-inside space-y-1 ml-4'>
                                <li>Enter your trading platform credentials</li>
                                <li>Ensure you have captured sessions using the browser extension</li>
                                <li>Verify your session data is available</li>
                            </ul>
                        </div>

                        <Button asChild className='w-full'>
                            <Link href='/user-authentication'>
                                <LogIn className='h-4 w-4 mr-2' />
                                Go to Authentication Page
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // User is authenticated, show protected content
    return <>{children}</>;
}

/**
 * Hook to get authentication status for conditional rendering
 */
export function useAuthGuard() {
    const auth = useAuth();

    return {
        isAuthenticated: auth.isAuthenticated(),
        isLoading: auth.isLoading,
        error: auth.error,
        userEmail: auth.getUserEmail(),
        authStatus: auth.authStatus,
        needsAuth: auth.requiresAuth(),
    };
}

/**
 * Simple authentication status indicator
 */
export function AuthStatus() {
    const { isAuthenticated, isLoading, userEmail, authStatus } = useAuthGuard();

    if (isLoading) {
        return (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Loader2 className='h-3 w-3 animate-spin' />
                Checking auth...
            </div>
        );
    }

    if (isAuthenticated) {
        const mioAvailable = authStatus?.sessionStats?.platforms?.marketinout?.sessionAvailable;
        const tvAvailable = authStatus?.sessionStats?.platforms?.tradingview?.sessionAvailable;

        return (
            <div className='flex items-center gap-2 text-sm'>
                <Shield className='h-3 w-3 text-green-600' />
                <span className='text-green-600'>Authenticated as {userEmail}</span>
                <span className='text-xs text-muted-foreground'>
                    (MIO: {mioAvailable ? '✓' : '✗'}, TV: {tvAvailable ? '✓' : '✗'})
                </span>
            </div>
        );
    }

    return (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Shield className='h-3 w-3' />
            Not authenticated
        </div>
    );
}
