import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { MIOService } from '@/lib/mio';
import { SessionResolver } from '@/lib/SessionResolver';
import type { MIOFormula, StoredFormulas } from '@/types/formula';

/**
 * Generate KV key for user formulas
 * Uses both email and password for user isolation
 */
function generateFormulasKey(userEmail: string, userPassword: string): string {
	return `mio-formulas:${userEmail.toLowerCase().trim()}:${userPassword}`;
}

/**
 * GET - Fetch user's stored formulas
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

		const key = generateFormulasKey(userEmail, userPassword);
		const storedData = await kv.get<StoredFormulas>(key);

		if (!storedData) {
			return NextResponse.json({
				formulas: [],
				totalCount: 0,
				lastUpdated: null,
			});
		}

		return NextResponse.json({
			formulas: storedData.formulas,
			totalCount: storedData.totalCount,
			lastUpdated: storedData.lastUpdated,
		});
	} catch (error) {
		console.error('[API] Error fetching formulas:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch formulas' },
			{ status: 500 }
		);
	}
}

/**
 * POST - Extract and save formulas from MIO
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, forceRefresh } = body;

		// Validate required fields
		if (!userEmail || !userPassword) {
			return NextResponse.json(
				{ error: 'User email and password are required' },
				{ status: 400 }
			);
		}

		// Check if formulas already exist and not forcing refresh
		if (!forceRefresh) {
			const key = generateFormulasKey(userEmail, userPassword);
			const existing = await kv.get<StoredFormulas>(key);
			if (existing && existing.formulas.length > 0) {
				return NextResponse.json({
					success: true,
					message: 'Formulas already extracted. Use forceRefresh=true to re-extract.',
					extracted: existing.totalCount,
					formulas: existing.formulas,
					errors: [],
				});
			}
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

		// Extract formulas using MIOService
		const extractionResult = await MIOService.extractAllFormulasWithSession(
			sessionInfo.internalId
		);

		// Store the results in KV
		const storedFormulas: StoredFormulas = {
			formulas: extractionResult.formulas,
			lastUpdated: new Date().toISOString(),
			totalCount: extractionResult.formulas.length,
		};

		const key = generateFormulasKey(userEmail, userPassword);
		await kv.set(key, storedFormulas);

		return NextResponse.json({
			success: extractionResult.success,
			extracted: extractionResult.totalExtracted,
			failed: extractionResult.errors.length,
			formulas: extractionResult.formulas,
			errors: extractionResult.errors,
		}, { status: 201 });

	} catch (error) {
		console.error('[API] Error extracting formulas:', error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Failed to extract formulas',
			},
			{ status: 500 }
		);
	}
}

/**
 * PUT - Update existing formula
 */
export async function PUT(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, formulaId, updates } = body;

		// Validate required fields
		if (!userEmail || !userPassword || !formulaId || !updates) {
			return NextResponse.json(
				{ error: 'User email, password, formula ID, and updates are required' },
				{ status: 400 }
			);
		}

		// Get existing formulas
		const key = generateFormulasKey(userEmail, userPassword);
		const storedData = await kv.get<StoredFormulas>(key);

		if (!storedData || !storedData.formulas) {
			return NextResponse.json(
				{ error: 'No formulas found for this user' },
				{ status: 404 }
			);
		}

		// Find the formula to update
		const formulaIndex = storedData.formulas.findIndex(f => f.id === formulaId);
		if (formulaIndex === -1) {
			return NextResponse.json(
				{ error: 'Formula not found' },
				{ status: 404 }
			);
		}

		// Update the formula
		const updatedFormula: MIOFormula = {
			...storedData.formulas[formulaIndex],
			...updates,
			updatedAt: new Date().toISOString(),
		};

		storedData.formulas[formulaIndex] = updatedFormula;
		storedData.lastUpdated = new Date().toISOString();

		// Save to KV
		await kv.set(key, storedData);

		return NextResponse.json({
			message: 'Formula updated successfully',
			formula: updatedFormula,
		});

	} catch (error) {
		console.error('[API] Error updating formula:', error);
		return NextResponse.json(
			{ error: 'Failed to update formula' },
			{ status: 500 }
		);
	}
}

/**
 * DELETE - Remove formula from MIO and local storage
 */
export async function DELETE(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const userEmail = searchParams.get('userEmail');
		const userPassword = searchParams.get('userPassword');
		const formulaId = searchParams.get('id');

		if (!userEmail || !userPassword || !formulaId) {
			return NextResponse.json(
				{ error: 'User email, password, and formula ID are required' },
				{ status: 400 }
			);
		}

		// Get existing formulas
		const key = generateFormulasKey(userEmail, userPassword);
		const storedData = await kv.get<StoredFormulas>(key);

		if (!storedData || !storedData.formulas) {
			return NextResponse.json(
				{ error: 'No formulas found for this user' },
				{ status: 404 }
			);
		}

		// Find the formula to delete
		const formulaIndex = storedData.formulas.findIndex(f => f.id === formulaId);
		if (formulaIndex === -1) {
			return NextResponse.json(
				{ error: 'Formula not found' },
				{ status: 404 }
			);
		}

		const deletedFormula = storedData.formulas[formulaIndex];

		// Delete from MIO first
		try {
			const userCredentials = { userEmail, userPassword };
			const sessionInfo = await SessionResolver.getLatestMIOSessionForUser(userCredentials);

			if (sessionInfo && sessionInfo.internalId && deletedFormula.screenId) {
				console.log('[API] Deleting formula from MIO:', deletedFormula.screenId);
				await MIOService.deleteFormulaWithSession(sessionInfo.internalId, [deletedFormula.screenId]);
			} else {
				console.warn('[API] No valid session or screenId, skipping MIO deletion');
			}
		} catch (mioError) {
			console.error('[API] Error deleting from MIO:', mioError);
			// Continue with local deletion even if MIO delete fails
			// This allows cleanup of orphaned local entries
		}

		// Remove from local storage
		storedData.formulas = storedData.formulas.filter(f => f.id !== formulaId);
		storedData.totalCount = storedData.formulas.length;
		storedData.lastUpdated = new Date().toISOString();

		// Save to KV
		await kv.set(key, storedData);

		return NextResponse.json({
			message: 'Formula deleted successfully',
			deletedFormula,
			count: storedData.totalCount,
		});

	} catch (error) {
		console.error('[API] Error deleting formula:', error);
		return NextResponse.json(
			{ error: 'Failed to delete formula' },
			{ status: 500 }
		);
	}
}
