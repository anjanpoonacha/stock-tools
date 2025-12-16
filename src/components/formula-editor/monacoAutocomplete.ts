// src/components/formula-editor/monacoAutocomplete.ts

import type { Monaco } from '@monaco-editor/react';
import type { FormulaIndicator, FormulaSample } from '@/types/formulaEditor';
import type { IDisposable } from 'monaco-editor';

/**
 * Register autocomplete (IntelliSense) provider for MIO formulas
 * Provides suggestions based on indicators and sample formulas
 *
 * @returns Disposable that should be disposed when provider is no longer needed
 */
export function registerFormulaCompletionProvider(
	monaco: Monaco,
	indicators: FormulaIndicator[],
	samples: FormulaSample[]
): IDisposable {
	// Register completion provider
	const completionDisposable = monaco.languages.registerCompletionItemProvider('mio-formula', {
		triggerCharacters: ['(', ',', ' '],

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		provideCompletionItems: (model: any, position: any) => {
			const word = model.getWordUntilPosition(position);
			const range = {
				startLineNumber: position.lineNumber,
				endLineNumber: position.lineNumber,
				startColumn: word.startColumn,
				endColumn: word.endColumn,
			};

			// Build suggestions from indicators
			const indicatorSuggestions = indicators.map((indicator) => {
				// Create snippet with placeholders for parameters
				// E.g., "ADVOL(20)" -> "ADVOL(${1:period})"
				let insertSnippet = indicator.name;

				if (indicator.syntax.includes('(')) {
					// Has parameters
					const match = indicator.syntax.match(/\(([^)]+)\)/);
					if (match && match[1]) {
						// Parse parameters and create placeholders
						const params = match[1].split(',').map((p, i) => {
							const paramName = p.trim();
							return `\${${i + 1}:${paramName}}`;
						}).join(', ');
						insertSnippet = `${indicator.name}(${params})`;
					} else {
						// Has parentheses but no clear params
						insertSnippet = `${indicator.name}(\${1})`;
					}
				}

				return {
					label: indicator.name,
					kind: monaco.languages.CompletionItemKind.Function,
					insertText: insertSnippet,
					insertTextFormat: 4, // Snippet format (CompletionItemInsertTextFormat enum value)
					documentation: {
						value: `**${indicator.name}**\n\n${indicator.description}\n\n**Syntax:** \`${indicator.syntax}\`${indicator.example ? `\n\n**Example:** \`${indicator.example}\`` : ''}`,
					},
					detail: indicator.syntax, // Show syntax as detail
					range,
					sortText: `a_${indicator.name}`, // Sort indicators first
				};
			});

			// Build suggestions from samples
			const sampleSuggestions = samples.map((sample, index) => ({
				label: sample.name,
				kind: monaco.languages.CompletionItemKind.Snippet,
				documentation: {
					value: `**${sample.name}**\n\n${sample.description || ''}\n\n\`\`\`\n${sample.formula}\n\`\`\``,
				},
				detail: sample.category || 'sample formula',
				insertText: sample.formula,
				range,
				sortText: `b_${index.toString().padStart(4, '0')}`, // Sort samples after indicators
			}));

			// Add common operators and keywords
			const keywordSuggestions = [
				{
					label: 'and',
					kind: monaco.languages.CompletionItemKind.Keyword,
					documentation: 'Logical AND operator',
					insertText: 'and',
					range,
					sortText: 'c_and',
				},
				{
					label: 'or',
					kind: monaco.languages.CompletionItemKind.Keyword,
					documentation: 'Logical OR operator',
					insertText: 'or',
					range,
					sortText: 'c_or',
				},
				{
					label: 'not',
					kind: monaco.languages.CompletionItemKind.Keyword,
					documentation: 'Logical NOT operator',
					insertText: 'not',
					range,
					sortText: 'c_not',
				},
			];

			return {
				suggestions: [...indicatorSuggestions, ...sampleSuggestions, ...keywordSuggestions],
			};
		},
	});

	// Register hover provider for documentation tooltips
	const hoverDisposable = monaco.languages.registerHoverProvider('mio-formula', {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		provideHover: (model: any, position: any) => {
			const word = model.getWordAtPosition(position);
			console.log('[HoverProvider] Hover triggered!');
			console.log('[HoverProvider] Word at position:', word?.word);
			console.log('[HoverProvider] Available indicators:', indicators.length);
			console.log('[HoverProvider] Available samples:', samples.length);

			if (!word) {
				console.log('[HoverProvider] No word found at position');
				return null;
			}

			// Find matching indicator
			const indicator = indicators.find(
				(i) => i.name.toLowerCase() === word.word.toLowerCase()
			);

			if (!indicator) {
				console.log('[HoverProvider] Indicator not found for:', word.word);
			} else {
				console.log('[HoverProvider] Found indicator:', indicator.name);
			}

			if (indicator) {
				console.log('[HoverProvider] Returning hover for:', indicator.name);

				// Build markdown content
				let markdownContent = `**${indicator.name}**\n\n${indicator.description}\n\n**Syntax:** \`${indicator.syntax}\``;

				if (indicator.parameters && indicator.parameters.length > 0) {
					markdownContent += `\n\n**Parameters:** ${indicator.parameters.join(', ')}`;
				}

				if (indicator.example) {
					markdownContent += `\n\n**Example:** \`${indicator.example}\``;
				}

				return {
					range: new monaco.Range(
						position.lineNumber,
						word.startColumn,
						position.lineNumber,
						word.endColumn
					),
					contents: [
						{ value: markdownContent }
					],
				};
			}

			// Find matching sample - use exact match or starts with, not contains
			const sample = samples.find((s) => {
				const lowerName = s.name.toLowerCase();
				const lowerWord = word.word.toLowerCase();
				return lowerName === lowerWord || lowerName.startsWith(lowerWord);
			});

			if (sample) {
				console.log('[HoverProvider] Returning hover for sample:', sample.name);

				let sampleContent = `**${sample.name}**\n\n`;
				if (sample.description) {
					// Limit description length
					const desc = sample.description.length > 200
						? sample.description.substring(0, 200) + '...'
						: sample.description;
					sampleContent += `${desc}\n\n`;
				}

				// Limit formula length
				const formula = sample.formula.length > 300
					? sample.formula.substring(0, 300) + '...'
					: sample.formula;
				sampleContent += `\`\`\`\n${formula}\n\`\`\``;

				return {
					range: new monaco.Range(
						position.lineNumber,
						word.startColumn,
						position.lineNumber,
						word.endColumn
					),
					contents: [
						{ value: sampleContent }
					],
				};
			}

			return null;
		},
	});

	// Register signature help provider (for function parameters)
	const signatureDisposable = monaco.languages.registerSignatureHelpProvider('mio-formula', {
		signatureHelpTriggerCharacters: ['(', ','],
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		provideSignatureHelp: (model: any, position: any) => {
			// Get text before cursor
			const textUntilPosition = model.getValueInRange({
				startLineNumber: 1,
				startColumn: 1,
				endLineNumber: position.lineNumber,
				endColumn: position.column,
			});

			// Find function name before opening parenthesis
			const match = textUntilPosition.match(/([A-Z][A-Z0-9_]*)\s*\([^)]*$/);
			if (!match) return null;

			const functionName = match[1];
			const indicator = indicators.find(
				(i) => i.name.toLowerCase() === functionName.toLowerCase()
			);

			if (!indicator) return null;

			return {
				value: {
					signatures: [
						{
							label: indicator.syntax,
							documentation: indicator.description,
							parameters: indicator.parameters
								? indicator.parameters.map((param) => ({
										label: param,
										documentation: '',
								  }))
								: [],
						},
					],
					activeSignature: 0,
					activeParameter: 0,
				},
				dispose: () => {},
			};
		},
	});

	// Return a combined disposable that disposes all three providers
	return {
		dispose: () => {
			completionDisposable.dispose();
			hoverDisposable.dispose();
			signatureDisposable.dispose();
		},
	};
}
