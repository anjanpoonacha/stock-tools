export async function fetchTradingViewWatchlistsWithAuth(url: string, cookie: string) {
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; StockFormatConverter/1.0)',
				Cookie: cookie,
			},
		});
		if (!res.ok) {
			const text = await res.text();
			console.error(`[TradingView API] HTTP ${res.status}: ${res.statusText}\nResponse body: ${text}`);
			throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
		}
		const data = await res.json();
		if (!Array.isArray(data)) {
			console.error('[TradingView API] Unexpected response format:', data);
			throw new Error('Unexpected response format from TradingView API');
		}
		// Only return id, name, and symbols for each watchlist
		return data
			.filter((list: any) => Array.isArray(list.symbols))
			.map((list: any) => ({
				id: list.id,
				name: list.name,
				symbols: list.symbols,
			}));
	} catch (err) {
		console.error('[TradingView API] fetchTradingViewWatchlistsWithAuth error:', err);
		throw err;
	}
}
