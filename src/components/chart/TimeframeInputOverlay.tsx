/**
 * Timeframe Input Overlay Component
 *
 * Displays a floating overlay showing the timeframe input buffer
 * with real-time validation and visual feedback.
 */

'use client';

import { useEffect } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimeframeInputOverlayProps {
	input: string;
	isValid: boolean;
	suggestions?: string[];
	onSubmit: () => void;
	onCancel: () => void;
	activeChartIndex: number;
	dualViewMode?: boolean;
}

export function TimeframeInputOverlay({
	input,
	isValid,
	onSubmit,
	onCancel,
	activeChartIndex,
	dualViewMode = false,
}: TimeframeInputOverlayProps) {
	// Handle Enter key to submit
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Allow browser shortcuts to pass through (Ctrl+R, Cmd+R, Alt+F4, etc.)
			if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
				return;
			}

			if (event.key === 'Enter' && isValid && input) {
				event.preventDefault();
				onSubmit();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				onCancel();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [input, isValid, onSubmit, onCancel]);

	// Position based on active chart
	// In single view or chart 0: center-left
	// In dual view chart 1: center-right
	const positionClass = dualViewMode && activeChartIndex === 1
		? 'right-1/4'
		: 'left-1/4';

	return (
		<div className='fixed inset-0 z-50 pointer-events-none flex items-center justify-center'>
			<div
				className={cn(
					'fixed top-1/2 -translate-y-1/2 pointer-events-auto',
					positionClass
				)}
			>
				<div className='bg-background/95 backdrop-blur-sm border-2 border-border rounded-lg shadow-lg p-4 min-w-[200px]'>
					{/* Header */}
					<div className='flex items-center justify-between mb-3'>
						<span className='text-xs text-muted-foreground font-medium'>
							Change Timeframe
						</span>
						{isValid ? (
							<Check className='h-4 w-4 text-green-500' />
						) : (
							<AlertTriangle className='h-4 w-4 text-yellow-500' />
						)}
					</div>

					{/* Input Display */}
					<div className='mb-3'>
						<div
							className={cn(
								'text-2xl font-mono font-bold text-center py-2 px-4 rounded border-2 transition-colors',
								isValid
									? 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400'
									: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
							)}
						>
							{input || '_'}
						</div>
					</div>

					{/* Validation Message */}
					<div className='text-center'>
						{isValid ? (
							<p className='text-xs text-green-600 dark:text-green-400 font-semibold'>
								✓ Press Enter to apply
							</p>
						) : (
							<p className='text-xs text-yellow-600 dark:text-yellow-400'>
								Continue typing...
							</p>
						)}
					</div>

					{/* Format Examples */}
					{!isValid && input.length === 0 && (
						<div className='mt-3 pt-3 border-t border-border'>
							<p className='text-[10px] text-muted-foreground mb-2 font-medium'>Examples:</p>
							<div className='grid grid-cols-2 gap-1 text-[10px]'>
								<span className='text-muted-foreground'><span className='font-mono font-semibold'>1</span> = 1 min</span>
								<span className='text-muted-foreground'><span className='font-mono font-semibold'>5</span> = 5 min</span>
								<span className='text-muted-foreground'><span className='font-mono font-semibold'>1s</span> = 1 sec</span>
								<span className='text-muted-foreground'><span className='font-mono font-semibold'>1M</span> = 1 month</span>
								<span className='text-muted-foreground'><span className='font-mono font-semibold'>1d</span> = 1 day</span>
								<span className='text-muted-foreground'><span className='font-mono font-semibold'>1w</span> = 1 week</span>
							</div>
						</div>
					)}

					{/* Hint */}
					<div className='mt-3 pt-3 border-t border-border text-center'>
						<p className='text-[10px] text-muted-foreground'>
							<span className='font-semibold'>Backspace</span> to delete • <span className='font-semibold'>ESC</span> to cancel
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
