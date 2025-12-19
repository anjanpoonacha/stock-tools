import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { getStoredCredentials } from '@/lib/auth/authUtils';

export function useChartDataCache() {
	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState({ current: 0, total: 0 });
	const showToast = useToast();

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
			const credentials = getStoredCredentials();

			if (!credentials) {
				throw new Error('Not authenticated');
			}

		// Batch fetch all charts in parallel (but with some throttling)
		const fetchPromises: Promise<void>[] = [];

		for (const symbol of symbols) {
			for (const resolution of resolutions) {
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
						fetchedCount++;
						setProgress({ current: fetchedCount, total: totalFetches });
					})
						.catch(err => {
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

		showToast(`Fetched ${totalFetches} charts`, 'success');
	} catch (err) {
		showToast('Failed to batch fetch chart data', 'error');
	} finally {
		setLoading(false);
		setProgress({ current: 0, total: 0 });
	}
}, [showToast]);

return {
	prefetchChartData,
	loading,
	progress,
};
}
