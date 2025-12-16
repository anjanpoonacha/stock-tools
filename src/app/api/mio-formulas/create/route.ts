// src/app/api/mio-formulas/create/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { MIOService } from '@/lib/mio';
import { SessionResolver } from '@/lib/SessionResolver';
import type { MIOFormula, StoredFormulas } from '@/types/formula';

/**
 * Generate KV key for user formulas
 */
function generateFormulasKey(userEmail: string, userPassword: string): string {
	return `mio-formulas:${userEmail.toLowerCase().trim()}:${userPassword}`;
}

/**
 * POST - Create new formula on MIO
 * Request body: { userEmail, userPassword, name, formula, categoryId?, groupId?, eventId? }
 * Response: { success, screenId, redirectUrl, formula }
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, name, formula, categoryId, groupId, eventId } = body;

		// Validate required fields
		if (!userEmail || !userPassword || !name || !formula) {
			return NextResponse.json(
				{ error: 'User email, password, name, and formula are required' },
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

		// Create formula using MIOService
		console.log('[API] Creating formula:', { name, formulaLength: formula.length });
		const result = await MIOService.createFormulaWithSession(sessionInfo.internalId, {
			name,
			formula,
			categoryId,
			groupId,
			eventId,
		});

		console.log('[API] Formula created successfully:', { screenId: result.screenId });

		// Extract API URL immediately after creation
		console.log('[API] Extracting API URL from formula page:', result.redirectUrl);
		const extracted = await MIOService.extractApiUrlFromFormula(
			sessionInfo.internalId,
			result.redirectUrl
		);

		// Create MIOFormula object for storage
		const now = new Date().toISOString();
		const newFormula: MIOFormula = {
			id: `formula_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			name,
			pageUrl: result.redirectUrl,
			apiUrl: extracted.apiUrl,
			screenId: result.screenId,
			createdAt: now,
			updatedAt: now,
			extractionStatus: extracted.apiUrl ? 'success' : 'failed',
			formulaText: extracted.formulaText || undefined,
		};

		console.log('[API] Formula stored with API URL:', {
			hasApiUrl: !!extracted.apiUrl,
			hasFormulaText: !!extracted.formulaText,
			extractionStatus: newFormula.extractionStatus
		});

		// Add to stored formulas
		const key = generateFormulasKey(userEmail, userPassword);
		const storedData = await kv.get<StoredFormulas>(key);

		if (storedData) {
			storedData.formulas.unshift(newFormula); // Add to beginning
			storedData.totalCount = storedData.formulas.length;
			storedData.lastUpdated = now;
			await kv.set(key, storedData);
		} else {
			// Create new storage
			await kv.set(key, {
				formulas: [newFormula],
				lastUpdated: now,
				totalCount: 1,
			});
		}

		return NextResponse.json({
			success: true,
			screenId: result.screenId,
			redirectUrl: result.redirectUrl,
			formula: newFormula,
		}, { status: 201 });

	} catch (error) {
		console.error('[API] Error creating formula:', error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Failed to create formula',
			},
			{ status: 500 }
		);
	}
}
