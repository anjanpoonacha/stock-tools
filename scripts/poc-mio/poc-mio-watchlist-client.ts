#!/usr/bin/env tsx
/**
 * POC: Centralized MIO Watchlist Client
 * 
 * Tests all watchlist operations with centralized:
 * - Response parsing
 * - Request validation
 * - Session management
 * 
 * Endpoints tested:
 * 1. GET  watch_list.php?mode=list          - List watchlists
 * 2. POST watch_list.php (mode=add)         - Add multiple stocks
 * 3. GET  my_watch_lists.php?mode=new       - Create watchlist
 * 4. GET  my_watch_lists.php?mode=delete    - Delete watchlist
 * 5. GET  wl_add_all.php?action=add         - Add single stock (NEW)
 * 6. GET  wl_add_all.php?action=remove      - Remove single stock (NEW)
 * 7. GET  wl_del.php?action=delete          - Delete by tid (NEW)
 */

import * as cheerio from 'cheerio';

// ============================================================================
// TYPES
// ============================================================================

type SessionKeyValue = {
  key: string;
  value: string;
};

type MIOResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    needsRefresh?: boolean;
  };
  meta: {
    statusCode: number;
    responseType: 'json' | 'html' | 'text' | 'redirect';
    url: string;
    rawResponse?: string; // For debugging
  };
};

type Watchlist = {
  id: string;
  name: string;
};

type WatchlistAddResponse = {
  wlid: string;
  symbols: string[];
  message?: string;
};

type WatchlistDeleteResponse = {
  deleted: boolean;
  wlid?: string;
  tid?: string;
  symbol?: string;
  message?: string;
};

type WatchlistCreateResponse = {
  created: boolean;
  wlid?: string;
  name: string;
  message?: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const MIO_URLS = {
  BASE: 'https://www.marketinout.com',
  WATCHLIST_LIST: 'https://www.marketinout.com/wl/watch_list.php?mode=list',
  WATCHLIST_API: 'https://www.marketinout.com/wl/watch_list.php',
  MY_WATCHLISTS: 'https://www.marketinout.com/wl/my_watch_lists.php',
  WL_ADD_ALL: 'https://www.marketinout.com/wl/wl_add_all.php',
  WL_DELETE: 'https://www.marketinout.com/wl/wl_del.php',
} as const;

const LOGIN_INDICATORS = ['login', 'signin', 'password'] as const;

const PATTERNS = {
  NUMERIC_ID: /^\d+$/,
  SYMBOL: /^[A-Z0-9]+\.[A-Z]+$/,
  WATCHLIST_ID_EXTRACT: /wlid=(\d+)/,
  SUCCESS_MESSAGE: /(has been added|has been removed|successfully|created)/i,
  ERROR_MESSAGE: /(error|failed|invalid)/i,
} as const;

// ============================================================================
// CENTRALIZED REQUEST VALIDATOR
// ============================================================================

class RequestValidator {
  static validateWatchlistId(wlid: string): { valid: boolean; error?: string } {
    if (!wlid || wlid.trim() === '') {
      return { valid: false, error: 'Watchlist ID cannot be empty' };
    }
    if (!PATTERNS.NUMERIC_ID.test(wlid)) {
      return { valid: false, error: `Invalid watchlist ID format: ${wlid}` };
    }
    return { valid: true };
  }

  static validateSymbol(symbol: string): { valid: boolean; error?: string } {
    if (!symbol || symbol.trim() === '') {
      return { valid: false, error: 'Symbol cannot be empty' };
    }
    // Allow both formats: TCS.NS or TCS
    if (!/^[A-Z0-9]+(\.[A-Z]+)?$/i.test(symbol)) {
      return { valid: false, error: `Invalid symbol format: ${symbol}` };
    }
    return { valid: true };
  }

  static validateSymbols(symbols: string[]): { valid: boolean; invalid: string[] } {
    const invalid = symbols.filter(s => !this.validateSymbol(s).valid);
    return { valid: invalid.length === 0, invalid };
  }

  static validateTid(tid: string): { valid: boolean; error?: string } {
    if (!tid || tid.trim() === '') {
      return { valid: false, error: 'Ticker ID cannot be empty' };
    }
    if (!PATTERNS.NUMERIC_ID.test(tid)) {
      return { valid: false, error: `Invalid ticker ID format: ${tid}` };
    }
    return { valid: true };
  }

  static validateWatchlistName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim() === '') {
      return { valid: false, error: 'Watchlist name cannot be empty' };
    }
    if (name.length > 100) {
      return { valid: false, error: 'Watchlist name too long (max 100 chars)' };
    }
    return { valid: true };
  }
}

