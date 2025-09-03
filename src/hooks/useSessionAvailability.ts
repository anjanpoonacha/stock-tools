import { useState, useEffect } from 'react';

interface SessionAvailabilityResult {
  mioSessionAvailable: boolean;
  tvSessionAvailable: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check session availability without making unnecessary API calls
 * This performs a lightweight check to see if sessions exist before attempting
 * to fetch data that requires those sessions
 */
export function useSessionAvailability(): SessionAvailabilityResult {
  const [mioSessionAvailable, setMioSessionAvailable] = useState(false);
  const [tvSessionAvailable, setTvSessionAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSessionAvailability = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get stored credentials from localStorage
        const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');

        if (!storedCredentials) {
          setMioSessionAvailable(false);
          setTvSessionAvailable(false);
          setLoading(false);
          return;
        }

        let credentials;
        try {
          credentials = JSON.parse(storedCredentials);
        } catch {
          setMioSessionAvailable(false);
          setTvSessionAvailable(false);
          setLoading(false);
          return;
        }

        // Check both platforms in parallel
        const [mioResponse, tvResponse] = await Promise.allSettled([
          fetch('/api/session/current', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: 'marketinout',
              userEmail: credentials.userEmail,
              userPassword: credentials.userPassword,
            }),
          }),
          fetch('/api/session/current', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: 'tradingview',
              userEmail: credentials.userEmail,
              userPassword: credentials.userPassword,
            }),
          }),
        ]);

        // Check MIO session availability
        if (mioResponse.status === 'fulfilled' && mioResponse.value.ok) {
          const mioData = await mioResponse.value.json();
          setMioSessionAvailable(mioData.hasSession && mioData.sessionAvailable);
        } else {
          setMioSessionAvailable(false);
        }

        // Check TradingView session availability
        if (tvResponse.status === 'fulfilled' && tvResponse.value.ok) {
          const tvData = await tvResponse.value.json();
          setTvSessionAvailable(tvData.hasSession && tvData.sessionAvailable);
        } else {
          setTvSessionAvailable(false);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check session availability');
        setMioSessionAvailable(false);
        setTvSessionAvailable(false);
      } finally {
        setLoading(false);
      }
    };

    checkSessionAvailability();
  }, []);

  return {
    mioSessionAvailable,
    tvSessionAvailable,
    loading,
    error,
  };
}
