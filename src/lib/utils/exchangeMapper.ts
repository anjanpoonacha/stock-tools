/**
 * Exchange Mapper Utility
 * 
 * Maps between TradingView format (NSE:SYMBOL) and MarketInOut format (SYMBOL.NS)
 * Supports multiple Indian exchanges for scalability.
 */

/**
 * Exchange suffix mapping
 * Maps TradingView exchange prefix to MIO exchange suffix
 */
const EXCHANGE_MAP: Record<string, string> = {
  NSE: 'NS',  // National Stock Exchange
  BSE: 'BO',  // Bombay Stock Exchange
  MCX: 'MCX', // Multi Commodity Exchange
  NCDEX: 'NCDEX', // National Commodity & Derivatives Exchange
};

/**
 * Reverse mapping: MIO suffix to TradingView prefix
 */
const REVERSE_EXCHANGE_MAP: Record<string, string> = {
  NS: 'NSE',
  BO: 'BSE',
  MCX: 'MCX',
  NCDEX: 'NCDEX',
};

/**
 * Default exchange for symbols without explicit exchange
 */
const DEFAULT_EXCHANGE_PREFIX = 'NSE';
const DEFAULT_EXCHANGE_SUFFIX = 'NS';

/**
 * Convert TradingView format to MarketInOut format
 * 
 * @param symbol - Symbol in TradingView format (e.g., "NSE:TCS", "BSE:TCS", "TCS")
 * @returns Symbol in MIO format (e.g., "TCS.NS", "TCS.BO")
 * 
 * @example
 * tvToMio("NSE:TCS") // Returns "TCS.NS"
 * tvToMio("BSE:TCS") // Returns "TCS.BO"
 * tvToMio("TCS") // Returns "TCS.NS" (defaults to NSE)
 * tvToMio("TCS.NS") // Returns "TCS.NS" (already in MIO format)
 */
export function tvToMio(symbol: string): string {
  // Already in MIO format (SYMBOL.SUFFIX)
  if (symbol.includes('.')) {
    return symbol;
  }

  // Has TradingView prefix (EXCHANGE:SYMBOL)
  if (symbol.includes(':')) {
    const [exchange, ticker] = symbol.split(':');
    const suffix = EXCHANGE_MAP[exchange.toUpperCase()];
    
    if (!suffix) {
      // Unknown exchange - default to NSE
      console.warn(`Unknown exchange: ${exchange}, defaulting to NSE`);
      return `${ticker}.${DEFAULT_EXCHANGE_SUFFIX}`;
    }
    
    return `${ticker}.${suffix}`;
  }

  // Plain symbol - default to NSE
  return `${symbol}.${DEFAULT_EXCHANGE_SUFFIX}`;
}

/**
 * Convert MarketInOut format to TradingView format
 * 
 * @param symbol - Symbol in MIO format (e.g., "TCS.NS", "TCS.BO")
 * @returns Symbol in TradingView format (e.g., "NSE:TCS", "BSE:TCS")
 * 
 * @example
 * mioToTv("TCS.NS") // Returns "NSE:TCS"
 * mioToTv("TCS.BO") // Returns "BSE:TCS"
 * mioToTv("NSE:TCS") // Returns "NSE:TCS" (already in TV format)
 * mioToTv("TCS") // Returns "NSE:TCS" (defaults to NSE)
 */
export function mioToTv(symbol: string): string {
  // Already in TradingView format (EXCHANGE:SYMBOL)
  if (symbol.includes(':')) {
    return symbol;
  }

  // Has MIO suffix (SYMBOL.SUFFIX)
  if (symbol.includes('.')) {
    const [ticker, suffix] = symbol.split('.');
    const exchange = REVERSE_EXCHANGE_MAP[suffix.toUpperCase()];
    
    if (!exchange) {
      // Unknown suffix - default to NSE
      console.warn(`Unknown exchange suffix: ${suffix}, defaulting to NSE`);
      return `${DEFAULT_EXCHANGE_PREFIX}:${ticker}`;
    }
    
    return `${exchange}:${ticker}`;
  }

  // Plain symbol - default to NSE
  return `${DEFAULT_EXCHANGE_PREFIX}:${symbol}`;
}

/**
 * Normalize symbol to ensure it has exchange information
 * Returns symbol in the requested format
 * 
 * @param symbol - Symbol in any format
 * @param format - Target format ('tv' or 'mio')
 * @returns Normalized symbol in the requested format
 * 
 * @example
 * normalizeSymbol("TCS", "mio") // Returns "TCS.NS"
 * normalizeSymbol("TCS", "tv") // Returns "NSE:TCS"
 * normalizeSymbol("NSE:TCS", "mio") // Returns "TCS.NS"
 * normalizeSymbol("TCS.NS", "tv") // Returns "NSE:TCS"
 */
export function normalizeSymbol(symbol: string, format: 'tv' | 'mio'): string {
  if (format === 'mio') {
    return tvToMio(symbol);
  } else {
    return mioToTv(symbol);
  }
}

/**
 * Validate if a symbol is in correct MIO format (SYMBOL.SUFFIX)
 * 
 * @param symbol - Symbol to validate
 * @returns true if valid MIO format, false otherwise
 * 
 * @example
 * isValidMioSymbol("TCS.NS") // Returns true
 * isValidMioSymbol("TCS") // Returns false
 * isValidMioSymbol("NSE:TCS") // Returns false
 */
export function isValidMioSymbol(symbol: string): boolean {
  // Must contain exactly one dot
  if (!symbol.includes('.') || symbol.split('.').length !== 2) {
    return false;
  }

  // Must match pattern: SYMBOL.SUFFIX
  const [ticker, suffix] = symbol.split('.');
  
  // Ticker should be alphanumeric (letters and numbers)
  if (!/^[A-Z0-9]+$/i.test(ticker)) {
    return false;
  }

  // Suffix should be alphabetic
  if (!/^[A-Z]+$/i.test(suffix)) {
    return false;
  }

  return true;
}

/**
 * Validate if a symbol is in correct TradingView format (EXCHANGE:SYMBOL)
 * 
 * @param symbol - Symbol to validate
 * @returns true if valid TV format, false otherwise
 * 
 * @example
 * isValidTvSymbol("NSE:TCS") // Returns true
 * isValidTvSymbol("TCS") // Returns false
 * isValidTvSymbol("TCS.NS") // Returns false
 */
export function isValidTvSymbol(symbol: string): boolean {
  // Must contain exactly one colon
  if (!symbol.includes(':') || symbol.split(':').length !== 2) {
    return false;
  }

  // Must match pattern: EXCHANGE:SYMBOL
  const [exchange, ticker] = symbol.split(':');
  
  // Exchange should be alphabetic
  if (!/^[A-Z]+$/i.test(exchange)) {
    return false;
  }

  // Ticker should be alphanumeric (letters and numbers)
  if (!/^[A-Z0-9]+$/i.test(ticker)) {
    return false;
  }

  return true;
}

/**
 * Get list of supported exchanges
 * 
 * @returns Array of exchange codes
 */
export function getSupportedExchanges(): string[] {
  return Object.keys(EXCHANGE_MAP);
}

/**
 * Check if an exchange is supported
 * 
 * @param exchange - Exchange code (e.g., "NSE", "BSE")
 * @returns true if supported, false otherwise
 */
export function isExchangeSupported(exchange: string): boolean {
  return exchange.toUpperCase() in EXCHANGE_MAP;
}
