/**
 * Cookie Types and Interfaces
 *
 * Defines types and interfaces for cookie parsing and manipulation
 */

export interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface CookieParseResult {
  cookies: ParsedCookie[];
  aspSessionCookies: ParsedCookie[];
  errors: string[];
}

export interface CookieMergeOptions {
  preserveExisting?: boolean;
  prioritizeNewer?: boolean;
  logChanges?: boolean;
}
