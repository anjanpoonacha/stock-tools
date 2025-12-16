'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthCredentials } from '@/types/session';

/**
 * Hook for managing unified session state across components
 * Now delegates to AuthContext for unified authentication
 */
export function useSessionState() {
	const auth = useAuth();

	// Migration is now handled by AuthContext automatically

	const login = useCallback(async (credentials: AuthCredentials) => {
		return await auth.login(credentials);
	}, [auth]);

	const logout = useCallback(() => {
		// Clean up any remaining old keys
		localStorage.removeItem('userEmail');
		localStorage.removeItem('userPassword');
		auth.logout();
	}, [auth]);

	const refreshSession = useCallback(async () => {
		await auth.checkAuthStatus();
	}, [auth]);

	// Auto-login now handled by AuthContext
	const autoLogin = useCallback(async () => {
		// AuthContext handles auto-login in its useEffect
		// This is kept for API compatibility but does nothing
	}, []);

	// Map AuthContext state to useSessionState API
	const mapSessionStats = (authStatus: typeof auth.authStatus) => {
		if (!authStatus?.sessionStats) return null;

		const authSessionStats = authStatus.sessionStats;
		return {
			hasSession: authSessionStats.platforms ?
				Object.values(authSessionStats.platforms).some(p => p.sessionAvailable) : false,
			sessionAvailable: authSessionStats.platforms ?
				Object.values(authSessionStats.platforms).some(p => p.sessionAvailable) : false,
			availableUsers: authSessionStats.availableUsers || [],
			currentUser: authSessionStats.currentUser,
			platforms: authSessionStats.platforms ? {
				marketinout: authSessionStats.platforms.marketinout ? {
					hasSession: authSessionStats.platforms.marketinout.sessionAvailable,
					sessionAvailable: authSessionStats.platforms.marketinout.sessionAvailable
				} : undefined,
				tradingview: authSessionStats.platforms.tradingview ? {
					hasSession: authSessionStats.platforms.tradingview.sessionAvailable,
					sessionAvailable: authSessionStats.platforms.tradingview.sessionAvailable
				} : undefined
			} : undefined,
			message: authSessionStats.message
		};
	};

	return {
		// State - mapped from AuthContext
		sessionStats: mapSessionStats(auth.authStatus),
		isLoading: auth.isLoading,
		error: auth.error,
		credentials: auth.authStatus ? {
			userEmail: auth.authStatus.userEmail,
			userPassword: '' // Don't expose password
		} : null,
		isLoggedIn: auth.isAuthenticated(),
		lastUpdated: Date.now(), // AuthContext doesn't track this, so use current time

		// Actions - delegated to AuthContext
		login,
		logout,
		refreshSession,
		autoLogin,

		// Utilities
		clearError: () => {
			// AuthContext doesn't have clearError, so this is a no-op
		},
	};
}

/**
 * Hook for components that only need to read session state
 * Now delegates to AuthContext
 */
export function useSessionStateReader() {
	const auth = useAuth();

	// Map AuthContext state to useSessionStateReader API
	const mapSessionStats = (authStatus: typeof auth.authStatus) => {
		if (!authStatus?.sessionStats) return null;

		const authSessionStats = authStatus.sessionStats;
		return {
			hasSession: authSessionStats.platforms ?
				Object.values(authSessionStats.platforms).some(p => p.sessionAvailable) : false,
			sessionAvailable: authSessionStats.platforms ?
				Object.values(authSessionStats.platforms).some(p => p.sessionAvailable) : false,
			availableUsers: authSessionStats.availableUsers || [],
			currentUser: authSessionStats.currentUser,
			platforms: authSessionStats.platforms ? {
				marketinout: authSessionStats.platforms.marketinout ? {
					hasSession: authSessionStats.platforms.marketinout.sessionAvailable,
					sessionAvailable: authSessionStats.platforms.marketinout.sessionAvailable
				} : undefined,
				tradingview: authSessionStats.platforms.tradingview ? {
					hasSession: authSessionStats.platforms.tradingview.sessionAvailable,
					sessionAvailable: authSessionStats.platforms.tradingview.sessionAvailable
				} : undefined
			} : undefined,
			message: authSessionStats.message
		};
	};

	return {
		sessionStats: mapSessionStats(auth.authStatus),
		isLoading: auth.isLoading,
		error: auth.error,
		credentials: auth.authStatus ? {
			userEmail: auth.authStatus.userEmail,
			userPassword: '' // Don't expose password
		} : null,
		isLoggedIn: auth.isAuthenticated(),
		lastUpdated: Date.now(), // AuthContext doesn't track this, so use current time
	};
}
