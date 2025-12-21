/**
 * SWR Fetcher for Formula Results
 * 
 * This module provides:
 * - Key generator for formula results with user credentials
 * - POST fetcher for formula results API
 * - Type-safe response handling
 */

import type { Stock } from '@/types/stock';

/**
 * Formula results response type
 */
export interface FormulaResultsResponse {
  stocks: Stock[];
  formulaName: string;
}

/**
 * Formula results key parameters
 */
export interface FormulaResultsKeyParams {
  formulaId: string;
  userEmail: string;
  userPassword: string;
}

/**
 * Generate SWR key for formula results
 * Returns null if any parameter is missing (conditional fetching)
 */
export function formulaResultsKey(
  params: Partial<FormulaResultsKeyParams>
): [string, FormulaResultsKeyParams] | null {
  const { formulaId, userEmail, userPassword } = params;
  
  // Conditional fetching: return null if any param is missing
  if (!formulaId || !userEmail || !userPassword) {
    return null;
  }

  return [
    'formula-results',
    { formulaId, userEmail, userPassword }
  ];
}

/**
 * Fetcher for formula results
 * Makes POST request to /api/formula-results
 */
export async function formulaResultsFetcher(
  _key: string,
  params: FormulaResultsKeyParams
): Promise<FormulaResultsResponse> {
  const { formulaId, userEmail, userPassword } = params;

  const response = await fetch('/api/formula-results', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmail,
      userPassword,
      formulaId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.details || errorData.error || `HTTP ${response.status}`;
    const error = new Error(message);
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
}
