/**
 * SWR fetcher and key functions for MIO formulas
 */
import type { MIOFormula } from '@/types/formula';

export interface FormulasResponse {
	formulas: MIOFormula[];
	lastUpdated: string;
	totalCount: number;
}

/**
 * Generate SWR key for formulas endpoint
 * Returns null if credentials are missing (prevents fetching)
 */
export function formulaKey(userEmail?: string, userPassword?: string): string | null {
	if (!userEmail || !userPassword) {
		return null;
	}
	return `/api/mio-formulas?userEmail=${userEmail}&userPassword=${userPassword}`;
}

/**
 * Fetcher function for formulas API
 */
export async function formulaFetcher(url: string): Promise<FormulasResponse> {
	const res = await fetch(url);
	
	if (!res.ok) {
		const error = new Error('Failed to load formulas');
		throw error;
	}
	
	const data = await res.json();
	return data;
}
