// src/types/formulaEditor.ts

import type { MIOFormula } from './formula';

/**
 * Formula indicator/function definition from MIO documentation
 */
export interface FormulaIndicator {
	name: string;
	description: string;
	syntax: string;
	category?: string;
	parameters?: string[];
	example?: string;
}

/**
 * Sample formula from MIO
 */
export interface FormulaSample {
	name: string;
	formula: string;
	description?: string;
	category?: string;
}

/**
 * Documentation section from MIO
 */
export interface FormulaDocumentation {
	topic: string;
	content: string;
	url?: string;
}

/**
 * Combined autocomplete data
 */
export interface FormulaAutocompleteData {
	indicators: FormulaIndicator[];
	samples: FormulaSample[];
	documentation: FormulaDocumentation[];
}

/**
 * Cached formula data with metadata
 */
export interface CachedFormulaData extends FormulaAutocompleteData {
	timestamp: string;
	version: string;
}

/**
 * Editor mode (create or edit)
 */
export interface FormulaEditorMode {
	mode: 'create' | 'edit';
	formula?: MIOFormula; // Only populated for edit mode
}

/**
 * Form data for formula creation/editing
 */
export interface FormulaFormData {
	name: string;
	formula: string;
	categoryId?: string;
	groupId?: string;
	eventId?: string;
	screenId?: string; // Only for edit mode
}

/**
 * API response from create/edit operations
 */
export interface FormulaApiResponse {
	success: boolean;
	screenId: string;
	redirectUrl: string;
	formula?: MIOFormula;
	error?: string;
}
