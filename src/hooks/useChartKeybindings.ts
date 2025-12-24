/**
 * Centralized Chart Keybindings Hook
 *
 * Manages all keyboard shortcuts for chart view including:
 * - Navigation (Up/Down arrows)
 * - Timeframe input (starts with number)
 * - Symbol search (starts with letter)
 * - Mode-based detection to handle symbols like "5PAISA" and "BSOFT"
 */

import { useEffect, useRef } from 'react';
import keybindingsConfig from '@/config/keybindings.json';

export interface UseChartKeybindingsOptions {
	onNavigatePrev: () => void;
	onNavigateNext: () => void;
	onTimeframeInput: (char: string) => void;
	onTimeframeBackspace?: () => void;
	onSymbolInput?: (char: string) => void;
	onSymbolBackspace?: () => void;
	onSymbolSubmit?: () => void; // Submit symbol search (Enter key)
	onTimeframeSubmit?: () => void; // Submit timeframe (Enter key)
	onTabKeyPress?: () => void; // Cycle through charts in dual view
	onWatchlistSearchOpen?: () => void; // Triggered by ;
	onWatchlistQuickAdd?: () => void; // Triggered by Option+W
	onStockRemove?: () => void; // Triggered by Option+D
	// Pass the current mode from parent to determine which overlay is active
	inputMode: 'none' | 'timeframe' | 'symbol' | 'watchlist';
	activeChartIndex?: number;
	enabled?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UseChartKeybindingsReturn {
	// No state needed in hook anymore - parent manages it
}

/**
 * Check if the active element is an input field
 */
function isInputElement(element: Element | null): boolean {
	if (!element) return false;
	const tagName = element.tagName;
	return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

/**
 * Check if any modifier key is pressed (except Shift)
 * These indicate browser shortcuts that should not be intercepted
 */
function hasModifierKey(event: KeyboardEvent): boolean {
	return event.ctrlKey || event.metaKey || event.altKey;
}

/**
 * Check if character is a digit (0-9)
 */
function isDigit(char: string): boolean {
	return /^[0-9]$/i.test(char);
}

/**
 * Check if character is a letter or colon
 */
function isLetterOrColon(char: string): boolean {
	return /^[a-z:]$/i.test(char);
}

/**
 * Check if character is valid for timeframe continuation (d, w, m, s)
 */
function isTimeframeSuffix(char: string): boolean {
	return /^[dwms]$/i.test(char);
}

export function useChartKeybindings(options: UseChartKeybindingsOptions): UseChartKeybindingsReturn {
	const {
		onNavigatePrev,
		onNavigateNext,
		onTimeframeInput,
		onTimeframeBackspace,
		onSymbolInput,
		onSymbolBackspace,
		onSymbolSubmit,
		onTimeframeSubmit,
		onTabKeyPress,
		onWatchlistSearchOpen,
		onWatchlistQuickAdd,
		onStockRemove,
		inputMode,
		enabled = true,
	} = options;

	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Clear timeout on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!enabled) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			// Skip if focused on input elements
			if (isInputElement(document.activeElement)) {
				return;
			}

			// Check for Quick add (Option+W / Alt+W) first - before blocking modifiers
			// On Mac: Option+W produces special character, so we check event.code instead of event.key
			const isQuickAddShortcut = 
				event.code === 'KeyW' && 
				event.altKey && 
				!event.ctrlKey && 
				!event.metaKey &&
				!event.shiftKey;

			if (isQuickAddShortcut && inputMode === 'none' && onWatchlistQuickAdd) {
				event.preventDefault();
				onWatchlistQuickAdd();
				return;
			}

			// Check for Quick remove (Option+D / Alt+D) - before blocking modifiers
			const isQuickRemoveShortcut = 
				event.code === 'KeyD' && 
				event.altKey && 
				!event.ctrlKey && 
				!event.metaKey &&
				!event.shiftKey;

			if (isQuickRemoveShortcut && inputMode === 'none' && onStockRemove) {
				event.preventDefault();
				onStockRemove();
				return;
			}

			// Allow browser shortcuts to pass through (Ctrl+R, Cmd+R, Alt+F4, etc.)
			// Also allow Shift+ combinations for text selection
			if (hasModifierKey(event) || event.shiftKey) {
				return;
			}

			// Navigation shortcuts
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				onNavigatePrev();
				return;
			}

