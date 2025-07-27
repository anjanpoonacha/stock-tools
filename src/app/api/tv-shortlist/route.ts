import { NextRequest, NextResponse } from 'next/server';
import { fetchWatchlistsWithAuth } from '@/lib/tradingview';

export async function POST(req: NextRequest) {
	try {
		const { url, sessionid } = await req.json();
		if (!url || !sessionid) {
			return NextResponse.json({ error: 'Missing url or sessionid' }, { status: 400 });
		}
		const cookie = `sessionid=${sessionid}`;
		const watchlists = await fetchWatchlistsWithAuth(url, cookie);
		return NextResponse.json({ watchlists });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'An unknown error occurred';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
