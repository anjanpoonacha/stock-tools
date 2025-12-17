import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { LocalStorageCache } from '@/lib/utils/cache';

const CACHE_KEY_PREFIX = 'chart-data:';

export function useChartDataCache() {
	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState({ current: 0, total: 0 });
	const showToast = useToast();

	const getCacheKey = (symbol: string, resolution: string) => {
		return `${CACHE_KEY_PREFIX}${symbol}_${resolution}`;
	};

	const getCachedData = (symbol: string, resolution: string) => {
		const key = getCacheKey(symbol, resolution);
		return LocalStorageCache.get<unknown>(key);
	};

	const prefetchChartData = useCallback(async (
		symbols: string[],
		resolutions: string[] = ['1W', '1D']
	) => {
		const totalFetches = symbols.length * resolutions.length;
		setLoading(true);
		setProgress({ current: 0, total: totalFetches });

		let fetchedCount = 0;

		try {
			// Get credentials
			const credentials = JSON.parse(
				localStorage.getItem('mio-tv-auth-credentials') || '{}'
			);

			if (!credentials.userEmail || !credentials.userPassword) {
				throw new Error('Not authenticated');
			}

			// Fetch all charts in parallel (but with some throttling)
			const fetchPromises: Promise<void>[] = [];

			for (const symbol of symbols) {
				for (const resolution of resolutions) {
					const key = getCacheKey(symbol, resolution);

					// Skip if already cached and fresh
					const existing = LocalStorageCache.get<unknown>(key);
					if (existing) {
						fetchedCount++;
						setProgress({ current: fetchedCount, total: totalFetches });
						continue;
					}

					// Fetch chart data
					const fetchPromise = fetch(
						`/api/chart-data?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&barsCount=300`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								userEmail: credentials.userEmail,
								userPassword: credentials.userPassword,
							}),
						}
					)
						.then(res => res.json())
						.then(data => {
							if (data.success) {
								LocalStorageCache.set(key, data);
							}
							fetchedCount++;
							setProgress({ current: fetchedCount, total: totalFetches });
						})
						.catch(err => {
							console.error(`Failed to fetch ${symbol} ${resolution}:`, err);
							fetchedCount++;
							setProgress({ current: fetchedCount, total: totalFetches });
						});

					fetchPromises.push(fetchPromise);

					// Throttle: Wait 100ms between batches of 4
					if (fetchPromises.length % 4 === 0) {
						await Promise.all(fetchPromises);
						fetchPromises.length = 0;
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				}
			}

			// Wait for remaining fetches
			await Promise.all(fetchPromises);

			showToast(`Prefetched ${totalFetches} charts`, 'success');
		} catch (err) {
			console.error('[useChartDataCache] Prefetch error:', err);
			showToast('Failed to prefetch chart data', 'error');
		} finally {
			setLoading(false);
			setProgress({ current: 0, total: 0 });
		}
	}, [showToast]);

	return {
		getCachedData,
		prefetchChartData,
		loading,
		progress,
	};
}
