import { useState, useEffect } from 'react';
import type { MIOFormula } from '@/types/formula';

export interface UseFormulasResult {
	formulas: MIOFormula[];
	loading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
}

export function useFormulas(): UseFormulasResult {
	const [formulas, setFormulas] = useState<MIOFormula[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadFormulas = async () => {
		setLoading(true);
		setError(null);

		try {
			const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');
			if (!storedCredentials) {
				setFormulas([]);
				setLoading(false);
				return;
			}

			const credentials = JSON.parse(storedCredentials);
			const params = new URLSearchParams({
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
			});

			const res = await fetch(`/api/mio-formulas?${params}`);

			if (!res.ok) {
				throw new Error('Failed to load formulas');
			}

			const data = await res.json();

			// Filter only successfully extracted formulas with valid API URLs
			const validFormulas = data.formulas.filter(
				(f: MIOFormula) => f.extractionStatus === 'success' && f.apiUrl
			);

			setFormulas(validFormulas);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load formulas';
			setError(errorMessage);
			setFormulas([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadFormulas();
	}, []);

	return {
		formulas,
		loading,
		error,
		refresh: loadFormulas,
	};
}
