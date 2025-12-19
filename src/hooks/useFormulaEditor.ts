// src/hooks/useFormulaEditor.ts

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { FormulaCacheManager } from '@/lib/mio/formulaCache';
import type {
	FormulaEditorMode,
	FormulaFormData,
	FormulaIndicator,
	FormulaSample,
} from '@/types/formulaEditor';

interface UseFormulaEditorReturn {
	formData: FormulaFormData;
	setFormData: (data: FormulaFormData) => void;
	indicators: FormulaIndicator[];
	samples: FormulaSample[];
	loading: boolean;
	saving: boolean;
	error: string | null;
	handleSubmit: (e: React.FormEvent) => Promise<void>;
}

import { requireCredentials } from '@/lib/auth/authUtils';

const getCredentials = () => {
	return requireCredentials();
};

/**
 * Hook for managing formula editor state
 * Handles loading autocomplete data, form state, and submission
 */
export function useFormulaEditor(
	mode: FormulaEditorMode,
	onSuccess: () => void
): UseFormulaEditorReturn {
	const [formData, setFormData] = useState<FormulaFormData>({
		name: mode.formula?.name || '',
		formula: mode.formula?.formulaText || '',
		categoryId: 'price_action',
		groupId: 'stock',
		eventId: 'trend_up',
		screenId: mode.formula?.screenId,
	});

	const [indicators, setIndicators] = useState<FormulaIndicator[]>([]);
	const [samples, setSamples] = useState<FormulaSample[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const showToast = useToast();

	// Reset form data when mode changes (e.g., create → edit → create)
	useEffect(() => {
		setFormData({
			name: mode.formula?.name || '',
			formula: mode.formula?.formulaText || '',
			categoryId: 'price_action',
			groupId: 'stock',
			eventId: 'trend_up',
			screenId: mode.formula?.screenId,
		});
	}, [mode]);

	// Load autocomplete data on mount
	useEffect(() => {
		loadAutocompleteData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadAutocompleteData = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);

			// Try to get from cache first
			const cachedData = FormulaCacheManager.get();

			if (cachedData && !FormulaCacheManager.isExpired()) {
				setIndicators(cachedData.indicators);
				setSamples(cachedData.samples);
				setLoading(false);
				return;
			}

			// Fetch fresh data from API
			const credentials = getCredentials();
			const params = new URLSearchParams({
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
			});

			const res = await fetch(`/api/mio-formulas/data?${params}`);

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || 'Failed to load autocomplete data');
			}

			const data = await res.json();
			setIndicators(data.indicators || []);
			setSamples(data.samples || []);

			// Cache the data
			FormulaCacheManager.set({
				indicators: data.indicators || [],
				samples: data.samples || [],
				documentation: data.documentation || [],
			});
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load autocomplete data';
			setError(errorMessage);
			showToast(errorMessage, 'error');

			// Load static fallback data if available (for now, use empty arrays)
			setIndicators([]);
			setSamples([]);
		} finally {
			setLoading(false);
		}
	}, [showToast]);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setSaving(true);
			setError(null);

			try {
				const credentials = getCredentials();
				const endpoint =
					mode.mode === 'create'
						? '/api/mio-formulas/create'
						: '/api/mio-formulas/edit';
				const method = mode.mode === 'create' ? 'POST' : 'PUT';

				const res = await fetch(endpoint, {
					method,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...formData,
						userEmail: credentials.userEmail,
						userPassword: credentials.userPassword,
					}),
				});

				if (!res.ok) {
					const errorData = await res.json();
					throw new Error(errorData.error || `Failed to ${mode.mode} formula`);
				}

				await res.json();

				showToast(
					mode.mode === 'create'
						? 'Formula created successfully!'
						: 'Formula updated successfully!',
					'success'
				);

				// Call success callback to refresh parent list and close dialog
				onSuccess();
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : `Failed to ${mode.mode} formula`;
				setError(errorMessage);
				showToast(errorMessage, 'error');
			} finally {
				setSaving(false);
			}
		},
		[formData, mode, onSuccess, showToast]
	);

	return {
		formData,
		setFormData,
		indicators,
		samples,
		loading,
		saving,
		error,
		handleSubmit,
	};
}
