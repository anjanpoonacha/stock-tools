/**
 * HTTP Client Types
 * 
 * Common types used across all HTTP clients
 */

export interface HttpResponse<T = unknown> {
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
    duration: number;
  };
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: URLSearchParams | string | Record<string, any>;
  timeout?: number;
  followRedirects?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryOn: number[]; // HTTP status codes to retry
}
