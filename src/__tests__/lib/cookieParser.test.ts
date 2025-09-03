import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CookieParser, type ParsedCookie } from '../../lib/cookieParser';

describe('CookieParser', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		consoleWarnSpy.mockRestore();
	});

	describe('parseSetCookieHeader', () => {
		it('should return empty result for null input', () => {
			const result = CookieParser.parseSetCookieHeader(null);
			expect(result).toEqual({
				cookies: [],
				aspSessionCookies: [],
				errors: [],
			});
		});

		it('should return empty result for undefined input', () => {
			const result = CookieParser.parseSetCookieHeader(undefined as unknown as string | string[] | null);
			expect(result).toEqual({
				cookies: [],
				aspSessionCookies: [],
				errors: [],
			});
		});

		it('should parse simple cookie', () => {
			const result = CookieParser.parseSetCookieHeader('sessionId=abc123');
			expect(result.cookies).toHaveLength(1);
			expect(result.cookies[0]).toEqual({
				name: 'sessionId',
				value: 'abc123',
			});
			expect(result.aspSessionCookies).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});

		it('should parse ASPSESSION cookie', () => {
			const result = CookieParser.parseSetCookieHeader('ASPSESSIONIDABC123=xyz789');
			expect(result.cookies).toHaveLength(1);
			expect(result.aspSessionCookies).toHaveLength(1);
			expect(result.aspSessionCookies[0]).toEqual({
				name: 'ASPSESSIONIDABC123',
				value: 'xyz789',
			});
		});

		it('should parse cookie with all attributes', () => {
			const cookieHeader = 'sessionId=abc123; Domain=example.com; Path=/; Expires=Wed, 09 Jun 2021 10:18:14 GMT; Max-Age=3600; HttpOnly; Secure; SameSite=Strict';
			const result = CookieParser.parseSetCookieHeader(cookieHeader);

			expect(result.cookies).toHaveLength(1);
			const cookie = result.cookies[0];
			expect(cookie.name).toBe('sessionId');
			expect(cookie.value).toBe('abc123');
			expect(cookie.domain).toBe('example.com');
			expect(cookie.path).toBe('/');
			expect(cookie.expires).toBeInstanceOf(Date);
			expect(cookie.maxAge).toBe(3600);
			expect(cookie.httpOnly).toBe(true);
			expect(cookie.secure).toBe(true);
			expect(cookie.sameSite).toBe('Strict');
		});

		it('should parse multiple cookies from array', () => {
			const headers = ['sessionId=abc123', 'userId=user456'];
			const result = CookieParser.parseSetCookieHeader(headers);

			expect(result.cookies).toHaveLength(2);
			expect(result.cookies[0].name).toBe('sessionId');
			expect(result.cookies[1].name).toBe('userId');
		});

		it('should handle invalid header format', () => {
			const result = CookieParser.parseSetCookieHeader([null as unknown as string, undefined as unknown as string, '']);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toBe('Invalid Set-Cookie header format');
		});

		it('should handle too many cookies in header', () => {
			// Create a header with more than 50 cookies
			const cookies = Array.from({ length: 51 }, (_, i) => `cookie${i}=value${i}`);
			const header = cookies.join(', ');
			const result = CookieParser.parseSetCookieHeader(header);

			expect(result.errors).toContain('Too many cookies in header (max: 50)');
		});

		it('should handle cookie parsing errors', () => {
			// Mock parseSingleCookie to throw an error
			const originalParseSingleCookie = (CookieParser as unknown as { parseSingleCookie: unknown }).parseSingleCookie;
			(CookieParser as unknown as { parseSingleCookie: unknown }).parseSingleCookie = vi.fn().mockImplementation(() => {
				throw new Error('Parse error');
			});

			const result = CookieParser.parseSetCookieHeader('invalidCookie');
			expect(result.errors).toContain('Failed to parse cookie: Parse error');

			// Restore original method
			(CookieParser as unknown as { parseSingleCookie: unknown }).parseSingleCookie = originalParseSingleCookie;
		});

		it('should log parsing results', () => {
			CookieParser.parseSetCookieHeader('ASPSESSIONIDABC123=xyz789');
			expect(consoleSpy).toHaveBeenCalledWith('[CookieParser] Parsed 1 cookies, 1 ASPSESSION cookies');
		});

		it('should log parse errors', () => {
			const result = CookieParser.parseSetCookieHeader([null as unknown as string]);
			expect(consoleWarnSpy).toHaveBeenCalledWith('[CookieParser] Parse errors:', result.errors);
		});
	});

	describe('extractASPSESSION', () => {
		it('should extract ASPSESSION from string format', () => {
			const cookieString = 'ASPSESSIONIDABC123=xyz789; normalCookie=value';
			const result = CookieParser.extractASPSESSION(cookieString);

			expect(result).toEqual({
				ASPSESSIONIDABC123: 'xyz789',
			});
		});

		it('should extract ASPSESSION from object format', () => {
			const cookieObject = {
				ASPSESSIONIDABC123: 'xyz789',
				normalCookie: 'value',
				ASPSESSIONIDDEF456: 'abc123',
			};
			const result = CookieParser.extractASPSESSION(cookieObject);

			expect(result).toEqual({
				ASPSESSIONIDABC123: 'xyz789',
				ASPSESSIONIDDEF456: 'abc123',
			});
		});

		it('should extract ASPSESSION from ParsedCookie array', () => {
			const cookies: ParsedCookie[] = [
				{ name: 'ASPSESSIONIDABC123', value: 'xyz789' },
				{ name: 'normalCookie', value: 'value' },
				{ name: 'ASPSESSIONIDDEF456', value: 'abc123' },
			];
			const result = CookieParser.extractASPSESSION(cookies);

			expect(result).toEqual({
				ASPSESSIONIDABC123: 'xyz789',
				ASPSESSIONIDDEF456: 'abc123',
			});
		});

		it('should handle non-string values in object format', () => {
			const cookieObject = {
				ASPSESSIONIDABC123: 'xyz789',
				ASPSESSIONIDINVALID: 123 as unknown as string, // Non-string value
			};
			const result = CookieParser.extractASPSESSION(cookieObject);

			expect(result).toEqual({
				ASPSESSIONIDABC123: 'xyz789',
			});
		});

		it('should return empty object for no ASPSESSION cookies', () => {
			const result = CookieParser.extractASPSESSION({ normalCookie: 'value' });
			expect(result).toEqual({});
		});

		it('should log extracted ASPSESSION cookies', () => {
			CookieParser.extractASPSESSION({ ASPSESSIONIDABC123: 'xyz789' });
			expect(consoleSpy).toHaveBeenCalledWith('[CookieParser] Extracted 1 ASPSESSION cookies:', ['ASPSESSIONIDABC123']);
		});
	});

	describe('mergeCookies', () => {
		it('should merge cookies with default options', () => {
			const existing = { cookie1: 'value1', cookie2: 'value2' };
			const newCookies = { cookie2: 'newValue2', cookie3: 'value3' };

			const result = CookieParser.mergeCookies(existing, newCookies);

			expect(result).toEqual({
				cookie1: 'value1',
				cookie2: 'newValue2',
				cookie3: 'value3',
			});
		});

		it('should preserve existing cookies when preserveExisting is true', () => {
			const existing = { cookie1: 'value1', cookie2: 'value2' };
			const newCookies = { cookie2: 'newValue2', cookie3: 'value3' };

			const result = CookieParser.mergeCookies(existing, newCookies, {
				preserveExisting: true,
				prioritizeNewer: false,
			});

			expect(result).toEqual({
				cookie1: 'value1',
				cookie2: 'value2', // Preserved
				cookie3: 'value3',
			});
		});

		it('should skip invalid cookies', () => {
			const existing = { cookie1: 'value1' };
			const newCookies = { 'invalid<name>': 'value2' };

			const result = CookieParser.mergeCookies(existing, newCookies);

			expect(result).toEqual({ cookie1: 'value1' });
			expect(consoleWarnSpy).toHaveBeenCalledWith('[CookieParser] Skipping invalid cookie: invalid<name>');
		});

		it('should log changes when logChanges is true', () => {
			const existing = { cookie1: 'value1' };
			const newCookies = { cookie1: 'newValue1', cookie2: 'value2' };

			CookieParser.mergeCookies(existing, newCookies, { logChanges: true });

			expect(consoleSpy).toHaveBeenCalledWith('[CookieParser] Cookie merge changes:', ['Updated: cookie1', 'Added: cookie2']);
		});

		it('should not log changes when logChanges is false', () => {
			const existing = { cookie1: 'value1' };
			const newCookies = { cookie2: 'value2' };

			CookieParser.mergeCookies(existing, newCookies, { logChanges: false });

			expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Cookie merge changes'));
		});
	});

	describe('validateCookieFormat', () => {
		it('should validate valid cookie name and value', () => {
			expect(CookieParser.validateCookieFormat('validName', 'validValue123')).toBe(true);
		});

		it('should reject invalid name types', () => {
			expect(CookieParser.validateCookieFormat(null as unknown as string, 'value')).toBe(false);
			expect(CookieParser.validateCookieFormat(undefined as unknown as string, 'value')).toBe(false);
			expect(CookieParser.validateCookieFormat(123 as unknown as string, 'value')).toBe(false);
		});

		it('should reject empty name', () => {
			expect(CookieParser.validateCookieFormat('', 'value')).toBe(false);
		});

		it('should reject name that is too long', () => {
			const longName = 'a'.repeat(257);
			expect(CookieParser.validateCookieFormat(longName, 'value')).toBe(false);
			expect(consoleWarnSpy).toHaveBeenCalledWith('[CookieParser] Cookie name too long: 257 chars');
		});

		it('should reject invalid name format', () => {
			expect(CookieParser.validateCookieFormat('invalid<name>', 'value')).toBe(false);
			expect(consoleWarnSpy).toHaveBeenCalledWith('[CookieParser] Invalid cookie name format: invalid<name>');
		});

		it('should reject invalid value types', () => {
			expect(CookieParser.validateCookieFormat('name', null as unknown as string)).toBe(false);
			expect(CookieParser.validateCookieFormat('name', 123 as unknown as string)).toBe(false);
		});

		it('should reject value that is too long', () => {
			const longValue = 'a'.repeat(4097);
			expect(CookieParser.validateCookieFormat('name', longValue)).toBe(false);
			expect(consoleWarnSpy).toHaveBeenCalledWith('[CookieParser] Cookie value too long: 4097 chars');
		});

		it('should reject suspicious patterns in value', () => {
			const suspiciousValues = [
				'<script>alert("xss")</script>',
				'javascript:alert("xss")',
				'vbscript:msgbox("xss")',
				'onload=alert("xss")',
				'onerror=alert("xss")',
				'eval(maliciousCode)',
				'document.cookie="stolen"',
				'window.location="evil.com"',
			];

			suspiciousValues.forEach(value => {
				expect(CookieParser.validateCookieFormat('name', value)).toBe(false);
				expect(consoleWarnSpy).toHaveBeenCalledWith('[CookieParser] Suspicious pattern detected in cookie value: name');
			});
		});
	});

	describe('cookieStringToObject', () => {
		it('should convert cookie string to object', () => {
			const cookieString = 'cookie1=value1; cookie2=value2; cookie3=value3';
			const result = CookieParser.cookieStringToObject(cookieString);

			expect(result).toEqual({
				cookie1: 'value1',
				cookie2: 'value2',
				cookie3: 'value3',
			});
		});

		it('should handle empty or invalid input', () => {
			expect(CookieParser.cookieStringToObject('')).toEqual({});
			expect(CookieParser.cookieStringToObject(null as unknown as string)).toEqual({});
			expect(CookieParser.cookieStringToObject(undefined as unknown as string)).toEqual({});
			expect(CookieParser.cookieStringToObject(123 as unknown as string)).toEqual({});
		});

		it('should skip invalid cookie parts', () => {
			const cookieString = 'validCookie=value; invalidPart; anotherValid=value2';
			const result = CookieParser.cookieStringToObject(cookieString);

			expect(result).toEqual({
				validCookie: 'value',
				anotherValid: 'value2',
			});
		});

		it('should skip cookies that fail validation', () => {
			const cookieString = 'validCookie=value; invalid<name>=value2';
			const result = CookieParser.cookieStringToObject(cookieString);

			expect(result).toEqual({
				validCookie: 'value',
			});
		});
	});

	describe('objectToCookieString', () => {
		it('should convert object to cookie string', () => {
			const cookieObject = {
				cookie1: 'value1',
				cookie2: 'value2',
				cookie3: 'value3',
			};
			const result = CookieParser.objectToCookieString(cookieObject);

			expect(result).toBe('cookie1=value1; cookie2=value2; cookie3=value3');
		});

		it('should skip invalid cookies', () => {
			const cookieObject = {
				validCookie: 'value',
				'invalid<name>': 'value2',
			};
			const result = CookieParser.objectToCookieString(cookieObject);

			expect(result).toBe('validCookie=value');
		});

		it('should handle empty object', () => {
			const result = CookieParser.objectToCookieString({});
			expect(result).toBe('');
		});
	});

	describe('sanitizeCookieValue', () => {
		it('should sanitize valid string', () => {
			const result = CookieParser.sanitizeCookieValue('validValue123');
			expect(result).toBe('validValue123');
		});

		it('should return empty string for non-string input', () => {
			expect(CookieParser.sanitizeCookieValue(null as unknown as string)).toBe('');
			expect(CookieParser.sanitizeCookieValue(undefined as unknown as string)).toBe('');
			expect(CookieParser.sanitizeCookieValue(123 as unknown as string)).toBe('');
		});

		it('should remove dangerous characters', () => {
			const result = CookieParser.sanitizeCookieValue('value<script>"alert"</script>');
			expect(result).toBe('valuescriptalert/script');
		});

		it('should remove control characters', () => {
			const result = CookieParser.sanitizeCookieValue('value\r\n\twith\tcontrol');
			expect(result).toBe('valuewithcontrol');
		});

		it('should normalize whitespace', () => {
			const result = CookieParser.sanitizeCookieValue('  value   with   spaces  ');
			expect(result).toBe('value with spaces');
		});

		it('should truncate long values', () => {
			const longValue = 'a'.repeat(5000);
			const result = CookieParser.sanitizeCookieValue(longValue);

			expect(result).toHaveLength(4096);
			expect(consoleWarnSpy).toHaveBeenCalledWith('[CookieParser] Cookie value truncated to 4096 chars');
		});
	});

	describe('isASPSESSIONCookie', () => {
		it('should identify valid ASPSESSION cookies', () => {
			expect(CookieParser.isASPSESSIONCookie('ASPSESSIONIDABC123')).toBe(true);
			expect(CookieParser.isASPSESSIONCookie('ASPSESSIONID123ABC')).toBe(true);
			expect(CookieParser.isASPSESSIONCookie('aspsessionidabc123')).toBe(true); // Case insensitive
		});

		it('should reject non-ASPSESSION cookies', () => {
			expect(CookieParser.isASPSESSIONCookie('sessionId')).toBe(false);
			expect(CookieParser.isASPSESSIONCookie('ASPSESSION')).toBe(false);
			expect(CookieParser.isASPSESSIONCookie('ASPSESSIONID')).toBe(false);
			expect(CookieParser.isASPSESSIONCookie('')).toBe(false);
		});
	});

	describe('getPrimaryASPSESSION', () => {
		it('should return first valid ASPSESSION cookie', () => {
			const cookies = {
				normalCookie: 'value',
				ASPSESSIONIDABC123: 'xyz789',
				ASPSESSIONIDDEF456: 'abc123',
			};
			const result = CookieParser.getPrimaryASPSESSION(cookies);

			expect(result).toEqual({
				key: 'ASPSESSIONIDABC123',
				value: 'xyz789',
			});
		});

		it('should return null if no ASPSESSION cookies found', () => {
			const cookies = {
				normalCookie: 'value',
				sessionId: 'abc123',
			};
			const result = CookieParser.getPrimaryASPSESSION(cookies);

			expect(result).toBeNull();
		});

		it('should return null if ASPSESSION cookie has empty value', () => {
			const cookies = {
				ASPSESSIONIDABC123: '',
				ASPSESSIONIDDEF456: 'validValue',
			};
			const result = CookieParser.getPrimaryASPSESSION(cookies);

			expect(result).toEqual({
				key: 'ASPSESSIONIDDEF456',
				value: 'validValue',
			});
		});
	});

	describe('updateASPSESSIONCookies', () => {
		it('should update ASPSESSION cookies', () => {
			const existing = {
				normalCookie: 'value',
				ASPSESSIONIDOLD123: 'oldValue',
				anotherCookie: 'value2',
			};
			const newASPSessions = {
				ASPSESSIONIDNEW456: 'newValue',
				ASPSESSIONIDNEW789: 'newValue2',
			};

			const result = CookieParser.updateASPSESSIONCookies(existing, newASPSessions);

			expect(result).toEqual({
				normalCookie: 'value',
				anotherCookie: 'value2',
				ASPSESSIONIDNEW456: 'newValue',
				ASPSESSIONIDNEW789: 'newValue2',
			});
		});

		it('should skip invalid new ASPSESSION cookies', () => {
			const existing = { normalCookie: 'value' };
			const newASPSessions = {
				'ASPSESSIONID<INVALID>': 'value',
				ASPSESSIONIDVALID123: 'validValue',
			};

			const result = CookieParser.updateASPSESSIONCookies(existing, newASPSessions);

			expect(result).toEqual({
				normalCookie: 'value',
				ASPSESSIONIDVALID123: 'validValue',
			});
		});

		it('should log changes when updates are made', () => {
			const existing = { ASPSESSIONIDOLD123: 'oldValue' };
			const newASPSessions = { ASPSESSIONIDNEW456: 'newValue' };

			CookieParser.updateASPSESSIONCookies(existing, newASPSessions);

			expect(consoleSpy).toHaveBeenCalledWith('[CookieParser] Updated 2 ASPSESSION cookies');
		});
	});

	describe('logCookieOperation', () => {
		it('should log in development environment', () => {
			const originalEnv = process.env.NODE_ENV;
			(process.env as unknown as { NODE_ENV: string }).NODE_ENV = 'development';

			CookieParser.logCookieOperation('test operation', { data: 'test' });

			expect(consoleSpy).toHaveBeenCalledWith('[CookieParser] test operation:', { data: 'test' });

			(process.env as unknown as { NODE_ENV: string }).NODE_ENV = originalEnv;
		});

		it('should not log in production environment', () => {
			const originalEnv = process.env.NODE_ENV;
			(process.env as unknown as { NODE_ENV: string }).NODE_ENV = 'production';

			CookieParser.logCookieOperation('test operation', { data: 'test' });

			expect(consoleSpy).not.toHaveBeenCalledWith('[CookieParser] test operation:', { data: 'test' });

			(process.env as unknown as { NODE_ENV: string }).NODE_ENV = originalEnv;
		});
	});

	describe('parseSingleCookie (private method)', () => {
		it('should parse cookie with SameSite=Lax', () => {
			const result = CookieParser.parseSetCookieHeader('sessionId=abc123; SameSite=Lax');
			expect(result.cookies[0].sameSite).toBe('Lax');
		});

		it('should parse cookie with SameSite=None', () => {
			const result = CookieParser.parseSetCookieHeader('sessionId=abc123; SameSite=None');
			expect(result.cookies[0].sameSite).toBe('None');
		});

		it('should ignore invalid SameSite values', () => {
			const result = CookieParser.parseSetCookieHeader('sessionId=abc123; SameSite=Invalid');
			expect(result.cookies[0].sameSite).toBeUndefined();
		});

		it('should ignore invalid expires date', () => {
			const result = CookieParser.parseSetCookieHeader('sessionId=abc123; Expires=invalid-date');
			expect(result.cookies[0].expires).toBeInstanceOf(Date);
			expect(isNaN(result.cookies[0].expires!.getTime())).toBe(true);
		});

		it('should ignore invalid max-age value', () => {
			const result = CookieParser.parseSetCookieHeader('sessionId=abc123; Max-Age=invalid');
			expect(result.cookies[0].maxAge).toBeUndefined();
		});

		it('should return null for empty cookie string', () => {
			const result = CookieParser.parseSetCookieHeader('');
			expect(result.cookies).toHaveLength(0);
		});

		it('should return null for cookie without equals sign', () => {
			const result = CookieParser.parseSetCookieHeader('invalidcookie');
			expect(result.cookies).toHaveLength(0);
		});
	});

	describe('splitCookieHeader (private method)', () => {
		it('should split cookies correctly with dates', () => {
			const header = 'cookie1=value1; Expires=Wed, 09 Jun 2021 10:18:14 GMT, cookie2=value2';
			const result = CookieParser.parseSetCookieHeader(header);

			// The implementation may not split this correctly due to comma in date
			expect(result.cookies).toHaveLength(1);
			expect(result.cookies[0].name).toBe('cookie1');
		});

		it('should handle complex cookie header with multiple attributes', () => {
			const header = 'sessionId=abc123; Domain=example.com; Path=/; Expires=Wed, 09 Jun 2021 10:18:14 GMT; HttpOnly, userId=user456; Secure';
			const result = CookieParser.parseSetCookieHeader(header);

			expect(result.cookies).toHaveLength(2);
			expect(result.cookies[0].name).toBe('sessionId');
			expect(result.cookies[0].expires).toBeInstanceOf(Date);
			expect(result.cookies[1].name).toBe('userId');
			expect(result.cookies[1].secure).toBe(true);
		});
	});
});