// ============================================================================
// CENTRALIZED RESPONSE PARSER
// ============================================================================

class ResponseParser {
  /**
   * Check if HTML response indicates a login page (session expired)
   */
  static isLoginPage(html: string): boolean {
    return LOGIN_INDICATORS.some(indicator => html.toLowerCase().includes(indicator.toLowerCase()));
  }

  /**
   * Extract success message from HTML
   */
  static extractSuccessMessage(html: string): string | null {
    // Pattern 1: "X has been added to the watch list!"
    const match1 = html.match(/([A-Z0-9\.]+)\s+has been (added|removed)/i);
    if (match1) {
      return match1[0];
    }

    // Pattern 2: Look for success indicators
    if (PATTERNS.SUCCESS_MESSAGE.test(html)) {
      // Extract the sentence containing success
      const sentences = html.split(/[.!]/);
      const successSentence = sentences.find(s => PATTERNS.SUCCESS_MESSAGE.test(s));
      return successSentence?.trim() || null;
    }

    return null;
  }

  /**
   * Extract error message from HTML
   */
  static extractErrorMessage(html: string): string | null {
    // Look for error indicators
    if (PATTERNS.ERROR_MESSAGE.test(html)) {
      const sentences = html.split(/[.!]/);
      const errorSentence = sentences.find(s => PATTERNS.ERROR_MESSAGE.test(s));
      return errorSentence?.trim() || null;
    }
    return null;
  }

  /**
   * Extract redirect URL from HTML (302 responses)
   */
  static extractRedirectUrl(html: string): string | null {
    // Pattern: <a HREF="watch_list.php?wlid=74577">here</a>
    const match = html.match(/<a\s+HREF="([^"]+)">(?:here|click here)/i);
    if (match && match[1]) {
      return match[1].startsWith('http') ? match[1] : `${MIO_URLS.BASE}${match[1]}`;
    }
    return null;
  }

  /**
   * Extract watchlist ID from HTML/URL
   */
  static extractWatchlistId(text: string): string | null {
    const match = text.match(PATTERNS.WATCHLIST_ID_EXTRACT);
    return match ? match[1] : null;
  }

  /**
   * Parse watchlist action response (add/remove)
   */
  static parseWatchlistActionResponse(html: string): {
    success: boolean;
    action?: 'added' | 'removed';
    symbol?: string;
    message?: string;
  } {
    // Check for login page first
    if (this.isLoginPage(html)) {
      return { success: false, message: 'Session expired - login required' };
    }

    // Extract success message
    const successMsg = this.extractSuccessMessage(html);
    if (successMsg) {
      const action = successMsg.toLowerCase().includes('added') ? 'added' : 'removed';
      // Extract symbol from message
      const symbolMatch = successMsg.match(/^([A-Z0-9\.]+)\s+/);
      const symbol = symbolMatch ? symbolMatch[1] : undefined;

      return {
        success: true,
        action,
        symbol,
        message: successMsg,
      };
    }

    // Check for errors
    const errorMsg = this.extractErrorMessage(html);
    if (errorMsg) {
      return { success: false, message: errorMsg };
    }

    // If we can't determine, assume failure
    return { success: false, message: 'Unable to parse response' };
  }

  /**
   * Parse watchlist list HTML using cheerio
   */
  static parseWatchlistList(html: string): Watchlist[] {
    const $ = cheerio.load(html);
    const watchlists: Watchlist[] = [];

    $('#sel_wlid option').each((_, element) => {
      const id = $(element).attr('value')?.trim();
      const name = $(element).text().trim();

      if (id && name && PATTERNS.NUMERIC_ID.test(id)) {
        watchlists.push({ id, name });
      }
    });

    return watchlists;
  }
}

