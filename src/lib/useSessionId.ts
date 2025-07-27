// src/lib/useSessionId.ts
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

type Platform = 'tradingview' | 'marketinout';

const SESSION_KEYS: Record<Platform, string> = {
	tradingview: 'tradingview_sessionid',
	marketinout: 'marketinout_sessionid',
};

export function useSessionId(platform: Platform): [string, Dispatch<SetStateAction<string>>] {
	const key = SESSION_KEYS[platform];
	const [sessionId, setSessionId] = useState<string>(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem(key) || '';
		}
		return '';
	});

	useEffect(() => {
		if (sessionId) {
			localStorage.setItem(key, sessionId);
		}
	}, [sessionId, key]);

	return [sessionId, setSessionId];
}
