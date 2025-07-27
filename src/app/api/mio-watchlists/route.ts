// src/app/api/mio-watchlists/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: NextRequest) {
	try {
		const { aspSessionId } = await req.json();
		if (!aspSessionId) {
			return NextResponse.json({ error: 'Missing aspSessionId' }, { status: 400 });
		}

		const res = await fetch('https://www.marketinout.com/wl/watch_list.php?mode=list', {
			headers: {
				Cookie: `ASPSESSIONIDCECTBSAC=${aspSessionId}`,
			},
		});

		if (!res.ok) {
			return NextResponse.json({ error: 'Failed to fetch watchlist page' }, { status: 500 });
		}

		const html = await res.text();
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

		return NextResponse.json({ watchlists });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'An unknown error occurred';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
