// src/lib/mio/formulaData.ts

import * as cheerio from 'cheerio';
import type {
	FormulaIndicator,
	FormulaSample,
	FormulaDocumentation,
	FormulaAutocompleteData,
} from '@/types/formulaEditor';
import type { SessionKeyValue } from './types';
import { ErrorHandler, Platform, ErrorLogger } from '../errors';

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
	 * The structure will depend on what MIO returns
	 */
	static parseIndicatorsHtml(html: string): FormulaIndicator[] {
		const $ = cheerio.load(html);
		const indicators: FormulaIndicator[] = [];

		// Strategy 1: Look for structured data in tables or lists
		$('table tr, ul li, .indicator-item').each((_, element) => {
			const $el = $(element);

			// Try to extract name, syntax, description
			// This is a best-guess approach - we'll need to adjust based on actual HTML
			const name = $el.find('.name, .indicator-name, td:first-child').first().text().trim();
			const syntax = $el.find('.syntax, .indicator-syntax, td:nth-child(2)').first().text().trim();
			const description = $el.find('.description, .indicator-desc, td:last-child').first().text().trim();

			if (name && name.length > 0) {
				indicators.push({
					name,
					syntax: syntax || name + '()',
					description: description || name,
					category: 'indicator',
				});
			}
		});

		// Strategy 2: Look for function names in code blocks or pre tags
		if (indicators.length === 0) {
			$('code, pre').each((_, element) => {
				const text = $(element).text();
				// Match function-like patterns: WORD() or WORD(params)
				const matches = text.matchAll(/([A-Z][A-Z0-9_]*)\s*\([^)]*\)/g);
				for (const match of matches) {
					const fullSyntax = match[0].trim();
					const name = match[1];

					if (!indicators.find(i => i.name === name)) {
						indicators.push({
							name,
							syntax: fullSyntax,
							description: `${name} indicator`,
							category: 'indicator',
						});
					}
				}
			});
		}

		// Strategy 3: Extract from plain text if no structured data found
		if (indicators.length === 0) {
			const text = $.text();
			const lines = text.split('\n');

			for (const line of lines) {
				// Look for patterns like "ADVOL(20)" or "EXCH(NSE)"
				const matches = line.matchAll(/([A-Z][A-Z0-9_]*)\s*\(([^)]*)\)/g);
				for (const match of matches) {
					const fullSyntax = match[0].trim();
					const name = match[1];
					const params = match[2];

					if (!indicators.find(i => i.name === name)) {
						indicators.push({
							name,
							syntax: fullSyntax,
							description: `${name} - ${line.substring(0, 100).trim()}`,
							category: 'indicator',
							parameters: params ? [params] : undefined,
						});
					}
				}
			}
		}

		console.log(`[FormulaDataManager] Parsed ${indicators.length} indicators`);
		return indicators;
	}

	/**
	 * Parse sample formulas from HTML response
	 */
	static parseSamplesHtml(html: string): FormulaSample[] {
		const $ = cheerio.load(html);
		const samples: FormulaSample[] = [];

		// Strategy 1: Look for structured data
		$('table tr, .sample-item, .formula-sample').each((_, element) => {
			const $el = $(element);

			const name = $el.find('.name, .sample-name, td:first-child').first().text().trim();
			const formula = $el.find('.formula, .sample-formula, td:nth-child(2)').first().text().trim();
			const description = $el.find('.description, .sample-desc, td:last-child').first().text().trim();

			if (formula && formula.length > 0) {
				samples.push({
					name: name || 'Sample formula',
					formula,
					description,
					category: 'sample',
				});
			}
		});

		// Strategy 2: Look for code blocks
		if (samples.length === 0) {
			$('code, pre').each((_, element) => {
				const formula = $(element).text().trim();

				if (formula.length > 5 && formula.length < 500) {
					// Get preceding text as name/description
					const prevText = $(element).prev().text().trim() || $(element).parent().prev().text().trim();

					samples.push({
						name: prevText.substring(0, 50) || 'Sample formula',
						formula,
						description: prevText,
						category: 'sample',
					});
				}
			});
		}

		console.log(`[FormulaDataManager] Parsed ${samples.length} samples`);
		return samples;
	}

	/**
	 * Parse documentation from HTML response
	 */
	static parseDocsHtml(html: string): FormulaDocumentation[] {
		const $ = cheerio.load(html);
		const docs: FormulaDocumentation[] = [];

		// Look for documentation sections (headings + content)
		$('h1, h2, h3').each((_, element) => {
			const $heading = $(element);
			const topic = $heading.text().trim();

			// Get following content until next heading
			const $content = $heading.nextUntil('h1, h2, h3');
			const content = $content.text().trim();

			if (topic && content && content.length > 20) {
				docs.push({
					topic,
					content: content.substring(0, 500), // Limit content length
					url: MIO_FORMULA_DATA_URLS.WHATS_NEW,
				});
			}
		});

		console.log(`[FormulaDataManager] Parsed ${docs.length} documentation sections`);
		return docs;
	}
}
