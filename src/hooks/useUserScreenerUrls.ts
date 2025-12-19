import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserScreenerUrl } from '@/app/api/screener-urls/route';
import { getStoredCredentials } from '@/lib/auth/authUtils';

interface UseUserScreenerUrlsReturn {
	urls: UserScreenerUrl[];
	loading: boolean;
	error: string | null;
	addUrl: (name: string, url: string) => Promise<boolean>;
	updateUrl: (id: string, name: string, url: string) => Promise<boolean>;
	deleteUrl: (id: string) => Promise<boolean>;
	refreshUrls: () => Promise<void>;
}

export function useUserScreenerUrls(): UseUserScreenerUrlsReturn {
	const { getUserEmail, isAuthenticated } = useAuth();
	const [urls, setUrls] = useState<UserScreenerUrl[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const userEmail = getUserEmail();

	// Get user credentials
	const getUserCredentials = (): { userEmail: string; userPassword: string } | null => {
		if (typeof window === 'undefined') return null;
		return getStoredCredentials();

		return null;
	};

	// Fetch user's screener URLs
	const fetchUrls = useCallback(async () => {
		if (!userEmail || !isAuthenticated()) {
			setUrls([]);
			setError(null); // Clear any previous errors when not authenticated
			return;
		}

		const credentials = getUserCredentials();
		if (!credentials) {
			setUrls([]);
			setError(null); // Don't show error when credentials aren't available yet
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const response = await fetch(`/api/screener-urls?userEmail=${encodeURIComponent(credentials.userEmail)}&userPassword=${encodeURIComponent(credentials.userPassword)}`);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to fetch screener URLs');
			}

			const data = await response.json();
			setUrls(data.urls || []);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to fetch screener URLs';
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	}, [userEmail, isAuthenticated]);

	// Load URLs on mount and when user changes
	useEffect(() => {
		fetchUrls();
	}, [fetchUrls]);

	// Add new URL
	const addUrl = useCallback(async (name: string, url: string): Promise<boolean> => {
		if (!userEmail || !isAuthenticated()) {
			setError('User not authenticated');
			return false;
		}

		const credentials = getUserCredentials();
		if (!credentials) {
			setError('User credentials not available');
			return false;
		}

		setError(null);

		try {
			const response = await fetch('/api/screener-urls', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userEmail: credentials.userEmail,
					userPassword: credentials.userPassword,
					name,
					url,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to add screener URL');
			}

			const data = await response.json();

			// Optimistically update the state
			setUrls(prevUrls => [...prevUrls, data.url]);

			return true;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to add screener URL';
			setError(errorMessage);
			return false;
		}
	}, [userEmail, isAuthenticated]);

	// Update existing URL
	const updateUrl = useCallback(async (id: string, name: string, url: string): Promise<boolean> => {
		if (!userEmail || !isAuthenticated()) {
			setError('User not authenticated');
			return false;
		}

		const credentials = getUserCredentials();
		if (!credentials) {
			setError('User credentials not available');
			return false;
		}

		setError(null);

		try {
			const response = await fetch('/api/screener-urls', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userEmail: credentials.userEmail,
					userPassword: credentials.userPassword,
					id,
					name,
					url,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to update screener URL');
			}

			const data = await response.json();

			// Optimistically update the state
			setUrls(prevUrls =>
				prevUrls.map(prevUrl =>
					prevUrl.id === id ? data.url : prevUrl
				)
			);

			return true;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to update screener URL';
			setError(errorMessage);
			return false;
		}
	}, [userEmail, isAuthenticated]);

	// Delete URL
	const deleteUrl = useCallback(async (id: string): Promise<boolean> => {
		if (!userEmail || !isAuthenticated()) {
			setError('User not authenticated');
			return false;
		}

		const credentials = getUserCredentials();
		if (!credentials) {
			setError('User credentials not available');
			return false;
		}

		setError(null);

		try {
			const response = await fetch(`/api/screener-urls?userEmail=${encodeURIComponent(credentials.userEmail)}&userPassword=${encodeURIComponent(credentials.userPassword)}&id=${encodeURIComponent(id)}`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete screener URL');
			}

			// Optimistically update the state
			setUrls(prevUrls => prevUrls.filter(prevUrl => prevUrl.id !== id));

			return true;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to delete screener URL';
			setError(errorMessage);
			return false;
		}
	}, [userEmail, isAuthenticated]);

	// Refresh URLs (useful for manual refresh)
	const refreshUrls = useCallback(async () => {
		await fetchUrls();
	}, [fetchUrls]);

	return {
		urls,
		loading,
		error,
		addUrl,
		updateUrl,
		deleteUrl,
		refreshUrls,
	};
}
