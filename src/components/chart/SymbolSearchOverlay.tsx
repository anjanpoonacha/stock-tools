/**
 * Symbol Search Overlay Component
 *
 * Displays a floating overlay for searching and switching symbols
 */

'use client';

import { useEffect } from 'react';
import { Search, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SymbolSearchOverlayProps {
	input: string;
	matchingSymbols: string[];
	currentSymbol: string;
	onSubmit: () => void;
	onCancel: () => void;
}

export function SymbolSearchOverlay({
	input,
	matchingSymbols,
	currentSymbol,
	onSubmit,
	onCancel,
}: SymbolSearchOverlayProps) {
	// Handle Enter key to submit
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Allow browser shortcuts to pass through (Ctrl+R, Cmd+R, Alt+F4, etc.)
			if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
				return;
			}

			// Allow Enter if there are matches OR if user typed something (to load arbitrary symbol)
			if (event.key === 'Enter' && (matchingSymbols.length > 0 || input)) {
				event.preventDefault();
				onSubmit();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				onCancel();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [matchingSymbols, input, onSubmit, onCancel]);

	const hasMatches = matchingSymbols.length > 0;

	return (
		<div className='fixed inset-0 z-50 pointer-events-none flex items-center justify-center'>
			<div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto'>
				<div className='bg-background/95 backdrop-blur-sm border-2 border-border rounded-lg shadow-lg p-4 min-w-[300px]'>
					{/* Header */}
					<div className='flex items-center justify-between mb-3'>
						<div className='flex items-center gap-2'>
							<Search className='h-4 w-4 text-muted-foreground' />
							<span className='text-xs text-muted-foreground font-medium'>
								Jump to Symbol
							</span>
						</div>
						{hasMatches && (
							<CheckCircle className='h-4 w-4 text-green-500' />
						)}
					</div>

					{/* Input Display */}
					<div className='mb-3'>
						<div
							className={cn(
								'text-xl font-mono font-bold text-center py-2 px-4 rounded border-2 transition-colors',
								hasMatches
									? 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400'
									: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
							)}
						>
							{input || '_'}
						</div>
					</div>

					{/* Matching Results */}
					{hasMatches ? (
						<div className='space-y-2'>
							<p className='text-xs text-green-600 dark:text-green-400 font-semibold text-center'>
								✓ Press Enter to jump
							</p>

							<div className='max-h-[200px] overflow-y-auto space-y-1'>
								{matchingSymbols.slice(0, 5).map((symbol, index) => (
									<div
										key={symbol}
										className={cn(
											'p-2 rounded text-sm font-mono transition-colors',
											index === 0
												? 'bg-primary/10 border border-primary/30 text-primary font-semibold'
												: 'bg-muted/50 text-muted-foreground',
											symbol === currentSymbol && 'ring-2 ring-blue-500/50'
										)}
									>
										{symbol}
										{index === 0 && (
											<span className='ml-2 text-xs text-primary'>← First match</span>
										)}
										{symbol === currentSymbol && (
											<span className='ml-2 text-xs text-blue-500'>● Current</span>
										)}
									</div>
								))}
								{matchingSymbols.length > 5 && (
									<p className='text-xs text-muted-foreground text-center pt-1'>
										+{matchingSymbols.length - 5} more matches
									</p>
								)}
							</div>
						</div>
					) : (
						<div className='text-center space-y-2'>
							<p className='text-xs text-yellow-600 dark:text-yellow-400'>
								No matching symbols in current list
							</p>
							{input && (
								<p className='text-xs text-green-600 dark:text-green-400 font-semibold'>
									✓ Press Enter to load this symbol
								</p>
							)}
							<p className='text-[10px] text-muted-foreground'>
								Try: <span className='font-mono font-semibold'>RELIANCE</span> or{' '}
								<span className='font-mono font-semibold'>NYSE:AAPL</span>
							</p>
						</div>
					)}

					{/* Hint */}
					<div className='mt-3 pt-3 border-t border-border'>
						<p className='text-[10px] text-muted-foreground text-center'>
							<span className='font-semibold'>Backspace</span> to delete •{' '}
							<span className='font-semibold'>ESC</span> to cancel
						</p>
						<p className='text-[10px] text-muted-foreground text-center mt-1'>
							Default prefix: <span className='font-mono font-semibold'>NSE:</span>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
