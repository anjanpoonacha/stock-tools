/**
 * Authentication Utilities
 * 
 * Centralized helpers for accessing authentication credentials.
 * All code should use these helpers instead of directly accessing localStorage.
 */

import { UserCredentials, UserCredentialsSchema } from '@/types/auth';

const AUTH_STORAGE_KEY = 'mio-tv-auth-credentials';

/**
 * Get stored authentication credentials
 * @returns UserCredentials or null if not authenticated
 */
export function getStoredCredentials(): UserCredentials | null {
    try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        
        if (!stored) {
            return null;
        }

        const parsed = JSON.parse(stored);
        const validated = UserCredentialsSchema.safeParse(parsed);

        if (validated.success) {
            return validated.data;
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Get stored credentials or throw error with user-friendly message
 * Use this in components/hooks that require authentication
 * 
 * @throws Error if credentials are not found
 * @returns UserCredentials
 */
export function requireCredentials(): UserCredentials {
    const credentials = getStoredCredentials();
    
    if (!credentials) {
        throw new Error(
            'Authentication required. Please log in to continue.'
        );
    }

    return credentials;
}

/**
 * Check if user is currently authenticated (has valid credentials stored)
 * @returns boolean
 */
export function isAuthenticated(): boolean {
    return getStoredCredentials() !== null;
}

/**
 * Get user email from stored credentials
 * @returns User email or null if not authenticated
 */
export function getUserEmail(): string | null {
    const credentials = getStoredCredentials();
    return credentials?.userEmail || null;
}
