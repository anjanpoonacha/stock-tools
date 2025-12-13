import allNseStocks from '../../all_nse.json';

/**
 * Parse MIO symbols from raw text
 * Extracts symbols by splitting on whitespace and taking the first part before "|"
 */
export function parseMioSymbols(raw: string): string[] {
    return raw
        .trim()
        .split(/\s+/)
        .map((item) => item.split('|')[0])
        .filter(Boolean);
}

/**
 * Convert a symbol to TradingView format
 * Converts .NS suffix to NSE: prefix
 */
export function toTV(symbol: string): string | null {
    if (symbol.endsWith('.NS')) return `NSE:${symbol.replace('.NS', '')}`;
    return null;
}

/**
 * Symbol information type
 */
interface SymbolInfo {
    Industry?: string;
    Sector?: string;
}

/**
 * Build a symbol map for fast lookup
 */
export const symbolInfoMap: Record<string, SymbolInfo> = (() => {
    const map: Record<string, SymbolInfo> = {};
    (allNseStocks as Array<{ Symbol: string; Industry?: string; Sector?: string }>).forEach((entry) => {
        if (entry.Symbol) {
            map[entry.Symbol] = {
                Industry: entry.Industry,
                Sector: entry.Sector,
            };
        }
    });
    return map;
})();

/**
 * Group symbols by sector, industry, or none
 * Returns a comma-separated string with optional group headers (###GroupName)
 */
export function groupSymbols(symbols: string[], groupBy: 'Sector' | 'Industry' | 'None'): string {
    if (groupBy === 'None') {
        return symbols.join(',');
    }
    const grouped: Record<string, string[]> = {};
    for (const symbol of symbols) {
        let lookup = symbol.replace(/^NSE:|^BSE:/, '');
        if (!lookup.endsWith('.NS')) lookup += '.NS';
        const info = symbolInfoMap[lookup] || symbolInfoMap[lookup.replace('.NS', '.BO')];
        const group = info?.[groupBy] || 'Other';
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(symbol);
    }
    return Object.entries(grouped)
        .map(([group, syms]) => `###${group},${syms.join(',')}`)
        .join(',');
}

/**
 * Remove duplicate symbols from an array
 */
export function removeDuplicateSymbols(symbols: string[]): { unique: string[]; duplicateCount: number } {
    const uniqueSymbols = [...new Set(symbols)];
    return {
        unique: uniqueSymbols,
        duplicateCount: symbols.length - uniqueSymbols.length,
    };
}
