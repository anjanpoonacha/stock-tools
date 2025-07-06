export async function fetchTradingViewShortlistWithAuth(url: string, cookie: string): Promise<string[]> {
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
		const shortlist = data.find((list: any) => list.id === 134340368 || list.name === 'Shortlist');
		if (!shortlist) {
			console.error(
				'[TradingView API] Shortlist not found. Available lists:',
				data.map((l: any) => ({ id: l.id, name: l.name }))
			);
			throw new Error('Shortlist not found');
		}
		if (!Array.isArray(shortlist.symbols)) {
			console.error('[TradingView API] Shortlist symbols missing or not an array:', shortlist);
			throw new Error('Shortlist symbols missing or invalid');
		}
		return shortlist.symbols;
	} catch (err) {
		console.error('[TradingView API] fetchTradingViewShortlistWithAuth error:', err);
		throw err;
	}
}
