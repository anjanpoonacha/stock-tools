'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserCredentials, AuthStatus, UserCredentialsSchema } from '@/types/auth';

interface AuthContextType {
    // Authentication state
    authStatus: AuthStatus | null;
    isLoading: boolean;
    error: string | null;

    // Authentication actions
    login: (credentials: UserCredentials) => Promise<boolean>;
    logout: () => void;
    checkAuthStatus: () => Promise<void>;

    // Utility functions
    isAuthenticated: () => boolean;
    getUserEmail: () => string | null;
    requiresAuth: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

const AUTH_STORAGE_KEY = 'mio-tv-auth-credentials';
const AUTH_STATUS_KEY = 'mio-tv-auth-status';

export function AuthProvider({ children }: AuthProviderProps) {
    const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load stored credentials and auth status on mount - run only once
    useEffect(() => {
        const loadStoredAuth = async () => {
            try {
                console.log('[AuthContext] loadStoredAuth started');
                setIsLoading(true);
                setError(null);

                // Check for old credentials first (migration)
                const oldEmail = localStorage.getItem('userEmail');
                const oldPassword = localStorage.getItem('userPassword');

                if (oldEmail && oldPassword) {
                    console.log('[AuthContext] Found old credentials, migrating to AuthContext');

                    // Validate credentials with Zod
                    const validatedCredentials = UserCredentialsSchema.parse({
                        userEmail: oldEmail,
                        userPassword: oldPassword,
                    });

                    // Call authentication API directly (avoid calling login to prevent recursion)
                    const response = await fetch('/api/session/current', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(validatedCredentials),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const platforms = data.platforms || data.sessionStats?.platforms;

                        const newAuthStatus: AuthStatus = {
                            isAuthenticated: true,
                            userEmail: validatedCredentials.userEmail,
                            sessionStats: {
                                platforms: platforms || {},
                                message: data.message || 'User authenticated',
                                availableUsers: data.availableUsers,
                                currentUser: data.currentUser || validatedCredentials.userEmail,
                            },
                        };

                        // Store credentials and auth status
                        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(validatedCredentials));
                        localStorage.setItem(AUTH_STATUS_KEY, JSON.stringify(newAuthStatus));

                        // Clean up old keys after successful migration
                        localStorage.removeItem('userEmail');
                        localStorage.removeItem('userPassword');
                        console.log('[AuthContext] Migration successful, old keys removed');

                        setAuthStatus(newAuthStatus);
                        return; // Exit early
                    }
                }

                // Load stored credentials from new keys
                const storedCredentials = localStorage.getItem(AUTH_STORAGE_KEY);
                const storedAuthStatus = localStorage.getItem(AUTH_STATUS_KEY);

                console.log('[AuthContext] Stored credentials:', !!storedCredentials);
                console.log('[AuthContext] Stored auth status:', !!storedAuthStatus);

                if (storedCredentials && storedAuthStatus) {
                    const credentials = JSON.parse(storedCredentials);
                    const status = JSON.parse(storedAuthStatus);

                    // Validate stored credentials
                    const validatedCredentials = UserCredentialsSchema.safeParse(credentials);
                    if (validatedCredentials.success) {
                        console.log('[AuthContext] Validating stored credentials with backend');
                        
                        // CRITICAL FIX: Always validate stored credentials against backend
                        // This prevents stale session state when KV data is removed
                        try {
                            const response = await fetch('/api/session/current', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(validatedCredentials.data),
                            });

                            if (response.ok) {
                                const data = await response.json();
                                const platforms = data.platforms || data.sessionStats?.platforms;

                                // CRITICAL: Check if the response actually contains valid session data
                                // API returns 200 OK even when no sessions exist, so we need to check the data
                                const hasValidSessions = data.hasSession || data.sessionAvailable || 
                                    (platforms && Object.values(platforms).some((p: any) => p?.sessionAvailable));

                                if (hasValidSessions) {
                                    // Update with fresh session data from backend
                                    const freshAuthStatus: AuthStatus = {
                                        isAuthenticated: true,
                                        userEmail: validatedCredentials.data.userEmail,
                                        sessionStats: {
                                            platforms: platforms || {},
                                            message: data.message || 'User authenticated',
                                            availableUsers: data.availableUsers,
                                            currentUser: data.currentUser || validatedCredentials.data.userEmail,
                                        },
                                    };

                                    // Update stored auth status with fresh data
                                    localStorage.setItem(AUTH_STATUS_KEY, JSON.stringify(freshAuthStatus));
                                    setAuthStatus(freshAuthStatus);
                                    console.log('[AuthContext] Stored credentials validated and updated with fresh session data');
                                } else {
                                    // Credentials are valid but no sessions exist - update with no-session state
                                    const noSessionAuthStatus: AuthStatus = {
                                        isAuthenticated: true,
                                        userEmail: validatedCredentials.data.userEmail,
                                        sessionStats: {
                                            platforms: platforms || {},
                                            message: data.message || 'No sessions found',
                                            availableUsers: data.availableUsers,
                                            currentUser: data.currentUser || validatedCredentials.data.userEmail,
                                        },
                                    };

                                    // Update stored auth status with no-session state
                                    localStorage.setItem(AUTH_STATUS_KEY, JSON.stringify(noSessionAuthStatus));
                                    setAuthStatus(noSessionAuthStatus);
                                    console.log('[AuthContext] Stored credentials valid but no sessions found - updated with fresh no-session state');
                                }
                            } else {
                                // Credentials are no longer valid, clear them
                                console.log('[AuthContext] Stored credentials are invalid, clearing');
                                localStorage.removeItem(AUTH_STORAGE_KEY);
                                localStorage.removeItem(AUTH_STATUS_KEY);
                                setAuthStatus(null);
                            }
                        } catch (error) {
                            console.error('[AuthContext] Error validating stored credentials:', error);
                            // On validation error, clear stored credentials to be safe
                            localStorage.removeItem(AUTH_STORAGE_KEY);
                            localStorage.removeItem(AUTH_STATUS_KEY);
                            setAuthStatus(null);
                        }
                    } else {
                        // Clear invalid stored credentials
                        localStorage.removeItem(AUTH_STORAGE_KEY);
                        localStorage.removeItem(AUTH_STATUS_KEY);
                    }
                }
            } catch (error) {
                console.error('[AuthContext] Error loading stored auth:', error);
                // Clear stored auth on error
                localStorage.removeItem(AUTH_STORAGE_KEY);
                localStorage.removeItem(AUTH_STATUS_KEY);
            } finally {
                setIsLoading(false);
            }
        };

        console.log('[AuthContext] useEffect triggered, calling loadStoredAuth');
        loadStoredAuth();
    }, []); // Empty dependency array - run only once on mount


    const login = async (credentials: UserCredentials): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);

            // Validate credentials with Zod
            const validatedCredentials = UserCredentialsSchema.parse(credentials);

            // Call authentication API
            const response = await fetch('/api/session/current', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(validatedCredentials),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Authentication failed');
            }

            const data = await response.json();

            // Handle the actual API response structure
            const platforms = data.platforms || data.sessionStats?.platforms;

            // IMPORTANT: Always set isAuthenticated to true if API call succeeds
            // The API validates credentials - if it returns 200, credentials are valid
            // Session availability is separate from authentication
            const newAuthStatus: AuthStatus = {
                isAuthenticated: true,
                userEmail: validatedCredentials.userEmail,
                sessionStats: {
                    platforms: platforms || {},
                    message: data.message || 'User authenticated',
                    availableUsers: data.availableUsers,
                    currentUser: data.currentUser || validatedCredentials.userEmail,
                },
            };

            // Store credentials and auth status
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(validatedCredentials));
            localStorage.setItem(AUTH_STATUS_KEY, JSON.stringify(newAuthStatus));

            setAuthStatus(newAuthStatus);
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
            setError(errorMessage);
            console.error('[AuthContext] Login error:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        clearStoredAuth();
        setAuthStatus(null);
        setError(null);
    };

    const clearStoredAuth = () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_STATUS_KEY);
    };

    const checkAuthStatus = async () => {
        const storedCredentials = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedCredentials) {
            try {
                const credentials = JSON.parse(storedCredentials);
                const validatedCredentials = UserCredentialsSchema.parse(credentials);
                await login(validatedCredentials);
            } catch (error) {
                console.error('[AuthContext] Error checking auth status:', error);
                logout();
            }
        }
    };

    const isAuthenticated = (): boolean => {
        return authStatus?.isAuthenticated === true;
    };

    const getUserEmail = (): string | null => {
        return authStatus?.userEmail || null;
    };

    const requiresAuth = (): boolean => {
        return !isAuthenticated();
    };

    const contextValue: AuthContextType = {
        authStatus,
        isLoading,
        error,
        login,
        logout,
        checkAuthStatus,
        isAuthenticated,
        getUserEmail,
        requiresAuth,
    };

    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Hook for components that require authentication
export function useRequireAuth() {
    const auth = useAuth();

    useEffect(() => {
        if (!auth.isLoading && auth.requiresAuth()) {
            // This hook can be used to trigger auth requirements
            // Components can use this to show auth prompts
        }
    }, [auth.isLoading, auth.requiresAuth, auth]);

    return {
        ...auth,
        needsAuth: auth.requiresAuth(),
    };
}
