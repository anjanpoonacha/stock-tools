import { useMemo } from 'react';
import useSWR from 'swr';
import { formulaListKey, formulaListFetcher } from '@/lib/swr';
import type { MIOFormula } from '@/types/formula';

export interface UseFormulasResult {
	formulas: MIOFormula[];
	loading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
}

export function useFormulas(): UseFormulasResult {
	// Fetch formulas with SWR (formulaListKey handles credential check automatically)
	const { data, error: swrError, isLoading, mutate } = useSWR(
		formulaListKey(),
		formulaListFetcher,
		{
			revalidateOnFocus: false,
			revalidateOnReconnect: true,
		}
	);
	
	// Filter only successfully extracted formulas with valid API URLs
	const validFormulas = useMemo(() => {
		if (!data?.formulas) return [];
		return data.formulas.filter(
			(f: MIOFormula) => f.extractionStatus === 'success' && f.apiUrl
		);
	}, [data]);
	
	// Format error message
	const errorMessage = swrError 
		? (swrError instanceof Error ? swrError.message : 'Failed to load formulas')
		: null;
	
	// Refresh function that triggers revalidation
	const refresh = async () => {
		await mutate();
	};
	
	return {
		formulas: validFormulas,
		loading: isLoading,
		error: errorMessage,
		refresh,
	};
}