// ============================================================================
// CENTRALIZED HTTP CLIENT
// ============================================================================

class MIOHttpClient {
  /**
   * Make authenticated request to MIO
   */
  static async request<T>(
    url: string,
    options: {
      method: 'GET' | 'POST';
      sessionKeyValue: SessionKeyValue;
      body?: URLSearchParams | string;
      headers?: Record<string, string>;
    },
    parser?: (html: string) => T
  ): Promise<MIOResponse<T>> {
    const { method, sessionKeyValue, body, headers = {} } = options;

    try {
      // Build headers
      const requestHeaders: Record<string, string> = {
        Cookie: `${sessionKeyValue.key}=${sessionKeyValue.value}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...headers,
      };

      // Add content-type for POST
      if (method === 'POST' && body) {
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      console.log(`\n🔄 ${method} ${url}`);

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body instanceof URLSearchParams ? body.toString() : body,
        redirect: 'manual', // Handle redirects manually
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);

      // Handle different response types
      return await this.handleResponse(response, url, parser);
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
        meta: {
          statusCode: 0,
          responseType: 'text',
          url,
        },
      };
    }
  }

  /**
   * Handle response based on status code and content type
   */
  private static async handleResponse<T>(
    response: Response,
    url: string,
    parser?: (html: string) => T
  ): Promise<MIOResponse<T>> {
    const statusCode = response.status;

    // Handle redirects (302, 301)
    if (statusCode === 302 || statusCode === 301) {
      const location = response.headers.get('location');
      const html = await response.text();
      
      console.log(`   → Redirect to: ${location || ResponseParser.extractRedirectUrl(html) || 'unknown'}`);

      return {
        success: true,
        data: parser ? parser(html) : (html as unknown as T),
        meta: {
          statusCode,
          responseType: 'redirect',
          url,
          rawResponse: html,
        },
      };
    }

    // Handle non-OK responses
    if (!response.ok) {
      const html = await response.text();
      const errorMsg = ResponseParser.extractErrorMessage(html) || 
                      `HTTP ${statusCode}: ${response.statusText}`;

      return {
        success: false,
        error: {
          code: `HTTP_${statusCode}`,
          message: errorMsg,
          needsRefresh: statusCode === 401 || statusCode === 403,
        },
        meta: {
          statusCode,
          responseType: 'html',
          url,
          rawResponse: html,
        },
      };
    }

    // Handle successful responses
    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();

    // Check for login page (session expired)
    if (ResponseParser.isLoginPage(html)) {
      return {
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session expired - please refresh your session',
          needsRefresh: true,
        },
        meta: {
          statusCode,
          responseType: 'html',
          url,
          rawResponse: html,
        },
      };
    }

    // Parse response if parser provided
    if (parser) {
      try {
        const data = parser(html);
        return {
          success: true,
          data,
          meta: {
            statusCode,
            responseType: contentType.includes('json') ? 'json' : 'html',
            url,
            rawResponse: html,
          },
        };
      } catch (parseError) {
        return {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: parseError instanceof Error ? parseError.message : 'Failed to parse response',
          },
          meta: {
            statusCode,
            responseType: 'html',
            url,
            rawResponse: html,
          },
        };
      }
    }

    // Return raw HTML if no parser
    return {
      success: true,
      data: html as unknown as T,
      meta: {
        statusCode,
        responseType: 'html',
        url,
        rawResponse: html,
      },
    };
  }
}

// ============================================================================
// MIO WATCHLIST API CLIENT
// ============================================================================

class MIOWatchlistClient {
  private session: SessionKeyValue;

  constructor(session: SessionKeyValue) {
    this.session = session;
  }

  /**
   * 1. Get list of all watchlists
   */
  async getWatchlists(): Promise<MIOResponse<Watchlist[]>> {
    console.log('\n📋 Getting watchlist list...');
    return MIOHttpClient.request<Watchlist[]>(
      MIO_URLS.WATCHLIST_LIST,
      { method: 'GET', sessionKeyValue: this.session },
      (html) => ResponseParser.parseWatchlistList(html)
    );
  }

  /**
   * 2. Add multiple stocks to watchlist (POST)
   */
  async addStocksBulk(wlid: string, symbols: string[]): Promise<MIOResponse<WatchlistAddResponse>> {
    console.log(`\n➕ Adding stocks (bulk) to watchlist ${wlid}...`);
    
    // Validate inputs
    const wlidValidation = RequestValidator.validateWatchlistId(wlid);
    if (!wlidValidation.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: wlidValidation.error! },
        meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.WATCHLIST_API },
      };
    }

    const symbolsValidation = RequestValidator.validateSymbols(symbols);
    if (!symbolsValidation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid symbols: ${symbolsValidation.invalid.join(', ')}`,
        },
        meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.WATCHLIST_API },
      };
    }

    const formData = new URLSearchParams({
      mode: 'add',
      wlid,
      overwrite: '0',
      name: '',
      stock_list: symbols.join(','),
    });

    return MIOHttpClient.request<WatchlistAddResponse>(
      MIO_URLS.WATCHLIST_API,
      {
        method: 'POST',
        sessionKeyValue: this.session,
        body: formData,
      },
      (html) => ({
        wlid,
        symbols,
        message: ResponseParser.extractSuccessMessage(html) || 'Stocks added',
      })
    );
  }

  /**
   * 3. Create new watchlist
   */
  async createWatchlist(name: string): Promise<MIOResponse<WatchlistCreateResponse>> {
    console.log(`\n✨ Creating watchlist: "${name}"...`);

    // Validate name
    const nameValidation = RequestValidator.validateWatchlistName(name);
    if (!nameValidation.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: nameValidation.error! },
        meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.MY_WATCHLISTS },
      };
    }

    const url = `${MIO_URLS.MY_WATCHLISTS}?mode=new&name=${encodeURIComponent(name)}&wlid=`;

    return MIOHttpClient.request<WatchlistCreateResponse>(
      url,
      { method: 'GET', sessionKeyValue: this.session },
      (html) => {
        const wlid = ResponseParser.extractWatchlistId(html);
        return {
          created: !!wlid,
          wlid: wlid || undefined,
          name,
          message: wlid ? `Watchlist created with ID: ${wlid}` : 'Watchlist created',
        };
      }
    );
  }

  /**
   * 4. Delete watchlist(s)
   */
  async deleteWatchlists(deleteIds: string[]): Promise<MIOResponse<WatchlistDeleteResponse>> {
    console.log(`\n🗑️  Deleting watchlists: ${deleteIds.join(', ')}...`);

    // Validate IDs
    for (const id of deleteIds) {
      const validation = RequestValidator.validateWatchlistId(id);
      if (!validation.valid) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validation.error! },
          meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.MY_WATCHLISTS },
        };
      }
    }

    const params = deleteIds.map((id) => `todelete=${encodeURIComponent(id)}`).join('&');
    const url = `${MIO_URLS.MY_WATCHLISTS}?${params}&mode=delete`;

    return MIOHttpClient.request<WatchlistDeleteResponse>(
      url,
      { method: 'GET', sessionKeyValue: this.session },
      (html) => ({
        deleted: true,
        message: ResponseParser.extractSuccessMessage(html) || 'Watchlists deleted',
      })
    );
  }

  /**
   * 5. Add single stock to watchlist (NEW - from curls.http)
   */
  async addSingleStock(wlid: string, symbol: string): Promise<MIOResponse<WatchlistAddResponse>> {
    console.log(`\n➕ Adding single stock ${symbol} to watchlist ${wlid}...`);

    // Validate inputs
    const wlidValidation = RequestValidator.validateWatchlistId(wlid);
    if (!wlidValidation.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: wlidValidation.error! },
        meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.WL_ADD_ALL },
      };
    }

    const symbolValidation = RequestValidator.validateSymbol(symbol);
    if (!symbolValidation.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: symbolValidation.error! },
        meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.WL_ADD_ALL },
      };
    }

    const url = `${MIO_URLS.WL_ADD_ALL}?action=add&wlid=${wlid}&wl_name=&symbol=${symbol}`;

    return MIOHttpClient.request<WatchlistAddResponse>(
      url,
      { method: 'GET', sessionKeyValue: this.session },
      (html) => {
        const parsed = ResponseParser.parseWatchlistActionResponse(html);
        return {
          wlid,
          symbols: parsed.symbol ? [parsed.symbol] : [symbol],
          message: parsed.message,
        };
      }
    );
  }

  /**
   * 6. Remove single stock from watchlist (NEW - from curls.http)
   */
  async removeSingleStock(wlid: string, symbol: string): Promise<MIOResponse<WatchlistDeleteResponse>> {
    console.log(`\n➖ Removing single stock ${symbol} from watchlist ${wlid}...`);

    // Validate inputs
    const wlidValidation = RequestValidator.validateWatchlistId(wlid);
    if (!wlidValidation.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: wlidValidation.error! },
        meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.WL_ADD_ALL },
      };
    }

    const symbolValidation = RequestValidator.validateSymbol(symbol);
    if (!symbolValidation.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: symbolValidation.error! },
        meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.WL_ADD_ALL },
      };
    }

    const url = `${MIO_URLS.WL_ADD_ALL}?action=remove&wlid=${wlid}&wl_name=&symbol=${symbol}`;

    return MIOHttpClient.request<WatchlistDeleteResponse>(
      url,
      { method: 'GET', sessionKeyValue: this.session },
      (html) => {
        const parsed = ResponseParser.parseWatchlistActionResponse(html);
        return {
          deleted: parsed.success,
          wlid,
          symbol: parsed.symbol || symbol,
          message: parsed.message,
        };
      }
    );
  }

  /**
   * 7. Delete stock by ticker ID (NEW - from curls.http)
   */
  async deleteStockByTid(wlid: string, tid: string): Promise<MIOResponse<WatchlistDeleteResponse>> {
    console.log(`\n🗑️  Deleting stock tid=${tid} from watchlist ${wlid}...`);

    // Validate inputs
    const wlidValidation = RequestValidator.validateWatchlistId(wlid);
    if (!wlidValidation.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: wlidValidation.error! },
        meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.WL_DELETE },
      };
    }

    const tidValidation = RequestValidator.validateTid(tid);
    if (!tidValidation.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: tidValidation.error! },
        meta: { statusCode: 400, responseType: 'text', url: MIO_URLS.WL_DELETE },
      };
    }

    const url = `${MIO_URLS.WL_DELETE}?action=delete&wlid=${wlid}&tid=${tid}`;

    return MIOHttpClient.request<WatchlistDeleteResponse>(
      url,
      { method: 'GET', sessionKeyValue: this.session },
      (html) => {
        const parsed = ResponseParser.parseWatchlistActionResponse(html);
        return {
          deleted: parsed.success,
          wlid,
          tid,
          message: parsed.message,
        };
      }
    );
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  MIOWatchlistClient,
  MIOHttpClient,
  ResponseParser,
  RequestValidator,
  type MIOResponse,
  type SessionKeyValue,
  type Watchlist,
  type WatchlistAddResponse,
  type WatchlistDeleteResponse,
  type WatchlistCreateResponse,
};
