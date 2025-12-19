'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, Copy, Upload, Zap, ChevronDown, ChevronUp, Settings, Sparkles } from 'lucide-react';

interface SmartEditorProps {
    title?: string;
    description?: string;
    placeholder?: string;
    className?: string;
    compact?: boolean;
}

export function SmartEditor({
    title = 'Symbol Converter',
    description = 'Convert stock symbols between MarketInOut and TradingView formats',
    placeholder = 'Paste your stock symbols here...',
    className,
    compact = false,
}: SmartEditorProps) {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [isExpanded, setIsExpanded] = useState(!compact);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleConvert = async () => {
        if (!input.trim()) return;

        setIsProcessing(true);
        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Simple conversion logic for demo
        const symbols = input.split(/[,\n\s]+/).filter(Boolean);
        const converted = symbols.map((symbol) => {
            if (symbol.includes('.NS') || symbol.includes('.BO')) {
                // MIO to TV format
                const base = symbol.replace(/\.[A-Z]+$/, '');
                return `NSE:${base}`;
            } else if (symbol.startsWith('NSE:') || symbol.startsWith('BSE:')) {
                // TV to MIO format
                const base = symbol.split(':')[1];
                return `${base}.NS`;
            }
            return symbol;
        });

        setOutput(converted.join('\n'));
        setIsProcessing(false);
    };

    const handleCopy = async () => {
        if (output) {
            await navigator.clipboard.writeText(output);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setInput(text);
        } catch (error) {
            // Failed to read clipboard
        }
    };

    if (compact) {
        return (
            <Card className={cn('group hover:shadow-md transition-all duration-200', className)}>
                <CardHeader className='pb-3'>
                    <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                            <div className='w-8 h-8 bg-gradient-to-br from-primary/10 to-primary/20 rounded-lg flex items-center justify-center'>
                                <ArrowLeftRight className='w-4 h-4 text-primary' />
                            </div>
                            <div>
                                <CardTitle className='text-sm'>{title}</CardTitle>
                                <Badge variant='outline' className='text-xs mt-1'>
                                    Quick Convert
                                </Badge>
                            </div>
                        </div>
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setIsExpanded(!isExpanded)}
                            className='h-8 w-8 p-0'
                        >
                            {isExpanded ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
                        </Button>
                    </div>
                </CardHeader>
                {isExpanded && (
                    <CardContent className='pt-0 space-y-3'>
                        <Textarea
                            placeholder={placeholder}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className='min-h-[80px] text-sm'
                        />
                        <div className='flex gap-2'>
                            <Button size='sm' onClick={handleConvert} disabled={isProcessing || !input.trim()}>
                                {isProcessing ? (
                                    <Sparkles className='w-3 h-3 mr-1 animate-spin' />
                                ) : (
                                    <Zap className='w-3 h-3 mr-1' />
                                )}
                                Convert
                            </Button>
                            <Button variant='outline' size='sm' onClick={handlePaste}>
                                <Upload className='w-3 h-3 mr-1' />
                                Paste
                            </Button>
                        </div>
                        {output && (
                            <>
                                <Separator />
                                <div className='space-y-2'>
                                    <Textarea value={output} readOnly className='min-h-[60px] text-sm bg-muted/50' />
                                    <Button variant='outline' size='sm' onClick={handleCopy}>
                                        <Copy className='w-3 h-3 mr-1' />
                                        Copy Result
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                )}
            </Card>
        );
    }

    return (
        <Card className={cn('', className)}>
            <CardHeader>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                        <div className='w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center'>
                            <ArrowLeftRight className='w-6 h-6 text-primary-foreground' />
                        </div>
                        <div>
                            <CardTitle className='text-xl'>{title}</CardTitle>
                            <CardDescription className='mt-1'>{description}</CardDescription>
                        </div>
                    </div>
                    <Button variant='outline' size='sm'>
                        <Settings className='w-4 h-4 mr-2' />
                        Settings
                    </Button>
                </div>
            </CardHeader>
            <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                            <label className='text-sm font-medium'>Input</label>
                            <Button variant='ghost' size='sm' onClick={handlePaste}>
                                <Upload className='w-3 h-3 mr-1' />
                                Paste
                            </Button>
                        </div>
                        <Textarea
                            placeholder={placeholder}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className='min-h-[200px] font-mono'
                        />
                    </div>
                    <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                            <label className='text-sm font-medium'>Output</label>
                            <Button variant='ghost' size='sm' onClick={handleCopy} disabled={!output}>
                                <Copy className='w-3 h-3 mr-1' />
                                Copy
                            </Button>
                        </div>
                        <Textarea
                            value={output}
                            readOnly
                            placeholder='Converted symbols will appear here...'
                            className='min-h-[200px] font-mono bg-muted/50'
                        />
                    </div>
                </div>
                <div className='flex items-center justify-center'>
                    <Button onClick={handleConvert} disabled={isProcessing || !input.trim()} size='lg'>
                        {isProcessing ? (
                            <Sparkles className='w-4 h-4 mr-2 animate-spin' />
                        ) : (
                            <Zap className='w-4 h-4 mr-2' />
                        )}
                        {isProcessing ? 'Converting...' : 'Convert Symbols'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
