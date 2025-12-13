import { z } from 'zod';

/**
 * Single formula item from the formula list page
 */
export interface FormulaListItem {
	name: string;
	pageUrl: string;
	screenId: string;
}

/**
 * Complete MIO formula with extracted API URL
 */
export interface MIOFormula {
	id: string; // Unique ID: formula_{timestamp}_{random}
	name: string; // Formula name from table
	pageUrl: string; // Formula detail page URL
	apiUrl: string | null; // Web API URL (null if extraction pending/failed)
	screenId: string; // Extracted from page URL
	createdAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp
	extractionStatus: 'pending' | 'success' | 'failed';
	extractionError?: string; // Error message if extraction failed
}

/**
 * Result of extracting all formulas
 */
export interface FormulaExtractionResult {
	success: boolean;
	formulas: MIOFormula[];
	totalExtracted: number;
	errors: Array<{
		formulaName: string;
		error: string;
	}>;
}

/**
 * Stored formulas structure in Vercel KV
 */
export interface StoredFormulas {
	formulas: MIOFormula[];
	lastUpdated: string;
	totalCount: number;
}

// Zod schemas for validation

export const FormulaListItemSchema = z.object({
	name: z.string().min(1, 'Formula name is required'),
	pageUrl: z.string().url('Invalid page URL'),
	screenId: z.string().min(1, 'Screen ID is required'),
});

export const MIOFormulaSchema = z.object({
	id: z.string().min(1, 'Formula ID is required'),
	name: z.string().min(1, 'Formula name is required'),
	pageUrl: z.string().url('Invalid page URL'),
	apiUrl: z.string().url('Invalid API URL').nullable(),
	screenId: z.string().min(1, 'Screen ID is required'),
	createdAt: z.string().datetime('Invalid created timestamp'),
	updatedAt: z.string().datetime('Invalid updated timestamp'),
	extractionStatus: z.enum(['pending', 'success', 'failed']),
	extractionError: z.string().optional(),
});

export const StoredFormulasSchema = z.object({
	formulas: z.array(MIOFormulaSchema),
	lastUpdated: z.string().datetime('Invalid last updated timestamp'),
	totalCount: z.number().int().nonnegative(),
});

export const FormulaExtractionResultSchema = z.object({
	success: z.boolean(),
	formulas: z.array(MIOFormulaSchema),
	totalExtracted: z.number().int().nonnegative(),
	errors: z.array(
		z.object({
			formulaName: z.string(),
			error: z.string(),
		})
	),
});
