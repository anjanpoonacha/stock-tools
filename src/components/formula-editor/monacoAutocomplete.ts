// src/components/formula-editor/monacoAutocomplete.ts

import type { Monaco } from '@monaco-editor/react';
import type { FormulaIndicator, FormulaSample } from '@/types/formulaEditor';

/**
 * Register autocomplete (IntelliSense) provider for MIO formulas
 * Provides suggestions based on indicators and sample formulas
 */
export function registerFormulaCompletionProvider(
	monaco: Monaco,
	indicators: FormulaIndicator[],
	samples: FormulaSample[]
): void {
	// Register completion provider
	monaco.languages.registerCompletionItemProvider('mio-formula', {
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
			const indicatorSuggestions = indicators.map((indicator) => ({
				label: indicator.name,
				kind: monaco.languages.CompletionItemKind.Function,
				documentation: {
					value: `**${indicator.name}**\n\n${indicator.description}\n\n**Syntax:** \`${indicator.syntax}\`${indicator.example ? `\n\n**Example:** \`${indicator.example}\`` : ''}`,
				},
				detail: indicator.category || 'indicator',
				insertText: indicator.syntax,
				range,
				sortText: `a_${indicator.name}`, // Sort indicators first
			}));

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
	monaco.languages.registerHoverProvider('mio-formula', {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		provideHover: (model: any, position: any) => {
			const word = model.getWordAtPosition(position);
			if (!word) return null;

			// Find matching indicator
			const indicator = indicators.find(
				(i) => i.name.toLowerCase() === word.word.toLowerCase()
			);

			if (indicator) {
				return {
					range: new monaco.Range(
						position.lineNumber,
						word.startColumn,
						position.lineNumber,
						word.endColumn
					),
					contents: [
						{ value: `**${indicator.name}**` },
						{ value: indicator.description },
						{ value: `**Syntax:** \`${indicator.syntax}\`` },
						...(indicator.parameters
							? [{ value: `**Parameters:** ${indicator.parameters.join(', ')}` }]
							: []),
						...(indicator.example ? [{ value: `**Example:** \`${indicator.example}\`` }] : []),
					],
				};
			}

			// Find matching sample
			const sample = samples.find((s) => s.name.toLowerCase().includes(word.word.toLowerCase()));
			if (sample) {
				return {
					range: new monaco.Range(
						position.lineNumber,
						word.startColumn,
						position.lineNumber,
						word.endColumn
					),
					contents: [
						{ value: `**${sample.name}**` },
						...(sample.description ? [{ value: sample.description }] : []),
						{ value: `\`\`\`\n${sample.formula}\n\`\`\`` },
					],
				};
			}

			return null;
		},
	});

	// Register signature help provider (for function parameters)
	monaco.languages.registerSignatureHelpProvider('mio-formula', {
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
}
