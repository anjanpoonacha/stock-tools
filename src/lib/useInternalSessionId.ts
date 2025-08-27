// src/lib/useInternalSessionId.ts

import { useState, useEffect } from 'react';

/**
 * Get the internal session ID for MarketInOut (bridged session) from localStorage or server.
 * Returns an empty string if not set.
 * Checks localStorage first, then falls back to server API (for extension-bridged sessions with httpOnly cookies).
 */
export function getInternalSessionId(): string {
	debugger;
	if (typeof window === 'undefined') return '';

	// First check localStorage (manual bridge method)
	const fromLocalStorage = localStorage.getItem('marketinout_internalSessionId');
	if (fromLocalStorage) {
		return fromLocalStorage;
	}

	// Note: myAppToken cookie is httpOnly and cannot be read by client-side JavaScript
	// The useInternalSessionId hook will handle the async server call
	return '';
}

/**
 * Async function to get the internal session ID from the server API
 * This is used when the httpOnly cookie needs to be accessed
 */
export async function getInternalSessionIdFromServer(): Promise<string> {
	try {
		const response = await fetch('/api/session/current', {
			method: 'GET',
			credentials: 'include', // Include cookies in the request
		});

		if (!response.ok) {
			console.warn('[SESSION] Failed to fetch session from server:', response.status);
			return '';
		}

		const data = await response.json();

		if (data.hasSession && data.sessionId) {
			// Store in localStorage for future synchronous access
			localStorage.setItem('marketinout_internalSessionId', data.sessionId);
			// Dispatch custom event to notify other components
			window.dispatchEvent(new Event('internalSessionIdChanged'));
			return data.sessionId;
		}

		return '';
	} catch (error) {
		console.error('[SESSION] Error fetching session from server:', error);
		return '';
	}
}

/**
 * React hook to get the internal session ID with reactive updates.
 * Returns an object with the current internal session ID.
 */
export function useInternalSessionId() {
	const [internalSessionId, setInternalSessionId] = useState<string>('');

	useEffect(() => {
		async function initializeSession() {
			// Get initial value from localStorage
			let sessionId = getInternalSessionId();

			// If not found in localStorage, try fetching from server
			if (!sessionId) {
				sessionId = await getInternalSessionIdFromServer();
			}

			setInternalSessionId(sessionId);
		}

		initializeSession();

		// Listen for storage changes
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === 'marketinout_internalSessionId') {
				setInternalSessionId(e.newValue || '');
			}
		};

		window.addEventListener('storage', handleStorageChange);

		// Also listen for custom events in case localStorage is updated in the same tab
		const handleCustomStorageChange = () => {
			setInternalSessionId(getInternalSessionId());
		};

		window.addEventListener('internalSessionIdChanged', handleCustomStorageChange);

		return () => {
			window.removeEventListener('storage', handleStorageChange);
			window.removeEventListener('internalSessionIdChanged', handleCustomStorageChange);
		};
	}, []);

	return { internalSessionId };
}
