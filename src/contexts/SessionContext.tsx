'use client';

import { createContext, useContext, ReactNode } from 'react';
import useSWR from 'swr';
import { getStoredCredentials } from '@/lib/auth/authUtils';

/**
 * Session data structure for a platform
 */
interface PlatformSession {
  sessionAvailable: boolean;
  hasSession: boolean;
  sessionId?: string | null;
  currentSessionId?: string | null;
  message?: string;
}

/**
 * Full session response structure
 */
export interface SessionData {
  platforms?: {
    tradingview?: PlatformSession;
    marketinout?: PlatformSession;
  };
  message?: string;
  availableUsers?: string[];
  currentUser?: string;
}

/**
 * Session context value
 */
interface SessionContextValue {
  sessions: SessionData | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

/**
 * Fetcher for session data
 * Uses POST with credentials to fetch all sessions at once
 */
async function sessionFetcher(url: string): Promise<SessionData> {
  const credentials = getStoredCredentials();
  
  if (!credentials) {
    throw new Error('Authentication required. Please log in first.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail: credentials.userEmail,
      userPassword: credentials.userPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * SessionProvider component
 * Fetches and provides session data to all children
 * Makes a single API call that is cached and shared across all components
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<SessionData>(
    '/api/session/current',
    sessionFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      shouldRetryOnError: true,
      // Don't fetch if there are no credentials
      isPaused: () => !getStoredCredentials(),
    }
  );

  const value: SessionContextValue = {
    sessions: data || null,
    isLoading,
    error: error || null,
    mutate,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Hook to access session data
 * @returns Session context value
 * @throws Error if used outside SessionProvider
 */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}

/**
 * Hook to check if specific platform sessions are available
 * Replacement for useSessionAvailability hook
 * 
 * @returns Object with availability status for each platform
 * 
 * @example
 * const { mioSessionAvailable, tvSessionAvailable, loading } = useSessionAvailability();
 */
export function useSessionAvailability() {
  const { sessions, isLoading, error } = useSession();

  const mioSession = sessions?.platforms?.marketinout;
  const tvSession = sessions?.platforms?.tradingview;

  return {
    mioSessionAvailable: mioSession?.hasSession && mioSession?.sessionAvailable || false,
    tvSessionAvailable: tvSession?.hasSession && tvSession?.sessionAvailable || false,
    loading: isLoading,
    error: error?.message || null,
  };
}

/**
 * Hook to get session bridge for a specific platform
 * Replacement for useSessionBridge hook
 * Returns [sessionId, loading, error] tuple for backward compatibility
 * 
 * @param platform - Platform to get session for ('tradingview' or 'marketinout')
 * @returns Tuple of [sessionId, loading, error]
 * 
 * @example
 * const [sessionId, loading, error] = useSessionBridge('tradingview');
 */
export function useSessionBridge(
  platform: 'tradingview' | 'marketinout'
): [string | null, boolean, string | null] {
  const { sessions, isLoading, error } = useSession();

  const platformSession = sessions?.platforms?.[platform];
  
  // Handle both sessionId (TradingView) and currentSessionId (MarketInOut)
  const sessionId = platformSession?.sessionId || platformSession?.currentSessionId || null;

  return [sessionId, isLoading, error?.message || null];
}
