/**
 * Formula Results API - Non-Streaming
 * 
 * Returns only the formula results (stock list) without chart data.
 * Chart data is fetched on-demand when user opens chart view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { MIOFormula, StoredFormulas } from '@/types/formula';
import type { Stock } from '@/types/stock';
import { enrichStockMetadata } from '@/lib/utils';

/**
 * Generate KV key for user formulas
 */
function generateFormulasKey(userEmail: string, userPassword: string): string {
	return `mio-formulas:${userEmail.toLowerCase().trim()}:${userPassword}`;
}

/**
 * Parse MIO API pipe-delimited response to Stock[] format
 */
function parseMIOResponse(data: string): Stock[] {
	const lines = data.trim().split('\n');
	const stocks: Stock[] = [];

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;

		const parts = trimmedLine.split('|');
		if (parts.length < 2) continue;

		const rawSymbol = parts[0].trim();
		const priceStr = parts[1].trim();

		// Convert symbol format: APLAPOLLO.NS → NSE:APLAPOLLO
		let symbol = rawSymbol;
		if (rawSymbol.endsWith('.NS')) {
			const baseSymbol = rawSymbol.replace('.NS', '');
			symbol = `NSE:${baseSymbol}`;
		}

		const price = parseFloat(priceStr);
		const name = rawSymbol.replace('.NS', '');
		const enrichedData = enrichStockMetadata(symbol);

		stocks.push({
			symbol,
			name,
			price: isNaN(price) ? undefined : price,
			sector: enrichedData.sector,
			industry: enrichedData.industry,
		});
	}

	return stocks;
}

/**
 * POST - Get formula results (no chart data)
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, formulaId } = body;

		if (!userEmail || !userPassword || !formulaId) {
			return NextResponse.json({
				error: 'Missing required fields',
				details: 'userEmail, userPassword, and formulaId are required'
			}, { status: 400 });
		}

		// 1. Get user's formulas from KV
		const formulasKey = generateFormulasKey(userEmail, userPassword);
		const storedFormulas = await kv.get<StoredFormulas>(formulasKey);

		if (!storedFormulas?.formulas) {
			return NextResponse.json({
				error: 'No formulas found',
				details: 'User has no saved formulas'
			}, { status: 404 });
		}

		// 2. Find the requested formula
		const formula = storedFormulas.formulas.find((f: MIOFormula) => f.id === formulaId);

		if (!formula) {
			return NextResponse.json({
				error: 'Formula not found',
				details: `Formula with ID ${formulaId} not found`
			}, { status: 404 });
		}

		// 3. Check if formula has apiUrl
		if (!formula.apiUrl) {
			return NextResponse.json({
				error: 'Formula API URL not available',
				details: 'Formula API URL extraction is pending or failed'
			}, { status: 400 });
		}

		// 4. Fetch results from MIO API
		const mioResponse = await fetch(formula.apiUrl, {
			method: 'GET',
		});

		if (!mioResponse.ok) {

			return NextResponse.json({
				error: 'Failed to fetch formula results',
				details: `MIO API returned status ${mioResponse.status}`
			}, { status: 502 });
		}

		const mioData = await mioResponse.text();
		const stocks = parseMIOResponse(mioData);

		return NextResponse.json({
			success: true,
			formulaName: formula.name,
			stocks,
			stockCount: stocks.length
		});

	} catch (error) {

		return NextResponse.json({
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}
