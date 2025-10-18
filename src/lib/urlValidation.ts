/**
 * URL validation utilities for screener URLs
 */

export interface UrlValidationResult {
	isValid: boolean;
	error?: string;
}

/**
 * Validates a screener URL for basic format and security requirements
 */
export function validateScreenerUrl(url: string): UrlValidationResult {
	// Check if URL is provided
	if (!url || url.trim().length === 0) {
		return {
			isValid: false,
			error: 'URL is required'
		};
	}

	const trimmedUrl = url.trim();

	// Check URL length (reasonable limit)
	if (trimmedUrl.length > 2048) {
		return {
			isValid: false,
			error: 'URL is too long (maximum 2048 characters)'
		};
	}

	// Try to parse as URL
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(trimmedUrl);
	} catch {
		return {
			isValid: false,
			error: 'Invalid URL format'
		};
	}

	// Check protocol (only HTTP/HTTPS allowed)
	if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
		return {
			isValid: false,
			error: 'Only HTTP and HTTPS URLs are allowed'
		};
	}

	// Check for localhost/private IPs in production (basic security)
	const hostname = parsedUrl.hostname.toLowerCase();
	const privatePatterns = [
		'localhost',
		'127.0.0.1',
		'0.0.0.0',
		'::1'
	];

	if (privatePatterns.some(pattern => hostname === pattern || hostname.startsWith(pattern + '.'))) {
		return {
			isValid: false,
			error: 'Local URLs are not allowed'
		};
	}

	// Check for private IP ranges (basic check)
	if (hostname.match(/^10\./) || hostname.match(/^192\.168\./) || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
		return {
			isValid: false,
			error: 'Private IP addresses are not allowed'
		};
	}

	return {
		isValid: true
	};
}

/**
 * Validates a screener URL name
 */
export function validateScreenerUrlName(name: string): UrlValidationResult {
	if (!name || name.trim().length === 0) {
		return {
			isValid: false,
			error: 'Name is required'
		};
	}

	const trimmedName = name.trim();

	if (trimmedName.length > 100) {
		return {
			isValid: false,
			error: 'Name is too long (maximum 100 characters)'
		};
	}

	// Check for basic special characters that might cause issues
	if (trimmedName.includes('<') || trimmedName.includes('>') || trimmedName.includes('"')) {
		return {
			isValid: false,
			error: 'Name contains invalid characters'
		};
	}

	return {
		isValid: true
	};
}

/**
 * Sanitizes a URL name by trimming and removing potentially problematic characters
 */
export function sanitizeUrlName(name: string): string {
	return name.trim().replace(/[<>"]/g, '');
}

/**
 * Sanitizes a URL by trimming whitespace
 */
export function sanitizeUrl(url: string): string {
	return url.trim();
}
