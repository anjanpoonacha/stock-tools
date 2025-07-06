import { NextRequest, NextResponse } from 'next/server';
import { fetchTradingViewWatchlistsWithAuth } from './tv-fetch-shortlist';

export async function POST(req: NextRequest) {
	try {
		const { url, cookie } = await req.json();
		if (!url || !cookie) {
			return NextResponse.json({ error: 'Missing url or cookie' }, { status: 400 });
		}
		const watchlists = await fetchTradingViewWatchlistsWithAuth(url, cookie);
		return NextResponse.json({ watchlists }); // <-- Return as { watchlists }
	} catch (error) {
		const message = error instanceof Error ? error.message : 'An unknown error occurred';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