			if (event.key === 'ArrowDown') {
				event.preventDefault();
				onNavigateNext();
				return;
			}

			// Tab key - cycle through charts in dual view (only when not in input mode)
			if (event.key === 'Tab' && inputMode === 'none' && onTabKeyPress) {
				event.preventDefault();
				onTabKeyPress();
				return;
			}

			// Enter key - submit current input mode
			if (event.key === 'Enter') {
				event.preventDefault();
				if (inputMode === 'symbol' && onSymbolSubmit) {
					onSymbolSubmit();
				} else if (inputMode === 'timeframe' && onTimeframeSubmit) {
					onTimeframeSubmit();
				}
				return;
			}

			// Backspace - context aware based on current mode
			if (event.key === 'Backspace') {
				event.preventDefault();
				if (inputMode === 'symbol' && onSymbolBackspace) {
					onSymbolBackspace();
				} else if (inputMode === 'timeframe' && onTimeframeBackspace) {
					onTimeframeBackspace();
				}
				return;
			}

			// Escape key - handled by parent overlays
			if (event.key === 'Escape') {
				// Don't preventDefault - let overlays handle it
				return;
			}

			// Watchlist search (;) - only in 'none' mode
			if (event.key === keybindingsConfig.chart.watchlist.openSearch 
				&& inputMode === 'none' 
				&& onWatchlistSearchOpen) {
				event.preventDefault();
				onWatchlistSearchOpen();
				return;
			}

			// When in watchlist mode, don't intercept keys (let dialog handle)
			if (inputMode === 'watchlist') {
				return;
			}

			// Mode-based input detection
			if (inputMode === 'none') {
				// First character determines mode
				if (isDigit(event.key)) {
					// Starts with number → Timeframe mode (tentative)
					event.preventDefault();
					onTimeframeInput(event.key);
					return;
				} else if (isLetterOrColon(event.key) && onSymbolInput) {
					// Starts with letter → Symbol mode
					event.preventDefault();
					onSymbolInput(event.key.toUpperCase());
					return;
				}
			} else if (inputMode === 'timeframe') {
				// In timeframe mode - accept digits and suffixes (d, w, m, s)
				if (isDigit(event.key) || isTimeframeSuffix(event.key)) {
					event.preventDefault();
					onTimeframeInput(event.key.toLowerCase());
					return;
				} else if (isLetterOrColon(event.key) && onSymbolInput) {
					// Letter typed in timeframe mode → Switch to symbol mode
					// This handles cases like "5PAISA" where user types "5" then "P"
					event.preventDefault();
					onSymbolInput(event.key.toUpperCase());
					return;
				}
			} else if (inputMode === 'symbol') {
				// In symbol mode - accept letters, digits, and colon
				if (isLetterOrColon(event.key) && onSymbolInput) {
					event.preventDefault();
					onSymbolInput(event.key.toUpperCase());
					return;
				} else if (isDigit(event.key) && onSymbolInput) {
					// Allow digits in symbol mode (for stocks like 5PAISA)
					event.preventDefault();
					onSymbolInput(event.key);
					return;
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [
		enabled,
		onNavigatePrev,
		onNavigateNext,
		onTimeframeInput,
		onTimeframeBackspace,
		onSymbolInput,
		onSymbolBackspace,
		onSymbolSubmit,
		onTimeframeSubmit,
		onTabKeyPress,
		onWatchlistSearchOpen,
		onWatchlistQuickAdd,
		onStockRemove,
		inputMode,
	]);

	return {};
}
