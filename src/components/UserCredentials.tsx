'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, User, Lock, LogIn, Users } from 'lucide-react';

interface UserCredentialsProps {
    onCredentialsChange: (credentials: { userEmail: string; userPassword: string } | null) => void;
    availableUsers?: string[];
}

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

export function UserCredentials({ onCredentialsChange, availableUsers = [] }: UserCredentialsProps) {
    const [userEmail, setUserEmail] = useState('');
    const [userPassword, setUserPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const hasAutoLoginAttempted = useRef(false);

    // Load saved credentials from localStorage on component mount
    useEffect(() => {
        // Prevent multiple auto-login attempts
        if (hasAutoLoginAttempted.current) {
            return;
        }

        const autoLogin = async (emailToUse: string, passwordToUse: string) => {
            // Abort any existing request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/session/current', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userEmail: emailToUse,
                        userPassword: passwordToUse,
                    }),
                    signal: abortControllerRef.current.signal,
                });

                const data = await response.json();

                if (response.ok) {
                    setSessionStats(data);
                    setIsLoggedIn(true);

                    // Notify parent component
                    onCredentialsChange({
                        userEmail: emailToUse,
                        userPassword: passwordToUse,
                    });
                } else {
                    setError(data.details || data.error || 'Login failed');
                    setIsLoggedIn(false);
                    onCredentialsChange(null);
                }
            } catch (error) {
                if (error instanceof Error) {
                    if (error.name === 'AbortError') {
                        console.log('Auto-login request was aborted');
                        return;
                    }
                    console.error('Auto-login error:', error);
                    setError('Network error - please try again');
                    setIsLoggedIn(false);
                    onCredentialsChange(null);
                }
            } finally {
                setIsLoading(false);
                abortControllerRef.current = null;
            }
        };

        const savedEmail = localStorage.getItem('userEmail');
        const savedPassword = localStorage.getItem('userPassword');

        if (savedEmail && savedPassword) {
            hasAutoLoginAttempted.current = true;
            setUserEmail(savedEmail);
            setUserPassword(savedPassword);
            // Auto-login with saved credentials
            autoLogin(savedEmail, savedPassword);
        }

        // Cleanup function
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [onCredentialsChange]);

    const handleLogin = async (email?: string, password?: string) => {
        const emailToUse = email || userEmail;
        const passwordToUse = password || userPassword;

        if (!emailToUse || !passwordToUse) {
            setError('Please enter both email and password');
            return;
        }

        // Prevent multiple simultaneous requests
        if (isLoading) {
            return;
        }

        // Abort any existing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/session/current', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userEmail: emailToUse,
                    userPassword: passwordToUse,
                }),
                signal: abortControllerRef.current.signal,
            });

            const data = await response.json();

            if (response.ok) {
                setSessionStats(data);
                setIsLoggedIn(true);

                // Save credentials to localStorage
                localStorage.setItem('userEmail', emailToUse);
                localStorage.setItem('userPassword', passwordToUse);

                // Notify parent component
                onCredentialsChange({
                    userEmail: emailToUse,
                    userPassword: passwordToUse,
                });
            } else {
                setError(data.details || data.error || 'Login failed');
                setIsLoggedIn(false);
                onCredentialsChange(null);
            }
        } catch (error) {
            if (!(error instanceof Error)) {
                setError('An unknown error occurred');
                setIsLoggedIn(false);
                onCredentialsChange(null);
                return;
            }
            if (error.name === 'AbortError') {
                console.log('Login request was aborted');
                return;
            }
            setError('Network error - please try again');
            setIsLoggedIn(false);
            onCredentialsChange(null);
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setSessionStats(null);
        setError(null);

        // Clear saved credentials
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userPassword');

        // Notify parent component
        onCredentialsChange(null);
    };

    const handleUserSelect = (selectedEmail: string) => {
        setUserEmail(selectedEmail);
        setUserPassword(''); // Clear password when switching users
    };

    if (isLoggedIn && sessionStats) {
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
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
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
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                }`}
                            >
                                {sessionStats.platforms?.tradingview?.sessionAvailable ? 'Active' : 'No Session'}
                            </span>
                        </div>
                    </div>

                    <Alert>
                        <AlertDescription>{sessionStats.message}</AlertDescription>
                    </Alert>

                    <Button onClick={handleLogout} variant='outline' className='w-full'>
                        Switch User
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className='w-full max-w-md'>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <LogIn className='h-5 w-5' />
                    Enter Your Credentials
                </CardTitle>
                <CardDescription>
                    Enter the same email and password you configured in the browser extension
                </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
                {availableUsers.length > 0 && (
                    <div className='space-y-2'>
                        <Label className='flex items-center gap-2'>
                            <Users className='h-4 w-4' />
                            Available Users
                        </Label>
                        <div className='flex flex-wrap gap-2'>
                            {availableUsers.map((email) => (
                                <Button
                                    key={email}
                                    variant='outline'
                                    size='sm'
                                    onClick={() => handleUserSelect(email)}
                                    className='text-xs'
                                >
                                    {email}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                <div className='space-y-2'>
                    <Label htmlFor='userEmail'>Email</Label>
                    <Input
                        id='userEmail'
                        type='email'
                        placeholder='your@email.com'
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                <div className='space-y-2'>
                    <Label htmlFor='userPassword'>Password</Label>
                    <div className='relative'>
                        <Input
                            id='userPassword'
                            type={showPassword ? 'text' : 'password'}
                            placeholder='Your password'
                            value={userPassword}
                            onChange={(e) => setUserPassword(e.target.value)}
                            disabled={isLoading}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleLogin();
                                }
                            }}
                        />
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                        >
                            {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                        </Button>
                    </div>
                </div>

                {error && (
                    <Alert variant='destructive'>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <Button
                    onClick={() => handleLogin()}
                    disabled={isLoading || !userEmail || !userPassword}
                    className='w-full'
                >
                    {isLoading ? (
                        <>
                            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
                            Checking Sessions...
                        </>
                    ) : (
                        <>
                            <Lock className='h-4 w-4 mr-2' />
                            Access My Sessions
                        </>
                    )}
                </Button>

                <div className='text-xs text-muted-foreground text-center'>
                    This will only show sessions captured with these exact credentials
                </div>
            </CardContent>
        </Card>
    );
}
