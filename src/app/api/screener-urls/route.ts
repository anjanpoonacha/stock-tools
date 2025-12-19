import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { validateScreenerUrl, validateScreenerUrlName, sanitizeUrl, sanitizeUrlName } from '@/lib/urlValidation';

export interface UserScreenerUrl {
	id: string;
	name: string;
	url: string;
	createdAt: string;
}

/**
 * Generate KV key for user screener URLs
 * Uses both email and password for user isolation
 */
function generateScreenerUrlsKey(userEmail: string, userPassword: string): string {
	return `screener-urls:${userEmail.toLowerCase().trim()}:${userPassword}`;
}

/**
 * Generate unique ID for screener URL
 */
function generateUrlId(): string {
	return `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * GET - Fetch user's screener URLs
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const userEmail = searchParams.get('userEmail');
		const userPassword = searchParams.get('userPassword');

		if (!userEmail || !userPassword) {
			return NextResponse.json(
				{ error: 'User email and password are required' },
				{ status: 400 }
			);
		}

		const key = generateScreenerUrlsKey(userEmail, userPassword);
		const urls = await kv.get<UserScreenerUrl[]>(key);

		return NextResponse.json({
			urls: urls || [],
			count: urls?.length || 0
		});
	} catch (error) {

		return NextResponse.json(
			{ error: 'Failed to fetch screener URLs' },
			{ status: 500 }
		);
	}
}

/**
 * POST - Add new screener URL
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, name, url } = body;

		// Validate required fields
		if (!userEmail || !userPassword || !name || !url) {
			return NextResponse.json(
				{ error: 'User email, password, name, and URL are required' },
				{ status: 400 }
			);
		}

		// Sanitize inputs
		const sanitizedName = sanitizeUrlName(name);
		const sanitizedUrl = sanitizeUrl(url);

		// Validate name
		const nameValidation = validateScreenerUrlName(sanitizedName);
		if (!nameValidation.isValid) {
			return NextResponse.json(
				{ error: nameValidation.error },
				{ status: 400 }
			);
		}

		// Validate URL
		const urlValidation = validateScreenerUrl(sanitizedUrl);
		if (!urlValidation.isValid) {
			return NextResponse.json(
				{ error: urlValidation.error },
				{ status: 400 }
			);
		}

		// Get existing URLs
		const key = generateScreenerUrlsKey(userEmail, userPassword);
		const existingUrls = await kv.get<UserScreenerUrl[]>(key) || [];

		// Check for duplicate names
		const nameExists = existingUrls.some(existingUrl =>
			existingUrl.name.toLowerCase() === sanitizedName.toLowerCase()
		);

		if (nameExists) {
			return NextResponse.json(
				{ error: 'A screener URL with this name already exists' },
				{ status: 409 }
			);
		}

		// Create new URL entry
		const newUrl: UserScreenerUrl = {
			id: generateUrlId(),
			name: sanitizedName,
			url: sanitizedUrl,
			createdAt: new Date().toISOString()
		};

		// Add to existing URLs
		const updatedUrls = [...existingUrls, newUrl];

		// Save to KV
		await kv.set(key, updatedUrls);

		return NextResponse.json({
			message: 'Screener URL added successfully',
			url: newUrl,
			count: updatedUrls.length
		}, { status: 201 });

	} catch (error) {

		return NextResponse.json(
			{ error: 'Failed to add screener URL' },
			{ status: 500 }
		);
	}
}

/**
 * PUT - Update existing screener URL
 */
export async function PUT(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, id, name, url } = body;

		// Validate required fields
		if (!userEmail || !userPassword || !id || !name || !url) {
			return NextResponse.json(
				{ error: 'User email, password, ID, name, and URL are required' },
				{ status: 400 }
			);
		}

		// Sanitize inputs
		const sanitizedName = sanitizeUrlName(name);
		const sanitizedUrl = sanitizeUrl(url);

		// Validate name
		const nameValidation = validateScreenerUrlName(sanitizedName);
		if (!nameValidation.isValid) {
			return NextResponse.json(
				{ error: nameValidation.error },
				{ status: 400 }
			);
		}

		// Validate URL
		const urlValidation = validateScreenerUrl(sanitizedUrl);
		if (!urlValidation.isValid) {
			return NextResponse.json(
				{ error: urlValidation.error },
				{ status: 400 }
			);
		}

		// Get existing URLs
		const key = generateScreenerUrlsKey(userEmail, userPassword);
		const existingUrls = await kv.get<UserScreenerUrl[]>(key) || [];

		// Find the URL to update
		const urlIndex = existingUrls.findIndex(existingUrl => existingUrl.id === id);
		if (urlIndex === -1) {
			return NextResponse.json(
				{ error: 'Screener URL not found' },
				{ status: 404 }
			);
		}

		// Check for duplicate names (excluding current URL)
		const nameExists = existingUrls.some((existingUrl, index) =>
			index !== urlIndex && existingUrl.name.toLowerCase() === sanitizedName.toLowerCase()
		);

		if (nameExists) {
			return NextResponse.json(
				{ error: 'A screener URL with this name already exists' },
				{ status: 409 }
			);
		}

		// Update the URL
		const updatedUrl: UserScreenerUrl = {
			...existingUrls[urlIndex],
			name: sanitizedName,
			url: sanitizedUrl
		};

		existingUrls[urlIndex] = updatedUrl;

		// Save to KV
		await kv.set(key, existingUrls);

		return NextResponse.json({
			message: 'Screener URL updated successfully',
			url: updatedUrl,
			count: existingUrls.length
		});

	} catch (error) {

		return NextResponse.json(
			{ error: 'Failed to update screener URL' },
			{ status: 500 }
		);
	}
}

/**
 * DELETE - Remove screener URL
 */
export async function DELETE(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const userEmail = searchParams.get('userEmail');
		const userPassword = searchParams.get('userPassword');
		const id = searchParams.get('id');

		if (!userEmail || !userPassword || !id) {
			return NextResponse.json(
				{ error: 'User email, password, and URL ID are required' },
				{ status: 400 }
			);
		}

		// Get existing URLs
		const key = generateScreenerUrlsKey(userEmail, userPassword);
		const existingUrls = await kv.get<UserScreenerUrl[]>(key) || [];

		// Find and remove the URL
		const urlIndex = existingUrls.findIndex(url => url.id === id);
		if (urlIndex === -1) {
			return NextResponse.json(
				{ error: 'Screener URL not found' },
				{ status: 404 }
			);
		}

		const deletedUrl = existingUrls[urlIndex];
		const updatedUrls = existingUrls.filter(url => url.id !== id);

		// Save to KV
		await kv.set(key, updatedUrls);

		return NextResponse.json({
			message: 'Screener URL deleted successfully',
			deletedUrl,
			count: updatedUrls.length
		});

	} catch (error) {

		return NextResponse.json(
			{ error: 'Failed to delete screener URL' },
			{ status: 500 }
		);
	}
}
