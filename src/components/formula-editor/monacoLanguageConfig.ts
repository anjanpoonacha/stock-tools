// src/components/formula-editor/monacoLanguageConfig.ts

import type { Monaco } from '@monaco-editor/react';

// Singleton flag to prevent duplicate registration
let languageRegistered = false;

/**
 * Ensure custom MIO formula language is registered with Monaco Editor
 * Uses singleton pattern to prevent duplicate registration
 * Provides syntax highlighting for MIO formula syntax
 */
export function ensureLanguageRegistered(monaco: Monaco): void {
	// Already registered, skip
	if (languageRegistered) {
		return;
	}

	// Register the language
	monaco.languages.register({ id: 'mio-formula' });

	// Set Monaco Tokens Provider for syntax highlighting
	monaco.languages.setMonarchTokensProvider('mio-formula', {
		tokenizer: {
			root: [
				// Operators
				[/[+\-*/=<>!&|]/, 'operator'],

				// Comparison operators
				[/(and|or|not)\b/i, 'keyword'],

				// Numbers (integers and decimals)
				[/\b\d+\.?\d*\b/, 'number'],

				// Functions (uppercase words followed by parenthesis)
				[/\b[A-Z][A-Z0-9_]*(?=\()/, 'function'],

				// Parentheses and brackets
				[/[()]/, 'delimiter.parenthesis'],
				[/[\[\]]/, 'delimiter.bracket'],

				// Commas
				[/,/, 'delimiter.comma'],

				// Strings (single and double quotes)
				[/"([^"\\]|\\.)*$/, 'string.invalid'], // Unclosed string
				[/'([^'\\]|\\.)*$/, 'string.invalid'], // Unclosed string
				[/"/, 'string', '@stringDouble'],
				[/'/, 'string', '@stringSingle'],

				// Comments (if MIO supports them)
				[/\/\/.*$/, 'comment'],
				[/\/\*/, 'comment', '@comment'],

				// Identifiers
				[/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
			],

			stringDouble: [
				[/[^\\"]+/, 'string'],
				[/\\./, 'string.escape'],
				[/"/, 'string', '@pop'],
			],

			stringSingle: [
				[/[^\\']+/, 'string'],
				[/\\./, 'string.escape'],
				[/'/, 'string', '@pop'],
			],

			comment: [
				[/[^\/*]+/, 'comment'],
				[/\*\//, 'comment', '@pop'],
				[/[\/*]/, 'comment'],
			],
		},
	});

	// Set theme with custom colors
	monaco.editor.defineTheme('mio-formula-dark', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'function', foreground: 'DCDCAA', fontStyle: 'bold' },
			{ token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
			{ token: 'operator', foreground: 'D4D4D4' },
			{ token: 'number', foreground: 'B5CEA8' },
			{ token: 'string', foreground: 'CE9178' },
			{ token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
			{ token: 'identifier', foreground: '9CDCFE' },
		],
		colors: {},
	});

	monaco.editor.defineTheme('mio-formula-light', {
		base: 'vs',
		inherit: true,
		rules: [
			{ token: 'function', foreground: '795E26', fontStyle: 'bold' },
			{ token: 'keyword', foreground: 'AF00DB', fontStyle: 'bold' },
			{ token: 'operator', foreground: '000000' },
			{ token: 'number', foreground: '098658' },
			{ token: 'string', foreground: 'A31515' },
			{ token: 'comment', foreground: '008000', fontStyle: 'italic' },
			{ token: 'identifier', foreground: '001080' },
		],
		colors: {},
	});

	// Mark as registered
	languageRegistered = true;
}
