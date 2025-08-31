'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionStats, AuthCredentials } from '@/types/session';

interface SessionStateManager {
	sessionStats: SessionStats | null;
	isLoading: boolean;
	error: string | null;
	credentials: AuthCredentials | null;
	isLoggedIn: boolean;
	lastUpdated: number;
}

// Global session state - shared across all components
let globalSessionState: SessionStateManager = {
	sessionStats: null,
	isLoading: false,
	error: null,
	credentials: null,
	isLoggedIn: false,
	lastUpdated: 0,
};

// Subscribers for state changes
const subscribers = new Set<() => void>();

// Session state update function
function updateGlobalSessionState(updates: Partial<SessionStateManager>) {
	globalSessionState = {
		...globalSessionState,
		...updates,
		lastUpdated: Date.now(),
	};

	// Notify all subscribers
	subscribers.forEach(callback => callback());
}

// Session API call with deduplication
let activeSessionRequest: Promise<SessionStats> | null = null;

async function fetchSessionData(credentials: AuthCredentials, signal?: AbortSignal): Promise<SessionStats> {
	// If there's already an active request, wait for it
	if (activeSessionRequest) {
		return activeSessionRequest;
	}

	// Create new request
	activeSessionRequest = performSessionFetch(credentials, signal);

	try {
		const result = await activeSessionRequest;
		return result;
	} finally {
		// Clear the active request
		activeSessionRequest = null;
	}
}

async function performSessionFetch(credentials: AuthCredentials, signal?: AbortSignal): Promise<SessionStats> {
	const response = await fetch('/api/session/current', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(credentials),
		signal,
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.details || data.error || 'Session fetch failed');
	}

	return data;
}

/**
 * Hook for managing unified session state across components
 * Prevents race conditions and ensures consistent data
 */
export function useSessionState() {
	const [, forceUpdate] = useState({});
	const abortControllerRef = useRef<AbortController | null>(null);

	// Force re-render when global state changes
	const triggerUpdate = useCallback(() => {
		forceUpdate({});
	}, []);

	// Subscribe to global state changes
	useEffect(() => {
		subscribers.add(triggerUpdate);
		return () => {
			subscribers.delete(triggerUpdate);
		};
	}, [triggerUpdate]);

	// Cleanup abort controller on unmount
	useEffect(() => {
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	const login = useCallback(async (credentials: AuthCredentials) => {
		// Cancel any existing request
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		// Create new abort controller
		abortControllerRef.current = new AbortController();

		// Update loading state
		updateGlobalSessionState({
			isLoading: true,
			error: null,
			credentials,
		});

		try {
			const sessionStats = await fetchSessionData(credentials, abortControllerRef.current.signal);

			// Save credentials to localStorage
			localStorage.setItem('userEmail', credentials.userEmail);
			localStorage.setItem('userPassword', credentials.userPassword);

			// Update success state
			updateGlobalSessionState({
				sessionStats,
				isLoading: false,
				error: null,
				credentials,
				isLoggedIn: true,
			});
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				// IMPORTANT: Reset loading state even when aborted
				updateGlobalSessionState({
					isLoading: false,
				});
				return;
			}

			const errorMessage = error instanceof Error ? error.message : 'Login failed';

			updateGlobalSessionState({
				isLoading: false,
				error: errorMessage,
				isLoggedIn: false,
			});
		}
	}, []);

	const logout = useCallback(() => {
		// Cancel any active request
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		// Clear localStorage
		localStorage.removeItem('userEmail');
		localStorage.removeItem('userPassword');

		// Reset state
		updateGlobalSessionState({
			sessionStats: null,
			isLoading: false,
			error: null,
			credentials: null,
			isLoggedIn: false,
		});
	}, []);

	const refreshSession = useCallback(async () => {
		if (!globalSessionState.credentials) {
			return;
		}

		await login(globalSessionState.credentials);
	}, [login]);

	// Auto-login with saved credentials - simplified
	const autoLogin = useCallback(async () => {
		const savedEmail = localStorage.getItem('userEmail');
		const savedPassword = localStorage.getItem('userPassword');

		// Only auto-login if we have credentials and are not already logged in
		if (savedEmail && savedPassword && !globalSessionState.isLoggedIn && !globalSessionState.isLoading) {
			// Set loading state immediately
			updateGlobalSessionState({
				isLoading: true,
				error: null,
				credentials: { userEmail: savedEmail, userPassword: savedPassword },
			});

			try {
				const sessionStats = await performSessionFetch(
					{ userEmail: savedEmail, userPassword: savedPassword }
				);

				// Update success state
				updateGlobalSessionState({
					sessionStats,
					isLoading: false,
					error: null,
					credentials: { userEmail: savedEmail, userPassword: savedPassword },
					isLoggedIn: true,
				});

			} catch (error) {
				// Clear saved credentials on failure
				localStorage.removeItem('userEmail');
				localStorage.removeItem('userPassword');

				updateGlobalSessionState({
					isLoading: false,
					error: null, // Don't show auto-login errors to user
					credentials: null,
					isLoggedIn: false,
				});
			}
		}
	}, []);

	return {
		// State
		sessionStats: globalSessionState.sessionStats,
		isLoading: globalSessionState.isLoading,
		error: globalSessionState.error,
		credentials: globalSessionState.credentials,
		isLoggedIn: globalSessionState.isLoggedIn,
		lastUpdated: globalSessionState.lastUpdated,

		// Actions
		login,
		logout,
		refreshSession,
		autoLogin,

		// Utilities
		clearError: () => updateGlobalSessionState({ error: null }),
	};
}

/**
 * Hook for components that only need to read session state
 */
export function useSessionStateReader() {
	const [, forceUpdate] = useState({});

	// Force re-render when global state changes
	const triggerUpdate = useCallback(() => {
		forceUpdate({});
	}, []);

	// Subscribe to global state changes
	useEffect(() => {
		subscribers.add(triggerUpdate);
		return () => {
			subscribers.delete(triggerUpdate);
		};
	}, [triggerUpdate]);

	return {
		sessionStats: globalSessionState.sessionStats,
		isLoading: globalSessionState.isLoading,
		error: globalSessionState.error,
		credentials: globalSessionState.credentials,
		isLoggedIn: globalSessionState.isLoggedIn,
		lastUpdated: globalSessionState.lastUpdated,
	};
}
