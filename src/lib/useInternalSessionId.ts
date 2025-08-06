// src/lib/useInternalSessionId.ts

import { useState, useEffect } from 'react';

/**
 * Get the internal session ID for MarketInOut (bridged session) from localStorage.
 * Returns an empty string if not set.
 */
export function getInternalSessionId(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('marketinout_internalSessionId') || '';
}

/**
 * React hook to get the internal session ID with reactive updates.
 * Returns an object with the current internal session ID.
 */
export function useInternalSessionId() {
	const [internalSessionId, setInternalSessionId] = useState<string>('');

	useEffect(() => {
		// Get initial value
		setInternalSessionId(getInternalSessionId());

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
