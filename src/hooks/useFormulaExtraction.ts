import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import type { MIOFormula } from '@/types/formula';

interface ExtractionError {
	formulaName: string;
	error: string;
}

interface UseFormulaExtractionReturn {
	formulas: MIOFormula[];
	loading: boolean;
	extracting: boolean;
	error: string | null;
	extractionErrors: ExtractionError[];
	loadFormulas: () => Promise<void>;
	extractFormulas: () => Promise<void>;
	deleteFormula: (formulaId: string) => Promise<void>;
	copyToClipboard: (text: string, label: string) => Promise<void>;
	copyAllApiUrls: () => Promise<void>;
	exportFormulas: () => void;
}

const getCredentials = () => {
	const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');
	if (!storedCredentials) {
		throw new Error('Authentication required. Please log in first.');
	}

	try {
		return JSON.parse(storedCredentials);
	} catch {
		throw new Error('Invalid authentication data. Please log in again.');
	}
};

export const useFormulaExtraction = (): UseFormulaExtractionReturn => {
	const [formulas, setFormulas] = useState<MIOFormula[]>([]);
	const [loading, setLoading] = useState(false);
	const [extracting, setExtracting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [extractionErrors, setExtractionErrors] = useState<ExtractionError[]>([]);
	const showToast = useToast();

	const loadFormulas = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			const credentials = getCredentials();

			const params = new URLSearchParams({
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
			});

			const res = await fetch(`/api/mio-formulas?${params}`);

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || 'Failed to load formulas');
			}

			const data = await res.json();
			setFormulas(data.formulas || []);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load formulas';
			setError(errorMessage);
			showToast(errorMessage, 'error');
		} finally {
			setLoading(false);
		}
	}, [showToast]);

	const extractFormulas = useCallback(async () => {
		setExtracting(true);
		setError(null);
		setExtractionErrors([]);

		try {
			const credentials = getCredentials();

			const res = await fetch('/api/mio-formulas', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userEmail: credentials.userEmail,
					userPassword: credentials.userPassword,
					forceRefresh: true,
				}),
			});

			if (!res.ok) {
				const errorData = await res.json();
				if (errorData.sessionError) {
					throw new Error(
						'No valid MIO session found. Please capture your MIO session using the browser extension.'
					);
				}
				throw new Error(errorData.error || 'Failed to extract formulas');
			}

			const data = await res.json();
			setFormulas(data.formulas || []);
			setExtractionErrors(data.errors || []);

			if (data.success) {
				showToast(
					`Successfully extracted ${data.extracted} formula${data.extracted !== 1 ? 's' : ''}!`,
					'success'
				);
			} else {
				showToast(
					`Extracted ${data.extracted} formula${data.extracted !== 1 ? 's' : ''}, but ${data.failed} failed`,
					'error'
				);
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to extract formulas';
			setError(errorMessage);
			showToast(errorMessage, 'error');
		} finally {
			setExtracting(false);
		}
	}, [showToast]);

	const deleteFormula = useCallback(
		async (formulaId: string) => {
			try {
				const credentials = getCredentials();

				const params = new URLSearchParams({
					userEmail: credentials.userEmail,
					userPassword: credentials.userPassword,
					id: formulaId,
				});

				const res = await fetch(`/api/mio-formulas?${params}`, {
					method: 'DELETE',
				});

				if (!res.ok) {
					const errorData = await res.json();
					throw new Error(errorData.error || 'Failed to delete formula');
				}

				setFormulas(prevFormulas => prevFormulas.filter(f => f.id !== formulaId));
				showToast('Formula deleted successfully', 'success');
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Failed to delete formula';
				showToast(errorMessage, 'error');
			}
		},
		[showToast]
	);

	const copyToClipboard = useCallback(
		async (text: string, label: string) => {
			try {
				await navigator.clipboard.writeText(text);
				showToast(`${label} copied to clipboard`, 'success');
			} catch {
				showToast('Failed to copy to clipboard', 'error');
			}
		},
		[showToast]
	);

	const copyAllApiUrls = useCallback(async () => {
		const apiUrls = formulas.filter(f => f.apiUrl).map(f => f.apiUrl);
		if (apiUrls.length === 0) {
			showToast('No API URLs to copy', 'info');
			return;
		}

		const text = apiUrls.join('\n');
		await copyToClipboard(text, 'All API URLs');
	}, [formulas, showToast, copyToClipboard]);

	const exportFormulas = useCallback(() => {
		try {
			const data = JSON.stringify(formulas, null, 2);
			const blob = new Blob([data], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `mio-formulas-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			showToast('Formulas exported successfully', 'success');
		} catch {
			showToast('Failed to export formulas', 'error');
		}
	}, [formulas, showToast]);

	// Load formulas on mount
	useEffect(() => {
		loadFormulas();
	}, [loadFormulas]);

	return {
		formulas,
		loading,
		extracting,
		error,
		extractionErrors,
		loadFormulas,
		extractFormulas,
		deleteFormula,
		copyToClipboard,
		copyAllApiUrls,
		exportFormulas,
	};
};
