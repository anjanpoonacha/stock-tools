import { NextRequest, NextResponse } from 'next/server';
import { fetchTradingViewShortlistWithAuth } from './tv-fetch-shortlist';

export async function POST(req: NextRequest) {
	try {
		const { url, cookie } = await req.json();
		if (!url || !cookie) {
			return NextResponse.json({ error: 'Missing url or cookie' }, { status: 400 });
		}
		const symbols = await fetchTradingViewShortlistWithAuth(url, cookie);
		return NextResponse.json({ symbols });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
