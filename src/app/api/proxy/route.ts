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

/**
 * Helper to normalize headers.
 * If content-type is present in original headers, keep it as-is.
 * If setJson is true and no content-type is present, set to application/json.
 */
function normalizeHeaders(headers: Record<string, string>, setJson: boolean): Headers {
	const result = new Headers();
	let hasContentType = false;
	for (const [k, v] of Object.entries(headers)) {
		if (k.toLowerCase() === 'content-type') {
			hasContentType = true;
			result.set(k, v);
		} else {
			result.set(k, v);
		}
	}
	if (setJson && !hasContentType) result.set('content-type', 'application/json');
	return result;
}

export async function POST(req: NextRequest) {
	try {
		const { url, method = 'GET', headers = {}, body } = await req.json();
		if (!url) {
			return NextResponse.json({ error: 'Missing url' }, { status: 400 });
		}

		const fetchOptions: RequestInit = { method, headers };

		let setJson = false;

		// If there is a body and it's not a GET, handle content-type and body forwarding
		if (body && method !== 'GET') {
			const contentType = headers['content-type'] || headers['Content-Type'] || '';

			let parsedBody: unknown = body;

			// If content-type is application/json or not set, stringify the body
			if (!contentType || contentType.includes('application/json')) {
				if (typeof body === 'string') {
					parsedBody = parseRequestBody(body);
				}
				fetchOptions.body = JSON.stringify(parsedBody);
				setJson = true;
			} else {
				// For all other content-types, forward the body as-is
				fetchOptions.body = body;
				setJson = false;
			}
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
