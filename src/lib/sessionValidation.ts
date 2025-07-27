/**
 * Validate a MarketInOut session by attempting to fetch the watchlist.
 * If invalid, deletes the session and returns false.
 * Returns the watchlists array if valid, or throws if invalid.
 */
import { MIOService } from './MIOService';

export async function validateAndCleanupMarketinoutSession(
	internalSessionId: string
): Promise<{ id: string; name: string }[]> {
	try {
		const watchlists = await MIOService.getWatchlistsWithSession(internalSessionId);
		if (!watchlists || watchlists.length === 0) {
			const { deleteSession } = await import('./sessionStore');
			deleteSession(internalSessionId);
			throw new Error('Session expired. Please re-authenticate.');
		}
		return watchlists;
	} catch (err: any) {
		const { deleteSession } = await import('./sessionStore');
		deleteSession(internalSessionId);
		throw new Error(err.message || 'Session expired. Please re-authenticate.');
	}
}
