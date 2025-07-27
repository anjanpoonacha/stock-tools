// src/lib/MIOService.ts

type AddWatchlistParams = {
	aspSessionId: string;
	mioWlid: string;
	symbols: string;
};

export class MIOService {
	static async addWatchlist({ aspSessionId, mioWlid, symbols }: AddWatchlistParams): Promise<string> {
		const regroupTVWatchlist = (symbols: string) => {
			// This should match the regroupTVWatchlist logic from utils if needed
			// For now, just return symbols as-is
			return symbols;
		};

		const formData = new URLSearchParams({
			mode: 'add',
			wlid: mioWlid,
			overwrite: '0',
			name: '',
			stock_list: regroupTVWatchlist(symbols),
		}).toString();

		const res = await fetch('/api/proxy', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: JSON.stringify({
				url: 'https://www.marketinout.com/wl/watch_list.php',
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `ASPSESSIONIDCECTBSAC=${aspSessionId}`,
				},
				body: formData,
			}),
		});

		const text = await res.text();
		if (!res.ok) {
			throw new Error('Failed to sync. Please check your credentials.');
		}
		return text;
	}

	static async createWatchlist(aspSessionId: string, name: string): Promise<string> {
		const url = `https://www.marketinout.com/wl/my_watch_lists.php?mode=new&name=${encodeURIComponent(name)}&wlid=`;
		const res = await fetch('/api/proxy', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				url,
				method: 'GET',
				headers: {
					Cookie: `ASPSESSIONIDCECTBSAC=${aspSessionId}`,
				},
			}),
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error('Failed to create watchlist.');
		}
		return text;
	}

	static async deleteWatchlists(aspSessionId: string, todeleteIds: string[]): Promise<string> {
		const params = todeleteIds.map((id) => `todelete=${encodeURIComponent(id)}`).join('&');
		const url = `https://www.marketinout.com/wl/my_watch_lists.php?${params}&mode=delete`;
		const res = await fetch('/api/proxy', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				url,
				method: 'GET',
				headers: {
					Cookie: `ASPSESSIONIDCECTBSAC=${aspSessionId}`,
				},
			}),
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error('Failed to delete watchlists.');
		}
		return text;
	}
}
