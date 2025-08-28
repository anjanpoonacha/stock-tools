'use client';

import { useState, useEffect } from 'react';
import { UserCredentials } from '@/components/UserCredentials';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Users, Database, CheckCircle } from 'lucide-react';

interface UserCredentials {
    userEmail: string;
    userPassword: string;
}

interface SessionData {
    message?: string;
    availableUsers?: string[];
    platforms?: {
        marketinout?: {
            sessionAvailable: boolean;
        };
        tradingview?: {
            sessionAvailable: boolean;
        };
    };
    sessionStats?: {
        totalSessions: number;
        platformCounts?: Record<string, number>;
    };
}

export default function UserAuthTestPage() {
    const [currentUser, setCurrentUser] = useState<UserCredentials | null>(null);
    const [availableUsers, setAvailableUsers] = useState<string[]>([]);
    const [sessionData, setSessionData] = useState<SessionData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Load available users on component mount
    useEffect(() => {
        loadAvailableUsers();
    }, []);

    const loadAvailableUsers = async () => {
        try {
            const response = await fetch('/api/session/current');
            const data = await response.json();

            if (data.availableUsers) {
                setAvailableUsers(data.availableUsers);
            }
        } catch (error) {
            console.error('Error loading available users:', error);
        }
    };

    const handleCredentialsChange = async (credentials: UserCredentials | null) => {
        setCurrentUser(credentials);

        if (credentials) {
            setIsLoading(true);
            try {
                // Test the user-specific session API
                const response = await fetch('/api/session/current', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(credentials),
                });

                const data = await response.json();
                setSessionData(data);

                // Refresh available users list
                await loadAvailableUsers();
            } catch (error) {
                console.error('Error fetching session data:', error);
            } finally {
                setIsLoading(false);
            }
        } else {
            setSessionData(null);
        }
    };

    return (
        <div className='container mx-auto py-8 px-4'>
            <div className='max-w-4xl mx-auto space-y-8'>
                <div className='text-center space-y-4'>
                    <h1 className='text-3xl font-bold'>User Authentication Test</h1>
                    <p className='text-muted-foreground'>Test the user credential-based session segregation system</p>
                </div>

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
                    {/* User Credentials Section */}
                    <div className='space-y-4'>
                        <UserCredentials
                            onCredentialsChange={handleCredentialsChange}
                            availableUsers={availableUsers}
                        />

                        {availableUsers.length > 0 && (
                            <Card>
                                <CardHeader className='pb-3'>
                                    <CardTitle className='flex items-center gap-2 text-sm'>
                                        <Users className='h-4 w-4' />
                                        Available Users ({availableUsers.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className='flex flex-wrap gap-2'>
                                        {availableUsers.map((email) => (
                                            <Badge key={email} variant='outline' className='text-xs'>
                                                {email}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Session Data Section */}
                    <div className='space-y-4'>
                        {currentUser ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className='flex items-center gap-2'>
                                        <Database className='h-5 w-5' />
                                        Session Data for {currentUser.userEmail}
                                    </CardTitle>
                                    <CardDescription>Sessions filtered by user credentials</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? (
                                        <div className='flex items-center justify-center py-8'>
                                            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
                                        </div>
                                    ) : sessionData ? (
                                        <div className='space-y-4'>
                                            <div className='grid grid-cols-2 gap-4'>
                                                <div className='space-y-2'>
                                                    <h4 className='font-medium'>MarketInOut</h4>
                                                    <div className='flex items-center gap-2'>
                                                        {sessionData.platforms?.marketinout?.sessionAvailable ? (
                                                            <>
                                                                <CheckCircle className='h-4 w-4 text-green-600' />
                                                                <span className='text-sm text-green-600'>
                                                                    Active Session
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className='h-4 w-4 rounded-full bg-red-200' />
                                                                <span className='text-sm text-red-600'>No Session</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className='space-y-2'>
                                                    <h4 className='font-medium'>TradingView</h4>
                                                    <div className='flex items-center gap-2'>
                                                        {sessionData.platforms?.tradingview?.sessionAvailable ? (
                                                            <>
                                                                <CheckCircle className='h-4 w-4 text-green-600' />
                                                                <span className='text-sm text-green-600'>
                                                                    Active Session
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className='h-4 w-4 rounded-full bg-red-200' />
                                                                <span className='text-sm text-red-600'>No Session</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <Alert>
                                                <AlertDescription>{sessionData.message}</AlertDescription>
                                            </Alert>

                                            {sessionData.sessionStats && (
                                                <div className='mt-4 p-3 bg-muted rounded-lg'>
                                                    <h4 className='font-medium mb-2'>Session Statistics</h4>
                                                    <div className='text-sm space-y-1'>
                                                        <div>
                                                            Total Sessions: {sessionData.sessionStats.totalSessions}
                                                        </div>
                                                        <div>
                                                            Available Users: {sessionData.availableUsers?.length || 0}
                                                        </div>
                                                        {Object.entries(
                                                            sessionData.sessionStats.platformCounts || {}
                                                        ).map(([platform, count]) => (
                                                            <div key={platform}>
                                                                {platform}: {count as number} sessions
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className='text-center py-8 text-muted-foreground'>
                                            No session data available
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className='pt-6'>
                                    <div className='text-center py-8 text-muted-foreground'>
                                        <Database className='h-12 w-12 mx-auto mb-4 opacity-50' />
                                        <p>Enter your credentials to view session data</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle>How to Test</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <div className='space-y-2'>
                            <h4 className='font-medium'>1. Configure Extension</h4>
                            <p className='text-sm text-muted-foreground'>
                                Set up your email and password in the browser extension settings
                            </p>
                        </div>

                        <div className='space-y-2'>
                            <h4 className='font-medium'>2. Capture Sessions</h4>
                            <p className='text-sm text-muted-foreground'>
                                Visit MarketInOut or TradingView while logged in to capture sessions
                            </p>
                        </div>

                        <div className='space-y-2'>
                            <h4 className='font-medium'>3. Test Segregation</h4>
                            <p className='text-sm text-muted-foreground'>
                                Enter the same credentials here to see only your sessions
                            </p>
                        </div>

                        <div className='space-y-2'>
                            <h4 className='font-medium'>4. Test Multiple Users</h4>
                            <p className='text-sm text-muted-foreground'>
                                Configure different credentials in the extension to test user segregation
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
