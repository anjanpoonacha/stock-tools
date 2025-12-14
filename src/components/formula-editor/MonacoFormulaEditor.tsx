'use client';

// src/components/formula-editor/MonacoFormulaEditor.tsx

import { Editor, type Monaco } from '@monaco-editor/react';
import { useRef } from 'react';
import type { editor } from 'monaco-editor';
import { registerFormulaLanguage } from './monacoLanguageConfig';
import { registerFormulaCompletionProvider } from './monacoAutocomplete';
import type { FormulaIndicator, FormulaSample } from '@/types/formulaEditor';
import { useTheme } from 'next-themes';

interface MonacoFormulaEditorProps {
	value: string;
	onChange: (value: string) => void;
	indicators: FormulaIndicator[];
	samples: FormulaSample[];
	readOnly?: boolean;
	height?: string;
}

/**
 * Monaco Formula Editor Component
 * Provides VS Code-style editing experience for MIO formulas
 */
export function MonacoFormulaEditor({
	value,
	onChange,
	indicators,
	samples,
	readOnly = false,
	height = '400px',
}: MonacoFormulaEditorProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const { theme } = useTheme();

	function handleEditorDidMount(editor: editor.IStandaloneCodeEditor, monaco: Monaco) {
		editorRef.current = editor;

		// Register custom language and autocomplete
		registerFormulaLanguage(monaco);
		registerFormulaCompletionProvider(monaco, indicators, samples);

		// Focus editor
		editor.focus();
	}

	function handleEditorChange(value: string | undefined) {
		onChange(value || '');
	}

	// Determine theme based on next-themes
	const monacoTheme = theme === 'dark' ? 'mio-formula-dark' : 'mio-formula-light';

	return (
		<div className="border rounded-md overflow-hidden">
			<Editor
				height={height}
				defaultLanguage="mio-formula"
				value={value}
				onChange={handleEditorChange}
				theme={monacoTheme}
				options={{
					readOnly,
					minimap: { enabled: false },
					fontSize: 14,
					lineNumbers: 'on',
					scrollBeyondLastLine: false,
					automaticLayout: true,
					wordWrap: 'on',
					wrappingIndent: 'indent',
					tabSize: 2,
					insertSpaces: true,
					suggestOnTriggerCharacters: true,
					acceptSuggestionOnCommitCharacter: true,
					acceptSuggestionOnEnter: 'on',
					quickSuggestions: {
						other: true,
						comments: false,
						strings: false,
					},
					parameterHints: {
						enabled: true,
					},
					suggest: {
						showWords: false,
					},
					// Bracket matching
					matchBrackets: 'always',
					autoClosingBrackets: 'always',
					autoClosingQuotes: 'always',
				}}
				onMount={handleEditorDidMount}
			/>
		</div>
	);
}
