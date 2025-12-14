'use client';

// src/components/formula-editor/MonacoFormulaEditor.tsx

import { Editor, type Monaco } from '@monaco-editor/react';
import { useRef, useEffect, useState } from 'react';
import type { editor, IDisposable } from 'monaco-editor';
import { ensureLanguageRegistered } from './monacoLanguageConfig';
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
	const monacoRef = useRef<Monaco | null>(null);
	const completionDisposableRef = useRef<IDisposable | null>(null);
	const { resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// Handle SSR - only render Monaco after client-side mount
	useEffect(() => {
		setMounted(true);
	}, []);

	// Determine theme based on resolved theme (actual applied theme)
	// Default to light if theme not resolved yet
	const monacoTheme = resolvedTheme === 'dark'
		? 'mio-formula-dark'
		: 'mio-formula-light';

	console.log('[MonacoFormulaEditor] Theme:', {
		resolvedTheme,
		monacoTheme,
		mounted,
	});

	// Update editor theme when resolved theme changes
	useEffect(() => {
		if (editorRef.current && mounted) {
			editorRef.current.updateOptions({
				theme: monacoTheme,
			});
		}
	}, [monacoTheme, mounted]);

	// Cleanup disposables on unmount
	useEffect(() => {
		return () => {
			if (completionDisposableRef.current) {
				completionDisposableRef.current.dispose();
				completionDisposableRef.current = null;
			}
		};
	}, []);

	// Re-register provider when indicators or samples change
	useEffect(() => {
		// Only re-register if Monaco is already loaded
		// Re-register even with empty data to ensure consistency
		if (monacoRef.current) {
			console.log('[MonacoFormulaEditor] Data changed, re-registering provider', {
				indicators: indicators.length,
				samples: samples.length,
				monacoReady: !!monacoRef.current,
			});

			// Dispose old provider
			if (completionDisposableRef.current) {
				completionDisposableRef.current.dispose();
			}

			// Register with updated data
			completionDisposableRef.current = registerFormulaCompletionProvider(
				monacoRef.current,
				indicators,
				samples
			);

			console.log('[MonacoFormulaEditor] ✓ Re-registered autocomplete provider successfully');
		} else {
			console.log('[MonacoFormulaEditor] ✗ Cannot re-register - Monaco not ready');
		}
	}, [indicators, samples]);

	function handleEditorDidMount(editor: editor.IStandaloneCodeEditor, monaco: Monaco) {
		editorRef.current = editor;
		monacoRef.current = monaco;

		console.log('[MonacoFormulaEditor] Editor mounted, applying theme:', monacoTheme);

		// Register custom language once (singleton pattern)
		ensureLanguageRegistered(monaco);

		// Explicitly set theme after language registration
		monaco.editor.setTheme(monacoTheme);

		// ALWAYS register autocomplete provider, even if data is empty initially
		// The provider will be updated when data loads via useEffect
		if (completionDisposableRef.current) {
			completionDisposableRef.current.dispose();
		}

		// Register new provider with current data (may be empty, will update later)
		completionDisposableRef.current = registerFormulaCompletionProvider(
			monaco,
			indicators,
			samples
		);

		console.log('[MonacoFormulaEditor] Registered provider on mount with', {
			indicators: indicators.length,
			samples: samples.length,
		});

		// Focus editor
		editor.focus();
	}

	function handleEditorChange(value: string | undefined) {
		onChange(value || '');
	}

	// Don't render Monaco until client-side to avoid SSR issues
	if (!mounted) {
		return (
			<div className="border rounded-md overflow-hidden flex items-center justify-center" style={{ height }}>
				<p className="text-muted-foreground">Loading editor...</p>
			</div>
		);
	}

	return (
		<div className="border rounded-md overflow-hidden">
			<Editor
				height={height}
				defaultLanguage="mio-formula"
				language="mio-formula"
				value={value}
				onChange={handleEditorChange}
				theme={monacoTheme}
				loading={
					<div className="flex items-center justify-center" style={{ height }}>
						<p className="text-muted-foreground">Initializing editor...</p>
					</div>
				}
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
					// Enable hover tooltips
					hover: {
						enabled: true,
						delay: 300,
						sticky: true,
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
