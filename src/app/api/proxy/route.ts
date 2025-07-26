import { NextRequest, NextResponse } from 'next/server';

// Helper to parse the request body for TradingView API
function parseRequestBody(body: unknown): unknown {
	if (typeof body !== 'string') return body;
	const trimmed = body.trim();
	if (trimmed === '[]') return [];
	const arr = body
		.split(',')
		.map((s) =>
			s
				.trim()
				.replace(/^"+|"+$/g, '')
				.replace(/^'+|'+$/g, '')
		)
		.filter((s) => s.length > 0 && s !== '""' && s !== "''");
	return arr;
}

// Helper to normalize headers and set content-type if needed
function normalizeHeaders(headers: Record<string, string>, setJson: boolean): Headers {
	const result = new Headers();
	for (const [k, v] of Object.entries(headers)) {
		if (k.toLowerCase() !== 'content-type') result.set(k, v);
	}
	if (setJson) result.set('content-type', 'application/json');
	return result;
}

export async function POST(req: NextRequest) {
	try {
		const { url, method = 'GET', headers = {}, body } = await req.json();
		if (!url) {
			return NextResponse.json({ error: 'Missing url' }, { status: 400 });
		}

		let fetchOptions: RequestInit = { method, headers };
		let setJson = false;

		if (body && method !== 'GET') {
			let parsedBody: unknown;
			if (typeof body === 'string') {
				parsedBody = parseRequestBody(body);
				setJson = true;
			} else {
				parsedBody = body;
				setJson = true;
			}
			fetchOptions.body = JSON.stringify(parsedBody);
			fetchOptions.headers = normalizeHeaders(headers, setJson);
		}

		const res = await fetch(url, fetchOptions);
		const contentType = res.headers.get('content-type') || '';
		let data;
		if (contentType.includes('application/json')) {
			data = await res.json();
		} else {
			data = await res.text();
		}
		return NextResponse.json({ data, status: res.status });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'An unknown error occurred';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
