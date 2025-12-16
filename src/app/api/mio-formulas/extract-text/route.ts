// src/app/api/mio-formulas/extract-text/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { MIOService } from '@/lib/mio';
import { SessionResolver } from '@/lib/SessionResolver';

/**
 * POST - Extract formula text from a formula page URL
 * Used when editing formulas that don't have formulaText stored
 * Body params: userEmail, userPassword, pageUrl
 * Response: { formulaText, apiUrl }
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, pageUrl } = body;

		// Validate required fields
		if (!userEmail || !userPassword || !pageUrl) {
			return NextResponse.json(
				{ error: 'User email, password, and pageUrl are required' },
				{ status: 400 }
			);
		}

		// Resolve MIO session for the user
		const userCredentials = { userEmail, userPassword };
		const sessionInfo = await SessionResolver.getLatestMIOSessionForUser(userCredentials);

		if (!sessionInfo || !sessionInfo.internalId) {
			return NextResponse.json(
				{
					error: 'No valid MIO session found. Please capture your MIO session using the browser extension.',
					sessionError: true,
				},
				{ status: 401 }
			);
		}

		// Extract formula text and API URL from the page
		console.log('[API][extract-text] Extracting from URL:', pageUrl);
		console.log('[API][extract-text] Using session:', sessionInfo.internalId);

		const extracted = await MIOService.extractApiUrlFromFormula(
			sessionInfo.internalId,
			pageUrl
		);

		console.log('[API][extract-text] Extraction result:', {
			hasFormulaText: !!extracted.formulaText,
			formulaTextLength: extracted.formulaText?.length,
			formulaTextPreview: extracted.formulaText?.substring(0, 50),
			hasApiUrl: !!extracted.apiUrl,
			apiUrl: extracted.apiUrl,
		});

		if (!extracted.formulaText) {
			console.warn('[API][extract-text] ✗ No formula text found at:', pageUrl);
		} else {
			console.log('[API][extract-text] ✓ Successfully extracted formula text');
		}

		return NextResponse.json({
			success: true,
			formulaText: extracted.formulaText,
			apiUrl: extracted.apiUrl,
		});

	} catch (error) {
		console.error('[API] Error extracting formula text:', error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Failed to extract formula text',
			},
			{ status: 500 }
		);
	}
}
