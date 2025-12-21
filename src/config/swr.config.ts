import type { SWRConfiguration } from 'swr';

// Custom error type with status code
interface FetchError extends Error {
  status?: number;
}

// Default fetcher function
const defaultFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error: FetchError = new Error('API Error');
    error.status = res.status;
    throw error;
  }
  return res.json();
};

// Error retry logic - don't retry on 401/403 errors
const shouldRetryOnError = (error: FetchError) => {
  // Don't retry on authentication/authorization errors
  if (error.status === 401 || error.status === 403) {
    return false;
  }
  return true;
};

// Error handling callback for logging
const onError = (error: FetchError, key: string) => {
  console.error(`[SWR Error] Key: ${key}`, {
    message: error.message,
    status: error.status,
    timestamp: new Date().toISOString(),
  });
};

// Custom error retry with exponential backoff
const onErrorRetry = (
  error: FetchError,
  key: string,
  config: SWRConfiguration,
  revalidate: () => void,
  { retryCount }: { retryCount: number }
) => {
  // Don't retry on authentication/authorization errors
  if (error.status === 401 || error.status === 403) {
    return;
  }

  // Max 3 retries
  if (retryCount >= 3) {
    return;
  }

  // Exponential backoff: 5s, 10s, 20s (capped at 30s)
  const retryInterval = Math.min(5000 * Math.pow(2, retryCount), 30000);

  setTimeout(() => {
    revalidate();
  }, retryInterval);
};

export const swrConfig: SWRConfiguration = {
  // Default fetcher
  fetcher: defaultFetcher,

  // Deduplication interval - prevent duplicate requests within 2 seconds
  dedupingInterval: 2000,

  // Revalidation options
  revalidateOnFocus: false, // Prevent unnecessary refetches when window regains focus
  revalidateOnReconnect: true, // Revalidate when network reconnects
  
  // Error retry configuration with exponential backoff
  onErrorRetry, // Custom retry logic with exponential backoff (5s, 10s, 20s)
  shouldRetryOnError, // Additional check to skip retry on 401/403

  // Error handling
  onError,
};

export type { FetchError };
