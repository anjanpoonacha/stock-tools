/**
 * Validators Unit Tests
 * 
 * Pure unit tests for validation functions with no external dependencies.
 */

import { describe, it, expect } from 'vitest';
import { validateChartDataRequest, validateUserCredentials } from './validators';

describe('validateChartDataRequest', () => {
	describe('barsCount validation', () => {
		it('should reject barsCount > 2000', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', '2500');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('between 1 and 2000');
		});
		
		it('should reject barsCount = 0', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', '0');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('between 1 and 2000');
		});
		
		it('should reject negative barsCount', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', '-50');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('between 1 and 2000');
		});
		
		it('should reject non-numeric barsCount', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', 'abc');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('between 1 and 2000');
		});
		
		it('should accept barsCount = 1', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', '1');
			expect(result.valid).toBe(true);
			expect(result.params?.barsCount).toBe(1);
		});
		
		it('should accept barsCount = 300', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', '300');
			expect(result.valid).toBe(true);
			expect(result.params?.barsCount).toBe(300);
		});
		
		it('should accept barsCount = 1000 (verified via API testing)', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', '1000');
			expect(result.valid).toBe(true);
			expect(result.params?.barsCount).toBe(1000);
		});
		
		it('should accept barsCount = 2000 (max verified via API testing)', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', '2000');
			expect(result.valid).toBe(true);
			expect(result.params?.barsCount).toBe(2000);
		});
		
		it('should parse barsCount as integer', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', '150');
			expect(result.valid).toBe(true);
			expect(result.params?.barsCount).toBe(150);
			expect(typeof result.params?.barsCount).toBe('number');
		});
		
		it('should default barsCount to 300 when null', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1D', null);
			expect(result.valid).toBe(true);
			expect(result.params?.barsCount).toBe(300);
		});
	});
	
	describe('symbol validation', () => {
		it('should default symbol to NSE:JUNIPER when null', () => {
			const result = validateChartDataRequest(null, '1D', '100');
			expect(result.valid).toBe(true);
			expect(result.params?.symbol).toBe('NSE:JUNIPER');
		});
		
		it('should accept custom symbol', () => {
			const result = validateChartDataRequest('NSE:RELIANCE', '1D', '200');
			expect(result.valid).toBe(true);
			expect(result.params?.symbol).toBe('NSE:RELIANCE');
		});
		
		it('should accept symbol with colon', () => {
			const result = validateChartDataRequest('NYSE:AAPL', '1D', '100');
			expect(result.valid).toBe(true);
			expect(result.params?.symbol).toBe('NYSE:AAPL');
		});
	});
	
	describe('resolution validation', () => {
		it('should default resolution to 1D when null', () => {
			const result = validateChartDataRequest('NSE:RELIANCE', null, '200');
			expect(result.valid).toBe(true);
			expect(result.params?.resolution).toBe('1D');
		});
		
		it('should accept custom resolution', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '1W', '100');
			expect(result.valid).toBe(true);
			expect(result.params?.resolution).toBe('1W');
		});
		
		it('should accept minute resolution', () => {
			const result = validateChartDataRequest('NSE:JUNIPER', '5', '100');
			expect(result.valid).toBe(true);
			expect(result.params?.resolution).toBe('5');
		});
	});
	
	describe('combined defaults', () => {
		it('should apply all defaults when all params are null', () => {
			const result = validateChartDataRequest(null, null, null);
			expect(result.valid).toBe(true);
			expect(result.params?.symbol).toBe('NSE:JUNIPER');
			expect(result.params?.resolution).toBe('1D');
			expect(result.params?.barsCount).toBe(300);
		});
	});
});

describe('validateUserCredentials', () => {
	describe('missing credentials', () => {
		it('should reject missing email', () => {
			const result = validateUserCredentials(null, 'password');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Missing authentication credentials');
		});
		
		it('should reject missing password', () => {
			const result = validateUserCredentials('user@example.com', null);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Missing authentication credentials');
		});
		
		it('should reject undefined email', () => {
			const result = validateUserCredentials(undefined, 'password');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Missing authentication credentials');
		});
		
		it('should reject undefined password', () => {
			const result = validateUserCredentials('user@example.com', undefined);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Missing authentication credentials');
		});
		
		it('should reject empty string email', () => {
			const result = validateUserCredentials('', 'password');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Missing authentication credentials');
		});
		
		it('should reject empty string password', () => {
			const result = validateUserCredentials('user@example.com', '');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Missing authentication credentials');
		});
		
		it('should reject both missing', () => {
			const result = validateUserCredentials(null, null);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Missing authentication credentials');
		});
	});
	
	describe('invalid credential types', () => {
		it('should reject number as email', () => {
			const result = validateUserCredentials(12345, 'password');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid credential types');
		});
		
		it('should reject number as password', () => {
			const result = validateUserCredentials('user@example.com', 12345);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid credential types');
		});
		
		it('should reject object as email', () => {
			const result = validateUserCredentials({ email: 'test' }, 'password');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid credential types');
		});
		
		it('should reject array as password', () => {
			const result = validateUserCredentials('user@example.com', ['password']);
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid credential types');
		});
	});
	
	describe('valid credentials', () => {
		it('should accept valid credentials', () => {
			const result = validateUserCredentials('user@example.com', 'password123');
			expect(result.valid).toBe(true);
			expect(result.credentials?.userEmail).toBe('user@example.com');
			expect(result.credentials?.userPassword).toBe('password123');
		});
		
		it('should accept email with special characters', () => {
			const result = validateUserCredentials('user+tag@example.com', 'password123');
			expect(result.valid).toBe(true);
			expect(result.credentials?.userEmail).toBe('user+tag@example.com');
		});
		
		it('should accept password with special characters', () => {
			const result = validateUserCredentials('user@example.com', 'P@ssw0rd!123');
			expect(result.valid).toBe(true);
			expect(result.credentials?.userPassword).toBe('P@ssw0rd!123');
		});
		
		it('should not trim or modify credentials', () => {
			const result = validateUserCredentials(' user@example.com ', ' password ');
			expect(result.valid).toBe(true);
			expect(result.credentials?.userEmail).toBe(' user@example.com ');
			expect(result.credentials?.userPassword).toBe(' password ');
		});
	});
});
