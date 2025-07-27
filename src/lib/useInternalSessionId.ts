// src/lib/useInternalSessionId.ts

/**
 * Get the internal session ID for MarketInOut (bridged session) from localStorage.
 * Returns an empty string if not set.
 */
export function getInternalSessionId(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('marketinout_internalSessionId') || '';
}
