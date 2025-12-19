// src/app/api/mio-formulas/data/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { FormulaDataManager } from '@/lib/mio/formulaData';
import { SessionResolver } from '@/lib/SessionResolver';

/**
 * GET - Fetch autocomplete data for formula editor
 * Returns indicators, samples, and documentation for Monaco IntelliSense
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

		// Resolve MIO session for the user
		const userCredentials = { userEmail, userPassword };
		const sessionInfo = await SessionResolver.getLatestMIOSessionForUser(userCredentials);

		if (!sessionInfo) {
			return NextResponse.json(
				{
					error: 'No valid MIO session found. Please capture your MIO session using the browser extension.',
					sessionError: true,
				},
				{ status: 401 }
			);
		}

		// Fetch all autocomplete data
		const sessionKeyValue = { key: sessionInfo.key, value: sessionInfo.value };
		const data = await FormulaDataManager.fetchAllData(sessionKeyValue);

		return NextResponse.json({
			success: true,
			indicators: data.indicators,
			samples: data.samples,
			documentation: data.documentation,
			timestamp: new Date().toISOString(),
		});

	} catch (error) {

		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Failed to fetch formula data',
			},
			{ status: 500 }
		);
	}
}
