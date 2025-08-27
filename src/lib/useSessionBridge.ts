// src/lib/useSessionBridge.ts
import { useState, useEffect } from 'react';

/**
 * Hook to get session data from the browser extension via API
 * This replaces the old localStorage-based approach with server-side session resolution
 */
type Platform = 'tradingview' | 'marketinout';

interface SessionResponse {
	platform: string;
	hasSession: boolean;
	sessionAvailable: boolean;
	sessionId?: string | null;
	currentSessionId?: string | null;
	message: string;
}

export function useSessionBridge(platform: Platform): [string | null, boolean, string | null] {
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;

		async function fetchSessionData() {
			try {
				setLoading(true);
				setError(null);

				const response = await fetch(`/api/session/current?platform=${platform}`);

				if (!response.ok) {
					throw new Error(`Failed to fetch session: ${response.status}`);
				}

				const data: SessionResponse = await response.json();

				if (isMounted) {
					if (data.hasSession && data.sessionId) {
						setSessionId(data.sessionId);
					} else {
						setSessionId(null);
					}
				}
			} catch (err) {
				if (isMounted) {
					const errorMessage = err instanceof Error ? err.message : 'Unknown error';
					setError(errorMessage);
					setSessionId(null);
				}
			} finally {
				if (isMounted) {
					setLoading(false);
				}
			}
		}

		fetchSessionData();

		// Cleanup function
		return () => {
			isMounted = false;
		};
	}, [platform]);

	return [sessionId, loading, error];
}
