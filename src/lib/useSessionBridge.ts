// src/lib/useSessionBridge.ts

import { useState } from 'react';

/**
 * Hook to bridge an external session ID (e.g., MIO ASPSESSIONID) to the backend.
 * On success, the backend sets the myAppToken cookie.
 * The returned internalSessionId is stored in localStorage under 'marketinout_internalSessionId'.
 * This is distinct from the external session ID ('marketinout_sessionid').
 */
export function useSessionBridge() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	/**
	 * Bridge an external session ID to an internal session ID.
	 * Optionally, provide onBridged callback to receive the new internalSessionId immediately.
	 */
	async function bridgeSession(externalSessionId: string, onBridged?: (internalSessionId: string) => void) {
		setLoading(true);
		setError(null);
		setSuccess(false);
		try {
			const res = await fetch('/api/auth/session-bridge', {
				method: 'POST',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ externalSessionId }),
			});
			if (!res.ok) {
				const data = await res.json();
				setError(data.error || 'Failed to bridge session');
			} else {
				const data = await res.json();
				if (data.internalSessionId) {
					localStorage.setItem('marketinout_internalSessionId', data.internalSessionId);
					if (onBridged) onBridged(data.internalSessionId);
				}
				setSuccess(true);
			}
		} catch (e: any) {
			setError(e.message || 'Unknown error');
		} finally {
			setLoading(false);
		}
	}

	return { bridgeSession, loading, error, success };
}
