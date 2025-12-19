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
    checkSessionStatus: () => Promise<void>;

    // Utility functions
    isAuthenticated: () => boolean;
    getUserEmail: () => string | null;
    requiresAuth: () => boolean;
    hasSessionsAvailable: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

const AUTH_STORAGE_KEY = 'mio-tv-auth-credentials';
const AUTH_STATUS_KEY = 'mio-tv-auth-status';

/**
 * Authentication Provider
 * 
 * IMPORTANT: userEmail/userPassword are NOT real authentication credentials.
 * They serve as a "workspace identifier" to group sessions in KV storage.
 * 
 * Credentials should NEVER be cleared automatically, only on explicit logout.
 * Session availability is checked separately and doesn't affect authentication state.
 */
export function AuthProvider({ children }: AuthProviderProps) {
    const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Load stored credentials on mount
     * NO validation needed - credentials are just workspace identifiers
     */
    useEffect(() => {
        const loadStoredAuth = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Check for old credentials first (migration)
                const oldEmail = localStorage.getItem('userEmail');
                const oldPassword = localStorage.getItem('userPassword');

                if (oldEmail && oldPassword) {
                    // Validate with Zod
                    const validatedCredentials = UserCredentialsSchema.parse({
                        userEmail: oldEmail,
                        userPassword: oldPassword,
                    });

                    // Store in new format
                    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(validatedCredentials));
                    
                    // Clean up old keys
                    localStorage.removeItem('userEmail');
                    localStorage.removeItem('userPassword');

                    // Mark as authenticated immediately
                    setAuthStatus({
                        isAuthenticated: true,
                        userEmail: validatedCredentials.userEmail,
                        userPassword: validatedCredentials.userPassword,
                        sessionStats: null, // Will be checked in background
                    });

                    // Check session availability in background (non-blocking)
                    checkSessionAvailability(validatedCredentials);
                    return;
                }

                // Load stored credentials from new format
                const storedCredentials = localStorage.getItem(AUTH_STORAGE_KEY);

                if (storedCredentials) {
                    const credentials = JSON.parse(storedCredentials);
                    
                    // Validate stored credentials
                    const validatedCredentials = UserCredentialsSchema.safeParse(credentials);
                    
                    if (validatedCredentials.success) {
                        // ✅ ALWAYS mark as authenticated (workspace is valid)
                        // No backend validation needed - credentials are just namespace keys
                        setAuthStatus({
                            isAuthenticated: true,
                            userEmail: validatedCredentials.data.userEmail,
                            userPassword: validatedCredentials.data.userPassword,
                            sessionStats: null, // Will be checked in background
                        });

                        // Check session availability in background (non-blocking)
                        // This won't affect authentication state
                        checkSessionAvailability(validatedCredentials.data);
                    } else {
                        // Invalid format - clear only invalid data
                        console.warn('[Auth] Invalid credential format, clearing');
                        localStorage.removeItem(AUTH_STORAGE_KEY);
                        localStorage.removeItem(AUTH_STATUS_KEY);
                    }
                }
            } catch (error) {
                console.error('[Auth] Error loading credentials:', error);
                // Don't clear credentials on error - just log and continue
                setError('Error loading saved credentials');
            } finally {
                setIsLoading(false);
            }
        };

        loadStoredAuth();
    }, []); // Run only once on mount

    /**
     * Check session availability (separate from authentication)
     * This is a data availability check, not auth validation
     * Errors here do NOT affect authentication state
     */
    const checkSessionAvailability = async (credentials: UserCredentials) => {
        try {
            const response = await fetch('/api/session/current', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            if (response.ok) {
                const data = await response.json();
                const platforms = data.platforms || {};

                // ✅ Update session stats (NOT authentication state)
                const newSessionStats = {
                    platforms,
                    message: data.message || 'Session check complete',
                    availableUsers: data.availableUsers,
                    currentUser: data.currentUser || credentials.userEmail,
                    offline: false,
                    error: undefined,
                    lastChecked: new Date(),
                };

                setAuthStatus(prev => ({
                    ...prev!,
                    sessionStats: newSessionStats,
                }));
            } else {
                // ⚠️ API error - mark as offline but keep user authenticated
                console.warn('[Auth] Session check failed:', response.status);
                
                setAuthStatus(prev => ({
                    ...prev!,
                    sessionStats: {
                        platforms: {},
                        message: 'Could not check session status',
                        offline: true,
                        error: `API returned ${response.status}`,
                        lastChecked: new Date(),
                    },
                }));
            }
        } catch (error) {
            // ⚠️ Network error - mark as offline but keep user authenticated
            console.warn('[Auth] Session check error:', error);
            
            setAuthStatus(prev => ({
                ...prev!,
                sessionStats: {
                    platforms: {},
                    message: 'Connection error',
                    offline: true,
                    error: error instanceof Error ? error.message : 'Network error',
                    lastChecked: new Date(),
                },
            }));
        }
    };

    /**
     * Login - Store credentials and check session availability
     */
    const login = async (credentials: UserCredentials): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);

            // Validate credentials with Zod
            const validatedCredentials = UserCredentialsSchema.parse(credentials);

            // ✅ Store credentials immediately (no validation needed)
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(validatedCredentials));

            // ✅ Mark as authenticated immediately
            setAuthStatus({
                isAuthenticated: true,
                userEmail: validatedCredentials.userEmail,
                userPassword: validatedCredentials.userPassword,
                sessionStats: null, // Will be checked next
            });

            // Check session availability (Option A: immediate check with 1-2s delay)
            await checkSessionAvailability(validatedCredentials);

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            console.error('[Auth] Login error:', errorMessage);
            setError(errorMessage);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Logout - ONLY place where credentials are cleared
     */
    const logout = () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_STATUS_KEY);
        setAuthStatus(null);
        setError(null);
    };

    /**
     * Manually check session status (for refresh button)
     */
    const checkSessionStatus = async () => {
        const storedCredentials = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedCredentials) {
            try {
                const credentials = JSON.parse(storedCredentials);
                const validatedCredentials = UserCredentialsSchema.parse(credentials);
                await checkSessionAvailability(validatedCredentials);
            } catch (error) {
                console.error('[Auth] Error checking session status:', error);
            }
        }
    };

    /**
     * Check if user is authenticated (has valid workspace credentials)
     */
    const isAuthenticated = (): boolean => {
        return authStatus?.isAuthenticated === true;
    };

    /**
     * Get current user email (workspace identifier)
     */
    const getUserEmail = (): string | null => {
        return authStatus?.userEmail || null;
    };

    /**
     * Check if authentication is required
     */
    const requiresAuth = (): boolean => {
        return !isAuthenticated();
    };

    /**
     * Check if sessions are available (TradingView or MIO)
     */
    const hasSessionsAvailable = (): boolean => {
        const platforms = authStatus?.sessionStats?.platforms;
        if (!platforms) return false;

        const tvAvailable = platforms.tradingview?.sessionAvailable || false;
        const mioAvailable = platforms.marketinout?.sessionAvailable || false;

        return tvAvailable || mioAvailable;
    };

    const contextValue: AuthContextType = {
        authStatus,
        isLoading,
        error,
        login,
        logout,
        checkSessionStatus,
        isAuthenticated,
        getUserEmail,
        requiresAuth,
        hasSessionsAvailable,
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
