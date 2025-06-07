import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ClipboardActionsProps {
	value: string;
	onPaste: (text: string) => void;
	disabledCopy?: boolean;
	disabledPaste?: boolean;
}

export function ClipboardActions({ value, onPaste, disabledCopy, disabledPaste }: ClipboardActionsProps) {
	const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
	const [pasteStatus, setPasteStatus] = useState<'idle' | 'pasted'>('idle');

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopyStatus('copied');
			setTimeout(() => setCopyStatus('idle'), 1200);
		} catch {}
	};

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			onPaste(text);
			setPasteStatus('pasted');
			setTimeout(() => setPasteStatus('idle'), 1200);
		} catch {}
	};

	return (
		<div className='flex gap-2 mt-2'>
			<Button
				variant='outline'
				size='sm'
				onClick={handlePaste}
				disabled={disabledPaste}
				aria-label='Paste from clipboard'
			>
				{pasteStatus === 'pasted' ? 'Pasted!' : 'Paste'}
			</Button>
			<Button variant='outline' size='sm' onClick={handleCopy} disabled={disabledCopy} aria-label='Copy to clipboard'>
				{copyStatus === 'copied' ? 'Copied!' : 'Copy'}
			</Button>
		</div>
	);
}
