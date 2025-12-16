// src/lib/mio/formulaData.ts

import type {
	FormulaIndicator,
	FormulaSample,
	FormulaDocumentation,
	FormulaAutocompleteData,
} from '@/types/formulaEditor';
import type { SessionKeyValue } from './types';
import { ErrorHandler, Platform, ErrorLogger } from '../errors';
import { parseIndicatorsHtml, parseSamplesHtml, parseDocsHtml } from './parsers';

/**
 * MIO Documentation URLs for formula data
 */
export const MIO_FORMULA_DATA_URLS = {
	INDICATOR_LIST: 'https://www.marketinout.com/stock-screener/ajax/ajax_get_indicator_list.php',
	SAMPLES: 'https://www.marketinout.com/stock-screener/ajax_get_samples.php',
	WHATS_NEW: 'https://www.marketinout.com/home/whats-new.php',
} as const;

/**
 * FormulaDataManager - Fetches and parses autocomplete data from MIO
 */
export class FormulaDataManager {
	/**
	 * Fetch and parse indicator list
	 */
	static async fetchIndicators(sessionKeyValue: SessionKeyValue): Promise<FormulaIndicator[]> {
		try {
			const res = await fetch(MIO_FORMULA_DATA_URLS.INDICATOR_LIST, {
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			if (!res.ok) {
				throw new Error(`Failed to fetch indicators: ${res.status} ${res.statusText}`);
			}

			const html = await res.text();
			return this.parseIndicatorsHtml(html);
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'fetchIndicators',
				undefined,
				MIO_FORMULA_DATA_URLS.INDICATOR_LIST
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Fetch and parse sample formulas
	 */
	static async fetchSamples(sessionKeyValue: SessionKeyValue): Promise<FormulaSample[]> {
		try {
			const res = await fetch(MIO_FORMULA_DATA_URLS.SAMPLES, {
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			if (!res.ok) {
				throw new Error(`Failed to fetch samples: ${res.status} ${res.statusText}`);
			}

			const html = await res.text();
			return this.parseSamplesHtml(html);
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'fetchSamples',
				undefined,
				MIO_FORMULA_DATA_URLS.SAMPLES
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Fetch and parse documentation
	 */
	static async fetchDocumentation(sessionKeyValue: SessionKeyValue): Promise<FormulaDocumentation[]> {
		try {
			const res = await fetch(MIO_FORMULA_DATA_URLS.WHATS_NEW, {
				headers: {
					Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
				},
			});

			if (!res.ok) {
				throw new Error(`Failed to fetch documentation: ${res.status} ${res.statusText}`);
			}

			const html = await res.text();
			return this.parseDocsHtml(html);
		} catch (error) {
			const sessionError = ErrorHandler.parseError(
				error,
				Platform.MARKETINOUT,
				'fetchDocumentation',
				undefined,
				MIO_FORMULA_DATA_URLS.WHATS_NEW
			);
			ErrorLogger.logError(sessionError);
			throw sessionError;
		}
	}

	/**
	 * Fetch all autocomplete data at once
	 */
	static async fetchAllData(sessionKeyValue: SessionKeyValue): Promise<FormulaAutocompleteData> {
		// Fetch all data in parallel
		const [indicators, samples, documentation] = await Promise.allSettled([
			this.fetchIndicators(sessionKeyValue),
			this.fetchSamples(sessionKeyValue),
			this.fetchDocumentation(sessionKeyValue),
		]);

		return {
			indicators: indicators.status === 'fulfilled' ? indicators.value : [],
			samples: samples.status === 'fulfilled' ? samples.value : [],
			documentation: documentation.status === 'fulfilled' ? documentation.value : [],
		};
	}

	/**
	 * Parse indicators from HTML response
	 */
	static parseIndicatorsHtml(html: string): FormulaIndicator[] {
		return parseIndicatorsHtml(html);
	}

	/**
	 * Parse sample formulas from HTML response
	 */
	static parseSamplesHtml(html: string): FormulaSample[] {
		return parseSamplesHtml(html);
	}

	/**
	 * Parse documentation from HTML response
	 */
	static parseDocsHtml(html: string): FormulaDocumentation[] {
		return parseDocsHtml(html);
	}
}
