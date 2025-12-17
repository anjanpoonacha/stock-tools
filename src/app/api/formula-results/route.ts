import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { MIOFormula, StoredFormulas } from '@/types/formula';
import type { FormulaResultsResponse, Stock } from '@/types/stock';
import { enrichStockMetadata } from '@/lib/utils';

/**
 * Generate KV key for user formulas
 */
function generateFormulasKey(userEmail: string, userPassword: string): string {
	return `mio-formulas:${userEmail.toLowerCase().trim()}:${userPassword}`;
}

/**
 * POST - Fetch stock results for a formula
 * Calls the formula's apiUrl to get the list of stocks
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, formulaId } = body;

		// Validate required fields
		if (!userEmail || !userPassword || !formulaId) {
			return NextResponse.json(
				{ error: 'User email, password, and formulaId are required' },
				{ status: 400 }
			);
		}

		// Fetch formula from storage
		const key = generateFormulasKey(userEmail, userPassword);
		const storedData = await kv.get<StoredFormulas>(key);

		if (!storedData) {
			return NextResponse.json(
				{ error: 'No formulas found. Please extract formulas first.' },
				{ status: 404 }
			);
		}

		// Find the formula by ID
		const formula = storedData.formulas.find((f: MIOFormula) => f.id === formulaId);

		if (!formula) {
			return NextResponse.json(
				{ error: 'Formula not found' },
				{ status: 404 }
			);
		}

		if (!formula.apiUrl) {
			return NextResponse.json(
				{ error: 'Formula does not have an API URL. Please re-extract formulas.' },
				{ status: 400 }
			);
		}

		// Call the MIO API to get stock results
		console.log(`[API] Fetching stock results from: ${formula.apiUrl}`);

		const response = await fetch(formula.apiUrl);

		if (!response.ok) {
			throw new Error(`MIO API returned ${response.status}`);
		}

		const data = await response.text();

		console.log(`[API] Raw response from MIO (first 200 chars): ${data.substring(0, 200)}...`);

		// Parse the pipe-delimited format
		// Format: SYMBOL.NS|PRICE|DATE TIME
		// Example: APLAPOLLO.NS|1764.50|12/17/2025 15:45
		const stocks: Stock[] = parseMIOResponse(data);

		return NextResponse.json({
			success: true,
			formulaName: formula.name,
			stocks: stocks,
		} as FormulaResultsResponse);

	} catch (error) {
		console.error('[API] Error fetching formula results:', error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Failed to fetch formula results',
				success: false,
				formulaName: '',
				stocks: [],
			} as FormulaResultsResponse,
			{ status: 500 }
		);
	}
}

/**
 * Parse MIO API pipe-delimited response to Stock[] format
 * Format: SYMBOL.NS|PRICE|DATE TIME
 * Example: APLAPOLLO.NS|1764.50|12/17/2025 15:45
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
		// or INFY.NS → NSE:INFY
		let symbol = rawSymbol;
		if (rawSymbol.endsWith('.NS')) {
			const baseSymbol = rawSymbol.replace('.NS', '');
			symbol = `NSE:${baseSymbol}`;
		}

		// Parse price
		const price = parseFloat(priceStr);

		// Extract stock name from symbol (basic - just use symbol for now)
		const name = rawSymbol.replace('.NS', '');

		// Enrich with sector/industry data from static map
		const enrichedData = enrichStockMetadata(symbol);

		stocks.push({
			symbol,
			name,
			price: isNaN(price) ? undefined : price,
			sector: enrichedData.sector,
			industry: enrichedData.industry,
		});
	}

	console.log(`[API] Parsed ${stocks.length} stocks from MIO response`);
	return stocks;
}
