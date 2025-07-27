import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronUp, ClipboardCopy, ClipboardPaste, Download, Upload } from 'lucide-react';
import React, { useState } from 'react';

interface EditorWithClipboardProps {
	id: string;
	label: string;
	value: string;
	onChange?: (v: string) => void;
	readOnly?: boolean;
	placeholder?: string;
	showPaste?: boolean;
	showCopy?: boolean;
	showDownload?: boolean;
	onPaste?: (v: string) => void;
	onCopy?: () => void;
	onDownload?: () => void;
	disabledCopy?: boolean;
	disabledPaste?: boolean;
	className?: string;
	isCollapsed?: boolean;
}

export function EditorWithClipboard({
	id,
	label,
	value,
	onChange,
	readOnly,
	placeholder,
	showPaste,
	showCopy,
	showDownload,
	onPaste,
	onCopy,
	onDownload,
	disabledCopy,
	disabledPaste,
	className,
	isCollapsed,
}: EditorWithClipboardProps) {
	const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
	const [pasteStatus, setPasteStatus] = useState<'idle' | 'pasted'>('idle');
	const [fileStatus, setFileStatus] = useState<'idle' | 'loaded' | 'error'>('idle');
	const [collapsed, setCollapsed] = useState(isCollapsed ?? true);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const handlePaste = async () => {
		if (onPaste) {
			try {
				const text = await navigator.clipboard.readText();
				onPaste(text);
				setPasteStatus('pasted');
				setTimeout(() => setPasteStatus('idle'), 1200);
			} catch (e) {
				console.error('Failed to read clipboard', e);
				setPasteStatus('idle');
			}
		}
	};

	const handleCopy = async () => {
		if (onCopy) {
			onCopy();
		} else {
			try {
				await navigator.clipboard.writeText(value);
				setCopyStatus('copied');
				setTimeout(() => setCopyStatus('idle'), 1200);
			} catch {}
		}
	};

	const handleFileButtonClick = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			if (onPaste) onPaste(text);
			setFileStatus('loaded');
			setTimeout(() => setFileStatus('idle'), 1200);
		} catch {
			setFileStatus('error');
			setTimeout(() => setFileStatus('idle'), 1200);
		}
		e.target.value = '';
	};

	return (
		<div className='w-full'>
			<div className='flex items-center gap-2 mb-1'>
				<Label htmlFor={id} className='flex items-center gap-2 mb-0'>
					{label}
				</Label>
				<Button
					type='button'
					variant='ghost'
					size='icon'
					aria-label={collapsed ? 'Expand' : 'Collapse'}
					onClick={() => setCollapsed((c) => !c)}
				>
					{collapsed ? <ChevronDown className='w-5 h-5' /> : <ChevronUp className='w-5 h-5' />}
				</Button>
				{showPaste && (
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									type='button'
									variant='ghost'
									size='icon'
									aria-label='Paste from clipboard'
									onClick={handlePaste}
									disabled={disabledPaste}
								>
									<ClipboardPaste className='w-5 h-5' />
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>{pasteStatus === 'pasted' ? 'Pasted!' : 'Paste from clipboard'}</TooltipContent>
					</Tooltip>
				)}
				{/* File picker button only for input */}
				{showPaste && (
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									type='button'
									variant='ghost'
									size='icon'
									aria-label='Import from file'
									onClick={handleFileButtonClick}
									disabled={disabledPaste}
								>
									<Upload className='w-5 h-5' />
									<input
										type='file'
										accept='.txt,.csv,.tsv,.json,text/plain'
										ref={fileInputRef}
										onChange={handleFileChange}
										style={{ display: 'none' }}
									/>
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>
							{fileStatus === 'loaded' ? 'Loaded!' : fileStatus === 'error' ? 'Error reading file' : 'Import from file'}
						</TooltipContent>
					</Tooltip>
				)}
				{showCopy && (
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									type='button'
									variant='ghost'
									size='icon'
									aria-label='Copy to clipboard'
									onClick={handleCopy}
									disabled={disabledCopy || !value}
								>
									<ClipboardCopy className='w-5 h-5' />
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>{copyStatus === 'copied' ? 'Copied!' : 'Copy to clipboard'}</TooltipContent>
					</Tooltip>
				)}
				{/* Download button only for output */}
				{showDownload && (
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									type='button'
									variant='ghost'
									size='icon'
									aria-label='Download as file'
									onClick={onDownload}
									disabled={!value}
								>
									<Download className='w-5 h-5' />
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>Download as file</TooltipContent>
					</Tooltip>
				)}
			</div>
			{!collapsed && (
				<Textarea
					id={id}
					value={value}
					onChange={onChange ? (e) => onChange(e.target.value) : undefined}
					readOnly={readOnly}
					placeholder={placeholder}
					className={className}
				/>
			)}
		</div>
	);
}
