/**
 * Base HTTP Client
 * 
 * Abstract base class for all HTTP clients with:
 * - Retry logic with exponential backoff
 * - Request timeout handling
 * - Response type detection
 * - Error handling
 */

import type { HttpResponse, RequestOptions, RetryConfig } from './types.js';

export abstract class BaseHttpClient {
  protected defaultTimeout = 30000;
  protected retryConfig: RetryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    retryOn: [408, 429, 500, 502, 503, 504],
  };

  /**
   * Make HTTP request with retry logic
   */
  async request<T>(url: string, options: RequestOptions): Promise<HttpResponse<T>> {
    const startTime = Date.now();

    try {
      const response = await this.executeRequest(url, options);
      const duration = Date.now() - startTime;
      return await this.handleResponse<T>(response, url, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
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
          duration,
        },
      };
    }
  }

  /**
   * Execute HTTP request with retry logic and exponential backoff
   */
  protected async executeRequest(
    url: string,
    options: RequestOptions,
    attempt = 1
  ): Promise<Response> {
    const headers = this.buildHeaders(options);
    const timeout = options.timeout || this.defaultTimeout;

    // Build request body
    let body: string | undefined;
    if (options.body) {
      if (options.body instanceof URLSearchParams) {
        body = options.body.toString();
      } else if (typeof options.body === 'string') {
        body = options.body;
      } else {
        body = JSON.stringify(options.body);
        // Set JSON content-type if not already set
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: options.method,
        headers,
        body,
        signal: controller.signal,
        redirect: options.followRedirects === false ? 'manual' : 'follow',
      });

      clearTimeout(timeoutId);

      // Check if we should retry
      if (
        this.retryConfig.retryOn.includes(response.status) &&
        attempt < this.retryConfig.maxRetries
      ) {
        // Calculate exponential backoff delay
        const delay = this.retryConfig.retryDelay * Math.pow(2, attempt - 1);
        console.log(`   ⏳ Retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})...`);
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.executeRequest(url, options, attempt + 1);
      }

      return response;
    } catch (error) {
      // Retry on network errors if we haven't exhausted retries
      if (attempt < this.retryConfig.maxRetries) {
        const delay = this.retryConfig.retryDelay * Math.pow(2, attempt - 1);
        console.log(`   ⏳ Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})...`);
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.executeRequest(url, options, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Handle HTTP response and parse based on content type
   */
  protected async handleResponse<T>(
    response: Response,
    url: string,
    duration: number
  ): Promise<HttpResponse<T>> {
    const statusCode = response.status;

    // Handle redirects (302, 301)
    if (statusCode === 302 || statusCode === 301) {
      const location = response.headers.get('location');
      const text = await response.text();

      console.log(`   → Redirect to: ${location || 'See response'}`);

      return {
        success: true,
        data: text as unknown as T,
        meta: {
          statusCode,
          responseType: 'redirect',
          url,
          duration,
        },
      };
    }

    // Get response text
    const text = await response.text();

    // Handle non-OK responses
    if (!response.ok) {
      return {
        success: false,
        error: {
          code: `HTTP_${statusCode}`,
          message: `HTTP ${statusCode}: ${response.statusText}`,
          needsRefresh: statusCode === 401 || statusCode === 403,
        },
        meta: {
          statusCode,
          responseType: 'text',
          url,
          duration,
        },
      };
    }

    // Detect response type
    const contentType = response.headers.get('content-type') || '';
    let responseType: 'json' | 'html' | 'text' = 'text';
    let data: T;

    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(text) as T;
        responseType = 'json';
      } catch {
        // If JSON parsing fails, treat as text
        data = text as unknown as T;
      }
    } else if (contentType.includes('text/html')) {
      data = text as unknown as T;
      responseType = 'html';
    } else {
      data = text as unknown as T;
    }

    return {
      success: true,
      data,
      meta: {
        statusCode,
        responseType,
        url,
        duration,
      },
    };
  }

  /**
   * Subclasses must implement authentication header building
   */
  protected abstract buildHeaders(options: RequestOptions): Record<string, string>;
}
