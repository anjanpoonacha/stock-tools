import { NextRequest, NextResponse } from 'next/server';
import { fetchTradingViewWatchlistsWithAuth } from '../tv-shortlist/tv-fetch-shortlist';

export async function POST(req: NextRequest) {
	try {
		const { sessionid } = await req.json();
		if (!sessionid) {
			return NextResponse.json({ error: 'Missing sessionid' }, { status: 400 });
		}
		const url = 'https://www.tradingview.com/api/v1/symbols_list/all/';
		const cookie = `sessionid=${sessionid}`;
		const watchlists = await fetchTradingViewWatchlistsWithAuth(url, cookie);
		return NextResponse.json({ watchlists });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'An unknown error occurred';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
