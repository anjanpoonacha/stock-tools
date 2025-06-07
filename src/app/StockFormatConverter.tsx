'use client';

// Main UI for Stock Format Converter
// Mobile-first, code-editor-like input, delimiter/prefix options, conversion logic

import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

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
	const [direction, setDirection] = useState<Direction>('mio-to-tv');
	const [output, setOutput] = useState('');

	const handleConvert = () => {
		const symbols = parseInput(input, delimiter);
		const converted = convertSymbols(symbols, direction);
		setOutput(converted.join(delimiter === '\n' ? '\n' : delimiter));
	};

	return (
		<div className='max-w-md mx-auto p-4 flex flex-col gap-4 min-h-screen bg-background'>
			<h1 className='text-2xl font-bold mb-2 text-center'>Stock Format Converter</h1>
			<Label htmlFor='input' className='mb-1'>
				Input
			</Label>
			<Textarea
				id='input'
				value={input}
				onChange={(e) => setInput(e.target.value)}
				placeholder='Paste or type your stock list here...'
				className='min-h-[120px] font-mono text-base shadow-md'
				autoFocus
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
				{/* Only show prefix selection for MIO → TV */}
				{direction === 'mio-to-tv' && (
					<div className='flex flex-col flex-1 min-w-[120px]'>
						<Label htmlFor='prefix'>Prefix</Label>
						<div className='w-full rounded border px-3 py-2 bg-muted/50 text-muted-foreground'>NSE:</div>
					</div>
				)}
			</div>
			<div className='flex gap-2 justify-center mt-2'>
				<Button variant={direction === 'mio-to-tv' ? 'default' : 'outline'} onClick={() => setDirection('mio-to-tv')}>
					MarketInOut → TradingView
				</Button>
				<Button variant={direction === 'tv-to-mio' ? 'default' : 'outline'} onClick={() => setDirection('tv-to-mio')}>
					TradingView → MarketInOut
				</Button>
			</div>
			<Button className='w-full mt-2' onClick={handleConvert}>
				Convert
			</Button>
			<Label htmlFor='output' className='mt-4 mb-1'>
				Output
			</Label>
			<Textarea
				id='output'
				value={output}
				readOnly
				className='min-h-[120px] font-mono text-base bg-muted/50 shadow-inner'
			/>
		</div>
	);
}
