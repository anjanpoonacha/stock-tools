// src/app/api/mio-formulas/edit/route.ts

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
 * PUT - Edit existing formula on MIO
 * Request body: { userEmail, userPassword, screenId, name, formula, categoryId?, groupId?, eventId? }
 * Response: { success, screenId, redirectUrl, formula }
 */
export async function PUT(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, screenId, name, formula, categoryId, groupId, eventId } = body;

		// Validate required fields
		if (!userEmail || !userPassword || !screenId || !name || !formula) {
			return NextResponse.json(
				{ error: 'User email, password, screenId, name, and formula are required' },
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

		// Edit formula using MIOService

		const result = await MIOService.editFormulaWithSession(sessionInfo.internalId, {
			screenId,
			name,
			formula,
			categoryId,
			groupId,
			eventId,
		});

		// Update stored formula
		const key = generateFormulasKey(userEmail, userPassword);
		const storedData = await kv.get<StoredFormulas>(key);

		if (storedData) {
			// Find and update the formula
			const formulaIndex = storedData.formulas.findIndex(f => f.screenId === screenId);

			if (formulaIndex !== -1) {
				const now = new Date().toISOString();
				const updatedFormula: MIOFormula = {
					...storedData.formulas[formulaIndex],
					name,
					pageUrl: result.redirectUrl,
					updatedAt: now,
				};

				storedData.formulas[formulaIndex] = updatedFormula;
				storedData.lastUpdated = now;
				await kv.set(key, storedData);

				return NextResponse.json({
					success: true,
					screenId: result.screenId,
					redirectUrl: result.redirectUrl,
					formula: updatedFormula,
				});
			}
		}

		// If formula not found in storage, still return success from MIO
		// User can re-extract to sync storage
		return NextResponse.json({
			success: true,
			screenId: result.screenId,
			redirectUrl: result.redirectUrl,
			message: 'Formula updated on MIO. Please re-extract formulas to sync local storage.',
		});

	} catch (error) {

		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Failed to edit formula',
			},
			{ status: 500 }
		);
	}
}
