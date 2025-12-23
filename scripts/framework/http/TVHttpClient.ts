/**
 * TradingView HTTP Client
 * 
 * Handles TradingView-specific HTTP requests with:
 * - Session cookie authentication
 * - User ID fetching
 * - JWT token fetching for WebSocket auth
 */

import { BaseHttpClient } from './BaseHttpClient.js';
import type { HttpResponse, RequestOptions } from './types.js';

export interface TVUserInfo {
  userId: number;
  username?: string;
}

export class TVHttpClient extends BaseHttpClient {
  constructor(
    private sessionId: string,
    private sessionIdSign?: string
  ) {
    super();
  }

  /**
   * Build headers with TradingView session cookie
   */
  protected buildHeaders(options: RequestOptions): Record<string, string> {
    // Build session cookie
    let cookieValue = `sessionid=${this.sessionId}`;
    if (this.sessionIdSign) {
      cookieValue += `; sessionid_sign=${this.sessionIdSign}`;
    }

    return {
      Cookie: cookieValue,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
      ...options.headers,
    };
  }

  /**
   * Get TradingView user ID and username
   */
  async getUserId(): Promise<HttpResponse<TVUserInfo>> {
    console.log('🔍 Fetching TradingView User ID...');

    const response = await this.request<any>(
      'https://www.tradingview.com/api/v1/user/',
      { method: 'GET' }
    );

    if (!response.success) {
      return response as HttpResponse<TVUserInfo>;
    }

    // Extract user ID from response
    const data = response.data;
    const userId = data?.id || data?.user_id;
    const username = data?.username;

    if (!userId || typeof userId !== 'number') {
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'No user_id found in response',
        },
        meta: response.meta,
      };
    }

    console.log(`   ✅ User ID: ${userId}${username ? ` (${username})` : ''}`);

    return {
      success: true,
      data: { userId, username },
      meta: response.meta,
    };
  }

  /**
   * Get JWT token for WebSocket authentication
   */
  async getJWTToken(userId: number, chartId: string): Promise<HttpResponse<string>> {
    console.log(`🔐 Fetching JWT token for user ${userId}, chart ${chartId}...`);

    const url = `https://www.tradingview.com/chart-token/?image_url=${chartId}&user_id=${userId}`;

    const response = await this.request<any>(
      url,
      { 
        method: 'GET',
        headers: {
          Accept: '*/*', // Accept any content type
        },
      }
    );

    if (!response.success) {
      return response as HttpResponse<string>;
    }

    // Response can be JSON or plain text
    let jwtToken: string;

    if (typeof response.data === 'object' && response.data !== null) {
      // JSON response
      jwtToken = response.data.token || response.data.auth_token || response.data.jwt || '';
    } else if (typeof response.data === 'string') {
      // Plain text response
      jwtToken = response.data;
    } else {
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'Unable to extract JWT token from response',
        },
        meta: response.meta,
      };
    }

    // Validate JWT format (must start with "eyJ")
    if (!jwtToken || !jwtToken.startsWith('eyJ')) {
      return {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid JWT token format',
        },
        meta: response.meta,
      };
    }

    console.log(`   ✅ JWT token obtained (${jwtToken.length} characters)`);

    return {
      success: true,
      data: jwtToken,
      meta: response.meta,
    };
  }
}
