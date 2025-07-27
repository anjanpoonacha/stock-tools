// src/lib/useSessionId.ts
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * Hook to get/set the external session ID for a platform (e.g., ASPSESSIONID for MarketInOut).
 * Uses localStorage key 'marketinout_sessionid' for MarketInOut.
 * This is NOT the internal bridged session ID.
 */
type Platform = 'tradingview' | 'marketinout';

const SESSION_KEYS: Record<Platform, string> = {
	tradingview: 'tradingview_sessionid',
	marketinout: 'marketinout_sessionid',
};

export function useSessionId(platform: Platform): [string, Dispatch<SetStateAction<string>>] {
	const key = SESSION_KEYS[platform];
	const [sessionId, setSessionId] = useState<string>('');

	useEffect(() => {
		if (typeof window !== 'undefined') {
			// Always use localStorage for external sessionId
			const stored = localStorage.getItem(key) || '';
			setSessionId(stored);
		}
	}, [key]);

	useEffect(() => {
		if (sessionId) {
			localStorage.setItem(key, sessionId);
		}
	}, [sessionId, key]);

	return [sessionId, setSessionId];
}
