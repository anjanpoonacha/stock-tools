'use client';

// Main UI for Stock Format Converter
// Mobile-first, code-editor-like input, delimiter/prefix options, conversion logic

import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { downloadTextFile } from '@/lib/utils';
import { useState } from 'react';
import { RegroupBar } from '@/components/RegroupBar';

const DELIMITERS = [',', ' ', '\n', ';', '|'];

type Direction = 'mio-to-tv' | 'tv-to-mio';

function parseInput(input: string, delimiter: string) {
	if (delimiter === '\n') {
		return input
			.split(/\r?\n/)
			.map((s) => s.trim())
			.filter(Boolean);
	}
	return input
		.split(delimiter)
		.map((s) => s.trim())
		.filter(Boolean);
}

function convertSymbols(symbols: string[], direction: Direction) {
	if (direction === 'mio-to-tv') {
		// TCS.NS -> NSE:TCS (default to NSE:)
		return symbols.map((sym) => {
			const base = sym.replace(/\.[A-Z]+$/, '');
			return 'NSE:' + base;
		});
	} else {
		// TradingView (NSE:TCS, BSE:TCS) -> MarketInOut (TCS.NS, TCS.BS)
		return symbols.map((sym) => {
			if (sym.startsWith('NSE:')) return sym.slice(4) + '.NS';
			if (sym.startsWith('BSE:')) return sym.slice(4) + '.BS';
			return sym; // fallback
		});
	}
}

export default function StockFormatConverter() {
	const [input, setInput] = useState('');
	const [delimiter, setDelimiter] = useState(',');
	const [output, setOutput] = useState('');
	const [direction, setDirection] = useState<Direction>('mio-to-tv');

	const handleConvert = () => {
		const symbols = parseInput(input, delimiter);
		const converted = convertSymbols(symbols, direction);
		setOutput(converted.join(delimiter === '\n' ? '\n' : delimiter));
	};

	const handleToggleDirection = () => {
		setDirection((prev) => (prev === 'mio-to-tv' ? 'tv-to-mio' : 'mio-to-tv'));
		setOutput(''); // Clear output on direction change
	};

	const handleDownload = () => {
		downloadTextFile(output, 'converted-symbols.txt');
	};

	return (
		<div className='flex min-h-screen w-full bg-background'>
			<div className='flex flex-col items-center justify-center flex-grow w-full'>
				<div className='w-full bg-card rounded-xl shadow-lg p-4 flex flex-col gap-4 mx-auto'>
					<h1 className='text-2xl font-bold mb-2 text-center'>Stock Format Converter</h1>
					<EditorWithClipboard
						id='input'
						label='Input'
						value={input}
						onChange={setInput}
						onPaste={setInput}
						placeholder='Paste or type your stock list here...'
						showPaste
						className='min-h-[120px] font-mono text-base shadow-md mb-2'
					/>
					<div className='flex flex-wrap gap-2 items-center justify-between'>
						<div className='flex flex-col flex-1 min-w-[120px]'>
							<Label htmlFor='delimiter'>Delimiter</Label>
							<Select value={delimiter} onValueChange={setDelimiter}>
								<SelectTrigger id='delimiter' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{DELIMITERS.map((d) => (
										<SelectItem key={d} value={d}>
											{d === '\n' ? 'Newline' : d === ' ' ? 'Space' : d}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className='flex flex-col gap-2 justify-center mt-2'>
						<Button variant='default' className='w-full text-base font-semibold py-3' onClick={handleConvert}>
							{direction === 'mio-to-tv' ? 'MIO → TV' : 'TV → MIO'}
						</Button>
						<Button
							variant='outline'
							className='w-full text-xs py-2 opacity-80'
							onClick={handleToggleDirection}
							type='button'
						>
							Switch to {direction === 'mio-to-tv' ? 'TV → MIO' : 'MIO → TV'}
						</Button>
					</div>
					<RegroupBar value={output || input} onRegroup={setOutput} />
					<EditorWithClipboard
						id='output'
						label='Output'
						value={output}
						readOnly
						showCopy
						showDownload
						onDownload={handleDownload}
						className='min-h-[120px] font-mono text-base bg-muted/50 shadow-inner mb-2'
						disabledCopy={!output}
					/>
				</div>
			</div>
		</div>
	);
}
