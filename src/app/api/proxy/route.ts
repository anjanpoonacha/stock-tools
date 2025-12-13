import { NextRequest, NextResponse } from 'next/server';

// Helper to parse the request body for TradingView API
function parseRequestBody(body: unknown): unknown {
	if (typeof body !== 'string') return body;
	const trimmed = body.trim();
	if (trimmed === '[]') return [];

	// First, try to JSON.parse if it's a JSON-encoded string
	let stringToParse = body;
	try {
		const parsed = JSON.parse(body);
		if (typeof parsed === 'string') {
			stringToParse = parsed;
		}
	} catch {
		// Not JSON-encoded, continue with original string
	}

	const arr = stringToParse
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
		const payload = await req.json();
		console.log('[PROXY] Incoming payload:', payload);
		const { url, method = 'GET', headers = {}, body } = payload;
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
	let data;

	try {
		const contentType = res.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			data = await res.json();
		} else {
			data = await res.text();
		}
	} catch (parseError) {
		console.error('[PROXY] Failed to parse response:', parseError);
		data = {
			error: 'Invalid response format from TradingView',
			parseError: parseError instanceof Error ? parseError.message : String(parseError),
		};
	}

	// Pass through the original HTTP status code from TradingView
	return NextResponse.json({ data, status: res.status }, { status: res.status });
	} catch (error) {
		console.error('[PROXY] Error:', error);
		const message = error instanceof Error ? error.message : 'An unknown error occurred';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
