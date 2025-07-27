import { getPlatformSession } from './sessionStore';

// src/lib/MIOService.ts

type AddWatchlistWithSessionParams = {
	internalSessionId: string;
	mioWlid: string;
	symbols: string;
};

export class MIOService {
	/**
	 * Retrieve the ASP session ID for MIO from the session store.
	 */
	/**
	 * Retrieve the session key and value for MIO from the session store.
	 */
	static getSessionKeyValue(internalSessionId: string): { key: string; value: string } | undefined {
		const session = getPlatformSession(internalSessionId, 'marketinout');
		if (!session) return undefined;
		// Find the first key that is not 'sessionId'
		const key = Object.keys(session).find((k) => k !== 'sessionId');
		if (key && session[key]) {
			return { key, value: session[key] };
		}
		return undefined;
	}

	/**
	 * Fetch MIO watchlists using internalSessionId (handles session lookup and HTML parsing).
	 */
	static async getWatchlistsWithSession(internalSessionId: string): Promise<{ id: string; name: string }[]> {
		const sessionKeyValue = MIOService.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) throw new Error('No MIO session found for this user.');

		// Fetch the watchlist page from MIO
		const res = await fetch('https://www.marketinout.com/wl/watch_list.php?mode=list', {
			headers: {
				Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
			},
		});
		if (!res.ok) throw new Error('Failed to fetch watchlist page');

		const html = await res.text();
		// Use dynamic import for cheerio to avoid SSR issues
		const cheerio = await import('cheerio');
		const $ = cheerio.load(html);

		const watchlists: { id: string; name: string }[] = [];
		let count = 0;
		$('#sel_wlid option').each((_, el) => {
			if (count >= 8) return false;
			const id = $(el).attr('value')?.trim() || '';
			const name = $(el).text().trim();
			if (/^\d+$/.test(id) && name) {
				watchlists.push({ id, name });
				count++;
			}
		});

		return watchlists;
	}

	/**
	 * Add watchlist using internalSessionId (fetches aspSessionId from session store).
	 */
	static async addWatchlistWithSession({
		internalSessionId,
		mioWlid,
		symbols,
	}: AddWatchlistWithSessionParams): Promise<string> {
		const sessionKeyValue = MIOService.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) throw new Error('No MIO session found for this user.');
		return MIOService.addWatchlist({
			sessionKey: sessionKeyValue.key,
			sessionValue: sessionKeyValue.value,
			mioWlid,
			symbols,
		});
	}
	static async addWatchlist({
		sessionKey,
		sessionValue,
		mioWlid,
		symbols,
	}: {
		sessionKey: string;
		sessionValue: string;
		mioWlid: string;
		symbols: string;
	}): Promise<string> {
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

		const res = await fetch('https://www.marketinout.com/wl/watch_list.php', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: `${sessionKey}=${sessionValue}`,
			},
			body: formData,
		});

		const text = await res.text();
		if (!res.ok) {
			throw new Error('Failed to sync. Please check your credentials.');
		}
		return text;
	}

	static async createWatchlist(sessionKey: string, sessionValue: string, name: string): Promise<string> {
		const url = `https://www.marketinout.com/wl/my_watch_lists.php?mode=new&name=${encodeURIComponent(name)}&wlid=`;
		const res = await fetch(url, {
			method: 'GET',
			headers: {
				Cookie: `${sessionKey}=${sessionValue}`,
			},
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error('Failed to create watchlist.');
		}
		return text;
	}

	static async deleteWatchlists(sessionKey: string, sessionValue: string, todeleteIds: string[]): Promise<string> {
		if (!Array.isArray(todeleteIds) || todeleteIds.length === 0) {
			throw new Error('No watchlist IDs provided for deletion.');
		}
		const params = todeleteIds.map((id) => `todelete=${encodeURIComponent(id)}`).join('&');
		const url = `https://www.marketinout.com/wl/my_watch_lists.php?${params}&mode=delete`;
		console.log('[MIOService][deleteWatchlists] url:', url, 'params:', params, 'ids:', todeleteIds);
		const res = await fetch(url, {
			method: 'GET',
			headers: {
				Cookie: `${sessionKey}=${sessionValue}`,
			},
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error('Failed to delete watchlists.');
		}
		return text;
	}

	/**
	 * Delete watchlists using internalSessionId (fetches aspSessionId from session store).
	 */
	static async deleteWatchlistsWithSession(internalSessionId: string, deleteIds: string[]): Promise<string> {
		const sessionKeyValue = MIOService.getSessionKeyValue(internalSessionId);
		if (!sessionKeyValue) throw new Error('No MIO session found for this user.');
		return MIOService.deleteWatchlists(sessionKeyValue.key, sessionKeyValue.value, deleteIds);
	}
}
