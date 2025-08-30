'use client';

import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadTextFile } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { UsageGuide } from '@/components/UsageGuide';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { SessionError, SessionErrorType, Platform, ErrorSeverity, RecoveryAction } from '@/lib/sessionErrors';

// Helper to parse CSV
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map((h) => h.trim());
    const rows = lines.slice(1).map((line) => line.split(',').map((v) => v.trim()));
    return { headers, rows };
}

// Helper to group rows by a column
function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
    return rows.reduce((acc, row) => {
        const group = String(row[key] || 'Other');
        if (!acc[group]) acc[group] = [];
        acc[group].push(row);
        return acc;
    }, {} as Record<string, T[]>);
}

// Helper to convert symbol to TV format
function toTVSymbol(symbol: string | undefined) {
    if (!symbol) return '';
    if (typeof symbol !== 'string') return '';
    if (symbol.endsWith('.NS')) return 'NSE:' + symbol.replace(/\.NS$/, '');
    if (symbol.endsWith('.BS') || symbol.endsWith('.BO')) return 'BSE:' + symbol.replace(/\.(BS|BO)$/, '');
    return symbol;
}

export default function CsvWatchlistPage() {
    const [csv, setCsv] = useState('');
    const [groupByCol, setGroupByCol] = useState<string>('Sector');
    const [sortCol, setSortCol] = useState<string>('Symbol');
    const [error, setError] = useState<SessionError | Error | string | null>(null);

    const { headers, rows } = useMemo(() => parseCSV(csv), [csv]);
    const rowObjs = useMemo(
        () => rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || '']))),
        [headers, rows]
    );

    // Sort rows
    const sortedRows = useMemo(() => {
        if (!sortCol) return rowObjs;
        return [...rowObjs].sort((a, b) => (a[sortCol] || '').localeCompare(b[sortCol] || ''));
    }, [rowObjs, sortCol]);

    // Group rows
    const grouped = useMemo(
        () => groupBy(sortedRows, (groupByCol as keyof (typeof sortedRows)[0]) ?? 'Sector'),
        [sortedRows, groupByCol]
    );

    // TV Watchlist output
    const tvWatchlist = useMemo(() => {
        try {
            setError(null);
            // If grouping is disabled (groupByCol is empty or 'None'), just list all symbols
            if (!groupByCol || groupByCol === 'None') {
                return rowObjs
                    .map((row) => toTVSymbol(row.Symbol))
                    .filter(Boolean)
                    .join(',');
            }
            const groupStrings = Object.entries(grouped).map(
                ([group, items]) =>
                    `###${group},${items
                        .map((row) => toTVSymbol(row.Symbol))
                        .filter(Boolean)
                        .join(',')}`
            );
            // Join with comma, but do not prepend a comma at the start
            return groupStrings.filter(Boolean).join(',');
        } catch (e: unknown) {
            const sessionError = new SessionError(
                SessionErrorType.UNKNOWN_ERROR,
                'Failed to convert CSV symbols to TradingView format',
                e instanceof Error ? e.message : 'Unknown conversion error',
                {
                    operation: 'csv_symbol_conversion',
                    platform: Platform.UNKNOWN,
                    timestamp: new Date(),
                    additionalData: { groupByCol, symbolCount: rowObjs.length },
                },
                ErrorSeverity.ERROR,
                [
                    {
                        action: RecoveryAction.RETRY,
                        description: 'Check your CSV format and try again',
                        priority: 1,
                        automated: false,
                        estimatedTime: '1 minute',
                    },
                ]
            );
            setError(sessionError);
            return '';
        }
    }, [grouped, rowObjs, groupByCol]);

    const handleDownload = () => {
        downloadTextFile(tvWatchlist, 'tv-watchlist.txt');
    };

    return (
        <div className='max-w-7xl mx-auto'>
            <div className='w-full bg-card rounded-xl shadow-lg p-6 flex flex-col gap-6'>
                <h1 className='text-2xl font-bold mb-2 text-center'>CSV to TradingView Watchlist</h1>
                <UsageGuide
                    title='How to convert CSV to TradingView format'
                    steps={[
                        "Paste your CSV data with headers (must include 'Symbol' column)",
                        'Choose how to group symbols (by Sector, Industry, or None)',
                        'Select a column to sort the data by',
                        'Copy or download the TradingView-formatted output',
                        'Import the result directly into TradingView watchlists',
                    ]}
                    tips={[
                        'CSV must have headers in the first row',
                        'Symbol column is required (e.g., TCS.NS, INFY.BO)',
                        'Grouping creates sectioned format: ###GroupName,SYMBOL1,SYMBOL2',
                        'Preview table shows your data before conversion',
                    ]}
                    className='mb-4'
                />
                {error && <ErrorDisplay error={error} onRetry={() => setError(null)} className='mb-4' />}
                <EditorWithClipboard
                    id='csv-input'
                    label='CSV Input'
                    value={csv}
                    onChange={setCsv}
                    onPaste={setCsv}
                    placeholder='Paste or type your CSV here...'
                    showPaste
                    className='min-h-[120px] font-mono text-base shadow-md mb-4'
                />
                <EditorWithClipboard
                    id='tv-output'
                    label='TV Output'
                    value={tvWatchlist}
                    readOnly
                    showCopy
                    showDownload
                    onDownload={handleDownload}
                    className='min-h-[120px] font-mono text-base bg-muted/50 shadow-inner'
                    disabledCopy={!tvWatchlist}
                />
                {headers.length > 0 && (
                    <div className='flex flex-wrap gap-4 items-center mt-4'>
                        <div>
                            <Label htmlFor='group-by'>Group by</Label>
                            <Select value={groupByCol} onValueChange={setGroupByCol}>
                                <SelectTrigger id='group-by' className='w-40'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem key='None' value='None'>
                                        None
                                    </SelectItem>
                                    {headers.filter(Boolean).map((h) => (
                                        <SelectItem key={h} value={h}>
                                            {h}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor='sort-by'>Sort by</Label>
                            <Select value={sortCol} onValueChange={setSortCol}>
                                <SelectTrigger id='sort-by' className='w-40'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {headers.filter(Boolean).map((h) => (
                                        <SelectItem key={h} value={h}>
                                            {h}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
                {headers.length > 0 && (
                    <div className='overflow-x-auto rounded border bg-muted mt-2'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {headers.map((h) => (
                                        <TableHead key={h}>{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedRows.map((row, i) => (
                                    <TableRow key={i}>
                                        {headers.map((h) => (
                                            <TableCell key={h}>{row[h]}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
}
