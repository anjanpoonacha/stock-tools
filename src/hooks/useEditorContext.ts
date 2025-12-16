// src/hooks/useEditorContext.ts
// React hook for detecting editor context from cursor position

import { useState, useCallback } from 'react';
import type { EditorContext, CriterionMetadata } from '@/types/mioCriteria';

/**
 * Hook for detecting word boundaries and editor context from cursor position
 * 
 * Triggers context updates when user types a word followed by:
 * - Space (' ')
 * - Comma (',')
 * - Opening parenthesis ('(')
 * 
 * @param allCriteria - Complete list of criteria (unused in hook, but may be used for validation)
 * @returns Context state and cursor change handler
 * 
 * @example
 * function FormulaEditor() {
 *   const { context, handleCursorChange } = useEditorContext(allCriteria);
 *   
 *   return (
 *     <>
 *       <MonacoEditor 
 *         onCursorChange={(content, pos) => handleCursorChange(content, pos)}
 *       />
 *       {context && <ReferencePanel word={context.currentWord} />}
 *     </>
 *   );
 * }
 */
export function useEditorContext(_allCriteria: CriterionMetadata[]) {
  const [context, setContext] = useState<EditorContext | null>(null);
  
  /**
   * Handler for Monaco editor cursor changes
   * Call this from Monaco's onDidChangeCursorPosition event
   */
  const handleCursorChange = useCallback((
    content: string,
    cursorPosition: number
  ) => {
    const detectedContext = detectWordBoundary(content, cursorPosition);
    setContext(detectedContext);
  }, []);
  
  return { context, handleCursorChange };
}

/**
 * Detect word boundary and extract context from cursor position
 * 
 * Algorithm:
 * 1. Check if previous character is a trigger (space, comma, or parenthesis)
 * 2. If yes, extract the word before the trigger
 * 3. Calculate line number
 * 4. Return context object
 * 
 * @param content - Full editor content
 * @param cursorPosition - Current cursor position (0-based index)
 * @returns Editor context or null if not at word boundary
 * 
 * @example
 * detectWordBoundary("sector ", 7)
 * // → { currentWord: 'sector', triggerChar: ' ', cursorPosition: 7, lineNumber: 1 }
 * 
 * @example
 * detectWordBoundary("sector(", 7)
 * // → { currentWord: 'sector', triggerChar: '(', cursorPosition: 7, lineNumber: 1 }
 * 
 * @example
 * detectWordBoundary("sec", 3)
 * // → null (no trigger character)
 * 
 * @example
 * detectWordBoundary("price > 100, volume ", 20)
 * // → { currentWord: 'volume', triggerChar: ' ', cursorPosition: 20, lineNumber: 1 }
 */
function detectWordBoundary(
  content: string,
  cursorPosition: number
): EditorContext | null {
  // Edge case: cursor at start of document
  if (cursorPosition === 0) {
    return null;
  }
  
  // Check if previous character is a trigger
  const prevChar = content[cursorPosition - 1];
  const triggerChars: string[] = [' ', ',', '('];
  
  if (!triggerChars.includes(prevChar)) {
    return null; // Not at a word boundary
  }
  
  // Extract text before the trigger character
  const textBeforeTrigger = content.substring(0, cursorPosition - 1);
  
  // Find the word immediately before the trigger
  // Match alphanumeric characters (and underscores) at the end of the text
  const wordMatch = textBeforeTrigger.match(/(\w+)$/);
  
  if (!wordMatch) {
    return null; // No word found before trigger
  }
  
  const currentWord = wordMatch[1];
  
  // Calculate line number
  const lineNumber = calculateLineNumber(content, cursorPosition);
  
  return {
    currentWord,
    triggerChar: prevChar as ' ' | ',' | '(',
    cursorPosition,
    lineNumber,
  };
}

/**
 * Calculate line number from cursor position
 * 
 * Line numbers are 1-based (first line is 1, not 0)
 * 
 * @param content - Full editor content
 * @param position - Cursor position (0-based index)
 * @returns Line number (1-based)
 * 
 * @example
 * calculateLineNumber("line1\nline2\nline3", 0)
 * // → 1
 * 
 * @example
 * calculateLineNumber("line1\nline2\nline3", 6)
 * // → 2 (first char of line2)
 * 
 * @example
 * calculateLineNumber("line1\nline2\nline3", 12)
 * // → 3 (first char of line3)
 */
function calculateLineNumber(content: string, position: number): number {
  const textBeforeCursor = content.substring(0, position);
  const lineBreaks = textBeforeCursor.split('\n');
  return lineBreaks.length;
}
