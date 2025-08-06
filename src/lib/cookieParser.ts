// src/lib/cookieParser.ts

/**
 * Comprehensive Cookie Parser for MIO TV Scripts
 * 
 * Handles robust parsing of cookies, especially dynamic ASPSESSION names
 * used by MarketInOut (MIO) platform. Provides security validation,
 * sanitization, and conversion utilities.
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

/**
 * Centralized Cookie Parser with robust ASPSESSION detection
 */
export class CookieParser {
	// Regex patterns for cookie parsing
	private static readonly ASPSESSION_PATTERN = /^ASPSESSIONID[A-Z0-9]+$/i;
	private static readonly COOKIE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
	private static readonly COOKIE_VALUE_PATTERN = /^[a-zA-Z0-9+/=._-]*$/;
	
	// Security constraints
	private static readonly MAX_COOKIE_NAME_LENGTH = 256;
	private static readonly MAX_COOKIE_VALUE_LENGTH = 4096;
	private static readonly MAX_COOKIES_PER_HEADER = 50;
	
	// Common suspicious patterns to detect
	private static readonly SUSPICIOUS_PATTERNS = [
		/<script/i,
		/javascript:/i,
		/vbscript:/i,
		/onload=/i,
		/onerror=/i,
		/eval\(/i,
		/document\./i,
		/window\./i,
	];

	/**
	 * Parse Set-Cookie header(s) into structured cookie objects
	 * Handles multiple cookies in a single header and multiple headers
	 */
	static parseSetCookieHeader(setCookieHeader: string | string[] | null): CookieParseResult {
		const result: CookieParseResult = {
			cookies: [],
			aspSessionCookies: [],
			errors: [],
		};

		if (!setCookieHeader) {
			return result;
		}

		// Normalize to array
		const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
		
		for (const header of headers) {
			if (!header || typeof header !== 'string') {
				result.errors.push('Invalid Set-Cookie header format');
				continue;
			}

			// Split by comma, but be careful about dates that contain commas
			const cookieStrings = this.splitCookieHeader(header);
			
			if (cookieStrings.length > this.MAX_COOKIES_PER_HEADER) {
				result.errors.push(`Too many cookies in header (max: ${this.MAX_COOKIES_PER_HEADER})`);
				continue;
			}

			for (const cookieString of cookieStrings) {
				try {
					const cookie = this.parseSingleCookie(cookieString.trim());
					if (cookie) {
						result.cookies.push(cookie);
						
						// Check if it's an ASPSESSION cookie
						if (this.isASPSESSIONCookie(cookie.name)) {
							result.aspSessionCookies.push(cookie);
						}
					}
				} catch (error) {
					result.errors.push(`Failed to parse cookie: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			}
		}

		console.log(`[CookieParser] Parsed ${result.cookies.length} cookies, ${result.aspSessionCookies.length} ASPSESSION cookies`);
		if (result.errors.length > 0) {
			console.warn(`[CookieParser] Parse errors:`, result.errors);
		}

		return result;
	}

	/**
	 * Extract all ASPSESSION cookies from various input formats
	 */
	static extractASPSESSION(input: string | { [key: string]: string } | ParsedCookie[]): { [key: string]: string } {
		const aspSessions: { [key: string]: string } = {};

		if (typeof input === 'string') {
			// Parse cookie string format
			const cookieObject = this.cookieStringToObject(input);
			return this.extractASPSESSION(cookieObject);
		} else if (Array.isArray(input)) {
			// Handle ParsedCookie array
			for (const cookie of input) {
				if (this.isASPSESSIONCookie(cookie.name)) {
					aspSessions[cookie.name] = cookie.value;
				}
			}
		} else if (typeof input === 'object' && input !== null) {
			// Handle object format
			for (const [name, value] of Object.entries(input)) {
				if (this.isASPSESSIONCookie(name) && typeof value === 'string') {
					aspSessions[name] = value;
				}
			}
		}

		const count = Object.keys(aspSessions).length;
		if (count > 0) {
			console.log(`[CookieParser] Extracted ${count} ASPSESSION cookies:`, Object.keys(aspSessions));
		}

		return aspSessions;
	}

	/**
	 * Merge cookies, handling conflicts and updates intelligently
	 */
	static mergeCookies(
		existingCookies: { [key: string]: string },
		newCookies: { [key: string]: string },
		options: CookieMergeOptions = {}
	): { [key: string]: string } {
		const {
			preserveExisting = false,
			prioritizeNewer = true,
			logChanges = true,
		} = options;

		const merged = { ...existingCookies };
		const changes: string[] = [];

		for (const [name, value] of Object.entries(newCookies)) {
			// Validate cookie before merging
			if (!this.validateCookieFormat(name, value)) {
				console.warn(`[CookieParser] Skipping invalid cookie: ${name}`);
				continue;
			}

			const existingValue = merged[name];
			
			if (!existingValue) {
				// New cookie
				merged[name] = value;
				changes.push(`Added: ${name}`);
			} else if (existingValue !== value) {
				// Cookie value changed
				if (preserveExisting && !prioritizeNewer) {
					// Keep existing value
					changes.push(`Preserved existing: ${name}`);
				} else {
					// Update with new value
					merged[name] = value;
					changes.push(`Updated: ${name}`);
				}
			}
		}

		if (logChanges && changes.length > 0) {
			console.log(`[CookieParser] Cookie merge changes:`, changes);
		}

		return merged;
	}

	/**
	 * Validate cookie name and value format for security
	 */
	static validateCookieFormat(name: string, value: string): boolean {
		// Check name constraints
		if (!name || typeof name !== 'string') {
			return false;
		}

		if (name.length > this.MAX_COOKIE_NAME_LENGTH) {
			console.warn(`[CookieParser] Cookie name too long: ${name.length} chars`);
			return false;
		}

		if (!this.COOKIE_NAME_PATTERN.test(name)) {
			console.warn(`[CookieParser] Invalid cookie name format: ${name}`);
			return false;
		}

		// Check value constraints
		if (typeof value !== 'string') {
			return false;
		}

		if (value.length > this.MAX_COOKIE_VALUE_LENGTH) {
			console.warn(`[CookieParser] Cookie value too long: ${value.length} chars`);
			return false;
		}

		// Check for suspicious patterns
		for (const pattern of this.SUSPICIOUS_PATTERNS) {
			if (pattern.test(value)) {
				console.warn(`[CookieParser] Suspicious pattern detected in cookie value: ${name}`);
				return false;
			}
		}

		return true;
	}

	/**
	 * Convert cookie string to object format
	 */
	static cookieStringToObject(cookieString: string): { [key: string]: string } {
		const cookies: { [key: string]: string } = {};
		
		if (!cookieString || typeof cookieString !== 'string') {
			return cookies;
		}

		// Split by semicolon and parse each cookie
		const parts = cookieString.split(';');
		
		for (const part of parts) {
			const trimmed = part.trim();
			if (!trimmed) continue;

			const equalIndex = trimmed.indexOf('=');
			if (equalIndex === -1) continue;

			const name = trimmed.substring(0, equalIndex).trim();
			const value = trimmed.substring(equalIndex + 1).trim();

			if (this.validateCookieFormat(name, value)) {
				cookies[name] = value;
			}
		}

		return cookies;
	}

	/**
	 * Convert object format to cookie string
	 */
	static objectToCookieString(cookieObject: { [key: string]: string }): string {
		const cookieParts: string[] = [];

		for (const [name, value] of Object.entries(cookieObject)) {
			if (this.validateCookieFormat(name, value)) {
				cookieParts.push(`${name}=${value}`);
			}
		}

		return cookieParts.join('; ');
	}

	/**
	 * Sanitize cookie value for security
	 */
	static sanitizeCookieValue(value: string): string {
		if (typeof value !== 'string') {
			return '';
		}

		// Remove potentially dangerous characters
		let sanitized = value
			.replace(/[<>'"]/g, '') // Remove HTML/JS injection chars
			.replace(/[\r\n\t]/g, '') // Remove control characters
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();

		// Limit length
		if (sanitized.length > this.MAX_COOKIE_VALUE_LENGTH) {
			sanitized = sanitized.substring(0, this.MAX_COOKIE_VALUE_LENGTH);
			console.warn(`[CookieParser] Cookie value truncated to ${this.MAX_COOKIE_VALUE_LENGTH} chars`);
		}

		return sanitized;
	}

	/**
	 * Check if a cookie name matches ASPSESSION pattern
	 */
	static isASPSESSIONCookie(name: string): boolean {
		return this.ASPSESSION_PATTERN.test(name);
	}

	/**
	 * Get the primary ASPSESSION cookie from a collection
	 * Returns the first valid ASPSESSION cookie found
	 */
	static getPrimaryASPSESSION(cookies: { [key: string]: string }): { key: string; value: string } | null {
		for (const [name, value] of Object.entries(cookies)) {
			if (this.isASPSESSIONCookie(name) && value) {
				return { key: name, value };
			}
		}
		return null;
	}

	/**
	 * Update ASPSESSION cookies in existing cookie collection
	 */
	static updateASPSESSIONCookies(
		existingCookies: { [key: string]: string },
		newASPSessions: { [key: string]: string }
	): { [key: string]: string } {
		const updated = { ...existingCookies };
		let changeCount = 0;

		// Remove old ASPSESSION cookies
		for (const name of Object.keys(updated)) {
			if (this.isASPSESSIONCookie(name)) {
				delete updated[name];
				changeCount++;
			}
		}

		// Add new ASPSESSION cookies
		for (const [name, value] of Object.entries(newASPSessions)) {
			if (this.isASPSESSIONCookie(name) && this.validateCookieFormat(name, value)) {
				updated[name] = value;
				changeCount++;
			}
		}

		if (changeCount > 0) {
			console.log(`[CookieParser] Updated ${changeCount} ASPSESSION cookies`);
		}

		return updated;
	}

	/**
	 * Parse a single cookie string into ParsedCookie object
	 */
	private static parseSingleCookie(cookieString: string): ParsedCookie | null {
		if (!cookieString) return null;

		const parts = cookieString.split(';').map(part => part.trim());
		if (parts.length === 0) return null;

		// First part is name=value
		const nameValuePart = parts[0];
		const equalIndex = nameValuePart.indexOf('=');
		if (equalIndex === -1) return null;

		const name = nameValuePart.substring(0, equalIndex).trim();
		const value = nameValuePart.substring(equalIndex + 1).trim();

		if (!this.validateCookieFormat(name, value)) {
			return null;
		}

		const cookie: ParsedCookie = { name, value };

		// Parse attributes
		for (let i = 1; i < parts.length; i++) {
			const part = parts[i];
			const attrEqualIndex = part.indexOf('=');
			
			if (attrEqualIndex === -1) {
				// Boolean attributes
				const attr = part.toLowerCase();
				if (attr === 'httponly') cookie.httpOnly = true;
				else if (attr === 'secure') cookie.secure = true;
			} else {
				// Key-value attributes
				const attrName = part.substring(0, attrEqualIndex).trim().toLowerCase();
				const attrValue = part.substring(attrEqualIndex + 1).trim();

				switch (attrName) {
					case 'domain':
						cookie.domain = attrValue;
						break;
					case 'path':
						cookie.path = attrValue;
						break;
					case 'expires':
						try {
							cookie.expires = new Date(attrValue);
						} catch {
							// Invalid date, ignore
						}
						break;
					case 'max-age':
						const maxAge = parseInt(attrValue, 10);
						if (!isNaN(maxAge)) {
							cookie.maxAge = maxAge;
						}
						break;
					case 'samesite':
						const sameSite = attrValue as 'Strict' | 'Lax' | 'None';
						if (['Strict', 'Lax', 'None'].includes(sameSite)) {
							cookie.sameSite = sameSite;
						}
						break;
				}
			}
		}

		return cookie;
	}

	/**
	 * Split cookie header by comma, handling dates correctly
	 */
	private static splitCookieHeader(header: string): string[] {
		const cookies: string[] = [];
		let current = '';
		let inDate = false;

		for (let i = 0; i < header.length; i++) {
			const char = header[i];
			
			if (char === ',' && !inDate) {
				// End of cookie
				if (current.trim()) {
					cookies.push(current.trim());
				}
				current = '';
			} else {
				current += char;
				
				// Track if we're inside a date value
				if (char === '=' && current.toLowerCase().includes('expires')) {
					inDate = true;
				} else if (char === ';' && inDate) {
					inDate = false;
				}
			}
		}

		// Add the last cookie
		if (current.trim()) {
			cookies.push(current.trim());
		}

		return cookies;
	}

	/**
	 * Log cookie parsing operation for debugging
	 */
	static logCookieOperation(operation: string, details: unknown): void {
		if (process.env.NODE_ENV === 'development') {
			console.log(`[CookieParser] ${operation}:`, details);
		}
	}
}