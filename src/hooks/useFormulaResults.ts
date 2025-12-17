import { useState, useEffect } from 'react';
import type { FormulaResultsResponse, Stock } from '@/types/stock';
import { useToast } from '@/components/ui/toast';
import { LocalStorageCache } from '@/lib/utils/cache';

interface UseFormulaResultsReturn {
	stocks: Stock[];
	formulaName: string;
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

interface CachedResults {
	stocks: Stock[];
	formulaName: string;
}

const CACHE_KEY_PREFIX = 'formula-results:';

export function useFormulaResults(formulaId: string | null): UseFormulaResultsReturn {
	const [stocks, setStocks] = useState<Stock[]>([]);
	const [formulaName, setFormulaName] = useState<string>('');
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const showToast = useToast();

	const fetchResults = async () => {
		if (!formulaId) {
			setError('No formula ID provided');
			return;
		}

		// Check cache first
		const cacheKey = `${CACHE_KEY_PREFIX}${formulaId}`;
		const cached = LocalStorageCache.get<CachedResults>(cacheKey);
		if (cached) {
			setStocks(cached.stocks);
			setFormulaName(cached.formulaName);
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			// Get credentials from localStorage
			const credentials = JSON.parse(
				localStorage.getItem('mio-tv-auth-credentials') || '{}'
			);

			if (!credentials.userEmail || !credentials.userPassword) {
				throw new Error('Not authenticated. Please log in first.');
			}

			const response = await fetch('/api/formula-results', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userEmail: credentials.userEmail,
					userPassword: credentials.userPassword,
					formulaId,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to fetch formula results');
			}

			const data: FormulaResultsResponse = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Failed to fetch formula results');
			}

			setStocks(data.stocks);
			setFormulaName(data.formulaName);

			// Cache the results
			LocalStorageCache.set<CachedResults>(cacheKey, {
				stocks: data.stocks,
				formulaName: data.formulaName,
			});

			showToast(`Loaded ${data.stocks.length} stocks from formula`, 'success');
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			setError(errorMessage);
			showToast(errorMessage, 'error');
			console.error('[useFormulaResults] Error:', err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (formulaId) {
			fetchResults();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [formulaId]);

	return {
		stocks,
		formulaName,
		loading,
		error,
		refetch: fetchResults,
	};
}
